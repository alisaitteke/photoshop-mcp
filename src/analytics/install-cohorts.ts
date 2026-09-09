import { hasAnalyticsKey } from './config.js';
import { isAnalyticsEnabled } from './identity.js';
import { getAnalytics } from './provider.js';

export type InstallUsageSurface = 'mcp' | 'server' | 'web';

/** Maps internal usage_surface values to install-cohort person properties. */
export function normalizeInstallUsageSurface(surface: string): InstallUsageSurface {
  if (surface === 'ui' || surface === 'web') return 'web';
  if (surface === 'mcp' || surface === 'server') return surface;
  return 'server';
}

/**
 * Install-cohort fields — safe to call repeatedly.
 * See docs/anonymous-usage-analytics.md (person profile cohorts).
 */
export function applyInstallCohortPersonOnce(params: {
  usageSurface?: string;
  mcpClientName?: string;
}): void {
  if (!isAnalyticsEnabled() || !hasAnalyticsKey()) return;

  const once: Record<string, string> = {
    first_install_at: new Date().toISOString(),
  };

  if (params.usageSurface) {
    once.first_usage_surface = normalizeInstallUsageSurface(params.usageSurface);
  }
  if (params.mcpClientName?.trim()) {
    once.first_mcp_client_name = params.mcpClientName.trim();
  }

  getAnalytics().setPersonOnce(once);
}
