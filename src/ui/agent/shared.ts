import type { ModelMessage } from 'ai';
import type { ModelPricing, UsageCost } from '../providers/registry.js';

export type { UsageCost };
import type { LanguageModelUsage } from 'ai';

export interface ToolCallPersist {
  id: string;
  name: string;
  input: unknown;
  result?: { ok: boolean; content: string };
  status: 'pending' | 'success' | 'error';
}

export type PlanStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface PlanStepView {
  id: string;
  tool: string;
  rationale?: string;
  status: PlanStepStatus;
}

export interface PlanView {
  summary: string;
  steps: PlanStepView[];
}

export interface AssistantBuffer {
  text: string;
  toolCalls: ToolCallPersist[];
  /** Present only for Action Plan (beta) runs; persisted so it survives reload. */
  plan?: PlanView;
}

export interface RunChatStreamEvent {
  type:
    | 'text-delta'
    | 'tool-call'
    | 'tool-result'
    | 'finish'
    | 'error'
    | 'plan'
    | 'plan-step'
    | 'plan-repair';
  payload: unknown;
}

export interface RunChatFinishInfo {
  usage: LanguageModelUsage;
  cost?: UsageCost;
}

export function stringifyToolOutput(output: unknown): string {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  if (typeof output === 'object' && output !== null && 'content' in output) {
    const content = (output as { content?: Array<{ type?: string; text?: string }> }).content;
    if (Array.isArray(content)) {
      return content
        .map((c) => (typeof c === 'string' ? c : c?.text ?? ''))
        .filter(Boolean)
        .join('\n');
    }
  }
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

export function computeCost(usage: LanguageModelUsage, pricing: ModelPricing): UsageCost {
  const cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
  const totalInput = usage.inputTokens ?? 0;
  const noCache =
    usage.inputTokenDetails?.noCacheTokens ??
    Math.max(0, totalInput - cacheRead - cacheWrite);
  const output = usage.outputTokens ?? 0;

  const inputUsd = (noCache / 1_000_000) * pricing.inputUsdPerMTok;
  const outputUsd = (output / 1_000_000) * pricing.outputUsdPerMTok;
  const cachedReadUsd =
    (cacheRead / 1_000_000) * (pricing.cachedInputUsdPerMTok ?? pricing.inputUsdPerMTok);
  const cachedWriteUsd =
    (cacheWrite / 1_000_000) * (pricing.cachedWriteUsdPerMTok ?? pricing.inputUsdPerMTok);

  return {
    totalUsd: inputUsd + outputUsd + cachedReadUsd + cachedWriteUsd,
    inputUsd,
    outputUsd,
    cachedReadUsd,
    cachedWriteUsd,
  };
}

export function buildPromptWithHistory(history: ModelMessage[], prompt: string): string {
  const parts: string[] = [];
  for (const m of history) {
    const text =
      typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content
              .map((part) => ('text' in part ? part.text : ''))
              .filter(Boolean)
              .join('\n')
          : '';
    const trimmed = text.trim();
    if (!trimmed) continue;
    parts.push(`${m.role === 'user' ? 'User' : 'Assistant'}: ${trimmed}`);
  }
  parts.push(`User: ${prompt}`);
  return parts.join('\n\n');
}
