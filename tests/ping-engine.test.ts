import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PING_CONNECTED_TEXT, PING_FAILED_TEXT } from '../src/feedback/nudge.js';

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return { ...actual, platform: () => 'darwin' };
});

vi.mock('../src/platform/detector.js', () => ({
  PhotoshopDetector: class {
    async detect() {
      return {
        version: '27.9.1',
        path: '/Applications/Adobe Photoshop 2026/Adobe Photoshop 2026.app',
        isRunning: true,
        appName: 'Adobe Photoshop 2026',
      };
    }
  },
}));

import { MacOSExecutor } from '../src/platform/macos-executor.js';
import { PhotoshopConnection } from '../src/platform/connection.js';
import { probePhotoshopEngine, PING_PROBE_SCRIPT } from '../src/core/ping-engine.js';

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text)
    .join('\n');
}

describe('probePhotoshopEngine', () => {
  let home: string;
  let previousHome: string | undefined;
  let previousFeedback: string | undefined;

  beforeEach(() => {
    previousHome = process.env.PHOTOSHOP_MCP_HOME;
    previousFeedback = process.env.PSMCP_FEEDBACK;
    process.env.PSMCP_FEEDBACK = '0';
    home = mkdtempSync(join(tmpdir(), 'ph-mcp-ping-'));
    process.env.PHOTOSHOP_MCP_HOME = home;
  });

  afterEach(() => {
    if (previousHome === undefined) delete process.env.PHOTOSHOP_MCP_HOME;
    else process.env.PHOTOSHOP_MCP_HOME = previousHome;
    if (previousFeedback === undefined) delete process.env.PSMCP_FEEDBACK;
    else process.env.PSMCP_FEEDBACK = previousFeedback;
    rmSync(home, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('succeeds only after the probe script runs', async () => {
    const execute = vi.spyOn(MacOSExecutor.prototype, 'execute').mockResolvedValue(1);
    vi.spyOn(MacOSExecutor.prototype, 'isPhotoshopRunning').mockResolvedValue(true);
    const result = await probePhotoshopEngine(new PhotoshopConnection());
    expect(textOf(result)).toBe(PING_CONNECTED_TEXT);
    expect(result.isError).toBeUndefined();
    expect(execute).toHaveBeenCalledWith(expect.stringContaining(PING_PROBE_SCRIPT), 30_000);
  });

  it('fails without launching when Photoshop is not running', async () => {
    vi.spyOn(MacOSExecutor.prototype, 'isPhotoshopRunning').mockResolvedValue(false);
    const launch = vi.spyOn(MacOSExecutor.prototype, 'launchPhotoshop').mockResolvedValue(undefined);
    const execute = vi.spyOn(MacOSExecutor.prototype, 'execute').mockResolvedValue(1);
    const result = await probePhotoshopEngine(new PhotoshopConnection());
    expect(textOf(result)).toBe(PING_FAILED_TEXT);
    expect(launch).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not report success when the probe times out on a busy engine', async () => {
    vi.spyOn(MacOSExecutor.prototype, 'isPhotoshopRunning').mockResolvedValue(true);
    vi.spyOn(MacOSExecutor.prototype, 'execute').mockRejectedValue(
      new Error('Script execution timeout')
    );
    await expect(probePhotoshopEngine(new PhotoshopConnection())).rejects.toThrow(
      /script execution timeout/i
    );
  });
});
