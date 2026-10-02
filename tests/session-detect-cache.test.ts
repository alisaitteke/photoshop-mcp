import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/analytics/index.js', () => ({
  capture: vi.fn(),
  captureAnalyticsMilestoneOnce: vi.fn(),
  identifyPhotoshopVersion: vi.fn(),
}));

import { Session } from '../src/core/session.js';
import { writePhotoshopDetectCache } from '../src/platform/detect-cache.js';

describe('Session initialize detect cache', () => {
  let home: string;
  let appPath: string;
  let previousHome: string | undefined;
  let previousPsPath: string | undefined;

  beforeEach(() => {
    previousHome = process.env.PHOTOSHOP_MCP_HOME;
    previousPsPath = process.env.PHOTOSHOP_PATH;
    delete process.env.PHOTOSHOP_PATH;
    home = mkdtempSync(join(tmpdir(), 'ph-mcp-session-'));
    process.env.PHOTOSHOP_MCP_HOME = home;
    appPath = join(home, 'Adobe Photoshop 2026.app');
    mkdirSync(appPath);
  });

  afterEach(() => {
    if (previousHome === undefined) delete process.env.PHOTOSHOP_MCP_HOME;
    else process.env.PHOTOSHOP_MCP_HOME = previousHome;
    if (previousPsPath === undefined) delete process.env.PHOTOSHOP_PATH;
    else process.env.PHOTOSHOP_PATH = previousPsPath;
    rmSync(home, { recursive: true, force: true });
  });

  it('hydrates from cache without marking a fresh connection event', async () => {
    writePhotoshopDetectCache(
      { version: '27.9.1', path: appPath, appName: 'Adobe Photoshop 2026' },
      Date.now()
    );
    const session = new Session();
    await session.initialize();
    expect(session.getConnectionStatus()).toBe(true);
    expect(session.getConnection().getPhotoshopInfo()?.path).toBe(appPath);
  });

  it('defers detect when the cache is empty', async () => {
    const session = new Session();
    await session.initialize();
    expect(session.getConnectionStatus()).toBe(false);
    expect(session.getConnection().getPhotoshopInfo()).toBeNull();
  });
});
