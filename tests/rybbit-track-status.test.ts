import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../src/utils/logger.js';
import { RybbitNodeProvider } from '../src/analytics/rybbit-node.js';

describe('RybbitNodeProvider /track status', () => {
  let home: string;
  let previousHome: string | undefined;
  let previousDisabled: string | undefined;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    previousHome = process.env.PHOTOSHOP_MCP_HOME;
    previousDisabled = process.env.ANALYTICS_DISABLED;
    home = mkdtempSync(join(tmpdir(), 'ph-mcp-rybbit-'));
    process.env.PHOTOSHOP_MCP_HOME = home;
    delete process.env.ANALYTICS_DISABLED;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (previousHome === undefined) delete process.env.PHOTOSHOP_MCP_HOME;
    else process.env.PHOTOSHOP_MCP_HOME = previousHome;
    if (previousDisabled === undefined) delete process.env.ANALYTICS_DISABLED;
    else process.env.ANALYTICS_DISABLED = previousDisabled;
    rmSync(home, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('warns when /track is not 2xx', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    globalThis.fetch = vi.fn(async (url) => {
      const href = String(url);
      if (href.includes('/track')) {
        return new Response('blocked', { status: 403 });
      }
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const provider = new RybbitNodeProvider();
    provider.capture({
      name: 'mcp_product_feedback',
      properties: { event_source: 'mcp', feedback_choice: 'not_now' },
    });
    await provider.flush();
    await provider.shutdown();

    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/Analytics \/track returned 403 for mcp_product_feedback/)
    );
  });

  it('sends feedback events on /feedback with page_title and answer properties', async () => {
    const trackBodies: Record<string, unknown>[] = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      const href = String(url);
      if (href.includes('/track')) {
        trackBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      }
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const provider = new RybbitNodeProvider();
    provider.capture({
      name: 'mcp_product_feedback',
      properties: {
        $pathname: '/feedback',
        $page_title: 'better selections',
        event_source: 'mcp',
        feedback_choice: 'yes',
        has_suggestion: true,
        suggestion: 'better selections',
      },
    });
    await provider.flush();
    await provider.shutdown();

    expect(trackBodies).toHaveLength(1);
    expect(trackBodies[0]).toMatchObject({
      type: 'custom_event',
      event_name: 'mcp_product_feedback',
      hostname: 'photoshop-mcp.com',
      pathname: '/feedback',
      page_title: 'better selections',
      language: expect.any(String),
    });
    expect(String(trackBodies[0]?.language).length).toBeGreaterThan(0);
    expect(String(trackBodies[0]?.language).length).toBeLessThanOrEqual(35);
    const properties = JSON.parse(String(trackBodies[0]?.properties)) as Record<string, unknown>;
    expect(properties).toMatchObject({
      feedback_choice: 'yes',
      has_suggestion: true,
      suggestion: 'better selections',
      event_source: 'mcp',
    });
    expect(properties).not.toHaveProperty('$pathname');
    expect(properties).not.toHaveProperty('$page_title');
  });

  it('keeps feedback_choice and suggestion when properties exceed the size budget', async () => {
    const trackBodies: Record<string, unknown>[] = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      const href = String(url);
      if (href.includes('/track')) {
        trackBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      }
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const padded: Record<string, string | boolean> = {
      $pathname: '/feedback',
      $page_title: 'keep this answer',
      event_source: 'mcp',
      feedback_choice: 'yes',
      has_suggestion: true,
      suggestion: 'keep this answer',
    };
    for (let i = 0; i < 40; i += 1) {
      padded[`noise_${i}`] = 'n'.repeat(80);
    }

    const provider = new RybbitNodeProvider();
    provider.capture({
      name: 'mcp_product_feedback',
      properties: padded,
    });
    await provider.flush();
    await provider.shutdown();

    expect(trackBodies).toHaveLength(1);
    expect(trackBodies[0]?.pathname).toBe('/feedback');
    expect(trackBodies[0]?.page_title).toBe('keep this answer');
    const properties = JSON.parse(String(trackBodies[0]?.properties)) as Record<string, unknown>;
    expect(properties.feedback_choice).toBe('yes');
    expect(properties.suggestion).toBe('keep this answer');
    expect(JSON.stringify(properties).length).toBeLessThanOrEqual(2048);
  });
});
