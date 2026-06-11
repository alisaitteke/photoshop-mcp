import { kvGet, kvSet } from './store/kv.js';

export type ProviderId = 'anthropic' | 'openai' | 'openrouter' | 'google' | 'custom';

export interface ProviderConfig {
  apiKey?: string;
  defaultModel?: string;
}

export interface CustomProviderConfig {
  name: string;
  websiteUrl: string;
  apiKey: string;
  baseUrl: string;
  apiFormat: 'openai' | 'anthropic';
  models: { id: string; label: string }[];
  defaultModel: string;
}

export interface UIConfig {
  providers: Partial<Record<ProviderId, ProviderConfig>>;
  activeProvider: ProviderId;
  activeModel: string;
  customProvider: CustomProviderConfig | null;
}

const KV_KEY = 'config';

const DEFAULT_CONFIG: UIConfig = {
  providers: {},
  activeProvider: 'anthropic',
  activeModel: 'claude-sonnet-4-5',
  customProvider: null,
};

export function loadConfig(): UIConfig {
  const stored = kvGet<UIConfig>(KV_KEY);
  if (!stored) return { ...DEFAULT_CONFIG, providers: {} };
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    providers: { ...stored.providers },
    customProvider: stored.customProvider ?? null,
  };
}

export function saveConfig(patch: Partial<UIConfig>): UIConfig {
  const current = loadConfig();
  const next: UIConfig = {
    ...current,
    ...patch,
    providers: { ...current.providers, ...(patch.providers ?? {}) },
    customProvider: patch.customProvider !== undefined ? patch.customProvider : current.customProvider,
  };
  kvSet(KV_KEY, next);
  return next;
}

export function setProviderConfig(id: ProviderId, patch: ProviderConfig): UIConfig {
  const current = loadConfig();
  const merged: ProviderConfig = { ...current.providers[id], ...patch };
  return saveConfig({
    providers: { ...current.providers, [id]: merged },
  });
}

export function getProviderConfig(id: ProviderId): ProviderConfig | undefined {
  return loadConfig().providers[id];
}

export function maskApiKey(apiKey?: string): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 12) return '***';
  return `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`;
}

export function saveCustomProvider(config: CustomProviderConfig): UIConfig {
  return saveConfig({ customProvider: config });
}

export function getCustomProvider(): CustomProviderConfig | null {
  return loadConfig().customProvider;
}

export function deleteCustomProvider(): UIConfig {
  return saveConfig({ customProvider: null });
}
