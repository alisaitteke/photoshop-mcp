import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPhotoshopMcpHomeDir } from '../../lib/export-paths.js';

/**
 * Lets `npm run dev:ui` pin one token across the server and the Vite proxy so
 * a server restart does not require the proxy to re-read the session file.
 */
export const SESSION_TOKEN_ENV = 'PSMCP_UI_TOKEN';

export const SESSION_TOKEN_HEADER = 'x-psmcp-token';

const SESSION_FILE_NAME = 'ui-session.json';

export interface SessionFile {
  token: string;
  port: number;
  pid: number;
  createdAt: number;
}

export function getSessionFilePath(): string {
  return join(getPhotoshopMcpHomeDir(), SESSION_FILE_NAME);
}

export function createSessionToken(): string {
  const override = process.env[SESSION_TOKEN_ENV]?.trim();
  if (override) return override;
  return randomBytes(32).toString('base64url');
}

export function writeSessionFile(session: Omit<SessionFile, 'createdAt'>): void {
  const path = getSessionFilePath();
  mkdirSync(getPhotoshopMcpHomeDir(), { recursive: true, mode: 0o700 });
  const payload: SessionFile = { ...session, createdAt: Date.now() };
  writeFileSync(path, JSON.stringify(payload), { mode: 0o600 });
}

export function readSessionFile(): SessionFile | null {
  try {
    const raw = readFileSync(getSessionFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<SessionFile>;
    if (typeof parsed.token !== 'string' || !parsed.token) return null;
    return {
      token: parsed.token,
      port: Number(parsed.port) || 0,
      pid: Number(parsed.pid) || 0,
      createdAt: Number(parsed.createdAt) || 0,
    };
  } catch {
    return null;
  }
}

export function removeSessionFile(): void {
  try {
    rmSync(getSessionFilePath(), { force: true });
  } catch {
    // A stale session file is harmless; never fail shutdown over it.
  }
}

export function matchesSessionToken(candidate: string | undefined, token: string): boolean {
  if (!candidate) return false;
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(token, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Accepts the dedicated header or an `Authorization: Bearer <token>` header. */
export function extractRequestToken(headers: {
  token: string | undefined;
  authorization: string | undefined;
}): string | undefined {
  const direct = headers.token?.trim();
  if (direct) return direct;
  const auth = headers.authorization?.trim();
  if (!auth) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match?.[1]?.trim() || undefined;
}
