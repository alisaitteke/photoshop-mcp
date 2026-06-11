import type { LanguageModel } from 'ai';

export type ProviderId = 'anthropic' | 'openai' | 'openrouter' | 'google' | 'custom';

export interface ModelPricing {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  cachedInputUsdPerMTok?: number;
  cachedWriteUsdPerMTok?: number;
}

export interface ProviderModel {
  id: string;
  label: string;
  pricing?: ModelPricing;
}

export interface UsageCost {
  totalUsd: number;
  inputUsd: number;
  outputUsd: number;
  cachedReadUsd: number;
  cachedWriteUsd: number;
}

export interface ApiKeyValidation {
  ok: boolean;
  error?: string;
}

export interface CustomModelEntry {
  id: string;
  label: string;
}

export interface CustomProviderConfig {
  name: string;
  websiteUrl: string;
  apiKey: string;
  baseUrl: string;
  apiFormat: 'openai' | 'anthropic';
  models: CustomModelEntry[];
  defaultModel: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  apiKeyHint: string;
  apiKeyHelpUrl: string;
  validateApiKeyFormat(key: string): boolean;
  validateApiKey(key: string): Promise<ApiKeyValidation>;
  listModels(): ProviderModel[];
  defaultModel(): string;
  getLanguageModel(opts: { apiKey: string; modelId: string }): LanguageModel;
  getModelPricing(modelId: string): ModelPricing | undefined;
}
