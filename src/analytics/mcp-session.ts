import { hasAnalyticsKey } from './config.js';
import { buildRuntimeProperties } from './events.js';
import { isAnalyticsEnabled } from './identity.js';
import { getActiveMcpClient } from './mcp-client-state.js';
import { captureAnalyticsMilestoneOnce } from './milestones.js';
import { captureMcpPageleave } from './pageview.js';
import { flushAnalyticsClient, getAnalytics } from './provider.js';

export type McpShutdownReason = 'sigint' | 'sigterm' | 'error' | 'stdio_closed';
export type McpToolBatchFlushReason = 'debounce' | 'max_hold' | 'shutdown' | 'client_disconnect';

/** Flush after the last tool in a burst — fits IDE agent turns (LLM pauses between bursts). */
const DEBOUNCE_FLUSH_MS = 3_000;
/** Force flush during long uninterrupted tool chains (no debounce gap). */
const MAX_BATCH_HOLD_MS = 60_000;
const MAX_SUMMARY_LENGTH = 800;

interface ToolBatchEntry {
  ok: number;
  fail: number;
  errors: Map<string, number>;
  durationMs: number;
}

let startedAt: number | null = null;
let toolBatch = new Map<string, ToolBatchEntry>();
let debounceFlushTimer: ReturnType<typeof setTimeout> | null = null;
let maxHoldFlushTimer: ReturnType<typeof setTimeout> | null = null;

function captureMcpEvent(name: string, properties: Record<string, unknown>): void {
  if (!isAnalyticsEnabled() || !hasAnalyticsKey()) return;
  const client = getActiveMcpClient();
  getAnalytics().capture({
    name,
    properties: buildRuntimeProperties({
      ...(client.name ? { mcp_client_name: client.name } : {}),
      ...(client.version ? { mcp_client_version: client.version } : {}),
      ...properties,
    }),
  });
}

function clearDebounceFlushTimer(): void {
  if (!debounceFlushTimer) return;
  clearTimeout(debounceFlushTimer);
  debounceFlushTimer = null;
}

function clearMaxHoldFlushTimer(): void {
  if (!maxHoldFlushTimer) return;
  clearTimeout(maxHoldFlushTimer);
  maxHoldFlushTimer = null;
}

function clearFlushTimers(): void {
  clearDebounceFlushTimer();
  clearMaxHoldFlushTimer();
}

function formatUsageSummary(batch: Map<string, ToolBatchEntry>): string {
  const parts = [...batch.entries()]
    .sort((a, b) => b[1].ok + b[1].fail - (a[1].ok + a[1].fail))
    .map(([name, entry]) => `${name}:${entry.ok + entry.fail}`);

  let summary = parts.join(',');
  if (summary.length > MAX_SUMMARY_LENGTH) {
    summary = `${summary.slice(0, MAX_SUMMARY_LENGTH)}…`;
  }
  return summary;
}

function formatErrorCodesSummary(batch: Map<string, ToolBatchEntry>): string | undefined {
  const totals = new Map<string, number>();
  for (const entry of batch.values()) {
    for (const [code, count] of entry.errors) {
      totals.set(code, (totals.get(code) ?? 0) + count);
    }
  }
  if (totals.size === 0) return undefined;

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => `${code}:${count}`)
    .join(',');
}

function collectErrorCodes(batch: Map<string, ToolBatchEntry>): string[] {
  const codes = new Set<string>();
  for (const entry of batch.values()) {
    for (const code of entry.errors.keys()) {
      codes.add(code);
    }
  }
  return [...codes].sort();
}

export function flushMcpToolBatch(reason: McpToolBatchFlushReason): void {
  if (toolBatch.size === 0) return;

  let toolsCalledCount = 0;
  let toolsErrorCount = 0;
  let totalDurationMs = 0;

  for (const entry of toolBatch.values()) {
    toolsCalledCount += entry.ok + entry.fail;
    toolsErrorCount += entry.fail;
    totalDurationMs += entry.durationMs;
  }

  const errorCodesSummary = formatErrorCodesSummary(toolBatch);
  const errorCodes = collectErrorCodes(toolBatch);
  const toolsUsed = [...toolBatch.keys()].sort();

  captureMcpEvent('mcp_tool_batch', {
    tools_called_count: toolsCalledCount,
    tools_error_count: toolsErrorCount,
    unique_tools_count: toolBatch.size,
    tool_usage_summary: formatUsageSummary(toolBatch),
    tools_used: toolsUsed,
    had_errors: toolsErrorCount > 0,
    ...(errorCodesSummary ? { error_codes_summary: errorCodesSummary } : {}),
    ...(errorCodes.length > 0 ? { error_codes: errorCodes } : {}),
    batch_flush_reason: reason,
    duration_ms: totalDurationMs,
    event_source: 'mcp',
  });

  // Deliver the batch immediately — long-lived MCP stdio sessions may never call shutdown().
  void flushAnalyticsClient().catch(() => {});

  toolBatch.clear();
  clearFlushTimers();
}

function scheduleBatchFlush(): void {
  clearDebounceFlushTimer();
  debounceFlushTimer = setTimeout(() => {
    debounceFlushTimer = null;
    flushMcpToolBatch('debounce');
  }, DEBOUNCE_FLUSH_MS);
  debounceFlushTimer.unref?.();

  if (!maxHoldFlushTimer) {
    maxHoldFlushTimer = setTimeout(() => {
      maxHoldFlushTimer = null;
      flushMcpToolBatch('max_hold');
    }, MAX_BATCH_HOLD_MS);
    maxHoldFlushTimer.unref?.();
  }
}

export function startMcpAnalyticsSession(): void {
  startedAt = Date.now();
}

export function recordMcpToolCall(params: {
  toolName: string;
  ok: boolean;
  errorCode?: string;
  durationMs: number;
}): void {
  const existing = toolBatch.get(params.toolName) ?? {
    ok: 0,
    fail: 0,
    errors: new Map<string, number>(),
    durationMs: 0,
  };

  if (params.ok) {
    existing.ok += 1;
  } else {
    existing.fail += 1;
    if (params.errorCode) {
      existing.errors.set(params.errorCode, (existing.errors.get(params.errorCode) ?? 0) + 1);
    }
  }
  existing.durationMs += params.durationMs;
  toolBatch.set(params.toolName, existing);

  if (params.ok) {
    captureAnalyticsMilestoneOnce('mcp_first_tool_success', {
      tool_name: params.toolName,
      event_source: 'mcp',
    });
  }

  scheduleBatchFlush();
}

export function flushMcpToolBatchOnClientDisconnect(): void {
  flushMcpToolBatch('client_disconnect');
}

export function endMcpAnalyticsSession(reason: McpShutdownReason): void {
  flushMcpToolBatch('shutdown');

  const durationMs = startedAt !== null ? Date.now() - startedAt : 0;
  captureMcpPageleave(durationMs, reason);
  captureMcpEvent('mcp_session_ended', {
    duration_ms: durationMs,
    shutdown_reason: reason,
    event_source: 'mcp',
  });

  startedAt = null;
  toolBatch.clear();
  clearFlushTimers();
}
