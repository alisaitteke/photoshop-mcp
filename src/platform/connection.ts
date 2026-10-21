import { platform } from 'os';
import { Logger } from '../utils/logger.js';
import { PhotoshopDetector } from './detector.js';
import {
  clearPhotoshopDetectCache,
  readPhotoshopDetectCache,
  writePhotoshopDetectCache,
} from './detect-cache.js';
import { ScriptExecutor } from './script-executor.js';
import { WindowsExecutor } from './windows-executor.js';
import { MacOSExecutor } from './macos-executor.js';
import { MAC_APP_NOT_RESOLVED_PATTERN } from './macos-app.js';

export interface PhotoshopInfo {
  version: string;
  path: string;
  isRunning: boolean;
  appName?: string;
}

/** No install was found. envelope.ts maps it to `photoshop_not_detected`. */
export const PHOTOSHOP_NOT_DETECTED_MESSAGE = 'Photoshop not detected on this system.';

/** The script never reached Photoshop because its install could not be resolved or started. */
function isInstallUnusable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return MAC_APP_NOT_RESOLVED_PATTERN.test(message) || /Failed to launch Photoshop/i.test(message);
}

export class PhotoshopConnection {
  private logger: Logger;
  private detector: PhotoshopDetector;
  private executor: ScriptExecutor | null = null;
  private photoshopInfo: PhotoshopInfo | null = null;
  /** photoshopInfo came from the disk cache, not from a detect in this process. */
  private infoFromCache = false;
  private detectInFlight: Promise<PhotoshopInfo | null> | null = null;
  private macosExecutor?: MacOSExecutor;
  private onFreshDetect?: (ok: boolean) => void;

  constructor() {
    this.logger = new Logger('PhotoshopConnection');
    this.detector = new PhotoshopDetector();
    // Executor is initialized lazily on first use so that constructing a
    // PhotoshopConnection on an unsupported platform (e.g. the Linux CI runner
    // used for the verify-photoshop-prompts script) does not throw immediately.
  }

  /** Returns the platform executor, initializing it on first call. */
  private getExecutor(): ScriptExecutor {
    if (this.executor) return this.executor;

    const platformType = platform();
    if (platformType === 'win32') {
      this.executor = new WindowsExecutor();
    } else if (platformType === 'darwin') {
      this.macosExecutor = new MacOSExecutor();
      this.executor = this.macosExecutor;
    } else {
      throw new Error(`Unsupported platform: ${platformType}`);
    }
    return this.executor;
  }

  /** Register a listener for a real detect() — not a cache hydrate. */
  setOnFreshDetect(callback: (ok: boolean) => void): void {
    this.onFreshDetect = callback;
  }

  /** Load a valid on-disk detect without Spotlight/registry. */
  hydrateFromCache(): boolean {
    if (this.photoshopInfo) return true;
    const cached = readPhotoshopDetectCache();
    if (!cached) return false;
    this.applyCachedInfo(cached);
    this.logger.debug(`Using cached Photoshop detect at ${cached.path}`);
    return true;
  }

  private notifyFreshDetect(ok: boolean): void {
    this.onFreshDetect?.(ok);
  }

  private applyCachedInfo(cached: { version: string; path: string; appName?: string }): void {
    this.photoshopInfo = {
      version: cached.version,
      path: cached.path,
      isRunning: false,
      ...(cached.appName ? { appName: cached.appName } : {}),
    };
    this.infoFromCache = true;
  }

  /** Forget the detected install, in memory and on disk, so the next call detects again. */
  invalidateDetection(): void {
    this.photoshopInfo = null;
    this.infoFromCache = false;
    clearPhotoshopDetectCache();
  }

  private async resolvePhotoshopInfo(): Promise<PhotoshopInfo | null> {
    if (this.photoshopInfo) return this.photoshopInfo;

    const cached = readPhotoshopDetectCache();
    if (cached) {
      this.applyCachedInfo(cached);
      return this.photoshopInfo;
    }

    // Agents often call several tools in parallel at session start; they share
    // one detect (Spotlight / PowerShell / registry) instead of each running it.
    if (!this.detectInFlight) {
      this.detectInFlight = this.detectFresh().finally(() => {
        this.detectInFlight = null;
      });
    }
    return this.detectInFlight;
  }

