import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { generateObject, type LanguageModelUsage, type ModelMessage } from 'ai';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PHOTOSHOP_EXPORT_CHAT_ID_ENV } from '../../lib/export-paths.js';
import type { ProviderAdapter } from '../providers/registry.js';
import type { AuthMethod } from '../providers/types.js';
import { buildSpawnArgs, sanitizedEnv } from './mcp-transport.js';
import {
  computeCost,
  stringifyToolOutput,
  type AssistantBuffer,
  type PlanStepStatus,
  type PlanView,
  type RunChatFinishInfo,
  type RunChatStreamEvent,
} from './shared.js';

export interface RunChatViaActionPlanOptions {
  prompt: string;
  history: ModelMessage[];
  provider: ProviderAdapter;
  apiKey: string;
  modelId: string;
  chatId?: string;
  authMethod?: AuthMethod;
  systemPrompt: string;
  abortSignal: AbortSignal;
  onAssistantBuffer?: (buf: AssistantBuffer) => void;
  onFinish?: (info: RunChatFinishInfo) => void;
}

const MAX_STEPS = 20;
const MAX_REPAIRS = 3;
const MAX_SUGGESTED_FOLLOW_UPS = 5;

const planStepSchema = z.object({
  id: z.string().describe('Unique short id for this step, e.g. "s1".'),
  tool: z.string().describe('Exact tool name from the catalog.'),
  argsJson: z
    .string()
    .describe(
      'JSON-encoded object of arguments for the tool. Use "{}" if none. ' +
        'A value may reference a prior step result with the placeholder ' +
        '"$steps.<stepId>.<dot.path>" (e.g. "$steps.s1.document.id").'
    ),
  rationale: z.string().optional().describe('One short sentence on why this step.'),
  dependsOn: z.array(z.string()).optional().describe('Step ids this step depends on.'),
});

const planSchema = z.object({
  summary: z.string().describe('One short sentence summarizing the overall plan.'),
  steps: z.array(planStepSchema).max(MAX_STEPS),
});

type PlanStep = z.infer<typeof planStepSchema>;
type Plan = z.infer<typeof planSchema>;

// AI SDK tool shape we rely on (MCP-provided dynamic tools).
interface ExecutableTool {
  description?: string;
  inputSchema?: unknown;
  execute?: (
    input: unknown,
    options: { toolCallId: string; messages: ModelMessage[]; abortSignal?: AbortSignal }
  ) => Promise<unknown>;
}

type ToolMap = Record<string, ExecutableTool>;

class PlaceholderError extends Error {}

