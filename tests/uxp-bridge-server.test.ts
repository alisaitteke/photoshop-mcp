import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Ephemeral port so the test never binds (or steals) the real plugin port.
// Must be set BEFORE the dynamic import below: the module reads the env var
// at import time, and vitest hoists *static* imports above this assignment.
process.env.PHOTOSHOP_UXP_BRIDGE_PORT = '0';

const {
  ensureUxpBridgeServer,
  getUxpBridgePort,
  invokeUxpBridge,
  isUxpPluginPolling,
  shutdownUxpBridgeServer,
} = await import('../src/platform/uxp-bridge-server.js');

/** Raw HTTP request helpers — no fetch, so fake timers cannot stall them. */
const http = await import('node:http');

function get(path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: getUxpBridgePort(), path }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
  });
}

function post(path: string, payload: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: getUxpBridgePort(),
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        res.resume(); // drain the JSON body so 'end' fires
        res.on('end', () => resolve(res.statusCode ?? 0));
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
}

describe('UxpBridgeServer plugin handshake', () => {
  let port: number;

  beforeAll(async () => {
    port = await ensureUxpBridgeServer();
  });

  afterAll(async () => {
    await shutdownUxpBridgeServer();
  });

  it('binds an ephemeral port (not the production 38452) and reports the plugin as not polling', async () => {
    expect(port).toBeGreaterThan(0);
    expect(port).not.toBe(38452);
    const health = await get('/health');
    expect(health.status).toBe(200);
    const parsed = JSON.parse(health.body) as { ok: boolean; plugin_polling: boolean };
    expect(parsed.ok).toBe(true);
    // Nothing has polled yet — liveness of this HTTP server alone must not
    // read as "the Photoshop plugin is connected".
    expect(parsed.plugin_polling).toBe(false);
    expect(isUxpPluginPolling()).toBe(false);
  });

  it('marks the plugin as polling once /poll is hit, and stale after ~3s', async () => {
    const poll = await get('/poll');
    expect(poll.status).toBe(204); // empty queue
    expect(isUxpPluginPolling()).toBe(true);

    const health = await get('/health');
    expect((JSON.parse(health.body) as { plugin_polling: boolean }).plugin_polling).toBe(true);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 3100);
      expect(isUxpPluginPolling()).toBe(false);
      const stale = await get('/health');
      expect((JSON.parse(stale.body) as { plugin_polling: boolean }).plugin_polling).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('delivers a queued command to the poller and resolves its result', async () => {
    const invocation = invokeUxpBridge('neural_filter', { filter: 'colorize' }, 5_000);
    // Give the loop a tick to enqueue, then drain it like the plugin would.
    await new Promise((r) => setTimeout(r, 50));
    const poll = await get('/poll');
    expect(poll.status).toBe(200);
    const cmd = JSON.parse(poll.body) as { id: string; action: string };
    expect(cmd.action).toBe('neural_filter');

    expect(
      await post('/result', JSON.stringify({ id: cmd.id, ok: true, data: { filtered: true } }))
    ).toBe(200);

    const result = await invocation;
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ filtered: true });
  });

  it('stays "polling" while a picked-up command is executing, even past the stale window', async () => {
    // The plugin's poll loop awaits commands inline: a long batchPlay pauses
    // /poll traffic without the plugin being gone. A picked-up-but-unresolved
    // command must keep it reported as connected (issue #57 diagnostics).
    const invocation = invokeUxpBridge('neural_filter', { filter: 'colorize' }, 30_000);
    await new Promise((r) => setTimeout(r, 50));
    const poll = await get('/poll');
    const cmd = JSON.parse(poll.body) as { id: string };

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 10_000); // far past PLUGIN_STALE_MS
      expect(isUxpPluginPolling()).toBe(true);

      await post('/result', JSON.stringify({ id: cmd.id, ok: false, error: 'boom' }));
      vi.setSystemTime(Date.now() + 10_000); // past the stale window again
      expect(isUxpPluginPolling()).toBe(false); // resolved and silent → gone
    } finally {
      vi.useRealTimers();
    }
    await invocation; // ok:false result — the point was liveness, not the payload
  });
});
