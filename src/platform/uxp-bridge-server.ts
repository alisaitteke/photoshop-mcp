/**
 * MCP-hosted UXP bridge server — companion Photoshop plugin polls for commands.
 * See docs/plans/2026-07-03-1149-photoshop-ai-features/ and uxp-plugin/.
 */
import { createServer, type Server } from 'node:http';
import { Logger } from '../utils/logger.js';

const logger = new Logger('UxpBridgeServer');

export interface UxpBridgeCommand {
  id: string;
  action: string;
  params: Record<string, unknown>;
}

export interface UxpBridgeResult {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

const DEFAULT_PORT = Number.parseInt(process.env.PHOTOSHOP_UXP_BRIDGE_PORT ?? '38452', 10);

/**
 * The plugin polls every 400ms; after this long without any traffic it is
 * gone. Commands currently being executed also count as liveness: the
 * plugin's poll loop awaits each command inline, so a long batchPlay (up to
 * the 90s neural-filter budget) pauses polling without the plugin being
 * dead.
 */
const PLUGIN_STALE_MS = 3000;
const COMMAND_LIVENESS_MS = 120_000;

let server: Server | null = null;
let listenPort = DEFAULT_PORT;
const pendingCommands: UxpBridgeCommand[] = [];
const results = new Map<string, UxpBridgeResult>();
let lastPollAt: number | null = null;
let lastResultAt: number | null = null;
/** Commands picked up by a poller but not yet resolved, keyed by id → picked-at. */
const inFlightCommands = new Map<string, number>();

function json(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function getUxpBridgePort(): number {
  return listenPort;
}

/**
 * True when the Photoshop plugin is connected — the only real signal that
 * the bridge panel is loaded and running. A plain HTTP check of /health
 * only proves this Node server exists, not that anything in Photoshop is
 * talking to it. Liveness is any of:
 * - a `/poll` within PLUGIN_STALE_MS,
 * - a `/result` within PLUGIN_STALE_MS,
 * - a command the plugin picked up but has not resolved yet (its poll loop
 *   awaits commands inline, so polls pause while one runs).
 */
export function isUxpPluginPolling(): boolean {
  const now = Date.now();
  if (lastPollAt !== null && now - lastPollAt < PLUGIN_STALE_MS) return true;
  if (lastResultAt !== null && now - lastResultAt < PLUGIN_STALE_MS) return true;
  for (const [id, pickedAt] of inFlightCommands) {
    if (now - pickedAt < COMMAND_LIVENESS_MS) return true;
    inFlightCommands.delete(id); // stale beyond any command budget
  }
  return false;
}

/** Milliseconds since the last plugin contact, or null if it never polled. */
export function getLastPollAgeMs(): number | null {
  const candidates = [lastPollAt, lastResultAt].filter((t): t is number => t !== null);
  return candidates.length === 0 ? null : Date.now() - Math.max(...candidates);
}

export async function ensureUxpBridgeServer(): Promise<number> {
  if (server) return listenPort;

  return new Promise((resolve, reject) => {
    const s = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${listenPort}`);

      if (req.method === 'GET' && url.pathname === '/health') {
        json(res, 200, {
          ok: true,
          pending: pendingCommands.length,
          plugin_polling: isUxpPluginPolling(),
          last_poll_age_ms: getLastPollAgeMs(),
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/poll') {
        lastPollAt = Date.now();
        const cmd = pendingCommands.shift();
        if (!cmd) {
          res.writeHead(204);
          res.end();
          return;
        }
        inFlightCommands.set(cmd.id, lastPollAt);
        json(res, 200, cmd);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/result') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body) as UxpBridgeResult;
            if (parsed?.id) {
              results.set(parsed.id, parsed);
              inFlightCommands.delete(parsed.id);
              lastResultAt = Date.now();
            }
            json(res, 200, { ok: true });
          } catch {
            json(res, 400, { ok: false, error: 'invalid_json' });
          }
        });
        return;
      }

      json(res, 404, { ok: false, error: 'not_found' });
    });

    s.listen(listenPort, '127.0.0.1', () => {
      server = s;
      const addr = s.address();
      if (addr && typeof addr === 'object') {
        listenPort = addr.port;
      }
      logger.info(`UXP bridge listening on 127.0.0.1:${listenPort}`);
      resolve(listenPort);
    });

    s.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        listenPort += 1;
        s.listen(listenPort, '127.0.0.1');
        return;
      }
      reject(err);
    });
  });
}

export async function invokeUxpBridge(
  action: string,
  params: Record<string, unknown>,
  timeoutMs = 60_000
): Promise<UxpBridgeResult> {
  await ensureUxpBridgeServer();
  const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pendingCommands.push({ id, action, params });

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const hit = results.get(id);
    if (hit) {
      results.delete(id);
      return hit;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  inFlightCommands.delete(id);
  return { id, ok: false, error: 'uxp_bridge_timeout' };
}

export async function shutdownUxpBridgeServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
  lastPollAt = null;
  lastResultAt = null;
  inFlightCommands.clear();
}
