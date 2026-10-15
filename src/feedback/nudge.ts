import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { capture } from '../analytics/index.js';
import { flushAnalyticsClient } from '../analytics/provider.js';
import { hasAnalyticsKey } from '../analytics/config.js';
import { isAnalyticsEnabled } from '../analytics/identity.js';
import { envelopeToToolResult } from '../errors/envelope.js';
import { getPhotoshopMcpHomeDir, PHOTOSHOP_MCP_SURFACE_ENV } from '../lib/export-paths.js';
import { takeUpdateNoticeBlock } from '../update/check.js';

export const FEEDBACK_NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
/** After the user shared feedback (`yes`), ask again this long after their answer. */
export const FEEDBACK_NUDGE_YES_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
export const FEEDBACK_NUDGE_MIN_AGE_MS = 15 * 60 * 1000;
/** A due nudge waits while any other tool ran this recently (the user is mid-task). */
export const FEEDBACK_NUDGE_ACTIVE_TASK_WINDOW_MS = 3 * 60 * 1000;
/** Plus the 12-character truncation suffix this fills Rybbit's 512-character page_title limit. */
export const FEEDBACK_SUGGESTION_MAX_CHARS = 500;
export const FEEDBACK_NUDGE_MARKER = 'FEEDBACK_NUDGE';
export const FEEDBACK_NUDGE_ENV = 'PSMCP_FEEDBACK';
export const FEEDBACK_NUDGE_QUESTION_EN =
  'Was there anything in Photoshop during this session that got in your way or felt missing? One sentence is enough.';
export const FEEDBACK_NUDGE_QUESTION_TR =
  "Bu oturumda Photoshop'ta takıldığın ya da eksik bulduğun bir şey oldu mu? Bir cümle yeterli.";
export const FEEDBACK_NUDGE_LANGUAGE_RULE =
  'MUST ask the user in the language they are using in this conversation. Detect it from their messages; if mixed, use their latest message. Never default to English. Translate Q1 into that language and show only that translation. English and Turkish below are meaning-only examples — do not paste them unless the user is actually speaking that language.';
export const FEEDBACK_NUDGE_QUESTION_UI_PATH =
  "Host has a question UI (Cursor: AskQuestion; Claude Code: AskUserQuestion): ask now and wait for the answer. Call photoshop_submit_feedback with it, then continue the user's original request without ending the turn.";
export const FEEDBACK_NUDGE_CHAT_PATH =
  "Host has no question UI: do not interrupt. Finish the user's current request first, then add the question at the end of your final reply. When the user answers in their next message, call photoshop_submit_feedback then.";
export const FEEDBACK_NUDGE_ANSWER_RULE =
  "suggestion must be the user's own words in their own language (light trimming only, no rewording or translation). Never submit a placeholder, a guess, or your own summary or ideas. If there is no real answer, do not call photoshop_submit_feedback.";
export const PING_CONNECTED_TEXT = 'Successfully connected to Photoshop';
export const PING_FAILED_TEXT = 'Failed to connect to Photoshop';
export const PING_NOT_FOUND_REASON =
  'Photoshop was not found. Set PHOTOSHOP_PATH to the Photoshop app (macOS: the .app bundle, Windows: Photoshop.exe), then restart the MCP server.';
export const PING_NOT_RUNNING_REASON =
  'Photoshop is not running. Open Photoshop, wait until it finishes starting, then call photoshop_ping again. Ping never launches Photoshop.';

export type FeedbackChoice = 'yes' | 'not_now' | 'dont_ask';
export type FeedbackNudgeStatus = 'shown' | 'yes' | 'dont_ask';

export interface FeedbackNudgeStore {
  status?: FeedbackNudgeStatus;
  firstSeenAt?: number;
  lastShownAt?: number;
  submittedAt?: number;
  choice?: FeedbackChoice;
}

const STORE_FILE = 'feedback-nudge.json';
const TRUNCATION_SUFFIX = '…[truncated]';
/** Calls to these tools do not mean the user is working on a request. */
const NUDGE_NEUTRAL_TOOLS = new Set(['photoshop_ping', 'photoshop_submit_feedback']);

let lastTaskToolCallAt: number | undefined;

function getStorePath(): string {
  return join(getPhotoshopMcpHomeDir(), STORE_FILE);
}

export function isUiMcpSurface(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[PHOTOSHOP_MCP_SURFACE_ENV]?.trim().toLowerCase() === 'ui';
}

function envFalsy(name: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[name]?.trim().toLowerCase();
  return value === '0' || value === 'false' || value === 'no';
}

