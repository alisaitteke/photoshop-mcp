import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { prefixExtendScriptBom } from '../utils/extendscript-file.js';
import { parseExtendScriptPayload } from '../utils/extendscript-result.js';
import { Logger } from '../utils/logger.js';
import { ScriptExecutor } from './script-executor.js';
import {
  DEFAULT_SCRIPT_TIMEOUT_MS,
  QUEUE_WAIT_ALLOWANCE_MS,
  isScriptTimeoutError,
  resolveScriptTimeoutMs,
} from './script-timeout.js';
import {
  WINDOWS_JSX_ENV,
  WINDOWS_RESULT_ENV,
  buildWindowsBridgeScript,
  readWindowsResultFile,
} from './windows-script-bridge.js';

const execAsync = promisify(exec);

/** Extra grace before Node kills cscript, beyond the advertised tool timeout. */
const KILL_GRACE_MS = 5000;

function isExecTimeout(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const execError = error as { killed?: boolean; signal?: NodeJS.Signals | null };
    if (execError.killed || execError.signal) return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return isScriptTimeoutError(message) || /killed/i.test(message);
}

interface QueuedScript {
  cancelled: boolean;
  run: () => Promise<void>;
}

export class WindowsExecutor implements ScriptExecutor {
  private logger: Logger;
  private scriptQueue: QueuedScript[] = [];
  private isProcessing = false;

  constructor() {
    this.logger = new Logger('WindowsExecutor');
  }

  async execute(script: string, timeout?: number): Promise<unknown> {
    const timeoutMs = resolveScriptTimeoutMs(timeout);
    return new Promise((resolve, reject) => {
      // Two-phase timeout, matching macOS: queue wait does not eat run time,
      // and a cancelled queued task must never execute.
      const entry: QueuedScript = {
        cancelled: false,
        run: async () => {
          clearTimeout(waitTimer);

          let timedOut = false;
          const execTimer = setTimeout(() => {
            timedOut = true;
            reject(new Error('Script execution timeout'));
          }, timeoutMs);

          try {
            const result = await this.executeScript(script, timeoutMs);
            clearTimeout(execTimer);
            if (!timedOut) {
              resolve(result);
            }
          } catch (error) {
            clearTimeout(execTimer);
            if (!timedOut) {
              reject(error);
            }
            throw error;
          }
        },
      };

      const waitTimer = setTimeout(() => {
        entry.cancelled = true;
        reject(
          new Error(
            `Script timed out after ${timeoutMs + QUEUE_WAIT_ALLOWANCE_MS}ms waiting in the execution queue`
          )
        );
      }, timeoutMs + QUEUE_WAIT_ALLOWANCE_MS);

      this.scriptQueue.push(entry);
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.scriptQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.scriptQueue.length > 0) {
      const task = this.scriptQueue.shift();
      if (!task || task.cancelled) {
        continue;
      }
      try {
        await task.run();
      } catch (error) {
        this.logger.error('Script execution failed:', error);
      }
    }

    this.isProcessing = false;
  }

  private async executeScript(
    script: string,
    timeout: number = DEFAULT_SCRIPT_TIMEOUT_MS
  ): Promise<unknown> {
    const stamp = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const tempScriptPath = join(tmpdir(), `photoshop-script-${stamp}.jsx`);
    const vbsPath = join(tmpdir(), `photoshop-vbs-${stamp}.vbs`);
    const resultPath = join(tmpdir(), `photoshop-result-${stamp}.txt`);

    try {
      await writeFile(tempScriptPath, prefixExtendScriptBom(script), 'utf8');
      await writeFile(vbsPath, buildWindowsBridgeScript(), 'utf8');

      try {
        const { stderr } = await execAsync(`cscript //nologo "${vbsPath}"`, {
          timeout: timeout + KILL_GRACE_MS,
          killSignal: 'SIGKILL',
          env: {
            ...process.env,
            [WINDOWS_JSX_ENV]: tempScriptPath,
            [WINDOWS_RESULT_ENV]: resultPath,
          },
        });

        if (stderr) {
          this.logger.warn('Script execution warning:', stderr);
        }
      } catch (error) {
        if (isExecTimeout(error)) {
          throw new Error('Script execution timeout');
        }
        const fromFile = await readWindowsResultFile(resultPath);
        if (fromFile !== null) {
          return this.parseResult(fromFile);
        }
        throw error;
      }

      const fromFile = await readWindowsResultFile(resultPath);
      if (fromFile === null) {
        throw new Error('Photoshop script produced no result');
      }
      return this.parseResult(fromFile);
    } finally {
      await unlink(vbsPath).catch(() => {});
      await unlink(tempScriptPath).catch(() => {});
      await unlink(resultPath).catch(() => {});
    }
  }

  private parseResult(output: string): unknown {
    const trimmed = output.trim();

    if (trimmed.startsWith('ERROR:')) {
      throw new Error(trimmed.substring(6).trim());
    }

    return parseExtendScriptPayload(trimmed);
  }

  async isPhotoshopRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq Photoshop.exe"');
      return stdout.toLowerCase().includes('photoshop.exe');
    } catch {
      return false;
    }
  }

  async launchPhotoshop(photoshopPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.info(`Launching Photoshop: ${photoshopPath}`);

      const child = spawn(photoshopPath, [], {
        detached: true,
        stdio: 'ignore',
      });

      child.unref();

      setTimeout(() => {
        resolve();
      }, 5000);

      child.on('error', (error) => {
        reject(new Error(`Failed to launch Photoshop: ${error.message}`));
      });
    });
  }
}
