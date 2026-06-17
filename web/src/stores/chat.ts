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
  type PlanView,
  type ProviderId,
  type UsageCost,
  type UsageDetails,
} from '@/lib/api';

export interface ToolCall extends PersistedToolCall {}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolCalls: ToolCall[];
  plan?: PlanView;
  usage?: UsageDetails;
  cost?: UsageCost;
  provider?: ProviderId;
  model?: string;
  createdAt: number;
}

export interface ChatStreamEventPayload {
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  ok?: boolean;
  content?: string;
  finishReason?: string;
  usage?: UsageDetails;
  cost?: UsageCost;
  message?: string;
  // Action Plan (beta) events
  summary?: string;
  steps?: PlanView['steps'];
  status?: PlanStepStatus;
  stepId?: string;
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
        toolCalls: m.content.toolCalls ?? [],
        plan: m.content.plan,
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

  async function rename(id: string, title: string): Promise<void> {
    await apiRenameChat(id, title);
    const idx = chats.value.findIndex((c) => c.id === id);
    if (idx !== -1) chats.value[idx] = { ...chats.value[idx], title };
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
      provider: activeChat?.provider,
      model: activeChat?.model,
      createdAt: Date.now(),
    };
    messages.push(created);
    return created;
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
      m.text += data.text;
    } else if (event === 'tool-call' && data.id && data.name) {
      const m = ensureAssistantMessage();
      m.toolCalls.push({
        id: data.id,
        name: data.name,
        input: data.input,
        status: 'pending',
      });
    } else if (event === 'tool-result' && data.id) {
      const tc = findToolCall(data.id);
      if (tc) {
        tc.result = { ok: Boolean(data.ok), content: data.content ?? '' };
        tc.status = data.ok ? 'success' : 'error';
      }
    } else if (event === 'plan') {
      const m = ensureAssistantMessage();
      m.plan = { summary: data.summary ?? '', steps: data.steps ?? [] };
    } else if (event === 'plan-step' && data.id && data.status) {
      const m = ensureAssistantMessage();
      const step = m.plan?.steps.find((s) => s.id === data.id);
      if (step) step.status = data.status;
    } else if (event === 'plan-repair') {
      // Re-plan announced; the subsequent 'plan' event replaces the step list.
      // No dedicated state needed beyond the refreshed plan that follows.
    } else if (event === 'finish') {
      const m = ensureAssistantMessage();
      if (data.usage) m.usage = data.usage;
      if (data.cost) m.cost = data.cost;
    } else if (event === 'error') {
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
    rename,
    send,
    abort,
  };
}
