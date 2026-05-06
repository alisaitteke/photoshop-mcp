import { anthropicAdapter } from './anthropic.js';
import { googleAdapter } from './google.js';
import { openaiAdapter } from './openai.js';
import { openrouterAdapter } from './openrouter.js';
import type { ProviderAdapter, ProviderId } from './types.js';

export const providers: Record<ProviderId, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
  openrouter: openrouterAdapter,
  google: googleAdapter,
};

export function getProvider(id: string): ProviderAdapter | undefined {
  return providers[id as ProviderId];
}

export function listProviders(): ProviderAdapter[] {
  return Object.values(providers);
}

export type { ModelPricing, ProviderAdapter, ProviderId, UsageCost } from './types.js';
