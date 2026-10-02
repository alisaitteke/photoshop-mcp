import { createOpenAI } from '@ai-sdk/openai';
import type { ProviderAdapter, ProviderModel } from './types.js';

const REQUESTY_BASE_URL = 'https://router.requesty.ai/v1';

// Curated from Requesty managed models (GET /v1/models/managed), all with tool
// calling. Any id from GET /v1/models (e.g. `openai/gpt-4o-mini`) also works.
// Prices in USD per 1M tokens, as listed by Requesty.
const MODELS: ProviderModel[] = [
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
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    pricing: {
      inputUsdPerMTok: 1,
      outputUsdPerMTok: 5,
      cachedInputUsdPerMTok: 0.1,
      cachedWriteUsdPerMTok: 1.25,
    },
  },
  {
    id: 'gpt-5.4',
    label: 'GPT-5.4',
    pricing: { inputUsdPerMTok: 2.75, outputUsdPerMTok: 16.5, cachedInputUsdPerMTok: 0.275 },
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    pricing: { inputUsdPerMTok: 1.5, outputUsdPerMTok: 9, cachedInputUsdPerMTok: 0.15 },
  },
  {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    pricing: { inputUsdPerMTok: 0.28, outputUsdPerMTok: 0.56, cachedInputUsdPerMTok: 0.07 },
  },
];

export const requestyAdapter: ProviderAdapter = {
  id: 'requesty',
  label: 'Requesty',
  apiKeyHint: 'rqsty-...',
  apiKeyHelpUrl: 'https://app.requesty.ai/api-keys',
  supportedAuthMethods: ['api_key'],
  validateApiKeyFormat(key) {
    return key.trim().length > 0;
  },
  async validateApiKey(key) {
    try {
      const res = await fetch(`${REQUESTY_BASE_URL}/models`, {
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
    return 'claude-sonnet-4-5';
  },
  getLanguageModel({ apiKey, modelId }) {
    return createOpenAI({ apiKey, baseURL: REQUESTY_BASE_URL }).chat(modelId);
  },
  getModelPricing(modelId) {
    return MODELS.find((m) => m.id === modelId)?.pricing;
  },
};
