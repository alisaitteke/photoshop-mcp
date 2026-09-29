import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Ephemeral port so the test never binds (or steals) the real plugin port.
process.env.PHOTOSHOP_UXP_BRIDGE_PORT = '0';

const { resolvePhotoshopCapabilities } = await import('../src/platform/capabilities.js');
const { ensureUxpBridgeServer, getUxpBridgePort, shutdownUxpBridgeServer } =
  await import('../src/platform/uxp-bridge-server.js');

const http = await import('node:http');

function pollOnce(): Promise<void> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: getUxpBridgePort(), path: '/poll' }, (res) => {
      res.resume();
      res.on('end', () => resolve());
    });
    req.on('error', () => resolve());
  });
}

describe('resolvePhotoshopCapabilities plugin gating', () => {
  let poller: ReturnType<typeof setInterval> | null = null;

  beforeAll(async () => {
    await ensureUxpBridgeServer();
  });

  afterAll(async () => {
    if (poller) clearInterval(poller);
    await shutdownUxpBridgeServer();
  });

  it('reports uxp_bridge_reachable=false and neural_filters=false with no plugin polling', async () => {
    // The bridge HTTP server IS listening here — capabilities must still
    // say the bridge is unreachable, because no plugin is polling it.
    const caps = await resolvePhotoshopCapabilities('2026');
    expect(caps.features.uxp_plugin_api).toBe(true); // version-derived, unchanged
    expect(caps.features.uxp_bridge_reachable).toBe(false);
    expect(caps.features.neural_filters).toBe(false);
  });

  it('flips both flags once a plugin polls', async () => {
    poller = setInterval(() => void pollOnce(), 100);
    await new Promise((r) => setTimeout(r, 300));

    const caps = await resolvePhotoshopCapabilities('2026');
    expect(caps.features.uxp_bridge_reachable).toBe(true);
    expect(caps.features.neural_filters).toBe(true);

    clearInterval(poller);
    poller = null;
  });
});
