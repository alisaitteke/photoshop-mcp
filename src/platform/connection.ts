import { platform } from 'os';
import { Logger } from '../utils/logger.js';
import { PhotoshopDetector } from './detector.js';
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
  private executor: ScriptExecutor;
  private photoshopInfo: PhotoshopInfo | null = null;
  private macosExecutor?: MacOSExecutor;

  constructor() {
    this.logger = new Logger('PhotoshopConnection');
    this.detector = new PhotoshopDetector();

    // Initialize platform-specific executor
    const platformType = platform();
    if (platformType === 'win32') {
      this.executor = new WindowsExecutor();
    } else if (platformType === 'darwin') {
      this.macosExecutor = new MacOSExecutor();
      this.executor = this.macosExecutor;
    } else {
      throw new Error(`Unsupported platform: ${platformType}`);
    }
  }

  async ping(): Promise<boolean> {
    try {
      this.logger.debug('Pinging Photoshop...');
      
      // Try to detect Photoshop if not already detected
      if (!this.photoshopInfo) {
        this.photoshopInfo = await this.detector.detect();
      }

      // For now, just check if Photoshop is detected
      return this.photoshopInfo !== null;
    } catch (error) {
      this.logger.error('Ping failed:', error);
      return false;
    }
  }

  async getVersion(): Promise<string> {
    try {
      if (!this.photoshopInfo) {
        this.photoshopInfo = await this.detector.detect();
      }

      return this.photoshopInfo?.version || 'Unknown';
    } catch (error) {
      this.logger.error('Failed to get version:', error);
      throw error;
    }
  }

  async executeScript(script: string, timeout?: number): Promise<unknown> {
    try {
      // Ensure Photoshop is detected
      if (!this.photoshopInfo) {
        this.photoshopInfo = await this.detector.detect();
      }

      // Set app name for macOS executor
      if (this.macosExecutor && this.photoshopInfo.appName) {
        this.macosExecutor.setAppName(this.photoshopInfo.appName);
      }

      // Check if Photoshop is running, launch if needed
      const isRunning = await this.executor.isPhotoshopRunning();
      if (!isRunning) {
        this.logger.info('Photoshop not running, launching...');
        await this.executor.launchPhotoshop(this.photoshopInfo.path);
      }

      // Execute the script
      const result = await this.executor.execute(script, timeout);
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
    if (!this.photoshopInfo) {
      this.photoshopInfo = await this.detector.detect();
    }

    const isRunning = await this.executor.isPhotoshopRunning();
    if (!isRunning) {
      this.logger.info('Launching Photoshop...');
      await this.executor.launchPhotoshop(this.photoshopInfo.path);
    }
  }
}
