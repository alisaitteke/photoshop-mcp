import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/analytics/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/analytics/index.js')>();
  return {
    ...actual,
    capture: vi.fn(),
  };
});

vi.mock('../src/analytics/provider.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/analytics/provider.js')>();
  return {
    ...actual,
    flushAnalyticsClient: vi.fn().mockResolvedValue(undefined),
  };
});

import { capture } from '../src/analytics/index.js';
import { flushAnalyticsClient } from '../src/analytics/provider.js';
import { sanitizeAnalyticsProperties } from '../src/analytics/events.js';
import { buildPhotoshopInstructions } from '../src/prompts/instructions.js';
import {
  FEEDBACK_NUDGE_ACTIVE_TASK_WINDOW_MS,
  FEEDBACK_NUDGE_COOLDOWN_MS,
  FEEDBACK_NUDGE_ENV,
  FEEDBACK_NUDGE_LANGUAGE_RULE,
  FEEDBACK_NUDGE_MARKER,
  FEEDBACK_NUDGE_MIN_AGE_MS,
  FEEDBACK_NUDGE_QUESTION_EN,
  FEEDBACK_NUDGE_QUESTION_TR,
  FEEDBACK_NUDGE_YES_COOLDOWN_MS,
  FEEDBACK_SUGGESTION_MAX_CHARS,
  PING_CONNECTED_TEXT,
  PING_FAILED_TEXT,
  buildFeedbackNudgeBlock,
  buildPingToolResult,
  isFeedbackNudgeDue,
  isFeedbackNudgeEnabled,
  markFeedbackFirstSeen,
  markFeedbackNudgeShown,
  noteFeedbackTaskActivity,
  recordFeedback,
  resetFeedbackTaskActivityForTests,
  submitFeedbackFromArgs,
} from '../src/feedback/nudge.js';
import { PHOTOSHOP_MCP_SURFACE_ENV } from '../src/lib/export-paths.js';

function textBlocks(result: { content: Array<{ type: string; text?: string }> }): string[] {
  return result.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string);
}

function readNudgeStore(home: string): {
  firstSeenAt?: number;
  lastShownAt?: number;
  status?: string;
} {
  return JSON.parse(readFileSync(join(home, 'feedback-nudge.json'), 'utf8')) as {
    firstSeenAt?: number;
    lastShownAt?: number;
    status?: string;
  };
}

function writeNudgeStore(home: string, store: Record<string, unknown>): void {
  writeFileSync(join(home, 'feedback-nudge.json'), JSON.stringify(store));
}

