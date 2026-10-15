import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const detect = vi.hoisted(() => vi.fn());

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, platform: () => 'darwin' };
});

vi.mock('../src/platform/detector.js', () => ({
  PhotoshopDetector: class {
    detect = detect;
  },
}));

import { API_OVERRIDE_ENV, PhotoshopAPIFactory } from '../src/api/photoshop-api.js';
import { classifyError } from '../src/errors/envelope.js';
import {
  clearPhotoshopDetectCache,
  readPhotoshopDetectCache,
  writePhotoshopDetectCache,
} from '../src/platform/detect-cache.js';
import { MacOSExecutor } from '../src/platform/macos-executor.js';
import { PHOTOSHOP_NOT_DETECTED_MESSAGE, PhotoshopConnection } from '../src/platform/connection.js';
import { runSnippet } from '../src/tools/atomic-shared.js';

const APP_2026 = '/Applications/Adobe Photoshop 2026/Adobe Photoshop 2026.app';

function installed(path = APP_2026) {
  return { version: '27.9.1', path, isRunning: true, appName: 'Adobe Photoshop 2026' };
}

describe('PhotoshopAPIFactory detects Photoshop on the first tool call', () => {
  let home: string;
  let previousHome: string | undefined;
  let previousPsPath: string | undefined;

  beforeEach(() => {
    previousHome = process.env.PHOTOSHOP_MCP_HOME;
    previousPsPath = process.env.PHOTOSHOP_PATH;
    delete process.env.PHOTOSHOP_PATH;
    home = mkdtempSync(join(tmpdir(), 'ph-mcp-first-call-'));
    process.env.PHOTOSHOP_MCP_HOME = home;
    // Skip the UXP bridge probe; it only picks log wording.
    process.env[API_OVERRIDE_ENV] = 'extendscript';
    detect.mockReset();
  });

  afterEach(() => {
    if (previousHome === undefined) delete process.env.PHOTOSHOP_MCP_HOME;
    else process.env.PHOTOSHOP_MCP_HOME = previousHome;
    if (previousPsPath === undefined) delete process.env.PHOTOSHOP_PATH;
    else process.env.PHOTOSHOP_PATH = previousPsPath;
    delete process.env[API_OVERRIDE_ENV];
    rmSync(home, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('detects without an earlier photoshop_ping and without launching Photoshop', async () => {
    detect.mockResolvedValue(installed());
    const running = vi.spyOn(MacOSExecutor.prototype, 'isPhotoshopRunning');
    const launch = vi.spyOn(MacOSExecutor.prototype, 'launchPhotoshop');
    const connection = new PhotoshopConnection();

    const api = await new PhotoshopAPIFactory(connection).createAPI();

    expect(api.getAPIType()).toBe('ExtendScript');
    expect(detect).toHaveBeenCalledTimes(1);
    expect(connection.getPhotoshopInfo()?.path).toBe(APP_2026);
    expect(running).not.toHaveBeenCalled();
    expect(launch).not.toHaveBeenCalled();
  });

  it('shares one detect between parallel first tool calls', async () => {
    let finish!: (info: ReturnType<typeof installed>) => void;
    detect.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const connection = new PhotoshopConnection();
    const factory = new PhotoshopAPIFactory(connection);

    const calls = Promise.all([factory.createAPI(), factory.createAPI(), factory.createAPI()]);
    finish(installed());
    await calls;

    expect(detect).toHaveBeenCalledTimes(1);
  });

  it('detects again on the next call after a shared detect failed', async () => {
    detect.mockRejectedValueOnce(new Error('Photoshop not found on this system'));
    const connection = new PhotoshopConnection();
    const factory = new PhotoshopAPIFactory(connection);

    const first = await Promise.allSettled([factory.createAPI(), factory.createAPI()]);
    expect(first.every((r) => r.status === 'rejected')).toBe(true);
    expect(detect).toHaveBeenCalledTimes(1);

    detect.mockResolvedValueOnce(installed());
    await factory.createAPI();
    expect(detect).toHaveBeenCalledTimes(2);
  });

  it('runs the first snippet of a fresh session instead of "Photoshop info not available"', async () => {
    detect.mockResolvedValue(installed());
    vi.spyOn(MacOSExecutor.prototype, 'isPhotoshopRunning').mockResolvedValue(true);
    vi.spyOn(MacOSExecutor.prototype, 'execute').mockResolvedValue('ok');

    await expect(runSnippet(new PhotoshopConnection(), 'return 1;')).resolves.toBe('ok');
  });

  it('fails with photoshop_not_detected when no install is found', async () => {
    detect.mockRejectedValue(new Error('Photoshop not found on this system'));
    const factory = new PhotoshopAPIFactory(new PhotoshopConnection());

    const error = await factory.createAPI().catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(PHOTOSHOP_NOT_DETECTED_MESSAGE);
    expect(classifyError((error as Error).message).code).toBe('photoshop_not_detected');
  });

  it('keeps an unexpected detection failure in the message', async () => {
    detect.mockRejectedValue(new Error('Unsupported platform: linux'));
    const error = await new PhotoshopAPIFactory(new PhotoshopConnection())
      .createAPI()
      .catch((e: Error) => e);

    expect((error as Error).message).toContain(PHOTOSHOP_NOT_DETECTED_MESSAGE);
    expect((error as Error).message).toContain('Unsupported platform: linux');
    expect(classifyError((error as Error).message).code).toBe('photoshop_not_detected');
  });

  it('detects again on the next call after a failed detect', async () => {
    detect.mockRejectedValueOnce(new Error('Photoshop not found on this system'));
    detect.mockResolvedValueOnce(installed());
    const factory = new PhotoshopAPIFactory(new PhotoshopConnection());

    await expect(factory.createAPI()).rejects.toThrow(PHOTOSHOP_NOT_DETECTED_MESSAGE);
    await expect(factory.createAPI()).resolves.toBeDefined();
    expect(detect).toHaveBeenCalledTimes(2);
  });

  it('does not fail the detect when the detect cache cannot be written', async () => {
    const notADir = join(home, 'file');
    writeFileSync(notADir, '');
    process.env.PHOTOSHOP_MCP_HOME = join(notADir, 'home');
    detect.mockResolvedValue(installed());
    const connection = new PhotoshopConnection();

    await expect(connection.ensureDetected()).resolves.toMatchObject({ path: APP_2026 });
    expect(connection.getPhotoshopInfo()?.path).toBe(APP_2026);
  });

  it('reuses a valid detect cache instead of detecting', async () => {
    const appPath = join(home, 'Adobe Photoshop 2026.app');
    mkdirSync(appPath);
    writePhotoshopDetectCache({ version: '27.9.1', path: appPath });

    const info = await new PhotoshopConnection().ensureDetected();

    expect(info?.path).toBe(appPath);
    expect(detect).not.toHaveBeenCalled();
  });
});

describe('PhotoshopConnection recovers from a stale cached install', () => {
  let home: string;
  let stalePath: string;
  let freshPath: string;
  let previousHome: string | undefined;
  let previousPsPath: string | undefined;
  let targets: Array<string | undefined>;

  const appResolveFailure = new Error(
    'Command failed: osascript "/tmp/photoshop-applescript-1.scpt"\n' +
      'execution error: An error of type -10814 has occurred. (-10814)'
  );

  beforeEach(() => {
    previousHome = process.env.PHOTOSHOP_MCP_HOME;
    previousPsPath = process.env.PHOTOSHOP_PATH;
    delete process.env.PHOTOSHOP_PATH;
    home = mkdtempSync(join(tmpdir(), 'ph-mcp-stale-'));
    process.env.PHOTOSHOP_MCP_HOME = home;
    stalePath = join(home, 'Adobe Photoshop 2025.app');
    freshPath = join(home, 'Adobe Photoshop 2026.app');
    mkdirSync(stalePath);
    mkdirSync(freshPath);
    writePhotoshopDetectCache({
      version: '26.11.0',
      path: stalePath,
      appName: 'Adobe Photoshop 2025',
    });
    detect.mockReset();
    detect.mockResolvedValue(installed(freshPath));
    targets = [];
    vi.spyOn(MacOSExecutor.prototype, 'isPhotoshopRunning').mockResolvedValue(true);
  });

  afterEach(() => {
    if (previousHome === undefined) delete process.env.PHOTOSHOP_MCP_HOME;
    else process.env.PHOTOSHOP_MCP_HOME = previousHome;
    if (previousPsPath === undefined) delete process.env.PHOTOSHOP_PATH;
    else process.env.PHOTOSHOP_PATH = previousPsPath;
    rmSync(home, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function mockExecute(...outcomes: Array<Error | string>) {
    const queue = [...outcomes];
    return vi.spyOn(MacOSExecutor.prototype, 'execute').mockImplementation(async function (
      this: MacOSExecutor
    ) {
      targets.push((this as unknown as { appPath?: string }).appPath);
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (next instanceof Error) throw next;
      return next;
    });
  }

  it('detects again and retries once when AppleScript cannot resolve the cached app', async () => {
    const execute = mockExecute(appResolveFailure, 'ok');
    const connection = new PhotoshopConnection();

    await expect(connection.executeScript('return 1;')).resolves.toBe('ok');

    expect(detect).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(targets).toEqual([stalePath, freshPath]);
    expect(connection.getPhotoshopInfo()?.path).toBe(freshPath);
    expect(readPhotoshopDetectCache()?.path).toBe(freshPath);
  });

  it('recovers the same way when the session hydrated the cache at startup', async () => {
    mockExecute(appResolveFailure, 'ok');
    const connection = new PhotoshopConnection();
    expect(connection.hydrateFromCache()).toBe(true);

    await expect(connection.executeScript('return 1;')).resolves.toBe('ok');
    expect(targets).toEqual([stalePath, freshPath]);
  });

  it('detects again when the cached executable cannot be launched', async () => {
    vi.spyOn(MacOSExecutor.prototype, 'isPhotoshopRunning').mockResolvedValue(false);
    const launch = vi
      .spyOn(MacOSExecutor.prototype, 'launchPhotoshop')
      .mockRejectedValueOnce(
        new Error(
          'Failed to launch Photoshop: spawn C:\\Adobe Photoshop 2025\\Photoshop.exe ENOENT'
        )
      )
      .mockResolvedValueOnce(undefined);
    mockExecute('ok');

    await expect(new PhotoshopConnection().executeScript('return 1;')).resolves.toBe('ok');
    expect(launch.mock.calls.map(([path]) => path)).toEqual([stalePath, freshPath]);
  });

  it('retries only once', async () => {
    const execute = mockExecute(appResolveFailure);

    await expect(new PhotoshopConnection().executeScript('return 1;')).rejects.toThrow(
      /\(-10814\)/
    );
    expect(detect).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('does not re-detect an install that was just detected', async () => {
    clearPhotoshopDetectCache();
    const execute = mockExecute(appResolveFailure);

    await expect(new PhotoshopConnection().executeScript('return 1;')).rejects.toThrow(
      /\(-10814\)/
    );
    expect(detect).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a script timeout', 'Script execution timeout'],
    ['an ExtendScript error', 'Error 8: Syntax error. (number: 8)'],
    [
      'Photoshop not running',
      'execution error: Adobe Photoshop 2025 got an error: Application isn’t running. (-600)',
    ],
  ])('leaves the cache alone after %s', async (_label, message) => {
    const execute = mockExecute(new Error(message));

    await expect(new PhotoshopConnection().executeScript('return 1;')).rejects.toThrow(message);
    expect(detect).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(readPhotoshopDetectCache()?.path).toBe(stalePath);
  });

  it('invalidateDetection forgets the install in memory and on disk', async () => {
    const connection = new PhotoshopConnection();
    expect(connection.hydrateFromCache()).toBe(true);

    connection.invalidateDetection();

    expect(connection.getPhotoshopInfo()).toBeNull();
    expect(readPhotoshopDetectCache()).toBeNull();
    await expect(connection.ensureDetected()).resolves.toMatchObject({ path: freshPath });
    expect(detect).toHaveBeenCalledTimes(1);
  });
});
