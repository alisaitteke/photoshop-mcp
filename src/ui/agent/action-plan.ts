import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import type { LanguageModelUsage, ModelMessage } from 'ai';
import { randomUUID } from 'node:crypto';
import type { ProviderAdapter } from '../providers/registry.js';
import type { AuthMethod } from '../providers/types.js';
import { buildSpawnArgs, buildUiMcpChildEnv } from './mcp-transport.js';
import {
  buildToolCatalog,
  toPartialPlanView,
  toStepView,
  type CatalogTool,
  type Plan,
  type PlanStep,
} from './plan-schema.js';
import { createPlanner, type PlanResult, type Planner, type PlannerEvent } from './planner.js';
import {
  computeCost,
  finishToolCall,
  parseToolEnvelope,
  toolFailureMessage,
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
  apiKey?: string;
  modelId: string;
  chatId?: string;
  cliPath?: string;
  authMethod?: AuthMethod;
  systemPrompt: string;
  abortSignal: AbortSignal;
  onAssistantBuffer?: (buf: AssistantBuffer) => void;
  onFinish?: (info: RunChatFinishInfo) => void;
}

const MAX_REPAIRS = 3;
const MAX_SUGGESTED_FOLLOW_UPS = 5;

interface ExecutableTool extends CatalogTool {
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
  const authMethod = opts.authMethod ?? 'api_key';
  const pricing = opts.provider.getModelPricing(opts.modelId);

