import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

vi.mock('../src/platform/uxp-bridge-server.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/platform/uxp-bridge-server.js')>();
  return {
    ...actual,
    ensureUxpBridgeServer: vi.fn().mockResolvedValue(undefined),
  };
});

import { PhotoshopMCPServer } from '../src/core/server.js';
import { ToolRegistry } from '../src/core/tool-registry.js';
import {
  FEEDBACK_NUDGE_ENV,
  FEEDBACK_NUDGE_MARKER,
  FEEDBACK_NUDGE_MIN_AGE_MS,
  PING_CONNECTED_TEXT,
  buildPingToolResult,
  markFeedbackFirstSeen,
  resetFeedbackTaskActivityForTests,
} from '../src/feedback/nudge.js';
import { PHOTOSHOP_MCP_SURFACE_ENV } from '../src/lib/export-paths.js';

type CallToolHandler = (request: unknown, extra: unknown) => Promise<unknown>;

function textBlocks(result: { content: Array<{ type: string; text?: string }> }): string[] {
  return result.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string);
}

function captureCallToolHandler(): CallToolHandler {
  const setRequestHandler = vi.spyOn(Server.prototype, 'setRequestHandler');
  new PhotoshopMCPServer({ serverVersion: '0.0.0-test' });
  const call = setRequestHandler.mock.calls.find(([schema]) => schema === CallToolRequestSchema);
  if (!call) throw new Error('tools/call handler was not registered');
  return call[1] as CallToolHandler;
}

function callTool(handler: CallToolHandler, name: string): Promise<unknown> {
  return handler({ method: 'tools/call', params: { name, arguments: {} } }, {});
}

describe('tools/call dispatch and the feedback nudge', () => {
  let home: string;
  let previousHome: string | undefined;
  let previousFeedback: string | undefined;
  let previousSurface: string | undefined;

  beforeEach(() => {
    previousHome = process.env.PHOTOSHOP_MCP_HOME;
    previousFeedback = process.env[FEEDBACK_NUDGE_ENV];
    previousSurface = process.env[PHOTOSHOP_MCP_SURFACE_ENV];
    home = mkdtempSync(join(tmpdir(), 'ph-mcp-server-feedback-'));
    process.env.PHOTOSHOP_MCP_HOME = home;
    delete process.env[FEEDBACK_NUDGE_ENV];
    delete process.env[PHOTOSHOP_MCP_SURFACE_ENV];
    resetFeedbackTaskActivityForTests();
    vi.spyOn(ToolRegistry.prototype, 'execute').mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
    });
    markFeedbackFirstSeen(Date.now() - FEEDBACK_NUDGE_MIN_AGE_MS - 60_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetFeedbackTaskActivityForTests();
    if (previousHome === undefined) delete process.env.PHOTOSHOP_MCP_HOME;
    else process.env.PHOTOSHOP_MCP_HOME = previousHome;
    if (previousFeedback === undefined) delete process.env[FEEDBACK_NUDGE_ENV];
    else process.env[FEEDBACK_NUDGE_ENV] = previousFeedback;
    if (previousSurface === undefined) delete process.env[PHOTOSHOP_MCP_SURFACE_ENV];
    else process.env[PHOTOSHOP_MCP_SURFACE_ENV] = previousSurface;
    rmSync(home, { recursive: true, force: true });
  });

  it('holds a due nudge right after any other tool call', async () => {
    const handler = captureCallToolHandler();
    await callTool(handler, 'photoshop_get_state');
    expect(textBlocks(buildPingToolResult(true))).toEqual([PING_CONNECTED_TEXT]);
  });

  it('holds a due nudge after a failed tool call', async () => {
    const handler = captureCallToolHandler();
    vi.mocked(ToolRegistry.prototype.execute).mockRejectedValueOnce(new Error('boom'));
    await expect(callTool(handler, 'photoshop_get_state')).rejects.toThrow('boom');
    expect(textBlocks(buildPingToolResult(true))).toEqual([PING_CONNECTED_TEXT]);
  });

  it('does not count ping or submit_feedback as task activity', async () => {
    const handler = captureCallToolHandler();
    await callTool(handler, 'photoshop_ping');
    await callTool(handler, 'photoshop_submit_feedback');
    expect(textBlocks(buildPingToolResult(true))[1]).toContain(FEEDBACK_NUDGE_MARKER);
  });
});