/** Product-feedback ping nudge is on by default. Set `PSMCP_FEEDBACK=0` to disable. */
export function isFeedbackNudgeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return !envFalsy(FEEDBACK_NUDGE_ENV, env);
}

function readStore(): FeedbackNudgeStore {
  try {
    const raw = readFileSync(getStorePath(), 'utf8');
    const parsed = JSON.parse(raw) as FeedbackNudgeStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: FeedbackNudgeStore): void {
  const dir = getPhotoshopMcpHomeDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(getStorePath(), JSON.stringify(store), { mode: 0o600 });
}

export function truncateFeedbackSuggestion(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= FEEDBACK_SUGGESTION_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, FEEDBACK_SUGGESTION_MAX_CHARS)}${TRUNCATION_SUFFIX}`;
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Note a tool call from the MCP dispatch path. Ping is also called mid-task (after
 * extendscript_timeout), so any other tool call holds a due nudge for
 * FEEDBACK_NUDGE_ACTIVE_TASK_WINDOW_MS. In-process only: a new session starts idle.
 */
export function noteFeedbackTaskActivity(toolName: string, now = Date.now()): void {
  if (NUDGE_NEUTRAL_TOOLS.has(toolName)) return;
  lastTaskToolCallAt = now;
}

export function resetFeedbackTaskActivityForTests(): void {
  lastTaskToolCallAt = undefined;
}

function isTaskActive(now: number): boolean {
  if (lastTaskToolCallAt === undefined) return false;
  return now - lastTaskToolCallAt < FEEDBACK_NUDGE_ACTIVE_TASK_WINDOW_MS;
}

/**
 * A `yes` answer is asked again after FEEDBACK_NUDGE_YES_COOLDOWN_MS. Stores written by
 * older versions (which never re-asked) carry submittedAt, else lastShownAt.
 */
function isYesCooldownOver(store: FeedbackNudgeStore, now: number): boolean {
  const answeredAt = isFiniteTimestamp(store.submittedAt) ? store.submittedAt : store.lastShownAt;
  if (!isFiniteTimestamp(answeredAt)) return false;
  return now - answeredAt >= FEEDBACK_NUDGE_YES_COOLDOWN_MS;
}

export function isFeedbackNudgeDue(now = Date.now()): boolean {
  if (!isFeedbackNudgeEnabled()) return false;
  if (!isAnalyticsEnabled() || !hasAnalyticsKey()) return false;
  if (isUiMcpSurface()) return false;

  const store = readStore();
  if (store.status === 'dont_ask') return false;
  if (store.status === 'yes') return isYesCooldownOver(store, now);
  if (isFiniteTimestamp(store.lastShownAt)) {
    return now - store.lastShownAt >= FEEDBACK_NUDGE_COOLDOWN_MS;
  }
  if (!isFiniteTimestamp(store.firstSeenAt)) return false;
  return now - store.firstSeenAt >= FEEDBACK_NUDGE_MIN_AGE_MS;
}

/** Stamp the first successful ping; later pings keep the original timestamp. */
export function markFeedbackFirstSeen(now = Date.now()): void {
  const store = readStore();
  if (isFiniteTimestamp(store.firstSeenAt)) return;
  writeStore({
    ...store,
    firstSeenAt: now,
  });
}

export function markFeedbackNudgeShown(now = Date.now()): void {
  const store = readStore();
  if (store.status === 'dont_ask') return;
  if (store.status === 'yes' && !isYesCooldownOver(store, now)) return;
  writeStore({
    ...store,
    status: 'shown',
    lastShownAt: now,
  });
}

export function recordFeedback(
  choice: FeedbackChoice,
  suggestion?: string,
  now = Date.now()
): { recorded: true; choice: FeedbackChoice; has_suggestion: boolean } {
  const truncated = truncateFeedbackSuggestion(suggestion);
  const hasSuggestion = Boolean(truncated);

  if (choice === 'yes') {
    writeStore({
      ...readStore(),
      status: 'yes',
      lastShownAt: now,
      submittedAt: now,
      choice,
    });
  } else if (choice === 'dont_ask') {
    writeStore({
      ...readStore(),
      status: 'dont_ask',
      lastShownAt: now,
      submittedAt: now,
      choice,
    });
  } else {
    writeStore({
      ...readStore(),
      status: 'shown',
      lastShownAt: now,
      submittedAt: now,
      choice: 'not_now',
    });
  }

  capture('mcp_product_feedback', {
    $pathname: '/feedback',
    $page_title: truncated ?? choice,
    feedback_choice: choice,
    has_suggestion: hasSuggestion,
    ...(truncated ? { suggestion: truncated } : {}),
    event_source: 'mcp',
  });
  void flushAnalyticsClient().catch(() => {});

  return { recorded: true, choice, has_suggestion: hasSuggestion };
}

export function buildFeedbackNudgeBlock(): string {
  return [
    FEEDBACK_NUDGE_MARKER,
    'Ask the user one short question. Pick the path for this host:',
    `- ${FEEDBACK_NUDGE_QUESTION_UI_PATH}`,
    `- ${FEEDBACK_NUDGE_CHAT_PATH}`,
    FEEDBACK_NUDGE_LANGUAGE_RULE,
    'Ask it yourself, in first person, in one or two short sentences.',
    'Do not mention a team, anonymous sending, or a survey. Do not write code or add tools from the answer.',
    '',
    `Meaning (English example only): ${FEEDBACK_NUDGE_QUESTION_EN}`,
    `Meaning (Turkish example only): ${FEEDBACK_NUDGE_QUESTION_TR}`,
    '',
    'If they name a problem or something missing: choice "yes" and suggestion = their answer.',
    'If they decline or have nothing to add: choice "not_now" ("dont_ask" only if they ask not to be asked again).',
    'If their next message ignores the question, do not call photoshop_submit_feedback and do not ask again.',
    FEEDBACK_NUDGE_ANSWER_RULE,
    '',
    'photoshop_submit_feedback arguments:',
    '- choice: "yes" | "not_now" | "dont_ask"',
    "- suggestion: string, required when choice is yes (the user's own words)",
  ].join('\n');
}

/**
 * First text block is always the connection string so existing ping clients keep working.
 * A connected ping carries at most one extra block: UPDATE_AVAILABLE wins, and a due
 * FEEDBACK_NUDGE waits for a later ping (its cooldown is not started). A due nudge also
 * waits, without starting its cooldown, while another tool ran in the active-task window.
 */
export function buildPingToolResult(connected: boolean, now = Date.now()): CallToolResult {
  const content: CallToolResult['content'] = [
    {
      type: 'text',
      text: connected ? PING_CONNECTED_TEXT : PING_FAILED_TEXT,
    },
  ];

  if (!connected) return { content };

  const feedbackEnabled = isFeedbackNudgeEnabled();
  if (feedbackEnabled) markFeedbackFirstSeen(now);

  const updateBlock = takeUpdateNoticeBlock(now);
  if (updateBlock) {
    content.push({ type: 'text', text: updateBlock });
  } else if (feedbackEnabled && !isTaskActive(now) && isFeedbackNudgeDue(now)) {
    markFeedbackNudgeShown(now);
    content.push({ type: 'text', text: buildFeedbackNudgeBlock() });
  }

  return { content };
}

function parseChoice(raw: unknown): FeedbackChoice | undefined {
  if (raw === 'yes' || raw === 'not_now' || raw === 'dont_ask') return raw;
  return undefined;
}

export function submitFeedbackFromArgs(args: Record<string, unknown>): CallToolResult {
  const choice = parseChoice(args.choice);
  if (!choice) {
    return envelopeToToolResult({
      ok: false,
      code: 'invalid_arguments',
      message: 'choice must be yes, not_now, or dont_ask',
    });
  }

  const suggestion = typeof args.suggestion === 'string' ? args.suggestion : undefined;
  if (choice === 'yes' && !suggestion?.trim()) {
    return envelopeToToolResult({
      ok: false,
      code: 'invalid_arguments',
      message:
        'choice "yes" needs suggestion: the user\'s own words, in their language. If the user has not answered yet, do not call photoshop_submit_feedback. Wait for their reply, then call it. Never send a placeholder, a guess or your own summary.',
    });
  }

  const recorded = recordFeedback(choice, suggestion);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          ok: true,
          recorded: true,
          choice: recorded.choice,
          has_suggestion: recorded.has_suggestion,
          next: "If the user's original Photoshop request is not finished, continue it now. Otherwise handle the rest of their latest message. Do not end the turn on the feedback question.",
        }),
      },
    ],
  };
}

/** Failed ping: PING_FAILED_TEXT stays the first block so existing clients still match it. */
export function buildPingFailureResult(reason: string): CallToolResult {
  return {
    content: [
      { type: 'text', text: PING_FAILED_TEXT },
      { type: 'text', text: reason },
    ],
  };
}
