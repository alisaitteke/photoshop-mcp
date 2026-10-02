import { platform } from 'os';
import { Logger } from '../utils/logger.js';
import { PhotoshopDetector } from './detector.js';
import { readPhotoshopDetectCache, writePhotoshopDetectCache } from './detect-cache.js';
import { ScriptExecutor } from './script-executor.js';
import { WindowsExecutor } from './windows-executor.js';
import { MacOSExecutor } from './macos-executor.js';

export interface PhotoshopInfo {
  version: string;
  path: string;
  isRunning: boolean;
  appName?: string;
}

export class PhotoshopConnection {
  private logger: Logger;
  private detector: PhotoshopDetector;
  private executor: ScriptExecutor | null = null;
  private photoshopInfo: PhotoshopInfo | null = null;
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
    this.photoshopInfo = {
      version: cached.version,
      path: cached.path,
      isRunning: false,
      ...(cached.appName ? { appName: cached.appName } : {}),
    };
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
  }

  private async resolvePhotoshopInfo(): Promise<PhotoshopInfo | null> {
    if (this.photoshopInfo) return this.photoshopInfo;

    const cached = readPhotoshopDetectCache();
    if (cached) {
      this.applyCachedInfo(cached);
      return this.photoshopInfo;
    }

    try {
      this.photoshopInfo = await this.detector.detect();
      if (this.photoshopInfo) {
        writePhotoshopDetectCache({
          version: this.photoshopInfo.version,
          path: this.photoshopInfo.path,
          appName: this.photoshopInfo.appName,
        });
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
      await this.resolvePhotoshopInfo();
      if (!this.photoshopInfo) {
        throw new Error('Photoshop not found on this system');
      }

      const executor = this.getExecutor();
      this.applyMacOSAppName();

      const isRunning = await executor.isPhotoshopRunning();
      if (!isRunning) {
        if (options?.launch === false) {
          throw new Error('Photoshop is not running');
        }
        this.logger.info('Photoshop not running, launching...');
        await executor.launchPhotoshop(this.photoshopInfo.path);
      }

      const result = await executor.execute(script, timeout);
      return result;
    } catch (error) {
      this.logger.error('Script execution failed:', error);
      throw error;
    }
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
    this.applyMacOSAppName();
    const isRunning = await executor.isPhotoshopRunning();
    if (!isRunning) {
      this.logger.info('Launching Photoshop...');
      await executor.launchPhotoshop(this.photoshopInfo.path);
    }
  }

  /**
   * Point the macOS executor at the detected app bundle name. Must run after
   * getExecutor(): the executor is created lazily, and before this ordering fix
   * the first script of every session ran against the hard-coded default
   * ("Adobe Photoshop 2025"), so on any other version pgrep reported Photoshop
   * as not running, launchPhotoshop() stole focus for 5s, and osascript failed
   * to compile `do javascript` (-2741) because the app name did not resolve.
   */
  private applyMacOSAppName(): void {
    if (this.macosExecutor && this.photoshopInfo?.appName) {
      this.macosExecutor.setAppName(this.photoshopInfo.appName);
    }
  }
}
