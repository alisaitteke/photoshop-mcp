import type { LanguageModelUsage, ModelMessage } from 'ai';
import { buildPhotoshopInstructions } from '../prompts/instructions.js';
import type { AuthMethod } from './providers/types.js';
import type { ProviderAdapter } from './providers/registry.js';
import { runChatViaActionPlan } from './agent/action-plan.js';
import { runChatViaApiKey } from './agent/api-key.js';
import { runChatViaClaudeAccount } from './agent/claude-account.js';
import { runChatViaGeminiAccount } from './agent/gemini-account.js';
import { prepareInstant, runChatViaInstant } from './agent/instant.js';
import { routeIntent, toRouteView } from './intent/service.js';
import { loadConfig } from './config.js';
import {
  computeCost,
  type AssistantBuffer,
  type RunChatFinishInfo,
  type RunChatStreamEvent,
  type ToolCallPersist,
  type UsageCost,
} from './agent/shared.js';

export type { AssistantBuffer, RunChatFinishInfo, RunChatStreamEvent, ToolCallPersist, UsageCost };
export { computeCost };

export interface RunChatOptions {
  prompt: string;
  history: ModelMessage[];
  provider: ProviderAdapter;
  authMethod?: AuthMethod;
  apiKey?: string;
  modelId: string;
  chatId?: string;
  cliPath?: string;
  abortSignal: AbortSignal;
  onAssistantBuffer?: (buf: AssistantBuffer) => void;
  onFinish?: (info: RunChatFinishInfo) => void;
}

export const PHOTOSHOP_SYSTEM_PROMPT = `
You are an assistant that controls Adobe Photoshop on the user's machine through
the photoshop-mcp server. Use photoshop_* tools and photoshop_recipe_* recipes
to fulfill requests: open documents, manage layers, place images, apply filters,
write text, save files, and run multi-step workflows.

${buildPhotoshopInstructions()}

Additional UI constraints:
- After meaningful state changes, briefly describe in plain language what you did.
- If a tool call fails, surface the error envelope to the user and follow
  suggested_next_tool when present before asking the user to retry.
- Only Photoshop MCP tools are available. Do not attempt shell, filesystem,
  web, or general coding operations; respond in natural language instead.
`.trim();

export const ACTION_PLAN_SYSTEM_PROMPT = `
${PHOTOSHOP_SYSTEM_PROMPT}

You are operating in Action Plan mode. Analyze the full user request and produce a
single ordered plan that COMPLETES the entire outcome. The executor runs your plan
literally with no further LLM turns between steps — anything you omit will not happen.

Planning rules:
- Include every tool call required to deliver the requested end state, not a partial subset.
- After meaningful visual edits, include photoshop_get_preview when the user expects to see the result.
- Prefer photoshop_recipe_* tools over long atomic chains when the request matches a recipe purpose.
- A recipe that already performs a sub-task replaces its atomic equivalent — do not duplicate work.
- Use "$steps.<stepId>.<dot.path>" placeholders for values produced by earlier steps.
`.trim();

const CLARIFY_HINT = `
The request looks ambiguous. Before calling any Photoshop tool, ask the user exactly one short clarifying question, then stop.
`.trim();

export async function* runChat(opts: RunChatOptions): AsyncGenerator<RunChatStreamEvent> {
  const authMethod = opts.authMethod ?? 'api_key';
  let actionPlanBeta = loadConfig().actionPlanBeta;
  let agentSystemPrompt = PHOTOSHOP_SYSTEM_PROMPT;

  // Optional Jev routing (TYPESAFE_API_KEY). Any failure falls back to today's behaviour.
  const routed = await routeIntent(opts.prompt, opts.abortSignal).catch(() => null);
  if (routed) {
    const { decision } = routed;
    yield { type: 'route', payload: toRouteView(decision) };
    if (decision.route === 'instant' && decision.call) {
      const prepared = await prepareInstant(decision.call, opts.chatId);
      if (prepared) {
        yield* runChatViaInstant({
          prepared,
          chatId: opts.chatId,
          abortSignal: opts.abortSignal,
          onAssistantBuffer: opts.onAssistantBuffer,
          onFinish: opts.onFinish,
        });
        return;
      }
    }
    actionPlanBeta = decision.route === 'plan' || decision.route === 'instant';
    if (decision.route === 'clarify') agentSystemPrompt = `${PHOTOSHOP_SYSTEM_PROMPT}\n\n${CLARIFY_HINT}`;
  }

  if (actionPlanBeta) {
    yield* runChatViaActionPlan({
      prompt: opts.prompt,
      history: opts.history,
      provider: opts.provider,
      apiKey: opts.apiKey,
      modelId: opts.modelId,
      chatId: opts.chatId,
      cliPath: opts.cliPath,
      authMethod,
      systemPrompt: ACTION_PLAN_SYSTEM_PROMPT,
      abortSignal: opts.abortSignal,
      onAssistantBuffer: opts.onAssistantBuffer,
      onFinish: opts.onFinish,
    });
    return;
  }

  if (authMethod === 'cli_account') {
    if (opts.provider.id === 'anthropic') {
      yield* runChatViaClaudeAccount({
        prompt: opts.prompt,
        history: opts.history,
        provider: opts.provider,
        modelId: opts.modelId,
        chatId: opts.chatId,
        systemPrompt: agentSystemPrompt,
        abortSignal: opts.abortSignal,
        onAssistantBuffer: opts.onAssistantBuffer,
        onFinish: opts.onFinish,
      });
      return;
    }
    if (opts.provider.id === 'google') {
      yield* runChatViaGeminiAccount({
        prompt: opts.prompt,
        history: opts.history,
        modelId: opts.modelId,
        chatId: opts.chatId,
        cliPath: opts.cliPath,
        systemPrompt: agentSystemPrompt,
        abortSignal: opts.abortSignal,
        onAssistantBuffer: opts.onAssistantBuffer,
        onFinish: opts.onFinish,
      });
      return;
    }
    throw new Error('cli_account is not supported for this provider');
  }

  if (!opts.apiKey) {
    yield { type: 'error', payload: { message: 'API key is required for api_key auth mode' } };
    return;
  }

  yield* runChatViaApiKey({
    prompt: opts.prompt,
    history: opts.history,
    provider: opts.provider,
    apiKey: opts.apiKey,
    modelId: opts.modelId,
    chatId: opts.chatId,
    authMethod,
    systemPrompt: agentSystemPrompt,
    abortSignal: opts.abortSignal,
    onAssistantBuffer: opts.onAssistantBuffer,
    onFinish: opts.onFinish,
  });
}

export function buildHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: { text: string } }>
): ModelMessage[] {
  const history: ModelMessage[] = [];
  for (const m of messages) {
    const text = m.content.text?.trim();
    if (!text) continue;
    history.push({ role: m.role, content: text });
  }
  return history;
}

export type { LanguageModelUsage };
