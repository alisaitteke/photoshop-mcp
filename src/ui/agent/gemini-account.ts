import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { ModelMessage } from 'ai';
import { resolveCliBinary } from '../providers/cli-utils.js';
import { buildMcpServerConfig } from './mcp-transport.js';
import {
  buildPromptWithHistory,
  finishToolCall,
  isToolOutputOk,
  type AssistantBuffer,
  type RunChatFinishInfo,
  type RunChatStreamEvent,
} from './shared.js';

export interface RunChatViaGeminiAccountOptions {
  prompt: string;
  history: ModelMessage[];
  modelId: string;
  chatId?: string;
  cliPath?: string;
  systemPrompt: string;
  abortSignal: AbortSignal;
  onAssistantBuffer?: (buf: AssistantBuffer) => void;
  onFinish?: (info: RunChatFinishInfo) => void;
}

interface GeminiStreamEvent {
  type?: string;
  role?: string;
  content?: string;
  delta?: string;
  name?: string;
  id?: string;
  input?: unknown;
  output?: unknown;
  ok?: boolean;
  error?: string | { message?: string };
  stats?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export async function* runChatViaGeminiAccount(
  opts: RunChatViaGeminiAccountOptions
): AsyncGenerator<RunChatStreamEvent> {
  const geminiPath = await resolveCliBinary('gemini', opts.cliPath);
  if (!geminiPath) {
    yield {
      type: 'error',
      payload: {
        message: 'Gemini CLI not found. Install with `npm install -g @google/gemini-cli`.',
      },
    };
    return;
  }

  const buffer: AssistantBuffer = { text: '', toolCalls: [] };
  const workspaceDir = await createGeminiWorkspace(opts.chatId);
  const fullPrompt = `${opts.systemPrompt}\n\n${buildPromptWithHistory(opts.history, opts.prompt)}`;

  const args = [
    '-p',
    fullPrompt,
    '-m',
    opts.modelId,
    '--output-format',
    'stream-json',
    '--approval-mode',
    'yolo',
    '--skip-trust',
  ];

  const child = spawn(geminiPath, args, {
    cwd: workspaceDir,
    env: {
      ...process.env,
      GEMINI_CLI_TRUST_WORKSPACE: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const onAbort = () => child.kill('SIGTERM');
  opts.abortSignal.addEventListener('abort', onAbort);

  try {
    const geminiState = { sawMessage: false, chatId: opts.chatId };
    const events = readJsonLines(child.stdout!);
    for await (const raw of events) {
      if (opts.abortSignal.aborted) break;
      const event = raw as GeminiStreamEvent;
      const mapped = mapGeminiEvent(event, buffer, geminiState);
      for (const ev of mapped.events) {
        yield ev;
      }
      if (mapped.finish) {
        opts.onFinish?.(mapped.finish);
      }
    }

    const exitCode = await waitForChild(child);
    if (exitCode === 41) {
      yield {
        type: 'error',
        payload: {
          message: 'Gemini account authentication failed. Run `gemini auth login` and try again.',
        },
      };
    } else if (exitCode !== 0 && !opts.abortSignal.aborted) {
      yield {
        type: 'error',
        payload: { message: `Gemini CLI exited with code ${exitCode}` },
      };
    }
  } finally {
    opts.abortSignal.removeEventListener('abort', onAbort);
    if (!child.killed) child.kill('SIGTERM');
    opts.onAssistantBuffer?.(buffer);
  }
}

async function createGeminiWorkspace(chatId?: string): Promise<string> {
  const root = join(tmpdir(), `photoshop-mcp-gemini-${randomUUID()}`);
  const geminiDir = join(root, '.gemini');
  await mkdir(geminiDir, { recursive: true });
  const mcp = buildMcpServerConfig(chatId);
  const settings = {
    mcpServers: {
      photoshop: {
        command: mcp.command,
        args: mcp.args,
        env: mcp.env,
        trust: true,
        timeout: 120_000,
      },
    },
  };
  await writeFile(join(geminiDir, 'settings.json'), JSON.stringify(settings, null, 2));
  return root;
}

function mapGeminiEvent(
  event: GeminiStreamEvent,
  buffer: AssistantBuffer,
  state: { sawMessage: boolean; chatId?: string }
): { events: RunChatStreamEvent[]; finish?: RunChatFinishInfo } {
  const events: RunChatStreamEvent[] = [];
  let finish: RunChatFinishInfo | undefined;

  switch (event.type) {
    case 'message': {
      if (!state.sawMessage && event.role !== 'user') {
        state.sawMessage = true;
        events.push({ type: 'activity', payload: { phase: 'thinking' } });
      }
      const text = event.delta ?? event.content ?? '';
      if (text && event.role !== 'user') {
        buffer.text += text;
        events.push({ type: 'text-delta', payload: { text } });
      }
      break;
    }
    case 'tool_use': {
      const id = event.id ?? randomUUID();
      const tc = {
        id,
        name: event.name ?? 'tool',
        input: event.input,
        status: 'pending' as const,
        startedAt: Date.now(),
      };
      buffer.toolCalls.push(tc);
      events.push({
        type: 'tool-call',
        payload: { id: tc.id, name: tc.name, input: tc.input },
      });
      events.push({
        type: 'activity',
        payload: { phase: 'tool-running', detail: tc.name },
      });
      break;
    }
    case 'tool_result': {
      const id = event.id ?? '';
      const content =
        typeof event.output === 'string'
          ? event.output
          : JSON.stringify(event.output ?? '');
      const ok = isToolOutputOk(event.output) && event.ok !== false;
      events.push({
        type: 'tool-result',
        payload: finishToolCall(buffer, id, { output: event.output, content, ok, chatId: state.chatId }),
      });
      events.push({ type: 'activity', payload: { phase: 'thinking' } });
      break;
    }
    case 'error': {
      const message =
        typeof event.error === 'string'
          ? event.error
          : event.error?.message ?? 'Gemini CLI error';
      events.push({ type: 'error', payload: { message } });
      break;
    }
    case 'result': {
      const stats = event.stats;
      const inputTokens = stats?.inputTokens ?? 0;
      const outputTokens = stats?.outputTokens ?? 0;
      const usage = {
        inputTokens,
        outputTokens,
        totalTokens: stats?.totalTokens ?? inputTokens + outputTokens,
        inputTokenDetails: {
          noCacheTokens: inputTokens,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        outputTokenDetails: {
          textTokens: outputTokens,
          reasoningTokens: 0,
        },
      };
      finish = { usage };
      events.push({
        type: 'finish',
        payload: { finishReason: 'stop', usage, subscription: true },
      });
      break;
    }
    default:
      break;
  }

  return { events, finish };
}

async function* readJsonLines(
  stream: NodeJS.ReadableStream
): AsyncGenerator<unknown, void, void> {
  let pending = '';
  for await (const chunk of stream) {
    pending += chunk.toString();
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        yield JSON.parse(trimmed);
      } catch {
        // Ignore malformed lines from CLI stderr noise.
      }
    }
  }
  const tail = pending.trim();
  if (tail) {
    try {
      yield JSON.parse(tail);
    } catch {
      // ignore
    }
  }
}

function waitForChild(child: ReturnType<typeof spawn>): Promise<number> {
  return new Promise((resolve) => {
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}
