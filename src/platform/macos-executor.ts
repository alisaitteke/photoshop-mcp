import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Logger } from '../utils/logger.js';
import { prefixExtendScriptBom } from '../utils/extendscript-file.js';
import { parseExtendScriptPayload } from '../utils/extendscript-result.js';
import { ScriptExecutor } from './script-executor.js';

const execAsync = promisify(exec);

/** Escape a string for use as a pgrep -f pattern (extended regex). */
export function escapeForPgrep(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function envTruthy(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

/** Slack added to the AppleScript-side timeout beyond the tool timeout, so the
 * JSX gets its full advertised budget plus Apple-event overhead. */
const APPLESCRIPT_TIMEOUT_MARGIN_SECONDS = 5;

/** Extra grace before Node SIGKILLs osascript, beyond the AppleScript timeout.
 * Keeps the AppleScript timeout strictly below the hard kill so Photoshop gets
 * a clean AppleEvent timeout error instead of a dead pipe. */
const KILL_GRACE_MS = 5000;

/** Extra time a task may sit in the serial queue behind other scripts before
 * its caller gives up, on top of the task's own execution timeout. */
const QUEUE_WAIT_ALLOWANCE_MS = 60_000;

/**
 * AppleScript `with timeout of N seconds` value for a given tool timeout.
 * Without this block AppleScript's default ~120s Apple-event reply timeout
 * silently caps every `do javascript` call regardless of the tool timeout.
 */
export function appleScriptTimeoutSeconds(timeoutMs: number): number {
  return Math.ceil(timeoutMs / 1000) + APPLESCRIPT_TIMEOUT_MARGIN_SECONDS;
}

/** Hard outer bound: osascript is SIGKILLed after this many ms. Always strictly
 * above the AppleScript timeout so the clean AppleEvent error fires first. */
export function killTimeoutMs(timeoutMs: number): number {
  return appleScriptTimeoutSeconds(timeoutMs) * 1000 + KILL_GRACE_MS;
}

interface QueuedScript {
  /** Set when the caller's promise was already rejected (timed out while
   * queued); processQueue must skip these — they must never execute. */
  cancelled: boolean;
  run: () => Promise<void>;
}

export class MacOSExecutor implements ScriptExecutor {
  private logger: Logger;
  private scriptQueue: QueuedScript[] = [];
  private isProcessing = false;
  private appName: string = 'Adobe Photoshop 2025';

  constructor() {
    this.logger = new Logger('MacOSExecutor');
  }

  setAppName(appName: string): void {
    this.appName = appName;
    this.logger.debug(`App name set to: ${appName}`);
  }

  async execute(script: string, timeout: number = 30000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // Two-phase timeout. While QUEUED: a generous wait timer (timeout +
      // queue allowance) rejects the caller AND marks the entry cancelled so
      // it never executes later. While RUNNING: the real execution timer,
      // started at dequeue so queue wait does not eat into script run time.
      const entry: QueuedScript = {
        cancelled: false,
        run: async () => {
          clearTimeout(waitTimer);

          let timedOut = false;
          const execTimer = setTimeout(() => {
            timedOut = true;
            reject(new Error('Script execution timeout'));
          }, timeout);

          try {
            const result = await this.executeScript(script, timeout);
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
            `Script timed out after ${timeout + QUEUE_WAIT_ALLOWANCE_MS}ms waiting in the execution queue`
          )
        );
      }, timeout + QUEUE_WAIT_ALLOWANCE_MS);

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
        // Caller already saw a timeout for this task; running it now would
        // mutate Photoshop state after the caller gave up.
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

  private async executeScript(script: string, timeout: number = 30000): Promise<unknown> {
    // For macOS, we'll use AppleScript to execute JavaScript in Photoshop
    const tempScriptPath = join(tmpdir(), `photoshop-script-${Date.now()}.jsx`);
    const tempAppleScriptPath = join(tmpdir(), `photoshop-applescript-${Date.now()}.scpt`);

    try {
      await writeFile(tempScriptPath, prefixExtendScriptBom(script), 'utf8');

      // Create AppleScript that tells Photoshop to execute the JSX
      const appleScript = this.createAppleScriptWrapper(tempScriptPath, timeout);
      await writeFile(tempAppleScriptPath, appleScript, 'utf8');

      try {
        // Execute AppleScript via osascript; the timeout must kill the child,
        // otherwise abandoned osascript processes pile up behind long calls.
        // The kill fires after the AppleScript-side timeout (see
        // killTimeoutMs) so a clean AppleEvent timeout error comes first.
        const { stdout, stderr } = await execAsync(`osascript "${tempAppleScriptPath}"`, {
          timeout: killTimeoutMs(timeout),
          killSignal: 'SIGKILL',
        });

        if (stderr) {
          this.logger.warn('Script execution warning:', stderr);
        }

        // Parse result
        return this.parseResult(stdout);
      } catch (error) {
        this.logger.error('AppleScript execution failed:', error);
        throw error;
      } finally {
        // Cleanup AppleScript file
        await unlink(tempAppleScriptPath).catch(() => {});
      }
    } finally {
      // Cleanup JSX file
      await unlink(tempScriptPath).catch(() => {});
    }
  }

  private createAppleScriptWrapper(jsxPath: string, timeoutMs: number = 30000): string {
    // Use POSIX file path for AppleScript
    const posixPath = jsxPath.replace(/\\/g, '/');

    // 'activate' steals window focus on every tool call, which makes the
    // machine unusable while an agent drives Photoshop. Apple events reach
    // background apps fine, so only activate when explicitly requested.
    const activateLine = envTruthy('PHOTOSHOP_ACTIVATE') ? '\tactivate\n' : '';

    // Without an explicit `with timeout` block, AppleScript's default ~120s
    // Apple-event reply timeout caps every synchronous `do javascript` call,
    // silently defeating per-tool timeouts above 120s (batch tools use 600s).
    const timeoutSeconds = appleScriptTimeoutSeconds(timeoutMs);

    return `tell application "${this.appName}"
${activateLine}\tset jsxFile to POSIX file "${posixPath}"
\twith timeout of ${timeoutSeconds} seconds
\t\tdo javascript "$.evalFile(decodeURI('${encodeURI(posixPath)}'))"
\tend timeout
end tell`;
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
      // Match the specific app we drive, not any Photoshop — with 2025/2026/
      // Beta installed side by side, a generic match reports "running" while
      // the target version is not.
      const pattern = escapeForPgrep(this.appName);
      const { stdout } = await execAsync(`pgrep -f "${pattern}"`);
      return stdout.trim().length > 0;
    } catch {
      // pgrep returns non-zero exit code if no process found
      return false;
    }
  }

  async launchPhotoshop(photoshopPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.info(`Launching Photoshop: ${photoshopPath}`);

      // Use 'open' command on macOS to launch the app
      const child = spawn('open', ['-a', photoshopPath], {
        detached: true,
        stdio: 'ignore',
      });

      child.unref();

      // Wait a bit for Photoshop to start
      setTimeout(() => {
        resolve();
      }, 5000);

      child.on('error', (error) => {
        reject(new Error(`Failed to launch Photoshop: ${error.message}`));
      });
    });
  }

  /**
   * Alternative method using 'do shell script' via AppleScript
   * This can be more reliable for some versions
   */
  async executeViaDoShellScript(script: string): Promise<unknown> {
    const tempScriptPath = join(tmpdir(), `photoshop-script-${Date.now()}.jsx`);
    const tempAppleScriptPath = join(tmpdir(), `photoshop-applescript-alt-${Date.now()}.scpt`);

    try {
      await writeFile(tempScriptPath, prefixExtendScriptBom(script), 'utf8');

      const appleScript = `tell application "${this.appName}"
\tdo shell script "cat '${tempScriptPath}'"
end tell`;

      await writeFile(tempAppleScriptPath, appleScript, 'utf8');
      const { stdout } = await execAsync(`osascript "${tempAppleScriptPath}"`);
      
      await unlink(tempAppleScriptPath).catch(() => {});
      return this.parseResult(stdout);
    } finally {
      await unlink(tempScriptPath).catch(() => {});
    }
  }
}
