import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPhotoshopMcpHomeDir } from '../lib/export-paths.js';

/** Reuse a successful detect across stdio respawns; path is re-checked on read. */
export const PHOTOSHOP_DETECT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const STORE_FILE = 'photoshop-detect-cache.json';

export interface PhotoshopDetectCacheRecord {
  version: string;
  path: string;
  appName?: string;
  detectedAt: number;
}

function storePath(): string {
  return join(getPhotoshopMcpHomeDir(), STORE_FILE);
}

function isCacheBypassed(): boolean {
  return Boolean(process.env.PHOTOSHOP_PATH?.trim());
}

export function readPhotoshopDetectCache(now = Date.now()): PhotoshopDetectCacheRecord | null {
  if (isCacheBypassed()) return null;
  try {
    const raw = JSON.parse(readFileSync(storePath(), 'utf8')) as Partial<PhotoshopDetectCacheRecord>;
    if (
      !raw ||
      typeof raw.path !== 'string' ||
      typeof raw.version !== 'string' ||
      typeof raw.detectedAt !== 'number'
    ) {
      return null;
    }
    if (now - raw.detectedAt > PHOTOSHOP_DETECT_CACHE_TTL_MS) return null;
    if (!existsSync(raw.path)) return null;
    return {
      path: raw.path,
      version: raw.version,
      detectedAt: raw.detectedAt,
      ...(typeof raw.appName === 'string' ? { appName: raw.appName } : {}),
    };
  } catch {
    return null;
  }
}

export function writePhotoshopDetectCache(
  info: { version: string; path: string; appName?: string },
  now = Date.now()
): void {
  if (isCacheBypassed()) return;
  mkdirSync(getPhotoshopMcpHomeDir(), { recursive: true, mode: 0o700 });
  const record: PhotoshopDetectCacheRecord = {
    version: info.version,
    path: info.path,
    detectedAt: now,
    ...(info.appName ? { appName: info.appName } : {}),
  };
  writeFileSync(storePath(), JSON.stringify(record), { mode: 0o600 });
}

export function clearPhotoshopDetectCacheForTests(): void {
  try {
    unlinkSync(storePath());
  } catch {
    // File may not exist.
  }
}
