import { createAnthropic } from '@ai-sdk/anthropic';
import { resolveCliBinary, runCommand } from './cli-utils.js';
import type { ProviderAdapter, ProviderModel } from './types.js';

function sanitizeCliDetail(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 200);
}

// Public list pricing (USD per 1M tokens). Cache-write reflects the 5-minute
// tier; we don't currently differentiate the 1-hour tier.
const MODELS: ProviderModel[] = [
  {
    id: 'claude-opus-4-5',
    label: 'Claude Opus 4.5',
    pricing: {
      inputUsdPerMTok: 5,
      outputUsdPerMTok: 25,
      cachedInputUsdPerMTok: 0.5,
      cachedWriteUsdPerMTok: 6.25,
    },
  },
  {
    id: 'claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5',
    pricing: {
      inputUsdPerMTok: 3,
      outputUsdPerMTok: 15,
      cachedInputUsdPerMTok: 0.3,
      cachedWriteUsdPerMTok: 3.75,
    },
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    pricing: {
      inputUsdPerMTok: 1,
      outputUsdPerMTok: 5,
      cachedInputUsdPerMTok: 0.1,
      cachedWriteUsdPerMTok: 1.25,
    },
  },
];

export const anthropicAdapter: ProviderAdapter = {
  id: 'anthropic',
  label: 'Anthropic',
  apiKeyHint: 'sk-ant-...',
  apiKeyHelpUrl: 'https://console.anthropic.com/settings/keys',
  supportedAuthMethods: ['api_key', 'cli_account'],
  cliBinaryName: 'claude',
  validateApiKeyFormat(key) {
    return key.startsWith('sk-ant-');
  },
  async validateApiKey(key) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/models?limit=1', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return { ok: false, error: text };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
  async validateCliAccount({ cliPath } = {}) {
    const binary = await resolveCliBinary('claude', cliPath);
    if (!binary) {
      return {
        ok: false,
        error: 'cli_not_found',
      };
    }
    const result = await runCommand(binary, ['auth', 'status'], { timeoutMs: 15_000 });
    if (result.exitCode !== 0) {
      const detail = sanitizeCliDetail(result.stderr.trim() || result.stdout.trim());
      return {
        ok: false,
        error: 'not_authenticated',
        detail: detail
          ? `exit ${result.exitCode}: ${detail}`
          : `exit ${result.exitCode}`,
      };
    }
    try {
      const parsed = JSON.parse(result.stdout) as {
        email?: string;
        account?: { email?: string };
      };
      const accountLabel = parsed.email ?? parsed.account?.email;
      return accountLabel ? { ok: true, accountLabel } : { ok: true };
    } catch {
      return { ok: true };
    }
  },
  listModels() {
    return MODELS.map((m) => ({ ...m }));
  },
  defaultModel() {
    return 'claude-sonnet-4-5';
  },
  getLanguageModel({ apiKey, modelId }) {
    return createAnthropic({ apiKey })(modelId);
  },
  getModelPricing(modelId) {
    return MODELS.find((m) => m.id === modelId)?.pricing;
  },
};
