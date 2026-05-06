export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data as { error?: string }).error ?? res.statusText, data);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type ProviderId = 'anthropic' | 'openai' | 'openrouter' | 'google';

export interface Status {
  activeProvider: ProviderId;
  activeModel: string;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
}

export interface ProviderModel {
  id: string;
  label: string;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  apiKeyHint: string;
  apiKeyHelpUrl: string;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  models: ProviderModel[];
  defaultModel: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  provider: ProviderId;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface PersistedToolCall {
  id: string;
  name: string;
  input: unknown;
  result?: { ok: boolean; content: string };
  status: 'pending' | 'success' | 'error';
}

export interface UsageDetails {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputTokenDetails?: {
    noCacheTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  outputTokenDetails?: {
    textTokens?: number;
    reasoningTokens?: number;
  };
}

export interface UsageCost {
  totalUsd: number;
  inputUsd: number;
  outputUsd: number;
  cachedReadUsd: number;
  cachedWriteUsd: number;
}

export interface PersistedMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: {
    text: string;
    toolCalls: PersistedToolCall[];
    usage?: UsageDetails;
    cost?: UsageCost;
  };
  createdAt: number;
}

export interface ChatDetail {
  chat: ChatSummary;
  messages: PersistedMessage[];
}

// ---- Status -----------------------------------------------------------

export const apiStatus = () => api<Status>('/api/status');

export const apiSetActive = (body: Partial<{ activeProvider: ProviderId; activeModel: string }>) =>
  api<{ activeProvider: ProviderId; activeModel: string }>('/api/active', {
    method: 'POST',
    body: JSON.stringify(body),
  });

// ---- Providers --------------------------------------------------------

export const apiListProviders = () => api<ProviderInfo[]>('/api/providers');

export const apiValidateKey = (id: ProviderId, apiKey: string) =>
  api<{ ok: boolean; error?: string }>(`/api/providers/${id}/validate-key`, {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });

export const apiSaveKey = (id: ProviderId, apiKey: string) =>
  api<{ ok: true; apiKeyMasked: string | null }>(`/api/providers/${id}/key`, {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });

export const apiDeleteKey = (id: ProviderId) =>
  api<{ ok: true }>(`/api/providers/${id}/key`, { method: 'DELETE' });

// ---- Chats ------------------------------------------------------------

export const apiListChats = () => api<ChatSummary[]>('/api/chats');

export const apiCreateChat = (body: { provider?: ProviderId; model?: string; title?: string }) =>
  api<ChatSummary>('/api/chats', { method: 'POST', body: JSON.stringify(body) });

export const apiGetChat = (id: string) => api<ChatDetail>(`/api/chats/${id}`);

export const apiRenameChat = (id: string, title: string) =>
  api<{ ok: true }>(`/api/chats/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });

export const apiUpdateChatModel = (
  id: string,
  body: Partial<{ provider: ProviderId; model: string }>
) =>
  api<{ ok: true }>(`/api/chats/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const apiDeleteChat = (id: string) =>
  api<{ ok: true }>(`/api/chats/${id}`, { method: 'DELETE' });

// ---- Chat streaming ---------------------------------------------------

export interface ChatRequest {
  chatId: string;
  prompt: string;
  requestId: string;
}

export async function* streamChat(
  req: ChatRequest,
  signal: AbortSignal
): AsyncGenerator<{ event: string; data: unknown }, void, void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || res.statusText);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() ?? '';
    for (const block of events) {
      const ev = parseSSE(block);
      if (ev) yield ev;
    }
  }
}

export const abortChat = (id: string) =>
  api<{ ok: boolean }>(`/api/abort/${encodeURIComponent(id)}`, { method: 'POST' });

function parseSSE(block: string): { event: string; data: unknown } | null {
  const lines = block.split(/\n/);
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length) return null;
  const raw = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}
