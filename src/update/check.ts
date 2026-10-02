import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAppVersion } from '../analytics/app-version.js';
import { getPhotoshopMcpHomeDir, PHOTOSHOP_MCP_SURFACE_ENV } from '../lib/export-paths.js';
import { Logger } from '../utils/logger.js';

export const UPDATE_CHECK_ENV = 'PSMCP_UPDATE_CHECK';
export const INSTALL_CHANNEL_ENV = 'PSMCP_INSTALL_CHANNEL';
export const UPDATE_NOTICE_MARKER = 'UPDATE_AVAILABLE';
export const NPM_PACKAGE_NAME = '@alisaitteke/photoshop-mcp';
/** dist-tags only: ~20 bytes instead of the full packument. */
export const UPDATE_CHECK_URL =
  'https://registry.npmjs.org/-/package/@alisaitteke%2fphotoshop-mcp/dist-tags';
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const UPDATE_CHECK_TIMEOUT_MS = 3000;
export const UPDATE_NOTICE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type InstallChannel = 'npx' | 'mcpb' | 'npm' | 'source';

export interface UpdateCheckStore {
  /** Last successful registry lookup. Failed lookups are not stamped, so the next start retries. */
  checkedAt?: number;
  latestVersion?: string;
  notifiedAt?: number;
  notifiedVersion?: string;
}

