import { hasAnalyticsKey, isAnalyticsDisabledByEnv } from './config.js';
import { isAnalyticsOptedOut } from './identity.js';
import { NoopAnalyticsProvider } from './noop.js';
import { RybbitNodeProvider } from './rybbit-node.js';
import type { AnalyticsProvider } from './types.js';

let provider: AnalyticsProvider | null = null;

function createProvider(): AnalyticsProvider {
  if (isAnalyticsDisabledByEnv() || isAnalyticsOptedOut() || !hasAnalyticsKey()) {
    return new NoopAnalyticsProvider();
  }
  return new RybbitNodeProvider();
}

export function getAnalytics(): AnalyticsProvider {
  if (!provider) {
    provider = createProvider();
  }
  return provider;
}

export function resetAnalyticsProvider(): void {
  provider = null;
}

export async function flushAnalyticsClient(): Promise<void> {
  if (!provider) return;
  await provider.flush();
}

export async function shutdownAnalyticsClient(): Promise<void> {
  if (!provider) return;
  await provider.shutdown();
  provider = null;
}
