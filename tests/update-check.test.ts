import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAppVersion } from '../src/analytics/app-version.js';
import {
  FEEDBACK_NUDGE_ENV,
  FEEDBACK_NUDGE_MARKER,
  FEEDBACK_NUDGE_MIN_AGE_MS,
  PING_CONNECTED_TEXT,
  PING_FAILED_TEXT,
  buildPingToolResult,
  markFeedbackFirstSeen,
} from '../src/feedback/nudge.js';
import { PHOTOSHOP_MCP_SURFACE_ENV } from '../src/lib/export-paths.js';
import {
  INSTALL_CHANNEL_ENV,
  NPM_PACKAGE_NAME,
  UPDATE_CHECK_ENV,
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_CHECK_URL,
  UPDATE_NOTICE_COOLDOWN_MS,
  UPDATE_NOTICE_MARKER,
  buildUpdateInstruction,
  detectInstallChannel,
  fetchLatestVersion,
  getDueUpdateNotice,
  isNewerStableVersion,
  isUpdateCheckEnabled,
  refreshUpdateCheck,
  takeUpdateNoticeBlock,
  type UpdateCheckStore,
} from '../src/update/check.js';

const ENV_KEYS = [
  'PHOTOSHOP_MCP_HOME',
  UPDATE_CHECK_ENV,
  INSTALL_CHANNEL_ENV,
  'NO_UPDATE_NOTIFIER',
  'CI',
  PHOTOSHOP_MCP_SURFACE_ENV,
  FEEDBACK_NUDGE_ENV,
  'ANALYTICS_DISABLED',
  'POSTHOG_DISABLED',
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function textBlocks(result: { content: Array<{ type: string; text?: string }> }): string[] {
  return result.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string);
}

