import { getProvider } from './providers/registry.js';
import { kvGet, kvSet } from './store/kv.js';

export type ProviderId = 'anthropic' | 'openai' | 'openrouter' | 'google';
export type AuthMethod = 'api_key' | 'cli_account';

export interface ProviderConfig {
  authMethod?: AuthMethod;
  apiKey?: string;
  defaultModel?: string;
  cliPath?: string;
  cliAccountLabel?: string;
}

export interface UIConfig {
  providers: Partial<Record<ProviderId, ProviderConfig>>;
  activeProvider: ProviderId;
  activeModel: string;
  /**
   * Beta: when enabled (and the active provider uses api_key auth), a single
   * planning LLM call produces an ordered tool plan that is executed directly,
   * instead of the per-step ReAct loop. Defaults to off (backward compatible).
   */
  actionPlanBeta?: boolean;
}

const KV_KEY = 'config';

const DEFAULT_CONFIG: UIConfig = {
  providers: {},
  activeProvider: 'anthropic',
  activeModel: 'claude-sonnet-4-5',
  actionPlanBeta: false,
};

export function loadConfig(): UIConfig {
  const stored = kvGet<UIConfig>(KV_KEY);
  if (!stored) return { ...DEFAULT_CONFIG, providers: {} };
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    providers: { ...stored.providers },
  };
}

export function saveConfig(patch: Partial<UIConfig>): UIConfig {
  const current = loadConfig();
  const next: UIConfig = {
    ...current,
    ...patch,
    providers: { ...current.providers, ...(patch.providers ?? {}) },
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

export function getAuthMethod(id: ProviderId): AuthMethod {
  return getProviderConfig(id)?.authMethod ?? 'api_key';
}

export function isProviderConfigAuthenticated(id: ProviderId): boolean {
  const cfg = getProviderConfig(id);
  const authMethod = cfg?.authMethod ?? 'api_key';
  if (authMethod === 'api_key') return Boolean(cfg?.apiKey);
  return Boolean(cfg?.cliAccountLabel);
}

export async function probeProviderAuthentication(id: ProviderId): Promise<boolean> {
  const cfg = getProviderConfig(id);
  const authMethod = cfg?.authMethod ?? 'api_key';
  if (authMethod === 'api_key') return Boolean(cfg?.apiKey);
  const provider = getProvider(id);
  if (!provider?.validateCliAccount) return false;
  const check = await provider.validateCliAccount({ cliPath: cfg?.cliPath });
  return check.ok;
}

export function maskApiKey(apiKey?: string): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 12) return '***';
  return `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`;
}