describe('MCP feedback nudge', () => {
  let home: string;
  let previousHome: string | undefined;
  let previousDisabled: string | undefined;
  let previousPosthog: string | undefined;
  let previousSurface: string | undefined;
  let previousFeedback: string | undefined;

  beforeEach(() => {
    previousHome = process.env.PHOTOSHOP_MCP_HOME;
    previousDisabled = process.env.ANALYTICS_DISABLED;
    previousPosthog = process.env.POSTHOG_DISABLED;
    previousSurface = process.env[PHOTOSHOP_MCP_SURFACE_ENV];
    previousFeedback = process.env[FEEDBACK_NUDGE_ENV];
    home = mkdtempSync(join(tmpdir(), 'ph-mcp-feedback-'));
    process.env.PHOTOSHOP_MCP_HOME = home;
    delete process.env[FEEDBACK_NUDGE_ENV];
    delete process.env.ANALYTICS_DISABLED;
    delete process.env.POSTHOG_DISABLED;
    delete process.env[PHOTOSHOP_MCP_SURFACE_ENV];
    vi.mocked(capture).mockClear();
    vi.mocked(flushAnalyticsClient).mockClear();
    resetFeedbackTaskActivityForTests();
  });

  afterEach(() => {
    if (previousHome === undefined) delete process.env.PHOTOSHOP_MCP_HOME;
    else process.env.PHOTOSHOP_MCP_HOME = previousHome;
    if (previousDisabled === undefined) delete process.env.ANALYTICS_DISABLED;
    else process.env.ANALYTICS_DISABLED = previousDisabled;
    if (previousPosthog === undefined) delete process.env.POSTHOG_DISABLED;
    else process.env.POSTHOG_DISABLED = previousPosthog;
    if (previousSurface === undefined) delete process.env[PHOTOSHOP_MCP_SURFACE_ENV];
    else process.env[PHOTOSHOP_MCP_SURFACE_ENV] = previousSurface;
    if (previousFeedback === undefined) delete process.env[FEEDBACK_NUDGE_ENV];
    else process.env[FEEDBACK_NUDGE_ENV] = previousFeedback;
    rmSync(home, { recursive: true, force: true });
  });

  it('is on by default when PSMCP_FEEDBACK is unset', () => {
    delete process.env[FEEDBACK_NUDGE_ENV];
    expect(isFeedbackNudgeEnabled()).toBe(true);
    const firstSeenAt = 1_000_000;
    expect(textBlocks(buildPingToolResult(true, firstSeenAt))).toEqual([PING_CONNECTED_TEXT]);
    expect(readNudgeStore(home).firstSeenAt).toBe(firstSeenAt);
    const due = buildPingToolResult(true, firstSeenAt + FEEDBACK_NUDGE_MIN_AGE_MS);
    expect(textBlocks(due)[1]).toContain(FEEDBACK_NUDGE_MARKER);
  });

  it('is off when PSMCP_FEEDBACK is 0', () => {
    process.env[FEEDBACK_NUDGE_ENV] = '0';
    expect(isFeedbackNudgeEnabled()).toBe(false);
    const now = 1_000_000;
    expect(textBlocks(buildPingToolResult(true, now))).toEqual([PING_CONNECTED_TEXT]);
    expect(existsSync(join(home, 'feedback-nudge.json'))).toBe(false);
    expect(isFeedbackNudgeDue(now + FEEDBACK_NUDGE_MIN_AGE_MS)).toBe(false);
  });

  it('is off when PSMCP_FEEDBACK is false', () => {
    process.env[FEEDBACK_NUDGE_ENV] = 'false';
    expect(isFeedbackNudgeEnabled()).toBe(false);
  });

  it('is not due on a fresh install', () => {
    expect(isFeedbackNudgeDue(1_000_000)).toBe(false);
  });

  it('stamps firstSeenAt on the first connected ping and does not nudge', () => {
    const now = 1_000_000;
    const result = buildPingToolResult(true, now);
    expect(textBlocks(result)).toEqual([PING_CONNECTED_TEXT]);
    const stored = readNudgeStore(home);
    expect(stored.firstSeenAt).toBe(now);
    expect(stored.lastShownAt).toBeUndefined();
    expect(isFeedbackNudgeDue(now)).toBe(false);
    expect(isFeedbackNudgeDue(now + FEEDBACK_NUDGE_MIN_AGE_MS - 1)).toBe(false);
  });

  it('appends FEEDBACK_NUDGE 15 minutes after the first connected ping', () => {
    const firstSeenAt = 1_000_000;
    buildPingToolResult(true, firstSeenAt);
    const dueAt = firstSeenAt + FEEDBACK_NUDGE_MIN_AGE_MS;
    const result = buildPingToolResult(true, dueAt);
    const texts = textBlocks(result);
    expect(texts[0]).toBe(PING_CONNECTED_TEXT);
    expect(texts[1]).toContain(FEEDBACK_NUDGE_MARKER);
    expect(texts[1]).toContain('photoshop_submit_feedback');
    expect(texts[1]).toContain(FEEDBACK_NUDGE_LANGUAGE_RULE);
    expect(texts[1]).toContain('Never default to English');
    expect(texts[1]).toContain(FEEDBACK_NUDGE_QUESTION_EN);
    expect(texts[1]).toContain(FEEDBACK_NUDGE_QUESTION_TR);
    expect(texts[1]).not.toMatch(/Photoshop MCP team/i);
    expect(texts[1]).not.toMatch(/anonymously/i);
    expect(readNudgeStore(home).lastShownAt).toBe(dueAt);
  });

  it('asks a neutral question about this session', () => {
    expect(FEEDBACK_NUDGE_QUESTION_EN).toBe(
      'Was there anything in Photoshop during this session that got in your way or felt missing? One sentence is enough.'
    );
    expect(FEEDBACK_NUDGE_QUESTION_TR).toBe(
      "Bu oturumda Photoshop'ta takıldığın ya da eksik bulduğun bir şey oldu mu? Bir cümle yeterli."
    );
    const block = buildFeedbackNudgeBlock();
    expect(block).not.toMatch(/faster and more useful/i);
    expect(block).not.toMatch(/faster/i);
    expect(block).not.toMatch(/as if you will/i);
  });

  it('gives hosts without a question UI a path that does not interrupt the request', () => {
    const block = buildFeedbackNudgeBlock();
    expect(block).toMatch(/AskQuestion/);
    expect(block).toMatch(/AskUserQuestion/);
    expect(block).toMatch(/no question UI: do not interrupt/i);
    expect(block).toMatch(/end of your final reply/i);
    expect(block).toMatch(/next message/i);
    expect(block).not.toMatch(/ask in chat and wait/i);
  });

  it("tells the agent to submit only the user's own words", () => {
    const block = buildFeedbackNudgeBlock();
    expect(block).toMatch(/own words in their own language/i);
    expect(block).toMatch(/placeholder/i);
    expect(block).toMatch(/your own summary/i);
    expect(block).toMatch(/no real answer, do not call photoshop_submit_feedback/i);
    expect(block).toContain(FEEDBACK_NUDGE_LANGUAGE_RULE);
    expect(block).toMatch(/Do not mention a team, anonymous sending, or a survey/);
    expect(block).toMatch(/Do not write code or add tools from the answer/);
  });

  it('keeps the server instructions in line with the nudge block', () => {
    const instructions = buildPhotoshopInstructions();
    expect(instructions).not.toMatch(/faster and more useful/i);
    expect(instructions).not.toMatch(/ask in chat and wait/i);
    expect(instructions).toMatch(/no question UI: do not interrupt/i);
    expect(instructions).toMatch(/end of your final reply/i);
    expect(instructions).toMatch(/placeholder/i);
    expect(instructions).toContain(FEEDBACK_NUDGE_QUESTION_EN);
    expect(instructions).toContain(FEEDBACK_NUDGE_QUESTION_TR);
  });

  it('does not start the 15-minute clock on a failed ping', () => {
    const result = buildPingToolResult(false, 1_000_000);
    expect(textBlocks(result)).toEqual([PING_FAILED_TEXT]);
    expect(existsSync(join(home, 'feedback-nudge.json'))).toBe(false);
    expect(isFeedbackNudgeDue(1_000_000)).toBe(false);
    expect(isFeedbackNudgeDue(1_000_000 + FEEDBACK_NUDGE_MIN_AGE_MS)).toBe(false);
  });

  it('starts a 7-day cooldown when the ping nudge is shown', () => {
    const firstSeenAt = 1_000_000;
    markFeedbackFirstSeen(firstSeenAt);
    const shownAt = firstSeenAt + FEEDBACK_NUDGE_MIN_AGE_MS;
    markFeedbackNudgeShown(shownAt);
    expect(isFeedbackNudgeDue(shownAt)).toBe(false);
    expect(isFeedbackNudgeDue(shownAt + FEEDBACK_NUDGE_COOLDOWN_MS - 1)).toBe(false);
    expect(isFeedbackNudgeDue(shownAt + FEEDBACK_NUDGE_COOLDOWN_MS)).toBe(true);
  });

  it('keeps the 7-day cooldown when lastShownAt exists without firstSeenAt', () => {
    const lastShownAt = 1_000_000;
    markFeedbackNudgeShown(lastShownAt);
    expect(isFeedbackNudgeDue(lastShownAt)).toBe(false);
    expect(isFeedbackNudgeDue(lastShownAt + FEEDBACK_NUDGE_COOLDOWN_MS - 1)).toBe(false);
    expect(isFeedbackNudgeDue(lastShownAt + FEEDBACK_NUDGE_COOLDOWN_MS)).toBe(true);
  });

  it('asks again 30 days after yes', () => {
    const firstSeenAt = 1_000_000;
    markFeedbackFirstSeen(firstSeenAt);
    markFeedbackNudgeShown(firstSeenAt + FEEDBACK_NUDGE_MIN_AGE_MS);
    const submittedAt = firstSeenAt + FEEDBACK_NUDGE_MIN_AGE_MS + 60_000;
    recordFeedback('yes', 'batch rename layers', submittedAt);
    expect(readNudgeStore(home).status).toBe('yes');
    expect(isFeedbackNudgeDue(submittedAt + FEEDBACK_NUDGE_COOLDOWN_MS * 4)).toBe(false);
    expect(isFeedbackNudgeDue(submittedAt + FEEDBACK_NUDGE_YES_COOLDOWN_MS - 1)).toBe(false);
    expect(isFeedbackNudgeDue(submittedAt + FEEDBACK_NUDGE_YES_COOLDOWN_MS)).toBe(true);
  });

  it('shows the nudge again on ping after the yes cooldown, then uses the 7-day cooldown', () => {
    const submittedAt = 2_000_000;
    markFeedbackFirstSeen(1_000_000);
    recordFeedback('yes', 'batch rename layers', submittedAt);
    markFeedbackNudgeShown(submittedAt + 1);
    expect(readNudgeStore(home).status).toBe('yes');

    const dueAt = submittedAt + FEEDBACK_NUDGE_YES_COOLDOWN_MS;
    expect(textBlocks(buildPingToolResult(true, dueAt))[1]).toContain(FEEDBACK_NUDGE_MARKER);
    const stored = readNudgeStore(home);
    expect(stored.status).toBe('shown');
    expect(stored.lastShownAt).toBe(dueAt);
    expect(isFeedbackNudgeDue(dueAt + FEEDBACK_NUDGE_COOLDOWN_MS - 1)).toBe(false);
    expect(isFeedbackNudgeDue(dueAt + FEEDBACK_NUDGE_COOLDOWN_MS)).toBe(true);
  });

  it('applies the 30-day rule to a yes saved by an older version', () => {
    const submittedAt = 3_000_000;
    writeNudgeStore(home, {
      status: 'yes',
      firstSeenAt: 1_000_000,
      lastShownAt: submittedAt,
      submittedAt,
      choice: 'yes',
    });
    expect(isFeedbackNudgeDue(submittedAt + FEEDBACK_NUDGE_YES_COOLDOWN_MS - 1)).toBe(false);
    expect(isFeedbackNudgeDue(submittedAt + FEEDBACK_NUDGE_YES_COOLDOWN_MS)).toBe(true);
  });

  it('falls back to lastShownAt for a legacy yes without submittedAt', () => {
    const lastShownAt = 3_000_000;
    writeNudgeStore(home, { status: 'yes', lastShownAt });
    expect(isFeedbackNudgeDue(lastShownAt + FEEDBACK_NUDGE_YES_COOLDOWN_MS - 1)).toBe(false);
    expect(isFeedbackNudgeDue(lastShownAt + FEEDBACK_NUDGE_YES_COOLDOWN_MS)).toBe(true);
  });

  it('does not ask again after dont_ask', () => {
    const answeredAt = 2_000_000;
    markFeedbackFirstSeen(1_000_000);
    recordFeedback('dont_ask', undefined, answeredAt);
    const muchLater = answeredAt + FEEDBACK_NUDGE_YES_COOLDOWN_MS * 12;
    expect(isFeedbackNudgeDue(muchLater)).toBe(false);
    expect(textBlocks(buildPingToolResult(true, muchLater))).toEqual([PING_CONNECTED_TEXT]);
    expect(readNudgeStore(home).status).toBe('dont_ask');
  });

  it('asks again 7 days after not_now', () => {
    markFeedbackFirstSeen(1_000_000);
    recordFeedback('not_now');
    const stored = readNudgeStore(home);
    expect(stored.firstSeenAt).toBe(1_000_000);
    expect(isFeedbackNudgeDue(stored.lastShownAt!)).toBe(false);
    expect(isFeedbackNudgeDue(stored.lastShownAt! + FEEDBACK_NUDGE_COOLDOWN_MS)).toBe(true);
  });

  it('is not due when analytics are disabled', () => {
    process.env.ANALYTICS_DISABLED = '1';
    markFeedbackFirstSeen(1_000_000);
    expect(isFeedbackNudgeDue(1_000_000 + FEEDBACK_NUDGE_MIN_AGE_MS)).toBe(false);
  });

  it('is not due on the standalone UI surface', () => {
    process.env[PHOTOSHOP_MCP_SURFACE_ENV] = 'ui';
    markFeedbackFirstSeen(1_000_000);
    expect(isFeedbackNudgeDue(1_000_000 + FEEDBACK_NUDGE_MIN_AGE_MS)).toBe(false);
  });

  it('still nudges on the first ping of a session when no other tool has run', () => {
    const firstSeenAt = 1_000_000;
    markFeedbackFirstSeen(firstSeenAt);
    const dueAt = firstSeenAt + FEEDBACK_NUDGE_MIN_AGE_MS;
    expect(textBlocks(buildPingToolResult(true, dueAt))[1]).toContain(FEEDBACK_NUDGE_MARKER);
  });

  it('holds a due nudge while another tool ran in the last 3 minutes, without starting the cooldown', () => {
    const firstSeenAt = 1_000_000;
    markFeedbackFirstSeen(firstSeenAt);
    const dueAt = firstSeenAt + FEEDBACK_NUDGE_MIN_AGE_MS;
    const lastToolAt = dueAt - 1_000;
    noteFeedbackTaskActivity('photoshop_get_state', lastToolAt);

    expect(textBlocks(buildPingToolResult(true, dueAt))).toEqual([PING_CONNECTED_TEXT]);
    expect(
      textBlocks(buildPingToolResult(true, lastToolAt + FEEDBACK_NUDGE_ACTIVE_TASK_WINDOW_MS - 1))
    ).toEqual([PING_CONNECTED_TEXT]);
    expect(readNudgeStore(home).lastShownAt).toBeUndefined();
    expect(isFeedbackNudgeDue(dueAt)).toBe(true);

    const quietAt = lastToolAt + FEEDBACK_NUDGE_ACTIVE_TASK_WINDOW_MS;
    expect(textBlocks(buildPingToolResult(true, quietAt))[1]).toContain(FEEDBACK_NUDGE_MARKER);
    expect(readNudgeStore(home).lastShownAt).toBe(quietAt);
  });

  it('does not treat ping or submit_feedback as an active task', () => {
    const firstSeenAt = 1_000_000;
    markFeedbackFirstSeen(firstSeenAt);
    const dueAt = firstSeenAt + FEEDBACK_NUDGE_MIN_AGE_MS;
    noteFeedbackTaskActivity('photoshop_ping', dueAt - 1_000);
    noteFeedbackTaskActivity('photoshop_submit_feedback', dueAt - 1_000);
    expect(textBlocks(buildPingToolResult(true, dueAt))[1]).toContain(FEEDBACK_NUDGE_MARKER);
  });

  it('does not append a second nudge in the same cooldown window', () => {
    const firstSeenAt = 1_000_000;
    const dueAt = firstSeenAt + FEEDBACK_NUDGE_MIN_AGE_MS;
    expect(textBlocks(buildPingToolResult(true, firstSeenAt))).toEqual([PING_CONNECTED_TEXT]);
    const firstDue = buildPingToolResult(true, dueAt);
    const second = buildPingToolResult(true, dueAt + 1);
    expect(textBlocks(firstDue)).toHaveLength(2);
    expect(textBlocks(second)).toEqual([PING_CONNECTED_TEXT]);
  });

  it('keeps a 500-character answer whole', () => {
    expect(FEEDBACK_SUGGESTION_MAX_CHARS).toBe(500);
    const answer = 'y'.repeat(FEEDBACK_SUGGESTION_MAX_CHARS);
    recordFeedback('yes', answer);
    expect(capture).toHaveBeenCalledWith(
      'mcp_product_feedback',
      expect.objectContaining({ $page_title: answer, suggestion: answer })
    );
  });

  it('truncates suggestions to 500 characters and captures the event', () => {
    const long = 'x'.repeat(FEEDBACK_SUGGESTION_MAX_CHARS + 25);
    recordFeedback('yes', `  ${long}  `);
    expect(capture).toHaveBeenCalledWith(
      'mcp_product_feedback',
      expect.objectContaining({
        $pathname: '/feedback',
        $page_title: `${'x'.repeat(FEEDBACK_SUGGESTION_MAX_CHARS)}…[truncated]`,
        feedback_choice: 'yes',
        has_suggestion: true,
        suggestion: `${'x'.repeat(FEEDBACK_SUGGESTION_MAX_CHARS)}…[truncated]`,
        event_source: 'mcp',
      })
    );
    expect(flushAnalyticsClient).toHaveBeenCalledTimes(1);
    const props = vi.mocked(capture).mock.calls[0]?.[1] as { $page_title: string };
    // Rybbit rejects a /track body whose page_title is longer than 512 characters.
    expect(props.$page_title.length).toBeLessThanOrEqual(512);
  });

  it('uses the choice as page title when there is no suggestion', () => {
    recordFeedback('not_now');
    expect(capture).toHaveBeenCalledWith(
      'mcp_product_feedback',
      expect.objectContaining({
        $pathname: '/feedback',
        $page_title: 'not_now',
        feedback_choice: 'not_now',
        has_suggestion: false,
        event_source: 'mcp',
      })
    );
    expect(capture).toHaveBeenCalledWith(
      'mcp_product_feedback',
      expect.not.objectContaining({ suggestion: expect.anything() })
    );
  });

  it('rejects an invalid submit choice', () => {
    const result = submitFeedbackFromArgs({ choice: 'maybe' });
    expect(result.isError).toBe(true);
    expect(textBlocks(result).join('')).toContain('invalid_arguments');
    expect(flushAnalyticsClient).not.toHaveBeenCalled();
  });

  it("rejects yes without the user's own words and leaves the store unchanged", () => {
    markFeedbackFirstSeen(1_000_000);
    markFeedbackNudgeShown(1_000_000 + FEEDBACK_NUDGE_MIN_AGE_MS);
    const before = readFileSync(join(home, 'feedback-nudge.json'), 'utf8');

    for (const args of [
      { choice: 'yes' },
      { choice: 'yes', suggestion: '' },
      { choice: 'yes', suggestion: '  \n\t ' },
      { choice: 'yes', suggestion: 42 },
    ]) {
      const result = submitFeedbackFromArgs(args);
      expect(result.isError).toBe(true);
      const envelope = JSON.parse(textBlocks(result).join('')) as { code: string; message: string };
      expect(envelope.code).toBe('invalid_arguments');
      expect(envelope.message).toMatch(/own words/i);
      expect(envelope.message).toMatch(/has not answered/i);
      expect(envelope.message).toMatch(/do not call photoshop_submit_feedback/i);
    }

    expect(readFileSync(join(home, 'feedback-nudge.json'), 'utf8')).toBe(before);
    expect(capture).not.toHaveBeenCalled();
    expect(flushAnalyticsClient).not.toHaveBeenCalled();
  });

  it('still accepts not_now and dont_ask without a suggestion', () => {
    expect(submitFeedbackFromArgs({ choice: 'not_now' }).isError).toBeFalsy();
    expect(submitFeedbackFromArgs({ choice: 'dont_ask', suggestion: '   ' }).isError).toBeFalsy();
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it('tells the agent to continue after a valid submit', () => {
    const result = submitFeedbackFromArgs({
      choice: 'yes',
      suggestion: 'better selections',
    });
    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(textBlocks(result).join('')) as {
      ok: boolean;
      next: string;
    };
    expect(payload.ok).toBe(true);
    expect(payload.next).toMatch(/original Photoshop request/i);
    expect(flushAnalyticsClient).toHaveBeenCalledTimes(1);
  });
});

describe('feedback analytics allowlist', () => {
  it('keeps suggestion and drops blocked prompt text', () => {
    expect(
      sanitizeAnalyticsProperties({
        $pathname: '/feedback',
        $page_title: 'batch rename layers',
        feedback_choice: 'yes',
        has_suggestion: true,
        suggestion: 'batch rename layers',
        prompt: 'secret chat',
        event_source: 'mcp',
      })
    ).toEqual({
      $pathname: '/feedback',
      $page_title: 'batch rename layers',
      feedback_choice: 'yes',
      has_suggestion: true,
      suggestion: 'batch rename layers',
      event_source: 'mcp',
    });
  });
});
