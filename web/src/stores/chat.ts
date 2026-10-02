import { computed, reactive, ref } from 'vue';
import {
  abortChat,
  apiCreateChat,
  apiDeleteChat,
  apiGetChat,
  apiListChats,
  apiRenameChat,
  streamChat,
  type ChatSummary,
  type PersistedToolCall,
  type PlanStepStatus,
  type ToolImageRef,
  type PlanView,
  type ProviderId,
  type RouteView,
  type UsageCost,
  type UsageDetails,
} from '@/lib/api';

export interface ToolCall extends PersistedToolCall {}

export type StreamActivityPhase = 'planning' | 'thinking' | 'tool-running';

export interface StreamActivity {
  phase: StreamActivityPhase;
  detail?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  reasoning?: string;
  toolCalls: ToolCall[];
  plan?: PlanView;
  planPartial?: boolean;
  route?: RouteView;
  activity?: StreamActivity;
  isStreaming?: boolean;
  usage?: UsageDetails;
  cost?: UsageCost;
  provider?: ProviderId;
  model?: string;
  createdAt: number;
}

export interface ChatStreamEventPayload {
  text?: string;
  phase?: StreamActivityPhase;
  detail?: string;
  id?: string;
  name?: string;
  input?: unknown;
  ok?: boolean;
  content?: string;
  images?: ToolImageRef[];
  durationMs?: number;
  finishReason?: string;
  usage?: UsageDetails;
  cost?: UsageCost;
  message?: string;
  summary?: string;
  steps?: PlanView['steps'];
  status?: PlanStepStatus;
  stepId?: string;
  attempt?: number;
  reason?: string;
}

export interface ChatTotals {
  totalUsd: number;
  inputUsd: number;
  outputUsd: number;
  cachedReadUsd: number;
  cachedWriteUsd: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedReadTokens: number;
  cachedWriteTokens: number;
  reasoningTokens: number;
  assistantTurns: number;
  pricedTurns: number;
}

const EMPTY_TOTALS: ChatTotals = {
  totalUsd: 0,
  inputUsd: 0,
  outputUsd: 0,
  cachedReadUsd: 0,
  cachedWriteUsd: 0,
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedReadTokens: 0,
  cachedWriteTokens: 0,
  reasoningTokens: 0,
  assistantTurns: 0,
  pricedTurns: 0,
};

