import { exec } from 'child_process';
import { promisify } from 'util';
import { access, constants, readFile } from 'fs/promises';
import { Logger } from '../utils/logger.js';
import { PhotoshopInfo } from './connection.js';

const execAsync = promisify(exec);

export class MacOSDetector {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MacOSDetector');
  }

  async detect(): Promise<PhotoshopInfo> {
    this.logger.info('Detecting Photoshop on macOS...');

    // Try environment variable first
    const envPath = process.env.PHOTOSHOP_PATH;
    if (envPath) {
      this.logger.debug(`Using environment variable: ${envPath}`);
      const info = await this.checkPath(envPath);
      if (info) return info;
    }

    // Try mdfind (Spotlight) for fast detection
    try {
      const spotlightInfo = await this.detectUsingSpotlight();
      if (spotlightInfo) return spotlightInfo;
    } catch (error) {
      this.logger.warn('Spotlight detection failed:', error);
    }

    // Try common installation paths
    const commonPaths = this.getCommonPaths();
    for (const path of commonPaths) {
      const info = await this.checkPath(path);
      if (info) return info;
    }

    throw new Error('Photoshop not found on this system');
  }

  private async detectUsingSpotlight(): Promise<PhotoshopInfo | null> {
    try {
      // Use mdfind to search for Photoshop applications
      const { stdout } = await execAsync(
        'mdfind "kMDItemCFBundleIdentifier == com.adobe.Photoshop"'
      );

      const apps = stdout
        .split('\n')
        .filter((line) => line.trim() && line.endsWith('.app'))
        .sort((a, b) => b.localeCompare(a)); // Sort descending to get latest version first

      for (const appPath of apps) {
        const info = await this.checkPath(appPath);
        if (info) return info;
      }
    } catch (error) {
      this.logger.debug('Spotlight search failed:', error);
    }

    return null;
  }

  private getCommonPaths(): string[] {
    const paths: string[] = [];

    // Generate paths for versions 2012-2025
    for (let year = 2025; year >= 2012; year--) {
      paths.push(
        `/Applications/Adobe Photoshop ${year}/Adobe Photoshop ${year}.app`,
        `/Applications/Adobe Photoshop CC ${year}/Adobe Photoshop CC ${year}.app`,
        `/Applications/Adobe Photoshop ${year}.app`
      );
    }

    // Also check for version-less installation
    paths.push(
      '/Applications/Adobe Photoshop CC/Adobe Photoshop CC.app',
      '/Applications/Adobe Photoshop/Adobe Photoshop.app',
      '/Applications/Adobe Photoshop.app'
    );

    return paths;
  }

  private async checkPath(path: string): Promise<PhotoshopInfo | null> {
    try {
      // Clean up path
      const cleanPath = path.trim();

      // Check if path exists
      await access(cleanPath, constants.F_OK);

      // Get version from Info.plist
      const version = await this.extractVersionFromApp(cleanPath);
      
      // Extract app name from path
      const appName = cleanPath.split('/').pop()?.replace('.app', '') || 'Adobe Photoshop 2025';

      this.logger.info(`Found Photoshop at: ${cleanPath}`);

      return {
        version,
        path: cleanPath,
        isRunning: await this.checkIfRunning(cleanPath),
        appName,
      };
    } catch (error) {
      return null;
    }
  }

  private async extractVersionFromApp(appPath: string): Promise<string> {
    try {
      // Try to read version from Info.plist
      const plistPath = `${appPath}/Contents/Info.plist`;
      
      try {
        await access(plistPath, constants.F_OK);
        
        // Use PlistBuddy to extract version
        const { stdout: version } = await execAsync(
          `/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${plistPath}"`
        );
        
        if (version.trim()) {
          return version.trim();
        }
      } catch (error) {
        // PlistBuddy failed, try parsing manually
        const content = await readFile(plistPath, 'utf8');
        const versionMatch = content.match(
          /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/
        );
        
        if (versionMatch) {
          return versionMatch[1];
        }
      }

      // Fallback: extract year from path
      const yearMatch = appPath.match(/(\d{4})/);
      if (yearMatch) {
        return yearMatch[1];
      }
    } catch (error) {
      this.logger.debug('Failed to extract version from app:', error);
    }

    return 'Unknown';
  }

  private async checkIfRunning(appPath: string): Promise<boolean> {
    try {
      // Get the app name from path
      const appName = appPath.split('/').pop()?.replace('.app', '') || 'Adobe Photoshop';

      // Use pgrep to check if process is running
      const { stdout } = await execAsync(`pgrep -f "${appName}"`);
      return stdout.trim().length > 0;
    } catch (error) {
      // pgrep returns non-zero exit code if no process found
      return false;
    }
  }

  async getAppBundleId(appPath: string): Promise<string | null> {
    try {
      const plistPath = `${appPath}/Contents/Info.plist`;
      const { stdout } = await execAsync(
        `/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "${plistPath}"`
      );
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }
}