  let planner: Planner;
  try {
    planner = createPlanner({
      authMethod,
      provider: opts.provider,
      apiKey: opts.apiKey,
      modelId: opts.modelId,
      cliPath: opts.cliPath,
    });
  } catch (err) {
    yield { type: 'error', payload: { message: (err as Error).message } };
    return;
  }

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
        env: buildUiMcpChildEnv(opts.chatId),
      }),
    });

    const tools = (await mcp.tools()) as ToolMap;
    const catalog = buildToolCatalog(tools);

    yield { type: 'activity', payload: { phase: 'planning' } };

    let plan: Plan;
    try {
      const planned = yield* collectPlan(
        planner.plan({
          catalog,
          history: opts.history,
          prompt: opts.prompt,
          systemPrompt: opts.systemPrompt,
          abortSignal: opts.abortSignal,
        }),
        (view) => {
          buffer.plan = view;
          opts.onAssistantBuffer?.(buffer);
        }
      );
      plan = planned.plan;
      addUsage(planned.usage);
    } catch (err) {
      yield {
        type: 'error',
        payload: { message: `Planning failed: ${(err as Error).message}` },
      };
      return;
    }

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
      buffer.toolCalls.push({
        id: toolCallId,
        name: step.tool,
        input: args,
        status: 'pending',
        startedAt: Date.now(),
      });
      opts.onAssistantBuffer?.(buffer);

      try {
        const output = await tool!.execute!(args, {
          toolCallId,
          messages: [],
          abortSignal: opts.abortSignal,
        });
        results[step.id] = output;
        const payload = finishToolCall(buffer, toolCallId, { output, chatId: opts.chatId });
        const { ok, content: text } = payload;
        yield { type: 'tool-result', payload };
        opts.onAssistantBuffer?.(buffer);
        if (ok) {
          setStepStatus(planView, step.id, 'done');
          yield { type: 'plan-step', payload: { id: step.id, status: 'done' as PlanStepStatus } };
          opts.onAssistantBuffer?.(buffer);
          i++;
        } else {
          const repaired = yield* tryRepair(toolFailureMessage(output, text), step);
          if (!repaired) break;
        }
      } catch (err) {
        const text = (err as Error)?.message ?? String(err);
        yield { type: 'tool-result', payload: finishToolCall(buffer, toolCallId, { error: text }) };
        opts.onAssistantBuffer?.(buffer);
        const repaired = yield* tryRepair(text, step);
        if (!repaired) break;
      }
    }

    if (i >= steps.length && !opts.abortSignal.aborted && steps.length > 0) {
      const lastStep = steps[steps.length - 1]!;
      let lastOutput: unknown = results[lastStep.id];
      let followUpCount = 0;
      const seenFollowUpTools = new Set<string>();

      while (followUpCount < MAX_SUGGESTED_FOLLOW_UPS && lastOutput && !opts.abortSignal.aborted) {
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
          startedAt: Date.now(),
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
          const payload = finishToolCall(buffer, toolCallId, { output, chatId: opts.chatId });
          const { ok } = payload;
          yield { type: 'tool-result', payload };
          if (ok) {
            setStepStatus(planView, followStepId, 'done');
            yield {
              type: 'plan-step',
              payload: { id: followStepId, status: 'done' as PlanStepStatus },
            };
            opts.onAssistantBuffer?.(buffer);
          } else {
            setStepStatus(planView, followStepId, 'error');
            yield {
              type: 'plan-step',
              payload: { id: followStepId, status: 'error' as PlanStepStatus },
            };
            opts.onAssistantBuffer?.(buffer);
            break;
          }
        } catch (err) {
          const text = (err as Error)?.message ?? String(err);
          yield { type: 'tool-result', payload: finishToolCall(buffer, toolCallId, { error: text }) };
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

    function* emitFinish(): Generator<RunChatStreamEvent> {
      const cost = planner.kind === 'sdk' && pricing ? computeCost(totalUsage, pricing) : undefined;
      opts.onFinish?.({ usage: totalUsage, cost });
      yield {
        type: 'finish',
        payload: {
          finishReason: 'stop',
          usage: totalUsage,
          cost,
          ...(planner.kind === 'subscription' ? { subscription: true } : {}),
        },
      };
    }

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
      yield {
        type: 'plan-step',
        payload: { id: failedStep.id, status: 'error' as PlanStepStatus },
      };
      yield {
        type: 'plan-repair',
        payload: { stepId: failedStep.id, attempt: repairs, reason: errorMessage },
      };
      opts.onAssistantBuffer?.(buffer);

      const remaining = steps.slice(i);
      let replanned: Plan;
      try {
        yield { type: 'activity', payload: { phase: 'planning' } };

        const repaired = yield* collectRepairPlan(
          planner.repair({
            catalog,
            originalPrompt: opts.prompt,
            remaining,
            results,
            errorMessage,
            systemPrompt: opts.systemPrompt,
            abortSignal: opts.abortSignal,
          }),
          planView,
          i,
          (view) => {
            buffer.plan = view;
            opts.onAssistantBuffer?.(buffer);
          }
        );
        replanned = repaired.plan;
        addUsage(repaired.usage);
      } catch (err) {
        yield {
          type: 'error',
          payload: { message: `Re-planning failed: ${(err as Error).message}` },
        };
        return false;
      }

      steps = [...steps.slice(0, i), ...replanned.steps];
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

async function* collectPlan(
  gen: AsyncGenerator<PlannerEvent, PlanResult>,
  onPartial: (view: PlanView) => void
): AsyncGenerator<RunChatStreamEvent, PlanResult> {
  while (true) {
    const next = await gen.next();
    if (next.done) return next.value;
    const view = toPartialPlanView(next.value.plan);
    onPartial(view);
    yield { type: 'plan-partial', payload: view };
  }
}

async function* collectRepairPlan(
  gen: AsyncGenerator<PlannerEvent, PlanResult>,
  planView: PlanView,
  completedCount: number,
  onPartial: (view: PlanView) => void
): AsyncGenerator<RunChatStreamEvent, PlanResult> {
  while (true) {
    const next = await gen.next();
    if (next.done) return next.value;
    const partialTail = toPartialPlanView(next.value.plan);
    const mergedView: PlanView = {
      summary: partialTail.summary || planView.summary,
      steps: [...planView.steps.slice(0, completedCount), ...partialTail.steps],
    };
    onPartial(mergedView);
    yield { type: 'plan-partial', payload: mergedView };
  }
}

function setStepStatus(plan: PlanView, id: string, status: PlanStepStatus): void {
  const step = plan.steps.find((s) => s.id === id);
  if (step) step.status = status;
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

function extractSuggestedFollowUp(
  result: unknown
): { tool: string; args: Record<string, unknown> } | null {
  const parsed = parseToolEnvelope(result);
  if (!parsed) return null;

  const tool =
    (typeof parsed.next_suggested_tool === 'string' && parsed.next_suggested_tool) ||
    (typeof parsed.suggested_next_tool === 'string' && parsed.suggested_next_tool) ||
    null;
  if (!tool) return null;

  const args =
    parsed.suggested_args &&
    typeof parsed.suggested_args === 'object' &&
    parsed.suggested_args !== null
      ? (parsed.suggested_args as Record<string, unknown>)
      : {};

  return { tool, args };
}