export async function* runChatViaActionPlan(
  opts: RunChatViaActionPlanOptions
): AsyncGenerator<RunChatStreamEvent> {
  let mcp: MCPClient | undefined;
  const buffer: AssistantBuffer = { text: '', toolCalls: [] };
  const model = opts.provider.getLanguageModel({ apiKey: opts.apiKey, modelId: opts.modelId });
  const pricing = opts.provider.getModelPricing(opts.modelId);

  // Aggregate planner + repair token usage across all generateObject calls.
  const totalUsage: LanguageModelUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
  };
  const addUsage = (u?: LanguageModelUsage): void => {
    if (!u) return;
    totalUsage.inputTokens = (totalUsage.inputTokens ?? 0) + (u.inputTokens ?? 0);
    totalUsage.outputTokens = (totalUsage.outputTokens ?? 0) + (u.outputTokens ?? 0);
    totalUsage.totalTokens = (totalUsage.totalTokens ?? 0) + (u.totalTokens ?? 0);
    const id = totalUsage.inputTokenDetails;
    id.noCacheTokens = (id.noCacheTokens ?? 0) + (u.inputTokenDetails?.noCacheTokens ?? 0);
    id.cacheReadTokens = (id.cacheReadTokens ?? 0) + (u.inputTokenDetails?.cacheReadTokens ?? 0);
    id.cacheWriteTokens = (id.cacheWriteTokens ?? 0) + (u.inputTokenDetails?.cacheWriteTokens ?? 0);
    const od = totalUsage.outputTokenDetails;
    od.textTokens = (od.textTokens ?? 0) + (u.outputTokenDetails?.textTokens ?? 0);
    od.reasoningTokens = (od.reasoningTokens ?? 0) + (u.outputTokenDetails?.reasoningTokens ?? 0);
  };

  try {
    mcp = await createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: process.execPath,
        args: buildSpawnArgs(),
        env: {
          ...sanitizedEnv(),
          LOG_LEVEL: process.env.LOG_LEVEL ?? '2',
          ...(opts.chatId ? { [PHOTOSHOP_EXPORT_CHAT_ID_ENV]: opts.chatId } : {}),
        },
      }),
    });

    const tools = (await mcp.tools()) as ToolMap;
    const catalog = buildToolCatalog(tools);

    // ---- 1. Plan ---------------------------------------------------------
    const planResult = await generateObject({
      model,
      schema: planSchema,
      system: opts.systemPrompt,
      prompt: buildPlannerPrompt(catalog, opts.history, opts.prompt),
      abortSignal: opts.abortSignal,
    });
    addUsage(planResult.usage);

    let plan: Plan = planResult.object;

    // Empty plan -> fall back to a single natural-language reply.
    if (!plan.steps.length) {
      buffer.text = plan.summary?.trim() || 'No actionable steps were produced for this request.';
      yield { type: 'text-delta', payload: { text: buffer.text } };
      opts.onAssistantBuffer?.(buffer);
      yield* emitFinish();
      return;
    }

    const planView: PlanView = {
      summary: plan.summary,
      steps: plan.steps.map((s) => toStepView(s, 'pending')),
    };
    buffer.plan = planView;
    yield { type: 'plan', payload: planView };
    opts.onAssistantBuffer?.(buffer);

    // ---- 2. Execute (with bounded repair) --------------------------------
    const results: Record<string, unknown> = {};
    let steps = plan.steps;
    let i = 0;
    let repairs = 0;

    while (i < steps.length) {
      if (opts.abortSignal.aborted) break;
      const step = steps[i]!;
      const toolCallId = randomUUID();

      setStepStatus(planView, step.id, 'running');
      yield { type: 'plan-step', payload: { id: step.id, status: 'running' as PlanStepStatus } };
      opts.onAssistantBuffer?.(buffer);

      const tool = tools[step.tool];

      // Resolve args + validate tool existence before announcing the call.
      let args: unknown;
      let prepError: string | undefined;
      if (!tool || typeof tool.execute !== 'function') {
        prepError = `Unknown tool "${step.tool}". It is not in the available tool catalog.`;
      } else {
        try {
          args = resolveArgs(step.argsJson, results);
        } catch (err) {
          prepError =
            err instanceof PlaceholderError
              ? `Unresolved dependency: ${err.message}`
              : `Invalid arguments JSON: ${(err as Error).message}`;
        }
      }

      if (prepError) {
        const repaired = yield* tryRepair(prepError, step);
        if (!repaired) break;
        continue;
      }

      yield {
        type: 'tool-call',
        payload: { id: toolCallId, name: step.tool, input: args },
      };
      buffer.toolCalls.push({ id: toolCallId, name: step.tool, input: args, status: 'pending' });
      opts.onAssistantBuffer?.(buffer);

      try {
        const output = await tool!.execute!(args, {
          toolCallId,
          messages: [],
          abortSignal: opts.abortSignal,
        });
        results[step.id] = output;
        const text = stringifyToolOutput(output);
        const tc = buffer.toolCalls.find((c) => c.id === toolCallId);
        if (tc) {
          tc.result = { ok: true, content: text };
          tc.status = 'success';
        }
        yield { type: 'tool-result', payload: { id: toolCallId, ok: true, content: text } };
        setStepStatus(planView, step.id, 'done');
        yield { type: 'plan-step', payload: { id: step.id, status: 'done' as PlanStepStatus } };
        opts.onAssistantBuffer?.(buffer);
        i++;
      } catch (err) {
        const text = (err as Error)?.message ?? String(err);
        const tc = buffer.toolCalls.find((c) => c.id === toolCallId);
        if (tc) {
          tc.result = { ok: false, content: text };
          tc.status = 'error';
        }
        yield { type: 'tool-result', payload: { id: toolCallId, ok: false, content: text } };
        opts.onAssistantBuffer?.(buffer);
        const repaired = yield* tryRepair(text, step);
        if (!repaired) break;
      }
    }

    // ---- 3. Execute tool-suggested follow-ups (no extra LLM round-trip) --
    if (i >= steps.length && !opts.abortSignal.aborted && steps.length > 0) {
      const lastStep = steps[steps.length - 1]!;
      let lastOutput: unknown = results[lastStep.id];
      let followUpCount = 0;
      const seenFollowUpTools = new Set<string>();

      while (
        followUpCount < MAX_SUGGESTED_FOLLOW_UPS &&
        lastOutput &&
        !opts.abortSignal.aborted
      ) {
        const suggestion = extractSuggestedFollowUp(lastOutput);
        if (!suggestion || seenFollowUpTools.has(suggestion.tool)) break;

        const followTool = tools[suggestion.tool];
        if (!followTool || typeof followTool.execute !== 'function') break;

        seenFollowUpTools.add(suggestion.tool);
        followUpCount++;
        const followStepId = `followup-${followUpCount}`;
        const toolCallId = randomUUID();

        planView.steps.push({
          id: followStepId,
          tool: suggestion.tool,
          rationale: 'Suggested by prior tool result',
          status: 'running',
        });
        yield { type: 'plan', payload: planView };
        yield {
          type: 'plan-step',
          payload: { id: followStepId, status: 'running' as PlanStepStatus },
        };
        opts.onAssistantBuffer?.(buffer);

        yield {
          type: 'tool-call',
          payload: { id: toolCallId, name: suggestion.tool, input: suggestion.args },
        };
        buffer.toolCalls.push({
          id: toolCallId,
          name: suggestion.tool,
          input: suggestion.args,
          status: 'pending',
        });
        opts.onAssistantBuffer?.(buffer);

        try {
          const output = await followTool.execute!(suggestion.args, {
            toolCallId,
            messages: [],
            abortSignal: opts.abortSignal,
          });
          lastOutput = output;
          results[followStepId] = output;
          const text = stringifyToolOutput(output);
          const tc = buffer.toolCalls.find((c) => c.id === toolCallId);
          if (tc) {
            tc.result = { ok: true, content: text };
            tc.status = 'success';
          }
          yield { type: 'tool-result', payload: { id: toolCallId, ok: true, content: text } };
          setStepStatus(planView, followStepId, 'done');
          yield {
            type: 'plan-step',
            payload: { id: followStepId, status: 'done' as PlanStepStatus },
          };
          opts.onAssistantBuffer?.(buffer);
        } catch (err) {
          const text = (err as Error)?.message ?? String(err);
          const tc = buffer.toolCalls.find((c) => c.id === toolCallId);
          if (tc) {
            tc.result = { ok: false, content: text };
            tc.status = 'error';
          }
          yield { type: 'tool-result', payload: { id: toolCallId, ok: false, content: text } };
          setStepStatus(planView, followStepId, 'error');
          yield {
            type: 'plan-step',
            payload: { id: followStepId, status: 'error' as PlanStepStatus },
          };
          opts.onAssistantBuffer?.(buffer);
          break;
        }
      }
    }

    yield* emitFinish();
    return;

    // ---- helpers (closures over plan state) ------------------------------

    function* emitFinish(): Generator<RunChatStreamEvent> {
      const cost = pricing ? computeCost(totalUsage, pricing) : undefined;
      opts.onFinish?.({ usage: totalUsage, cost });
      yield { type: 'finish', payload: { finishReason: 'stop', usage: totalUsage, cost } };
    }

    /**
     * Re-plan ONLY the remaining steps (from the current failed index) using the
     * accumulated results and the error. Returns false when the repair budget is
     * exhausted (caller should stop), true when execution can continue.
     */
    async function* tryRepair(
      errorMessage: string,
      failedStep: PlanStep
    ): AsyncGenerator<RunChatStreamEvent, boolean> {
      if (repairs >= MAX_REPAIRS) {
        setStepStatus(planView, failedStep.id, 'error');
        opts.onAssistantBuffer?.(buffer);
        yield {
          type: 'plan-step',
          payload: { id: failedStep.id, status: 'error' as PlanStepStatus },
        };
        yield {
          type: 'error',
          payload: {
            message: `Action plan failed after ${MAX_REPAIRS} repair attempts at step "${failedStep.id}": ${errorMessage}`,
          },
        };
        return false;
      }
      repairs++;
      setStepStatus(planView, failedStep.id, 'error');
      yield { type: 'plan-step', payload: { id: failedStep.id, status: 'error' as PlanStepStatus } };
      yield {
        type: 'plan-repair',
        payload: { stepId: failedStep.id, attempt: repairs, reason: errorMessage },
      };
      opts.onAssistantBuffer?.(buffer);

      const remaining = steps.slice(i);
      let replanned: Plan;
      try {
        const repairResult = await generateObject({
          model,
          schema: planSchema,
          system: opts.systemPrompt,
          prompt: buildRepairPrompt(catalog, opts.prompt, remaining, results, errorMessage),
          abortSignal: opts.abortSignal,
        });
        addUsage(repairResult.usage);
        replanned = repairResult.object;
      } catch (err) {
        yield {
          type: 'error',
          payload: { message: `Re-planning failed: ${(err as Error).message}` },
        };
        return false;
      }

      // Splice the new steps in place of the remaining ones; keep index.
      steps = [...steps.slice(0, i), ...replanned.steps];
      // Rebuild the plan view tail so the UI reflects the new todo list.
      planView.steps = [
        ...planView.steps.slice(0, i),
        ...replanned.steps.map((s) => toStepView(s, 'pending')),
      ];
      yield { type: 'plan', payload: planView };
      opts.onAssistantBuffer?.(buffer);
      return true;
    }
  } finally {
    if (mcp) await mcp.close().catch(() => undefined);
  }
}

