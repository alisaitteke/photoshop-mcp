import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPhotoshopMcpHomeDir } from '../lib/export-paths.js';

/** Cursor often respawns stdio; treat activity inside this window as one session. */
export const MCP_LOGICAL_SESSION_IDLE_MS = 30 * 60 * 1000;

const STORE_FILE = 'mcp-logical-session.json';

export interface LogicalSessionRecord {
  id: string;
  startedAt: number;
  lastSeenAt: number;
  clientName?: string;
  clientVersion?: string;
  connectCount: number;
}

export interface ClosedLogicalSession {
  durationMs: number;
  shutdownReason: 'idle_timeout';
}

export interface BeginLogicalSessionResult {
  isNew: boolean;
  session: LogicalSessionRecord;
  closedPrevious?: ClosedLogicalSession;
}

let memory: LogicalSessionRecord | null = null;

function storePath(): string {
  return join(getPhotoshopMcpHomeDir(), STORE_FILE);
}

function readStore(): LogicalSessionRecord | null {
  if (memory) return memory;
  try {
    const raw = JSON.parse(readFileSync(storePath(), 'utf8')) as Partial<LogicalSessionRecord>;
    if (
      raw &&
      typeof raw.id === 'string' &&
      typeof raw.startedAt === 'number' &&
      typeof raw.lastSeenAt === 'number'
    ) {
      memory = {
        id: raw.id,
        startedAt: raw.startedAt,
        lastSeenAt: raw.lastSeenAt,
        connectCount: typeof raw.connectCount === 'number' ? raw.connectCount : 0,
        ...(typeof raw.clientName === 'string' ? { clientName: raw.clientName } : {}),
        ...(typeof raw.clientVersion === 'string' ? { clientVersion: raw.clientVersion } : {}),
      };
      return memory;
    }
  } catch {
    // Missing or corrupt store — start a new logical session.
  }
  return null;
}

function writeStore(record: LogicalSessionRecord): void {
  memory = record;
  mkdirSync(getPhotoshopMcpHomeDir(), { recursive: true, mode: 0o700 });
  writeFileSync(storePath(), JSON.stringify(record), { mode: 0o600 });
}

export function beginLogicalSession(now = Date.now()): BeginLogicalSessionResult {
  const existing = readStore();
  if (existing && now - existing.lastSeenAt < MCP_LOGICAL_SESSION_IDLE_MS) {
    const session = { ...existing, lastSeenAt: now };
    writeStore(session);
    return { isNew: false, session };
  }

  const closedPrevious = existing
    ? {
        durationMs: Math.max(0, existing.lastSeenAt - existing.startedAt),
        shutdownReason: 'idle_timeout' as const,
      }
    : undefined;

  const session: LogicalSessionRecord = {
    id: randomUUID(),
    startedAt: now,
    lastSeenAt: now,
    connectCount: 0,
  };
  writeStore(session);
  return { isNew: true, session, closedPrevious };
}

export function noteLogicalSessionActivity(now = Date.now()): void {
  const existing = readStore();
  if (!existing) return;
  writeStore({ ...existing, lastSeenAt: now });
}

export function bindLogicalSessionClient(
  client: { name?: string; version?: string },
  now = Date.now()
): { emitConnected: boolean; connectCount: number } {
  let session = readStore();
  if (!session) {
    session = beginLogicalSession(now).session;
  }

  const name = client.name?.trim() || 'unknown';
  const version = client.version?.trim() || 'unknown';
  const sameClient = session.clientName === name && session.clientVersion === version;

  if (sameClient) {
    writeStore({ ...session, lastSeenAt: now });
    return { emitConnected: false, connectCount: session.connectCount };
  }

  const connectCount = session.connectCount + 1;
  writeStore({
    ...session,
    lastSeenAt: now,
    clientName: name,
    clientVersion: version,
    connectCount,
  });
  return { emitConnected: true, connectCount };
}

export function getLogicalSession(): LogicalSessionRecord | null {
  return readStore();
}

/** Clears in-process state so tests can switch `PHOTOSHOP_MCP_HOME`. */
export function resetLogicalSessionForTests(): void {
  memory = null;
}
