import type { LanguageModel } from 'ai';

export type ProviderId = 'anthropic' | 'openai' | 'openrouter' | 'google' | 'custom';

export type AuthMethod = 'api_key' | 'cli_account';

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

export interface CliAccountValidation {
  ok: boolean;
  error?: string;
  detail?: string;
  accountLabel?: string;
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
  supportedAuthMethods: AuthMethod[];
  cliBinaryName?: string;
  validateApiKeyFormat(key: string): boolean;
  validateApiKey(key: string): Promise<ApiKeyValidation>;
  validateCliAccount?(opts: { cliPath?: string }): Promise<CliAccountValidation>;
  listModels(): ProviderModel[];
  defaultModel(): string;
  getLanguageModel(opts: { apiKey: string; modelId: string }): LanguageModel;
  getModelPricing(modelId: string): ModelPricing | undefined;
}