  private async detectFresh(): Promise<PhotoshopInfo | null> {
    try {
      this.infoFromCache = false;
      this.photoshopInfo = await this.detector.detect();
      if (this.photoshopInfo) {
        this.writeDetectCache(this.photoshopInfo);
        this.notifyFreshDetect(true);
        return this.photoshopInfo;
      }
      this.notifyFreshDetect(false);
      return null;
    } catch (error) {
      this.notifyFreshDetect(false);
      throw error;
    }
  }

  /** The cache only saves the next spawn a detect; a read-only home must not fail this one. */
  private writeDetectCache(info: PhotoshopInfo): void {
    try {
      writePhotoshopDetectCache({ version: info.version, path: info.path, appName: info.appName });
    } catch (error) {
      this.logger.warn('Could not write the Photoshop detect cache:', error);
    }
  }

  /**
   * Detect Photoshop unless this process already has: memory, then the disk
   * cache, then a real detect. Never launches Photoshop. Tools reach it through
   * PhotoshopAPIFactory, so the first tool of a session does not depend on an
   * earlier photoshop_ping. Throws when the platform detector does.
   */
  async ensureDetected(): Promise<PhotoshopInfo | null> {
    return this.resolvePhotoshopInfo();
  }

  async ping(): Promise<boolean> {
    try {
      this.logger.debug('Pinging Photoshop...');
      const info = await this.resolvePhotoshopInfo();
      return info !== null;
    } catch (error) {
      this.logger.error('Ping failed:', error);
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      const info = await this.resolvePhotoshopInfo();
      return info?.version || 'Unknown';
    } catch (error) {
      this.logger.error('Failed to get version:', error);
      throw error;
    }
  }

  async executeScript(
    script: string,
    timeout?: number,
    options?: { launch?: boolean }
  ): Promise<unknown> {
    try {
      return await this.runScript(script, timeout, options);
    } catch (error) {
      // A cached install can go stale between spawns (uninstalled, moved or
      // upgraded). The script never ran, so detect once more and retry once.
      // Timeouts and script errors did run, or may still be running: never retry.
      if (!this.infoFromCache || !isInstallUnusable(error)) {
        this.logger.error('Script execution failed:', error);
        throw error;
      }
      this.logger.warn(
        'Cached Photoshop install could not be resolved or started; detecting again:',
        error
      );
      this.invalidateDetection();
      try {
        return await this.runScript(script, timeout, options);
      } catch (retryError) {
        this.logger.error('Script execution failed:', retryError);
        throw retryError;
      }
    }
  }

  private async runScript(
    script: string,
    timeout?: number,
    options?: { launch?: boolean }
  ): Promise<unknown> {
    await this.resolvePhotoshopInfo();
    if (!this.photoshopInfo) {
      throw new Error('Photoshop not found on this system');
    }

    const executor = this.getExecutor();
    this.applyMacOSTarget();

    const isRunning = await executor.isPhotoshopRunning();
    if (!isRunning) {
      if (options?.launch === false) {
        throw new Error('Photoshop is not running');
      }
      this.logger.info('Photoshop not running, launching...');
      await executor.launchPhotoshop(this.photoshopInfo.path);
    }

    return executor.execute(script, timeout);
  }

  getPhotoshopInfo(): PhotoshopInfo | null {
    return this.photoshopInfo;
  }

  async ensurePhotoshopRunning(): Promise<void> {
    await this.resolvePhotoshopInfo();
    if (!this.photoshopInfo) {
      throw new Error('Photoshop not found on this system');
    }

    const executor = this.getExecutor();
    this.applyMacOSTarget();
    const isRunning = await executor.isPhotoshopRunning();
    if (!isRunning) {
      this.logger.info('Launching Photoshop...');
      await executor.launchPhotoshop(this.photoshopInfo.path);
    }
  }

  /**
   * Point the macOS executor at the detected install. Must run after
   * getExecutor(): the executor is created lazily, and before this ordering fix
   * the first script of every session ran against the hard-coded default
   * ("Adobe Photoshop 2025"). The bundle path is the AppleScript target; the
   * name stays for logs and as a fallback when the path is not a bundle (#72).
   */
  private applyMacOSTarget(): void {
    if (!this.macosExecutor || !this.photoshopInfo) return;
    if (this.photoshopInfo.appName) this.macosExecutor.setAppName(this.photoshopInfo.appName);
    this.macosExecutor.setAppPath(this.photoshopInfo.path);
  }
}
