import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
import {
  FEEDBACK_NUDGE_COOLDOWN_MS,
  FEEDBACK_NUDGE_ENV,
  FEEDBACK_NUDGE_LANGUAGE_RULE,
  FEEDBACK_NUDGE_MARKER,
  FEEDBACK_NUDGE_MIN_AGE_MS,
  FEEDBACK_NUDGE_QUESTION_EN,
  FEEDBACK_NUDGE_QUESTION_TR,
  FEEDBACK_SUGGESTION_MAX_CHARS,
  PING_CONNECTED_TEXT,
  PING_FAILED_TEXT,
  buildPingToolResult,
  isFeedbackNudgeDue,
  isFeedbackNudgeEnabled,
  markFeedbackFirstSeen,
  markFeedbackNudgeShown,
  recordFeedback,
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

  it('does not ask again after yes', () => {
    const now = 1_000_000;
    markFeedbackFirstSeen(now);
    markFeedbackNudgeShown(now + FEEDBACK_NUDGE_MIN_AGE_MS);
    recordFeedback('yes', 'batch rename layers');
    expect(
      isFeedbackNudgeDue(now + FEEDBACK_NUDGE_MIN_AGE_MS + FEEDBACK_NUDGE_COOLDOWN_MS * 4)
    ).toBe(false);
  });

  it('does not ask again after dont_ask', () => {
    recordFeedback('dont_ask');
    expect(isFeedbackNudgeDue(Date.now() + FEEDBACK_NUDGE_COOLDOWN_MS * 4)).toBe(false);
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

  it('does not append a second nudge in the same cooldown window', () => {
    const firstSeenAt = 1_000_000;
    const dueAt = firstSeenAt + FEEDBACK_NUDGE_MIN_AGE_MS;
    expect(textBlocks(buildPingToolResult(true, firstSeenAt))).toEqual([PING_CONNECTED_TEXT]);
    const firstDue = buildPingToolResult(true, dueAt);
    const second = buildPingToolResult(true, dueAt + 1);
    expect(textBlocks(firstDue)).toHaveLength(2);
    expect(textBlocks(second)).toEqual([PING_CONNECTED_TEXT]);
  });

  it('truncates suggestions to 200 characters and captures the event', () => {
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
