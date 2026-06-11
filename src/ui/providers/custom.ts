import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { getCustomProvider } from '../config.js';
import type { ProviderAdapter, ProviderModel } from './types.js';

export const customAdapter: ProviderAdapter = {
  id: 'custom',
  get label() {
    return getCustomProvider()?.name || 'Custom';
  },
  get apiKeyHint() {
    return 'Enter your API key';
  },
  get apiKeyHelpUrl() {
    return getCustomProvider()?.websiteUrl || '';
  },
  validateApiKeyFormat(_key: string) {
    return true;
  },
  async validateApiKey(key: string) {
    const cfg = getCustomProvider();
    if (!cfg) return { ok: false, error: 'Custom provider not configured' };
    try {
      const url =
        cfg.apiFormat === 'anthropic'
          ? `${cfg.baseUrl.replace(/\/+$/, '')}/v1/models?limit=1`
          : `${cfg.baseUrl.replace(/\/+$/, '')}/models`;
      const headers: Record<string, string> =
        cfg.apiFormat === 'anthropic'
          ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
          : { Authorization: `Bearer ${key}` };
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        return { ok: false, error: text };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
  listModels(): ProviderModel[] {
    const cfg = getCustomProvider();
    if (!cfg) return [];
    return cfg.models.map((m) => ({ id: m.id, label: m.label }));
  },
  defaultModel() {
    return getCustomProvider()?.defaultModel || '';
  },
  getLanguageModel({ apiKey, modelId }) {
    const cfg = getCustomProvider();
    if (cfg?.apiFormat === 'anthropic') {
      return createAnthropic({ apiKey, baseURL: cfg.baseUrl })(modelId);
    }
    const baseUrl = cfg?.baseUrl;
    return createOpenAI({ apiKey, ...(baseUrl ? { baseURL: baseUrl } : {}) }).chat(modelId);
  },
  getModelPricing(_modelId: string) {
    return undefined;
  },
};
