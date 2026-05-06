import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ProviderAdapter, ProviderModel } from './types.js';

// Curated to Gemini models that support tool calling on the Google AI Studio
// (Generative Language) API. Prices in USD per 1M tokens; Pro tiers reflect
// the lower context bracket (<=200K for 2.5 Pro, <=128K for 1.5 Pro).
const MODELS: ProviderModel[] = [
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    pricing: { inputUsdPerMTok: 1.25, outputUsdPerMTok: 10, cachedInputUsdPerMTok: 0.31 },
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    pricing: { inputUsdPerMTok: 0.3, outputUsdPerMTok: 2.5, cachedInputUsdPerMTok: 0.075 },
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite',
    pricing: { inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.4, cachedInputUsdPerMTok: 0.025 },
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    pricing: { inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.4 },
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    pricing: { inputUsdPerMTok: 1.25, outputUsdPerMTok: 5 },
  },
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    pricing: { inputUsdPerMTok: 0.075, outputUsdPerMTok: 0.3 },
  },
];

export const googleAdapter: ProviderAdapter = {
  id: 'google',
  label: 'Google AI Studio',
  apiKeyHint: 'AIza...',
  apiKeyHelpUrl: 'https://aistudio.google.com/apikey',
  validateApiKeyFormat(key) {
    return key.startsWith('AIza') && key.length >= 35;
  },
  async validateApiKey(key) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`
      );
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
    return 'gemini-2.5-flash';
  },
  getLanguageModel({ apiKey, modelId }) {
    return createGoogleGenerativeAI({ apiKey })(modelId);
  },
  getModelPricing(modelId) {
    return MODELS.find((m) => m.id === modelId)?.pricing;
  },
};
