import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearPhotoshopDetectCacheForTests,
  PHOTOSHOP_DETECT_CACHE_TTL_MS,
  readPhotoshopDetectCache,
  writePhotoshopDetectCache,
} from '../src/platform/detect-cache.js';

describe('Photoshop detect cache', () => {
  let home: string;
  let appPath: string;
  let previousHome: string | undefined;
  let previousPsPath: string | undefined;

  beforeEach(() => {
    previousHome = process.env.PHOTOSHOP_MCP_HOME;
    previousPsPath = process.env.PHOTOSHOP_PATH;
    delete process.env.PHOTOSHOP_PATH;
    home = mkdtempSync(join(tmpdir(), 'ph-mcp-detect-'));
    process.env.PHOTOSHOP_MCP_HOME = home;
    appPath = join(home, 'Adobe Photoshop 2026.app');
    mkdirSync(appPath);
    writeFileSync(join(appPath, 'Info.plist'), 'ok');
    clearPhotoshopDetectCacheForTests();
  });

  afterEach(() => {
    clearPhotoshopDetectCacheForTests();
    if (previousHome === undefined) delete process.env.PHOTOSHOP_MCP_HOME;
    else process.env.PHOTOSHOP_MCP_HOME = previousHome;
    if (previousPsPath === undefined) delete process.env.PHOTOSHOP_PATH;
    else process.env.PHOTOSHOP_PATH = previousPsPath;
    rmSync(home, { recursive: true, force: true });
  });

  it('returns null before anything is written', () => {
    expect(readPhotoshopDetectCache(1_000)).toBeNull();
  });

  it('reads back a valid cached detect', () => {
    writePhotoshopDetectCache(
      { version: '27.9.1', path: appPath, appName: 'Adobe Photoshop 2026' },
      1_000
    );
    expect(readPhotoshopDetectCache(2_000)).toEqual({
      version: '27.9.1',
      path: appPath,
      appName: 'Adobe Photoshop 2026',
      detectedAt: 1_000,
    });
  });

  it('expires after the TTL', () => {
    writePhotoshopDetectCache({ version: '27.9.1', path: appPath }, 1_000);
    expect(readPhotoshopDetectCache(1_000 + PHOTOSHOP_DETECT_CACHE_TTL_MS + 1)).toBeNull();
  });

  it('ignores a cached path that no longer exists', () => {
    writePhotoshopDetectCache({ version: '27.9.1', path: join(home, 'missing.app') }, 1_000);
    expect(readPhotoshopDetectCache(2_000)).toBeNull();
  });

  it('bypasses cache when PHOTOSHOP_PATH is set', () => {
    writePhotoshopDetectCache({ version: '27.9.1', path: appPath }, 1_000);
    process.env.PHOTOSHOP_PATH = appPath;
    expect(readPhotoshopDetectCache(2_000)).toBeNull();
    writePhotoshopDetectCache({ version: '99.0.0', path: appPath }, 3_000);
    delete process.env.PHOTOSHOP_PATH;
    expect(readPhotoshopDetectCache(4_000)?.version).toBe('27.9.1');
  });
});
