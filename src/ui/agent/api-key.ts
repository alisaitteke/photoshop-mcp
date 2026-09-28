import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { stepCountIs, streamText } from 'ai';
import type { ProviderAdapter } from '../providers/registry.js';
import type { AuthMethod } from '../providers/types.js';
import type { ModelMessage } from 'ai';
import { buildSpawnArgs, buildUiMcpChildEnv } from './mcp-transport.js';
import {
  computeCost,
  finishToolCall,
  type AssistantBuffer,
  type RunChatFinishInfo,
  type RunChatStreamEvent,
  type StreamActivityPayload,
} from './shared.js';

export interface RunChatViaApiKeyOptions {
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

export async function* runChatViaApiKey(
  opts: RunChatViaApiKeyOptions
): AsyncGenerator<RunChatStreamEvent> {
  let mcp: MCPClient | undefined;
  const buffer: AssistantBuffer = { text: '', toolCalls: [] };

  try {
    mcp = await createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: process.execPath,
        args: buildSpawnArgs(),
        env: buildUiMcpChildEnv(opts.chatId),
      }),
    });

    const tools = await mcp.tools();

    const result = streamText({
      model: opts.provider.getLanguageModel({
        apiKey: opts.apiKey,
        modelId: opts.modelId,
      }),
      tools,
      system: opts.systemPrompt,
      messages: [...opts.history, { role: 'user', content: opts.prompt }],
      stopWhen: stepCountIs(20),
      abortSignal: opts.abortSignal,
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta': {
          buffer.text += part.text;
          yield { type: 'text-delta', payload: { text: part.text } };
          opts.onAssistantBuffer?.(buffer);
          break;
        }
        case 'reasoning-delta': {
          buffer.reasoning = (buffer.reasoning ?? '') + part.text;
          yield { type: 'reasoning-delta', payload: { text: part.text } };
          opts.onAssistantBuffer?.(buffer);
          break;
        }
        case 'start-step': {
          const activity: StreamActivityPayload = { phase: 'thinking' };
          yield { type: 'activity', payload: activity };
          break;
        }
        case 'tool-call': {
          const tc = {
            id: part.toolCallId,
            name: part.toolName,
            input: part.input,
            status: 'pending' as const,
            startedAt: Date.now(),
          };
          buffer.toolCalls.push(tc);
          yield {
            type: 'tool-call',
            payload: { id: tc.id, name: tc.name, input: tc.input },
          };
          yield {
            type: 'activity',
            payload: { phase: 'tool-running', detail: part.toolName },
          };
          opts.onAssistantBuffer?.(buffer);
          break;
        }
        case 'tool-result': {
          yield {
            type: 'tool-result',
            payload: finishToolCall(buffer, part.toolCallId, {
              output: part.output,
              chatId: opts.chatId,
            }),
          };
          yield { type: 'activity', payload: { phase: 'thinking' } };
          opts.onAssistantBuffer?.(buffer);
          break;
        }
        case 'tool-error': {
          const text = (part.error as Error)?.message ?? String(part.error);
          yield {
            type: 'tool-result',
            payload: finishToolCall(buffer, part.toolCallId, { error: text }),
          };
          yield { type: 'activity', payload: { phase: 'thinking' } };
          opts.onAssistantBuffer?.(buffer);
          break;
        }
        case 'finish': {
          const usage = part.totalUsage;
          const pricing = opts.provider.getModelPricing(opts.modelId);
          const cost = pricing ? computeCost(usage, pricing) : undefined;
          opts.onFinish?.({ usage, cost });
          yield {
            type: 'finish',
            payload: { finishReason: part.finishReason, usage, cost },
          };
          break;
        }
        case 'error': {
          yield {
            type: 'error',
            payload: { message: (part.error as Error)?.message ?? String(part.error) },
          };
          break;
        }
        default:
          break;
      }
    }
  } finally {
    if (mcp) await mcp.close().catch(() => undefined);
  }
}