describe('update check', () => {
  let home: string;
  const saved: Record<string, string | undefined> = {};

  function storePath(): string {
    return join(home, 'update-check.json');
  }

  function readUpdateStore(): UpdateCheckStore {
    return JSON.parse(readFileSync(storePath(), 'utf8')) as UpdateCheckStore;
  }

  function seedStore(store: UpdateCheckStore): void {
    writeFileSync(storePath(), JSON.stringify(store));
  }

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    for (const key of ENV_KEYS) delete process.env[key];
    home = mkdtempSync(join(tmpdir(), 'ph-mcp-update-'));
    process.env.PHOTOSHOP_MCP_HOME = home;
    process.env[INSTALL_CHANNEL_ENV] = 'npx';
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    rmSync(home, { recursive: true, force: true });
  });

  describe('isNewerStableVersion', () => {
    it.each([
      ['1.7.28', '1.7.27', true],
      ['1.8.0', '1.7.27', true],
      ['2.0.0', '1.99.99', true],
      ['1.10.0', '1.9.9', true],
      ['v1.7.28', '1.7.27', true],
      ['1.7.27', '1.7.27', false],
      ['1.7.26', '1.7.27', false],
      ['1.8.0-beta.1', '1.7.27', false],
      ['1.8.0', '1.8.0-beta.1', true],
      ['1.8.0', '0.0.0', false],
      ['latest', '1.7.27', false],
      ['1.8.0', 'dev', false],
    ])('%s newer than %s → %s', (latest, current, expected) => {
      expect(isNewerStableVersion(latest, current)).toBe(expected);
    });
  });

  describe('isUpdateCheckEnabled', () => {
    it('is on by default', () => {
      expect(isUpdateCheckEnabled({})).toBe(true);
      expect(isUpdateCheckEnabled({ [UPDATE_CHECK_ENV]: 'true' })).toBe(true);
      expect(isUpdateCheckEnabled({ CI: 'false' })).toBe(true);
    });

    it.each(['0', 'false', 'no', ' FALSE '])('is off when PSMCP_UPDATE_CHECK=%s', (value) => {
      expect(isUpdateCheckEnabled({ [UPDATE_CHECK_ENV]: value })).toBe(false);
    });

    it('is off with NO_UPDATE_NOTIFIER, in CI and on the standalone UI surface', () => {
      expect(isUpdateCheckEnabled({ NO_UPDATE_NOTIFIER: '1' })).toBe(false);
      expect(isUpdateCheckEnabled({ CI: 'true' })).toBe(false);
      expect(isUpdateCheckEnabled({ [PHOTOSHOP_MCP_SURFACE_ENV]: 'ui' })).toBe(false);
    });
  });

  describe('detectInstallChannel', () => {
    it('prefers PSMCP_INSTALL_CHANNEL and ignores unknown values', () => {
      expect(detectInstallChannel({ [INSTALL_CHANNEL_ENV]: 'MCPB' }, '/x/node_modules/y.js')).toBe(
        'mcpb'
      );
      expect(
        detectInstallChannel({ [INSTALL_CHANNEL_ENV]: 'brew' }, '/repo/dist/update/check.js')
      ).toBe('source');
    });

    it.each([
      [
        '/Users/a/.npm/_npx/0f1e2d/node_modules/@alisaitteke/photoshop-mcp/dist/update/check.js',
        'npx',
      ],
      [
        'C:\\Users\\a\\AppData\\Local\\npm-cache\\_npx\\0f1e2d\\node_modules\\@alisaitteke\\photoshop-mcp\\dist\\update\\check.js',
        'npx',
      ],
      ['/Users/a/Library/Caches/pnpm/dlx/abc/node_modules/.pnpm/x/dist/update/check.js', 'npx'],
      [
        '/Users/a/Library/Application Support/Claude/Claude Extensions/photoshop-mcp/server/dist/update/check.js',
        'mcpb',
      ],
      ['/opt/homebrew/lib/node_modules/@alisaitteke/photoshop-mcp/dist/update/check.js', 'npm'],
      ['/Users/a/Development/photoshop-mcp/dist/update/check.js', 'source'],
    ])('%s → %s', (path, expected) => {
      expect(detectInstallChannel({}, path)).toBe(expected);
    });
  });

  it('gives one update step per install channel', () => {
    expect(buildUpdateInstruction('npx', '1.7.27')).toContain(`${NPM_PACKAGE_NAME}@latest`);
    expect(buildUpdateInstruction('npx', '1.7.27')).toContain('1.7.27');
    expect(buildUpdateInstruction('mcpb', '1.7.27')).toMatch(/Claude Desktop/);
    expect(buildUpdateInstruction('npm', '1.7.27')).toContain(
      `npm install -g ${NPM_PACKAGE_NAME}@latest`
    );
    expect(buildUpdateInstruction('source', '1.7.27')).toContain('git pull');
  });

  describe('fetchLatestVersion', () => {
    it('reads the latest dist-tag with a timeout signal', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ latest: '1.8.0', next: '2.0.0-rc.1' }));
      await expect(fetchLatestVersion(fetchImpl)).resolves.toBe('1.8.0');
      expect(fetchImpl).toHaveBeenCalledWith(
        UPDATE_CHECK_URL,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('returns undefined on HTTP errors, network errors and bad payloads', async () => {
      await expect(fetchLatestVersion(async () => jsonResponse({}, 404))).resolves.toBeUndefined();
      await expect(
        fetchLatestVersion(async () => {
          throw new Error('getaddrinfo ENOTFOUND registry.npmjs.org');
        })
      ).resolves.toBeUndefined();
      await expect(
        fetchLatestVersion(async () => jsonResponse({ latest: 42 }))
      ).resolves.toBeUndefined();
      await expect(fetchLatestVersion(async () => new Response('<html>'))).resolves.toBeUndefined();
    });

    it('gives up after the timeout', async () => {
      const hang = (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      await expect(fetchLatestVersion(hang, 20)).resolves.toBeUndefined();
    });
  });

  describe('refreshUpdateCheck', () => {
    it('caches the latest version', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ latest: '1.8.0' }));
      await refreshUpdateCheck({ now: 1_000_000, fetchImpl });
      expect(readUpdateStore()).toMatchObject({ checkedAt: 1_000_000, latestVersion: '1.8.0' });
    });

    it('asks npm at most once per 24 hours', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ latest: '1.8.0' }));
      await refreshUpdateCheck({ now: 1_000_000, fetchImpl });
      await refreshUpdateCheck({ now: 1_000_000 + UPDATE_CHECK_INTERVAL_MS - 1, fetchImpl });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      await refreshUpdateCheck({ now: 1_000_000 + UPDATE_CHECK_INTERVAL_MS, fetchImpl });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('rechecks when the clock went backwards', async () => {
      seedStore({ checkedAt: 5_000_000, latestVersion: '1.8.0' });
      const fetchImpl = vi.fn(async () => jsonResponse({ latest: '1.8.1' }));
      await refreshUpdateCheck({ now: 1_000_000, fetchImpl });
      expect(readUpdateStore().latestVersion).toBe('1.8.1');
    });

    it('does not stamp a failed lookup, so the next start retries', async () => {
      await refreshUpdateCheck({
        now: 1_000_000,
        fetchImpl: async () => {
          throw new Error('offline');
        },
      });
      expect(existsSync(storePath())).toBe(false);
    });

    it('keeps the notice cooldown when it refreshes', async () => {
      seedStore({ notifiedAt: 900_000, notifiedVersion: '1.7.30' });
      await refreshUpdateCheck({
        now: 1_000_000,
        fetchImpl: async () => jsonResponse({ latest: '1.8.0' }),
      });
      expect(readUpdateStore()).toMatchObject({ notifiedAt: 900_000, latestVersion: '1.8.0' });
    });

    it('shares one request between concurrent calls', async () => {
      const fetchImpl = vi.fn(async () => jsonResponse({ latest: '1.8.0' }));
      await Promise.all([
        refreshUpdateCheck({ now: 1_000_000, fetchImpl }),
        refreshUpdateCheck({ now: 1_000_000, fetchImpl }),
      ]);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('does not touch the network when disabled', async () => {
      process.env[UPDATE_CHECK_ENV] = '0';
      const fetchImpl = vi.fn(async () => jsonResponse({ latest: '1.8.0' }));
      await refreshUpdateCheck({ now: 1_000_000, fetchImpl });
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe('notice', () => {
    it('is not due without a cached lookup or when up to date', () => {
      expect(getDueUpdateNotice(1_000_000, '1.7.27')).toBeNull();
      seedStore({ checkedAt: 1, latestVersion: '1.7.27' });
      expect(getDueUpdateNotice(1_000_000, '1.7.27')).toBeNull();
    });

    it('builds an UPDATE_AVAILABLE block with the versions and the update step', () => {
      seedStore({ checkedAt: 1, latestVersion: '99.0.0' });
      expect(getDueUpdateNotice(1_000_000, '1.7.27')).toEqual({
        currentVersion: '1.7.27',
        latestVersion: '99.0.0',
        channel: 'npx',
      });
      const block = takeUpdateNoticeBlock(1_000_000);
      expect(block).not.toBeNull();
      expect(block!.split('\n')[0]).toBe(UPDATE_NOTICE_MARKER);
      expect(block).toContain('photoshop-mcp 99.0.0 is available');
      expect(block).toContain(`This session runs ${getAppVersion()}`);
      expect(block).toContain(`${NPM_PACKAGE_NAME}@latest`);
      expect(block).toMatch(/Do not ask a question/);
      expect(block).toMatch(/do not run the update step yourself/);
      expect(block).toMatch(/continue the user's original request/i);
    });

    it('shows at most once per 7 days', () => {
      seedStore({ checkedAt: 1, latestVersion: '99.0.0' });
      expect(takeUpdateNoticeBlock(1_000_000)).not.toBeNull();
      expect(readUpdateStore()).toMatchObject({ notifiedAt: 1_000_000, notifiedVersion: '99.0.0' });
      expect(takeUpdateNoticeBlock(1_000_001)).toBeNull();
      expect(takeUpdateNoticeBlock(1_000_000 + UPDATE_NOTICE_COOLDOWN_MS - 1)).toBeNull();
      expect(takeUpdateNoticeBlock(1_000_000 + UPDATE_NOTICE_COOLDOWN_MS)).not.toBeNull();
    });

    it('is not shown when disabled', () => {
      seedStore({ checkedAt: 1, latestVersion: '99.0.0' });
      process.env.NO_UPDATE_NOTIFIER = '1';
      expect(takeUpdateNoticeBlock(1_000_000)).toBeNull();
    });
  });

  describe('photoshop_ping result', () => {
    it('appends UPDATE_AVAILABLE after the connection line', () => {
      process.env[FEEDBACK_NUDGE_ENV] = '0';
      seedStore({ checkedAt: 1, latestVersion: '99.0.0' });
      const texts = textBlocks(buildPingToolResult(true, 1_000_000));
      expect(texts).toHaveLength(2);
      expect(texts[0]).toBe(PING_CONNECTED_TEXT);
      expect(texts[1]).toContain(UPDATE_NOTICE_MARKER);
    });

    it('does not add or consume the notice on a failed ping', () => {
      seedStore({ checkedAt: 1, latestVersion: '99.0.0' });
      expect(textBlocks(buildPingToolResult(false, 1_000_000))).toEqual([PING_FAILED_TEXT]);
      expect(readUpdateStore().notifiedAt).toBeUndefined();
    });

    it('never stacks with FEEDBACK_NUDGE; feedback waits for a later ping', () => {
      const firstSeenAt = 1_000_000;
      markFeedbackFirstSeen(firstSeenAt);
      seedStore({ checkedAt: 1, latestVersion: '99.0.0' });

      const dueAt = firstSeenAt + FEEDBACK_NUDGE_MIN_AGE_MS;
      const first = textBlocks(buildPingToolResult(true, dueAt));
      expect(first).toHaveLength(2);
      expect(first[1]).toContain(UPDATE_NOTICE_MARKER);
      expect(first[1]).not.toContain(FEEDBACK_NUDGE_MARKER);

      const feedbackStore = JSON.parse(readFileSync(join(home, 'feedback-nudge.json'), 'utf8')) as {
        lastShownAt?: number;
      };
      expect(feedbackStore.lastShownAt).toBeUndefined();

      const second = textBlocks(buildPingToolResult(true, dueAt + 1));
      expect(second).toHaveLength(2);
      expect(second[1]).toContain(FEEDBACK_NUDGE_MARKER);
    });
  });
});
