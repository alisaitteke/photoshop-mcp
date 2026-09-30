import { statfs } from 'node:fs/promises';

/**
 * Volume Photoshop uses as the scratch disk unless the user picked another one.
 * Adobe: by default the internal OS drive (Macintosh HD / C:).
 * https://helpx.adobe.com/photoshop/kb/troubleshoot-scratch-disk-is-full-challenger.html
 */
export function osDrivePath(): string {
  if (process.platform === 'win32') {
    const drive = process.env.SystemDrive || 'C:';
    return drive.endsWith('\\') ? drive : `${drive}\\`;
  }
  return '/';
}

/** Bytes available to unprivileged writers, or null when the volume cannot be read. */
export async function readOsDriveFreeBytes(): Promise<number | null> {
  try {
    const stats = await statfs(osDrivePath());
    if (!Number.isFinite(stats.bavail) || !Number.isFinite(stats.bsize) || stats.bsize <= 0) {
      return null;
    }
    return stats.bavail * stats.bsize;
  } catch {
    return null;
  }
}
