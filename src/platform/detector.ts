import { platform } from 'os';
import { Logger } from '../utils/logger.js';
import { PhotoshopInfo } from './connection.js';
import { WindowsDetector } from './windows-detector.js';
import { MacOSDetector } from './macos-detector.js';

export class PhotoshopDetector {
  private logger: Logger;
  private platformType: NodeJS.Platform;
  private windowsDetector?: WindowsDetector;
  private macosDetector?: MacOSDetector;

  constructor() {
    this.logger = new Logger('PhotoshopDetector');
    this.platformType = platform();

    // Initialize platform-specific detector
    if (this.platformType === 'win32') {
      this.windowsDetector = new WindowsDetector();
    } else if (this.platformType === 'darwin') {
      this.macosDetector = new MacOSDetector();
    }
  }

  async detect(): Promise<PhotoshopInfo> {
    this.logger.info(`Detecting Photoshop on ${this.platformType}...`);

    if (this.platformType === 'win32' && this.windowsDetector) {
      return await this.windowsDetector.detect();
    } else if (this.platformType === 'darwin' && this.macosDetector) {
      return await this.macosDetector.detect();
    } else {
      throw new Error(`Unsupported platform: ${this.platformType}`);
    }
  }

  /**
   * Determine if detected Photoshop version supports UXP
   * UXP is supported in Photoshop 23.5+ (roughly 2022+)
   */
  supportsUXP(version: string): boolean {
    // Try to extract numeric version
    const versionMatch = version.match(/(\d+)\.?(\d*)/);
    if (versionMatch) {
      const major = parseInt(versionMatch[1], 10);
      const minor = versionMatch[2] ? parseInt(versionMatch[2], 10) : 0;

      // Photoshop 23.5 or higher supports UXP
      return major > 23 || (major === 23 && minor >= 5);
    }

    // Try to extract year from version
    const yearMatch = version.match(/20(\d{2})/);
    if (yearMatch) {
      const year = parseInt(`20${yearMatch[1]}`, 10);
      // 2022 and later support UXP
      return year >= 2022;
    }

    // Default to false for unknown versions
    return false;
  }

  /**
   * Get recommended API type based on version
   */
  getRecommendedAPI(version: string): 'UXP' | 'ExtendScript' {
    return this.supportsUXP(version) ? 'UXP' : 'ExtendScript';
  }
}