export function useChatStore() {
  const chats = ref<ChatSummary[]>([]);
  const activeChatId = ref<string | null>(null);
  const messages = reactive<ChatMessage[]>([]);
  const sending = ref(false);
  const error = ref<string | null>(null);
  let activeRequestId: string | null = null;
  let abortController: AbortController | null = null;

  const chatTotals = computed<ChatTotals>(() => {
    const totals: ChatTotals = { ...EMPTY_TOTALS };
    for (const m of messages) {
      if (m.role !== 'assistant') continue;
      if (!m.usage && !m.cost) continue;
      totals.assistantTurns += 1;
      if (m.cost) {
        totals.pricedTurns += 1;
        totals.totalUsd += m.cost.totalUsd;
        totals.inputUsd += m.cost.inputUsd;
        totals.outputUsd += m.cost.outputUsd;
        totals.cachedReadUsd += m.cost.cachedReadUsd;
        totals.cachedWriteUsd += m.cost.cachedWriteUsd;
      }
      if (m.usage) {
        totals.totalTokens += m.usage.totalTokens ?? 0;
        totals.inputTokens += m.usage.inputTokens ?? 0;
        totals.outputTokens += m.usage.outputTokens ?? 0;
        totals.cachedReadTokens += m.usage.inputTokenDetails?.cacheReadTokens ?? 0;
        totals.cachedWriteTokens += m.usage.inputTokenDetails?.cacheWriteTokens ?? 0;
        totals.reasoningTokens += m.usage.outputTokenDetails?.reasoningTokens ?? 0;
      }
    }
    return totals;
  });

  async function loadChats(): Promise<void> {
    chats.value = await apiListChats();
  }

  async function selectChat(id: string): Promise<void> {
    activeChatId.value = id;
    messages.splice(0, messages.length);
    error.value = null;
    const detail = await apiGetChat(id);
    for (const m of detail.messages) {
      messages.push({
        id: m.id,
        role: m.role,
        text: m.content.text,
        reasoning: m.content.reasoning,
        toolCalls: m.content.toolCalls ?? [],
        plan: m.content.plan,
        route: m.content.route,
        usage: m.content.usage,
        cost: m.content.cost,
        provider: m.content.provider,
        model: m.content.model,
        createdAt: m.createdAt,
      });
    }
  }

  async function newChat(opts: { provider?: ProviderId; model?: string }): Promise<ChatSummary> {
    const created = await apiCreateChat(opts);
    chats.value = [created, ...chats.value];
    activeChatId.value = created.id;
    messages.splice(0, messages.length);
    error.value = null;
    return created;
  }

  async function removeChat(id: string): Promise<void> {
    await apiDeleteChat(id);
    chats.value = chats.value.filter((c) => c.id !== id);
    if (activeChatId.value === id) {
      activeChatId.value = null;
      messages.splice(0, messages.length);
    }
  }

  async function clearAllChats(): Promise<void> {
    const ids = chats.value.map((c) => c.id);
    if (ids.length === 0) return;
    await Promise.all(ids.map(apiDeleteChat));
    chats.value = [];
    activeChatId.value = null;
    messages.splice(0, messages.length);
    error.value = null;
  }

  async function rename(id: string, title: string): Promise<void> {
    await apiRenameChat(id, title);
    const idx = chats.value.findIndex((c) => c.id === id);
    if (idx !== -1) chats.value[idx] = { ...chats.value[idx], title };
  }

  function pruneSupersededToolCalls(m: ChatMessage): void {
    const live = new Map(
      (m.plan?.steps ?? []).filter((step) => step.id && step.tool).map((step) => [step.id, step.tool])
    );
    if (live.size === 0 || !m.toolCalls.some((tc) => tc.stepId)) return;
    const lastIndex = new Map<string, number>();
    m.toolCalls.forEach((tc, index) => {
      if (!tc.stepId || live.get(tc.stepId) !== tc.name) return;
      lastIndex.set(tc.stepId, index);
    });
    const next = m.toolCalls.filter((tc, index) => {
      if (!tc.stepId) return true;
      return lastIndex.get(tc.stepId) === index;
    });
    if (next.length !== m.toolCalls.length) m.toolCalls.splice(0, m.toolCalls.length, ...next);
  }

  function ensureAssistantMessage(): ChatMessage {
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant') return last;
    const activeChat = chats.value.find((c) => c.id === activeChatId.value);
    const created: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: '',
      toolCalls: [],
      isStreaming: true,
      provider: activeChat?.provider,
      model: activeChat?.model,
      createdAt: Date.now(),
    };
    messages.push(created);
    return created;
  }

  let streamingMessage: ChatMessage | null = null;
  let pendingTextDelta = '';
  let pendingReasoningDelta = '';
  let rafScheduled = false;

  function flushDeltaBatch(): void {
    rafScheduled = false;
    if (!streamingMessage) return;
    if (pendingTextDelta) {
      streamingMessage.text += pendingTextDelta;
      pendingTextDelta = '';
    }
    if (pendingReasoningDelta) {
      streamingMessage.reasoning = (streamingMessage.reasoning ?? '') + pendingReasoningDelta;
      pendingReasoningDelta = '';
    }
  }

  function scheduleDeltaFlush(): void {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(flushDeltaBatch);
  }

  function queueTextDelta(text: string): void {
    pendingTextDelta += text;
    scheduleDeltaFlush();
  }

  function queueReasoningDelta(text: string): void {
    pendingReasoningDelta += text;
    scheduleDeltaFlush();
  }

  function finalizeStreamingMessage(): void {
    flushDeltaBatch();
    if (streamingMessage) {
      streamingMessage.isStreaming = false;
      streamingMessage.activity = undefined;
      streamingMessage.planPartial = false;
    }
    streamingMessage = null;
    pendingTextDelta = '';
    pendingReasoningDelta = '';
  }

  function findToolCall(id: string): ToolCall | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
      const tc = messages[i].toolCalls.find((c) => c.id === id);
      if (tc) return tc;
    }
    return undefined;
  }

  function handleStreamEvent(event: string, data: ChatStreamEventPayload): void {
    if (event === 'text-delta' && data.text) {
      const m = ensureAssistantMessage();
      streamingMessage = m;
      queueTextDelta(data.text);
    } else if (event === 'reasoning-delta' && data.text) {
      const m = ensureAssistantMessage();
      streamingMessage = m;
      queueReasoningDelta(data.text);
    } else if (event === 'activity' && data.phase) {
      const m = ensureAssistantMessage();
      streamingMessage = m;
      m.activity = { phase: data.phase, detail: data.detail };
    } else if (event === 'tool-call' && data.id && data.name) {
      flushDeltaBatch();
      const m = ensureAssistantMessage();
      streamingMessage = m;
      m.toolCalls.push({
        id: data.id,
        name: data.name,
        input: data.input,
        ...(data.stepId ? { stepId: data.stepId } : {}),
        status: 'pending',
        startedAt: Date.now(),
      });
    } else if (event === 'tool-result' && data.id) {
      flushDeltaBatch();
      const tc = findToolCall(data.id);
      if (tc) {
        tc.result = {
          ok: Boolean(data.ok),
          content: data.content ?? '',
          ...(data.images?.length ? { images: data.images } : {}),
        };
        tc.status = data.ok ? 'success' : 'error';
        tc.durationMs =
          data.durationMs ?? (tc.startedAt ? Math.max(0, Date.now() - tc.startedAt) : undefined);
      }
    } else if (event === 'route') {
      const m = ensureAssistantMessage();
      streamingMessage = m;
      m.route = data as unknown as RouteView;
    } else if (event === 'plan-partial') {
      const m = ensureAssistantMessage();
      streamingMessage = m;
      m.plan = { summary: data.summary ?? '', steps: data.steps ?? [] };
      m.planPartial = true;
      pruneSupersededToolCalls(m);
    } else if (event === 'plan') {
      flushDeltaBatch();
      const m = ensureAssistantMessage();
      streamingMessage = m;
      m.plan = { summary: data.summary ?? '', steps: data.steps ?? [] };
      m.planPartial = false;
      pruneSupersededToolCalls(m);
    } else if (event === 'plan-step' && data.id && data.status) {
      flushDeltaBatch();
      const m = ensureAssistantMessage();
      const step = m.plan?.steps.find((s) => s.id === data.id);
      if (step) step.status = data.status;
    } else if (event === 'plan-repair') {
      // Re-plan announced; the subsequent 'plan' event replaces the step list.
    } else if (event === 'finish') {
      flushDeltaBatch();
      const m = ensureAssistantMessage();
      if (data.usage) m.usage = data.usage;
      if (data.cost) m.cost = data.cost;
    } else if (event === 'error') {
      finalizeStreamingMessage();
      error.value = data.message ?? 'Unknown error';
    }
  }

  async function send(prompt: string): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed || !activeChatId.value) return;

    sending.value = true;
    error.value = null;

    messages.push({
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      toolCalls: [],
      createdAt: Date.now(),
    });

    ensureAssistantMessage();

    const requestId = crypto.randomUUID();
    activeRequestId = requestId;
    abortController = new AbortController();

    try {
      for await (const ev of streamChat(
        { chatId: activeChatId.value, prompt: trimmed, requestId },
        abortController.signal
      )) {
        if (ev.event === 'done') break;
        handleStreamEvent(ev.event, ev.data as ChatStreamEventPayload);
      }
      // Refresh sidebar (title may have been auto-generated, updatedAt changed).
      void loadChats();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        error.value = (err as Error).message;
      }
    } finally {
      finalizeStreamingMessage();
      sending.value = false;
      activeRequestId = null;
      abortController = null;
    }
  }

  async function abort(): Promise<void> {
    if (!activeRequestId) return;
    try {
      await abortChat(activeRequestId);
    } catch {
      // ignore
    }
    abortController?.abort();
  }

  return {
    chats,
    activeChatId,
    messages,
    sending,
    error,
    chatTotals,
    loadChats,
    selectChat,
    newChat,
    removeChat,
    clearAllChats,
    rename,
    send,
    abort,
  };
}
