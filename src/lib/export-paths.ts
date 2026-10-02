import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, normalize, relative, resolve } from 'node:path';

const EXPORTS_SUBDIR = 'exports';

/** Set by the UI chat runner so default exports land under ~/.photoshop-mcp/exports/<id>/. */
export const PHOTOSHOP_EXPORT_CHAT_ID_ENV = 'PHOTOSHOP_EXPORT_CHAT_ID';

/** Set to `ui` when the standalone UI spawns this MCP as a child (skip host-tool feedback nudge). */
export const PHOTOSHOP_MCP_SURFACE_ENV = 'PHOTOSHOP_MCP_SURFACE';

export function sanitizeExportChatSegment(raw: string | undefined | null): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return null;
  if (t === '.' || t === '..') return null;
  return t;
}

export function getPhotoshopMcpHomeDir(): string {
  const env = process.env.PHOTOSHOP_MCP_HOME?.trim();
  if (env) return env;
  return join(homedir(), '.photoshop-mcp');
}

export function getPhotoshopExportsDir(): string {
  const dir = join(getPhotoshopMcpHomeDir(), EXPORTS_SUBDIR);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function getPhotoshopExportsWorkingDir(): string {
  const root = getPhotoshopExportsDir();
  const seg = sanitizeExportChatSegment(process.env[PHOTOSHOP_EXPORT_CHAT_ID_ENV]);
  if (!seg) return root;
  const dir = join(root, seg);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function normalizeExt(ext: string): string {
  const e = ext.replace(/^\.+/, '').toLowerCase();
  return e || 'bin';
}

function assertResolvedUnderExports(exportsDir: string, resolved: string): void {
  const rel = relative(exportsDir, resolved);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('Resolved path escapes Photoshop MCP exports directory');
  }
}

/**
 * Resolve a save/export path: optional user path, default file under
 * ~/.photoshop-mcp/exports (or ~/.photoshop-mcp/exports/<chatId> in UI mode).
 */
export function resolveExportPath(userPath: string | undefined, ext: string): string {
  const exportsDir = getPhotoshopExportsWorkingDir();
  const dotExt = `.${normalizeExt(ext)}`;

  const trimmed = userPath?.trim();
  if (!trimmed) {
    const base = `photoshop-export-${Date.now()}-${randomBytes(4).toString('hex')}${dotExt}`;
    return join(exportsDir, base);
  }

  if (isAbsolute(trimmed)) {
    return normalize(trimmed);
  }

  const resolved = resolve(exportsDir, trimmed);
  assertResolvedUnderExports(exportsDir, resolved);
  return resolved;
}
