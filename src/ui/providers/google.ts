import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { resolveCliBinary, runCommand } from './cli-utils.js';
import type { ProviderAdapter, ProviderModel } from './types.js';

// Curated to Gemini models that support tool calling on the Google AI Studio
// (Generative Language) API. Prices in USD per 1M tokens; Pro tiers reflect
// the lower context bracket (<=200K for 2.5 Pro). Gemini 3.8 Flash rates are
// Google's 2026 price; they double on 2027-01-01.
const MODELS: ProviderModel[] = [
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    pricing: { inputUsdPerMTok: 0.75, outputUsdPerMTok: 3.75, cachedInputUsdPerMTok: 0.075 },
  },
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
];

export const googleAdapter: ProviderAdapter = {
  id: 'google',
  label: 'Google AI Studio',
  apiKeyHint: 'AIza...',
  apiKeyHelpUrl: 'https://aistudio.google.com/apikey',
  supportedAuthMethods: ['api_key', 'cli_account'],
  cliBinaryName: 'gemini',
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
  async validateCliAccount({ cliPath } = {}) {
    const binary = await resolveCliBinary('gemini', cliPath);
    if (!binary) {
      return { ok: false, error: 'cli_not_found' };
    }
    const result = await runCommand(
      binary,
      ['-p', 'ping', '--output-format', 'json', '--approval-mode', 'yolo'],
      { timeoutMs: 60_000, env: { GEMINI_CLI_TRUST_WORKSPACE: 'true' } }
    );
    if (result.exitCode === 41) {
      return { ok: false, error: 'not_authenticated' };
    }
    if (result.exitCode !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim();
      return { ok: false, error: detail || 'cli_probe_failed' };
    }
    return { ok: true };
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
