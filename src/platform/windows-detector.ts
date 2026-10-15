import { exec } from 'child_process';
import { promisify } from 'util';
import { access, constants } from 'fs/promises';
import { Logger } from '../utils/logger.js';
import { PhotoshopInfo } from './connection.js';

const execAsync = promisify(exec);

interface RegistryEntry {
  version: string;
  path: string;
}

/** Path of the first running Photoshop.exe; prints nothing when none runs. wmic is deprecated. */
const RUNNING_PHOTOSHOP_PATH_COMMAND =
  'powershell -NoProfile -NonInteractive -Command "(Get-Process -Name Photoshop -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)"';

const RUNNING_PATH_TIMEOUT_MS = 10_000;

/** Compare dotted versions by number: "270.0" is newer than "90.0", unlike a string compare. */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map((part) => parseInt(part, 10) || 0);
  const right = b.split('.').map((part) => parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export class WindowsDetector {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('WindowsDetector');
  }

  async detect(): Promise<PhotoshopInfo> {
    this.logger.info('Detecting Photoshop on Windows...');

    // Try environment variable first
    const envPath = process.env.PHOTOSHOP_PATH;
    if (envPath) {
      this.logger.debug(`Using environment variable: ${envPath}`);
      const info = await this.checkPath(envPath);
      if (info) return info;
      this.logger.warn(
        `PHOTOSHOP_PATH is set but no Photoshop.exe was found at ${envPath}. Falling back to automatic detection.`
      );
    }

    // A running Photoshop reports its own path, whichever drive it is on.
    const runningInfo = await this.detectFromRunningProcess();
    if (runningInfo) return runningInfo;

    // Try registry detection
    try {
      const registryInfo = await this.detectFromRegistry();
      if (registryInfo) return registryInfo;
    } catch (error) {
      this.logger.warn('Registry detection failed:', error);
    }

    // Try common installation paths
    const commonPaths = this.getCommonPaths();
    for (const path of commonPaths) {
      const info = await this.checkPath(path);
      if (info) return info;
    }

    throw new Error('Photoshop not found on this system');
  }

  private async detectFromRunningProcess(): Promise<PhotoshopInfo | null> {
    try {
      const { stdout } = await execAsync(RUNNING_PHOTOSHOP_PATH_COMMAND, {
        timeout: RUNNING_PATH_TIMEOUT_MS,
        windowsHide: true,
      });
      const exePath = stdout.trim().split(/\r?\n/)[0]?.trim();
      return exePath ? await this.checkPath(exePath) : null;
    } catch (error) {
      this.logger.debug('Running-process detection failed:', error);
      return null;
    }
  }

  private async detectFromRegistry(): Promise<PhotoshopInfo | null> {
    try {
      // Query Adobe registry keys
      const registryPaths = [
        'HKLM\\SOFTWARE\\Adobe\\Photoshop',
        'HKLM\\SOFTWARE\\WOW6432Node\\Adobe\\Photoshop',
      ];

      const entries: RegistryEntry[] = [];
      for (const regPath of registryPaths) {
        try {
          const { stdout } = await execAsync(`reg query "${regPath}" /s`);
          entries.push(...this.parseRegistryOutput(stdout));
        } catch {
          // Continue to next registry path
          continue;
        }
      }

      // Newest first. An uninstalled version can leave its key behind, so
      // try every entry instead of giving up after the newest.
      entries.sort((a, b) => compareVersions(b.version, a.version));
      for (const entry of entries) {
        const info = await this.checkPath(entry.path);
        if (info) return info;
      }

      // Try COM CLSID registry
      const clsidPaths = [
        'HKCR\\CLSID\\{06870682-6f3c-4b97-9143-f03e85c0bd3e}\\LocalServer32',
        'HKCR\\Wow6432Node\\CLSID\\{06870682-6f3c-4b97-9143-f03e85c0bd3e}\\LocalServer32',
      ];

      for (const clsidPath of clsidPaths) {
        try {
          const { stdout } = await execAsync(`reg query "${clsidPath}" /ve`);
          const exePath = this.extractPathFromCLSID(stdout);
          if (exePath) {
            const info = await this.checkPath(exePath);
            if (info) return info;
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      this.logger.error('Registry query failed:', error);
    }

    return null;
  }

  private parseRegistryOutput(output: string): RegistryEntry[] {
    const entries: RegistryEntry[] = [];
    const lines = output.split('\n');
    
    let currentVersion = '';
    for (const line of lines) {
      // Extract version from registry path
      const versionMatch = line.match(/Photoshop\\(\d+\.\d+)/);
      if (versionMatch) {
        currentVersion = versionMatch[1];
      }

      // Extract ApplicationPath
      const pathMatch = line.match(/ApplicationPath\s+REG_SZ\s+(.+)/);
      if (pathMatch && currentVersion) {
        entries.push({
          version: currentVersion,
          path: pathMatch[1].trim(),
        });
      }
    }

    return entries;
  }

  private extractPathFromCLSID(output: string): string | null {
    const match = output.match(/REG_SZ\s+(.+\.exe)/i);
    if (match) {
      // Remove quotes and trailing parameters
      return match[1].trim().replace(/^"(.+)".*$/, '$1');
    }
    return null;
  }

  private getCommonPaths(): string[] {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    const paths: string[] = [];
    
    // Generate paths from next year's release (Adobe ships "Photoshop N+1"
    // in the autumn of year N) back to 2012, so new versions are found
    // without a code change.
    const maxYear = new Date().getFullYear() + 1;
    for (let year = maxYear; year >= 2012; year--) {
      paths.push(
        `${programFiles}\\Adobe\\Adobe Photoshop ${year}\\Photoshop.exe`,
        `${programFilesX86}\\Adobe\\Adobe Photoshop ${year}\\Photoshop.exe`,
        `${programFiles}\\Adobe\\Adobe Photoshop CC ${year}\\Photoshop.exe`,
        `${programFilesX86}\\Adobe\\Adobe Photoshop CC ${year}\\Photoshop.exe`
      );
    }

    // Also check for version-less installation
    paths.push(
      `${programFiles}\\Adobe\\Adobe Photoshop CC\\Photoshop.exe`,
      `${programFiles}\\Adobe\\Photoshop CC\\Photoshop.exe`
    );

    return paths;
  }

  private async checkPath(path: string): Promise<PhotoshopInfo | null> {
    try {
      // Clean up path; registry ApplicationPath values end with a backslash
      let cleanPath = path
        .trim()
        .replace(/^"|"$/g, '')
        .replace(/[\\/]+$/, '');
      
      // If path is a directory, append Photoshop.exe
      if (!cleanPath.toLowerCase().endsWith('.exe')) {
        cleanPath = `${cleanPath}\\Photoshop.exe`;
      }

      await access(cleanPath, constants.F_OK);
      
      const version = this.extractVersionFromPath(cleanPath);
      
      this.logger.info(`Found Photoshop at: ${cleanPath}`);
      
      return {
        version,
        path: cleanPath,
        isRunning: await this.checkIfRunning(),
      };
    } catch {
      return null;
    }
  }

  private extractVersionFromPath(path: string): string {
    // Try to extract year from path
    const yearMatch = path.match(/(\d{4})/);
    if (yearMatch) {
      return yearMatch[1];
    }

    // Try to extract version number
    const versionMatch = path.match(/(\d+\.\d+)/);
    if (versionMatch) {
      return versionMatch[1];
    }

    return 'Unknown';
  }

  private async checkIfRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq Photoshop.exe"');
      return stdout.toLowerCase().includes('photoshop.exe');
    } catch {
      return false;
    }
  }
}
