import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import type { LanguageModelUsage } from 'ai';
import { randomUUID } from 'node:crypto';
import type { InstantCall } from '../intent/router.js';
import { buildSpawnArgs, buildUiMcpChildEnv } from './mcp-transport.js';
import {
  finishToolCall,
  toolFailureMessage,
  type AssistantBuffer,
  type RunChatFinishInfo,
  type RunChatStreamEvent,
} from './shared.js';

/**
 * The "instant" route: Jev already picked the tool and its arguments, so run it
 * directly and show a preview. No language model is involved, so there is no
 * token usage or cost for the turn.
 */

type ExecutableTool = {
  execute?: (
    input: unknown,
    options: { toolCallId: string; messages: []; abortSignal?: AbortSignal }
  ) => PromiseLike<unknown>;
};

export interface PreparedInstant {
  mcp: MCPClient;
  tools: Record<string, ExecutableTool>;
  call: InstantCall;
}

const ZERO_COST = { totalUsd: 0, inputUsd: 0, outputUsd: 0, cachedReadUsd: 0, cachedWriteUsd: 0 };

const ZERO_USAGE: LanguageModelUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
};

/**
 * Start the MCP child and check the tool exists. Returns null (caller falls back
 * to the normal LLM route) instead of failing the turn.
 */
export async function prepareInstant(call: InstantCall, chatId?: string): Promise<PreparedInstant | null> {
  let mcp: MCPClient | undefined;
  try {
    mcp = await createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: process.execPath,
        args: buildSpawnArgs(),
        env: buildUiMcpChildEnv(chatId),
      }),
    });
    const tools = (await mcp.tools()) as unknown as Record<string, ExecutableTool>;
    if (typeof tools[call.tool]?.execute !== 'function') {
      await mcp.close();
      return null;
    }
    return { mcp, tools, call };
  } catch {
    await mcp?.close().catch(() => undefined);
    return null;
  }
}

export async function* runChatViaInstant(opts: {
  prepared: PreparedInstant;
  chatId?: string;
  abortSignal: AbortSignal;
  onAssistantBuffer?: (buf: AssistantBuffer) => void;
  onFinish?: (info: RunChatFinishInfo) => void;
}): AsyncGenerator<RunChatStreamEvent> {
  const { mcp, tools, call } = opts.prepared;
  const buffer: AssistantBuffer = { text: '', toolCalls: [] };

  const runTool = async function* (
    name: string,
    args: Record<string, unknown>
  ): AsyncGenerator<RunChatStreamEvent, { ok: boolean; message: string }> {
    const id = randomUUID();
    buffer.toolCalls.push({ id, name, input: args, status: 'pending', startedAt: Date.now() });
    yield { type: 'tool-call', payload: { id, name, input: args } };
    yield { type: 'activity', payload: { phase: 'tool-running', detail: name } };
    opts.onAssistantBuffer?.(buffer);
    try {
      const output = await tools[name]!.execute!(args, { toolCallId: id, messages: [], abortSignal: opts.abortSignal });
      const payload = finishToolCall(buffer, id, { output, chatId: opts.chatId });
      yield { type: 'tool-result', payload };
      opts.onAssistantBuffer?.(buffer);
      return { ok: payload.ok, message: payload.ok ? '' : toolFailureMessage(output, payload.content) };
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      yield { type: 'tool-result', payload: finishToolCall(buffer, id, { error: message }) };
      opts.onAssistantBuffer?.(buffer);
      return { ok: false, message };
    }
  };

  try {
    const main = yield* runTool(call.tool, call.args);
    if (main.ok && call.preview && !opts.abortSignal.aborted && tools.photoshop_get_preview?.execute) {
      yield* runTool('photoshop_get_preview', { max_dimension_px: 1024 });
    }
    buffer.text = main.ok ? `Done: ${call.label}.` : `${call.label} did not work: ${main.message}`;
    yield { type: 'text-delta', payload: { text: buffer.text } };
    opts.onAssistantBuffer?.(buffer);

    opts.onFinish?.({ usage: ZERO_USAGE, cost: ZERO_COST });
    yield { type: 'finish', payload: { finishReason: 'stop', usage: ZERO_USAGE, cost: ZERO_COST } };
  } finally {
    await mcp.close().catch(() => undefined);
  }
}
