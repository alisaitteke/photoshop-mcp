import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  beginLogicalSession,
  bindLogicalSessionClient,
  getLogicalSession,
  MCP_LOGICAL_SESSION_IDLE_MS,
  noteLogicalSessionActivity,
  resetLogicalSessionForTests,
} from '../src/analytics/logical-session.js';

describe('logical MCP session', () => {
  let home: string;
  let previousHome: string | undefined;

  beforeEach(() => {
    previousHome = process.env.PHOTOSHOP_MCP_HOME;
    home = mkdtempSync(join(tmpdir(), 'ph-mcp-logical-'));
    process.env.PHOTOSHOP_MCP_HOME = home;
    resetLogicalSessionForTests();
  });

  afterEach(() => {
    resetLogicalSessionForTests();
    if (previousHome === undefined) delete process.env.PHOTOSHOP_MCP_HOME;
    else process.env.PHOTOSHOP_MCP_HOME = previousHome;
    rmSync(home, { recursive: true, force: true });
  });

  it('starts a new session on first begin', () => {
    const now = 1_000_000;
    const result = beginLogicalSession(now);
    expect(result.isNew).toBe(true);
    expect(result.closedPrevious).toBeUndefined();
    expect(result.session.startedAt).toBe(now);
    expect(result.session.lastSeenAt).toBe(now);
  });

  it('reuses the session inside the idle window', () => {
    const now = 1_000_000;
    const first = beginLogicalSession(now);
    resetLogicalSessionForTests();
    const second = beginLogicalSession(now + 5 * 60 * 1000);
    expect(second.isNew).toBe(false);
    expect(second.session.id).toBe(first.session.id);
    expect(second.closedPrevious).toBeUndefined();
  });

  it('opens a new session after idle and reports the previous duration', () => {
    const now = 1_000_000;
    const first = beginLogicalSession(now);
    noteLogicalSessionActivity(now + 2_000);
    resetLogicalSessionForTests();
    const next = beginLogicalSession(now + MCP_LOGICAL_SESSION_IDLE_MS + 3_000);
    expect(next.isNew).toBe(true);
    expect(next.closedPrevious).toEqual({
      durationMs: 2_000,
      shutdownReason: 'idle_timeout',
    });
    expect(next.session.id).not.toBe(first.session.id);
  });

  it('emits client_connected once per client inside the window', () => {
    beginLogicalSession(1_000_000);
    const first = bindLogicalSessionClient({ name: 'cursor', version: '1.0.0' }, 1_000_100);
    expect(first.emitConnected).toBe(true);
    expect(first.connectCount).toBe(1);

    resetLogicalSessionForTests();
    beginLogicalSession(1_000_200);
    const second = bindLogicalSessionClient({ name: 'cursor', version: '1.0.0' }, 1_000_300);
    expect(second.emitConnected).toBe(false);
    expect(second.connectCount).toBe(1);
  });

  it('emits again when the MCP client identity changes', () => {
    beginLogicalSession(1_000_000);
    bindLogicalSessionClient({ name: 'cursor', version: '1.0.0' }, 1_000_100);
    const changed = bindLogicalSessionClient({ name: 'claude-desktop', version: '2.0.0' }, 1_000_200);
    expect(changed.emitConnected).toBe(true);
    expect(changed.connectCount).toBe(2);
  });

  it('persists across in-process reset via the home dir file', () => {
    const first = beginLogicalSession(1_000_000);
    resetLogicalSessionForTests();
    const loaded = getLogicalSession();
    expect(loaded?.id).toBe(first.session.id);
  });
});