// ---- pure helpers ------------------------------------------------------

function toStepView(step: PlanStep, status: PlanStepStatus) {
  return { id: step.id, tool: step.tool, rationale: step.rationale, status };
}

function setStepStatus(plan: PlanView, id: string, status: PlanStepStatus): void {
  const step = plan.steps.find((s) => s.id === id);
  if (step) step.status = status;
}

function buildToolCatalog(tools: ToolMap): string {
  const lines: string[] = [];
  for (const [name, tool] of Object.entries(tools)) {
    const desc = (tool.description ?? '').replace(/\s+/g, ' ').trim();
    let params = '';
    try {
      const schema = tool.inputSchema as { jsonSchema?: unknown } | undefined;
      const json = schema?.jsonSchema ?? schema;
      if (json) params = JSON.stringify(json);
    } catch {
      params = '';
    }
    lines.push(`- ${name}: ${desc}${params ? `\n  params: ${params}` : ''}`);
  }
  return lines.join('\n');
}

function buildPlannerPrompt(catalog: string, history: ModelMessage[], prompt: string): string {
  return [
    'Produce a COMPLETE ordered execution plan of Photoshop MCP tool calls that fully delivers the user request.',
    'Rules:',
    '- Use ONLY tools from the catalog below; copy tool names exactly.',
    '- Each step\'s argsJson must be a valid JSON object string matching the tool params.',
    '- When a step needs a value produced by an earlier step, reference it with',
    '  "$steps.<stepId>.<dot.path>" inside argsJson instead of guessing.',
    '- The plan must accomplish the full request end-to-end. Do not stop at partial progress.',
    '- After meaningful visual edits, include photoshop_get_preview when the user expects to see the result.',
    '- Prefer photoshop_recipe_* tools over composing many atomic calls when the request matches a recipe.',
    '- Read each tool description: if a recipe already performs a sub-task, do not duplicate with atomic tools.',
    '- Include photoshop_get_state when document/layer state is uncertain before dependent tools.',
    '- Include export/save steps when the user asks to export or save a file.',
    '',
    'Tool catalog:',
    catalog,
    '',
    formatHistory(history),
    `User request: ${prompt}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildRepairPrompt(
  catalog: string,
  originalPrompt: string,
  remaining: PlanStep[],
  results: Record<string, unknown>,
  errorMessage: string
): string {
  return [
    'A step in the execution plan failed. Re-plan ONLY the remaining work.',
    `Original user request: ${originalPrompt}`,
    '',
    'Error from the failed step:',
    errorMessage,
    '',
    'Results already produced by completed steps (JSON):',
    safeJson(results),
    '',
    'Remaining steps that still need to run (the first one failed):',
    safeJson(remaining),
    '',
    'Return a corrected, ordered plan for the remaining work only. Reuse prior results',
    'via "$steps.<stepId>.<dot.path>" placeholders. Use ONLY tools from the catalog.',
    '',
    'Tool catalog:',
    catalog,
  ].join('\n');
}

function formatHistory(history: ModelMessage[]): string {
  if (!history.length) return '';
  const lines = history
    .map((m) => {
      const text =
        typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? m.content.map((p) => ('text' in p ? p.text : '')).filter(Boolean).join(' ')
            : '';
      const trimmed = text.trim();
      return trimmed ? `${m.role === 'user' ? 'User' : 'Assistant'}: ${trimmed}` : '';
    })
    .filter(Boolean);
  return lines.length ? `Conversation so far:\n${lines.join('\n')}\n` : '';
}

function resolveArgs(argsJson: string, results: Record<string, unknown>): unknown {
  const trimmed = (argsJson ?? '').trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  return resolvePlaceholders(parsed, results);
}

const PLACEHOLDER_RE = /^\$steps\.([^.]+)(?:\.(.+))?$/;

function resolvePlaceholders(value: unknown, results: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const match = PLACEHOLDER_RE.exec(value);
    if (!match) return value;
    const [, stepId, path] = match;
    if (!(stepId! in results)) {
      throw new PlaceholderError(`step "${stepId}" has no result yet for "${value}"`);
    }
    const resolved = path ? getByPath(results[stepId!], path) : results[stepId!];
    if (resolved === undefined) {
      throw new PlaceholderError(`path "${path}" not found in result of step "${stepId}"`);
    }
    return resolved;
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolvePlaceholders(v, results));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolvePlaceholders(v, results);
    }
    return out;
  }
  return value;
}

function getByPath(root: unknown, path: string): unknown {
  let current = root;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Parse tool result envelopes for next_suggested_tool / suggested_next_tool hints. */
function extractSuggestedFollowUp(
  result: unknown
): { tool: string; args: Record<string, unknown> } | null {
  const parsed = parseToolResultObject(result);
  if (!parsed) return null;

  const tool =
    (typeof parsed.next_suggested_tool === 'string' && parsed.next_suggested_tool) ||
    (typeof parsed.suggested_next_tool === 'string' && parsed.suggested_next_tool) ||
    null;
  if (!tool) return null;

  const args =
    parsed.suggested_args && typeof parsed.suggested_args === 'object' && parsed.suggested_args !== null
      ? (parsed.suggested_args as Record<string, unknown>)
      : {};

  return { tool, args };
}

function parseToolResultObject(result: unknown): Record<string, unknown> | null {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    if ('content' in result) {
      const text = stringifyToolOutput(result);
      try {
        const fromText = JSON.parse(text) as unknown;
        if (fromText && typeof fromText === 'object' && !Array.isArray(fromText)) {
          return fromText as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
    return result as Record<string, unknown>;
  }
  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}
