import { createOpenAI } from '@ai-sdk/openai';
import type { ProviderAdapter, ProviderModel } from './types.js';

// Curated to models known to support tool calling. Prices in USD per 1M tokens.
const MODELS: ProviderModel[] = [
  {
    id: 'gpt-6-astra',
    label: 'GPT-6 Astra',
    pricing: { inputUsdPerMTok: 10, outputUsdPerMTok: 50, cachedInputUsdPerMTok: 1 },
  },
  {
    id: 'gpt-6.1-sol',
    label: 'GPT-6.1 Sol',
    pricing: { inputUsdPerMTok: 2, outputUsdPerMTok: 10, cachedInputUsdPerMTok: 0.1 },
  },
  {
    id: 'gpt-6-luna',
    label: 'GPT-6 Luna',
    pricing: { inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.5, cachedInputUsdPerMTok: 0.01 },
  },
];

export const openaiAdapter: ProviderAdapter = {
  id: 'openai',
  label: 'OpenAI',
  apiKeyHint: 'sk-...',
  apiKeyHelpUrl: 'https://platform.openai.com/api-keys',
  supportedAuthMethods: ['api_key'],
  validateApiKeyFormat(key) {
    return key.startsWith('sk-') && key.length > 20;
  },
  async validateApiKey(key) {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
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
  listModels() {
    return MODELS.map((m) => ({ ...m }));
  },
  defaultModel() {
    return 'gpt-6-luna';
  },
  getLanguageModel({ apiKey, modelId }) {
    return createOpenAI({ apiKey })(modelId);
  },
  getModelPricing(modelId) {
    return MODELS.find((m) => m.id === modelId)?.pricing;
  },
};
