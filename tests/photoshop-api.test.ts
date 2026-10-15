import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { PhotoshopConnection } from '../src/platform/connection.js';

process.env.PHOTOSHOP_UXP_BRIDGE_PORT = '0';

const { PhotoshopAPIFactory, API_OVERRIDE_ENV } = await import('../src/api/photoshop-api.js');
const { shutdownUxpBridgeServer } = await import('../src/platform/uxp-bridge-server.js');
const { classifyError } = await import('../src/errors/envelope.js');
const { PHOTOSHOP_NOT_DETECTED_MESSAGE } = await import('../src/platform/connection.js');

function makeConnection(
  info: { version: string; path: string; isRunning: boolean } | null = {
    version: '2026',
    path: 'C:\\Photoshop.exe',
    isRunning: true,
  }
) {
  const executed: Array<{ script: string; timeout?: number }> = [];
  const connection = {
    ensureDetected: () => Promise.resolve(info),
    getPhotoshopInfo: () => info,
    executeScript: (script: string, timeout?: number) => {
      executed.push({ script, timeout });
      return Promise.resolve('ok');
    },
  } as unknown as PhotoshopConnection & {
    executeScript(script: string, timeout?: number): Promise<unknown>;
  };
  return { connection, executed };
}

afterEach(() => {
  delete process.env[API_OVERRIDE_ENV];
});

afterAll(async () => {
  await shutdownUxpBridgeServer();
});

describe('PhotoshopAPIFactory (issue #57)', () => {
  it('defaults to ExtendScript and no longer claims "UXP not available" unconditionally', async () => {
    const { connection } = makeConnection();
    const api = await new PhotoshopAPIFactory(connection).createAPI();
    expect(api.getAPIType()).toBe('ExtendScript');
  });

  it('PHOTOSHOP_MCP_API=uxp forces the UXP path, which fails fast instead of hanging', async () => {
    process.env[API_OVERRIDE_ENV] = 'uxp';
    const { connection, executed } = makeConnection();
    const api = await new PhotoshopAPIFactory(connection).createAPI();
    expect(api.getAPIType()).toBe('UXP');

    // Must reject promptly (no 30s ExtendScript hang) and never touch the
    // legacy script path.
    const started = Date.now();
    await expect(api.executeScript('return 1;')).rejects.toThrow(/PHOTOSHOP_MCP_API=extendscript/);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(executed).toEqual([]);
  });

  it('PHOTOSHOP_MCP_API=extendscript forces the ExtendScript path', async () => {
    process.env[API_OVERRIDE_ENV] = 'extendscript';
    const { connection, executed } = makeConnection();
    const api = await new PhotoshopAPIFactory(connection).createAPI();
    expect(api.getAPIType()).toBe('ExtendScript');
    await api.executeScript('return { ok: true };');
    expect(executed).toHaveLength(1);
    // Wrapped in the error-handling IIFE, not passed through raw.
    expect(executed[0].script).toContain('ERROR:');
    expect(executed[0].script).toContain('return { ok: true };');
  });

  it('reports photoshop_not_detected when detection finds nothing', async () => {
    const { connection } = makeConnection(null);
    const error = await new PhotoshopAPIFactory(connection).createAPI().catch((e: Error) => e);
    expect((error as Error).message).toBe(PHOTOSHOP_NOT_DETECTED_MESSAGE);
    expect(classifyError((error as Error).message).code).toBe('photoshop_not_detected');
  });

  it('accepts the override with surrounding whitespace (Windows `set X=uxp && ...`)', async () => {
    process.env[API_OVERRIDE_ENV] = ' UXP ';
    const { connection } = makeConnection();
    const api = await new PhotoshopAPIFactory(connection).createAPI();
    expect(api.getAPIType()).toBe('UXP');
  });
});