export interface UpdateNotice {
  currentVersion: string;
  latestVersion: string;
  channel: InstallChannel;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const STORE_FILE = 'update-check.json';
const INSTALL_CHANNELS: readonly InstallChannel[] = ['npx', 'mcpb', 'npm', 'source'];
const logger = new Logger('UpdateCheck');

let inflight: Promise<void> | null = null;

function getStorePath(): string {
  return join(getPhotoshopMcpHomeDir(), STORE_FILE);
}

function readStore(): UpdateCheckStore {
  try {
    const parsed = JSON.parse(readFileSync(getStorePath(), 'utf8')) as UpdateCheckStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: UpdateCheckStore): void {
  const dir = getPhotoshopMcpHomeDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(getStorePath(), JSON.stringify(store), { mode: 0o600 });
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** True while `since` is in the past and less than `windowMs` ago (a clock set backwards expires it). */
function withinWindow(since: unknown, now: number, windowMs: number): boolean {
  return isFiniteTimestamp(since) && since <= now && now - since < windowMs;
}

function envFalsy(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === '0' || v === 'false' || v === 'no';
}

function envTruthy(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return Boolean(v) && !envFalsy(v);
}

/**
 * On by default. Off with `PSMCP_UPDATE_CHECK=0`, any `NO_UPDATE_NOTIFIER`, a truthy `CI`,
 * and when the standalone UI spawns this server (its agent is not the user's host).
 */
export function isUpdateCheckEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (envFalsy(env[UPDATE_CHECK_ENV])) return false;
  if (env.NO_UPDATE_NOTIFIER?.trim()) return false;
  if (envTruthy(env.CI)) return false;
  if (env[PHOTOSHOP_MCP_SURFACE_ENV]?.trim().toLowerCase() === 'ui') return false;
  return true;
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
}

export function parseVersion(raw: string): ParsedVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    raw.trim()
  );
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

/** True when `latest` is a stable release newer than `current`. Unknown versions never notify. */
export function isNewerStableVersion(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  if (!l || !c || l.prerelease) return false;
  if (c.major === 0 && c.minor === 0 && c.patch === 0) return false;
  if (l.major !== c.major) return l.major > c.major;
  if (l.minor !== c.minor) return l.minor > c.minor;
  if (l.patch !== c.patch) return l.patch > c.patch;
  // Same x.y.z: the stable release is newer than a prerelease of it.
  return c.prerelease !== null;
}

const MODULE_PATH = fileURLToPath(import.meta.url);

/** How this copy was installed, so the notice can give one correct update step. */
export function detectInstallChannel(
  env: NodeJS.ProcessEnv = process.env,
  modulePath: string = MODULE_PATH
): InstallChannel {
  const explicit = env[INSTALL_CHANNEL_ENV]?.trim().toLowerCase();
  if (explicit && (INSTALL_CHANNELS as readonly string[]).includes(explicit)) {
    return explicit as InstallChannel;
  }
  const path = modulePath.replace(/\\/g, '/');
  if (/\/_npx\//.test(path) || /\/dlx\//.test(path)) return 'npx';
  if (/\/claude extensions\//i.test(path)) return 'mcpb';
  if (/\/node_modules\//.test(path)) return 'npm';
  return 'source';
}

export function buildUpdateInstruction(channel: InstallChannel, currentVersion: string): string {
  switch (channel) {
    case 'npx':
      return (
        'Restart the MCP client (or reload this MCP server) so npx starts the new version. ' +
        `If it still starts ${currentVersion}, change the server args to \`-y ${NPM_PACKAGE_NAME}@latest\` and restart.`
      );
    case 'mcpb':
      return 'Update the Photoshop MCP extension in Claude Desktop (Settings → Extensions) or install the latest .mcpb bundle, then restart Claude Desktop.';
    case 'npm':
      return `Run \`npm install -g ${NPM_PACKAGE_NAME}@latest\` (or update it where it was installed), then restart the MCP client.`;
    case 'source':
      return 'Run `git pull && npm install && npm run build` in the photoshop-mcp checkout, then restart the MCP client.';
  }
}

/** Latest dist-tag from npm, or undefined on any failure (offline, timeout, bad payload). */
export async function fetchLatestVersion(
  fetchImpl: FetchLike = fetch,
  timeoutMs: number = UPDATE_CHECK_TIMEOUT_MS
): Promise<string | undefined> {
  try {
    const response = await fetchImpl(UPDATE_CHECK_URL, {
      headers: {
        accept: 'application/json',
        'user-agent': `photoshop-mcp/${getAppVersion()}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { latest?: unknown } | null;
    const latest = body?.latest;
    return typeof latest === 'string' && parseVersion(latest) ? latest.trim() : undefined;
  } catch (error) {
    logger.debug('Update check failed:', error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

export interface RefreshUpdateCheckOptions {
  now?: number;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

async function runRefresh(options: RefreshUpdateCheckOptions): Promise<void> {
  const now = options.now ?? Date.now();
  if (withinWindow(readStore().checkedAt, now, UPDATE_CHECK_INTERVAL_MS)) return;
  const latest = await fetchLatestVersion(options.fetchImpl, options.timeoutMs);
  if (!latest) return;
  try {
    writeStore({ ...readStore(), checkedAt: now, latestVersion: latest });
  } catch (error) {
    logger.debug(
      'Could not save update check:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Look up the latest npm release at most once per 24 hours and cache it under
 * ~/.photoshop-mcp/update-check.json. Never throws; concurrent calls share one request.
 * Tool calls only read the cache, so a slow or missing network never delays them.
 */
export function refreshUpdateCheck(options: RefreshUpdateCheckOptions = {}): Promise<void> {
  if (!isUpdateCheckEnabled()) return Promise.resolve();
  if (inflight) return inflight;
  inflight = runRefresh(options)
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** A notice when the cached release is newer and none was shown in the last 7 days. */
export function getDueUpdateNotice(
  now: number = Date.now(),
  currentVersion: string = getAppVersion()
): UpdateNotice | null {
  if (!isUpdateCheckEnabled()) return null;
  const store = readStore();
  const latest = store.latestVersion;
  if (typeof latest !== 'string' || !isNewerStableVersion(latest, currentVersion)) return null;
  if (withinWindow(store.notifiedAt, now, UPDATE_NOTICE_COOLDOWN_MS)) return null;
  return { currentVersion, latestVersion: latest, channel: detectInstallChannel() };
}

export function markUpdateNoticeShown(latestVersion: string, now: number = Date.now()): void {
  writeStore({ ...readStore(), notifiedAt: now, notifiedVersion: latestVersion });
}

export function buildUpdateNoticeBlock(notice: UpdateNotice): string {
  return [
    UPDATE_NOTICE_MARKER,
    `photoshop-mcp ${notice.latestVersion} is available. This session runs ${notice.currentVersion}.`,
    'Tell the user now, once, in one short sentence in the language they are using in this conversation, and include the update step below.',
    "Do not ask a question, do not open the host question UI, and do not run the update step yourself. Then continue the user's original request immediately. Do not end the turn on this notice.",
    '',
    `Update step: ${buildUpdateInstruction(notice.channel, notice.currentVersion)}`,
  ].join('\n');
}

/**
 * The UPDATE_AVAILABLE block for this ping, or null. Starts the 7-day cooldown when it
 * returns a block; if the cooldown cannot be saved, shows nothing rather than repeat it every ping.
 */
export function takeUpdateNoticeBlock(now: number = Date.now()): string | null {
  const notice = getDueUpdateNotice(now);
  if (!notice) return null;
  try {
    markUpdateNoticeShown(notice.latestVersion, now);
  } catch {
    return null;
  }
  return buildUpdateNoticeBlock(notice);
}
