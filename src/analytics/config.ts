// Agency fork: no default telemetry tokens. Analytics only runs when the
// operator explicitly opts in via ANALYTICS_ENABLED and supplies their own keys.
const DEFAULT_POSTHOG_KEY = '';
const DEFAULT_API_HOST = 'https://eu.posthog.com';
const DEFAULT_UI_HOST = 'https://eu.posthog.com';

const DEFAULT_MIXPANEL_TOKEN = '';
const DEFAULT_MIXPANEL_API_HOST = 'https://api-eu.mixpanel.com';
const DEFAULT_MIXPANEL_NODE_HOST = 'api-eu.mixpanel.com';

export type AnalyticsProviderName = 'mixpanel' | 'posthog';

function envTruthy(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function isPostHogDisabledByEnv(): boolean {
  return envTruthy('POSTHOG_DISABLED');
}

export function isAnalyticsDisabledByEnv(): boolean {
  // Opt-in model: disabled unless ANALYTICS_ENABLED is set, and the legacy
  // disable flags always win even when it is.
  if (envTruthy('ANALYTICS_DISABLED') || isPostHogDisabledByEnv()) return true;
  return !envTruthy('ANALYTICS_ENABLED');
}

export function resolveAnalyticsProvider(): AnalyticsProviderName {
  const value = process.env.ANALYTICS_PROVIDER?.trim().toLowerCase();
  if (value === 'posthog') return 'posthog';
  return 'mixpanel';
}

export function resolveMixpanelToken(): string {
  return process.env.MIXPANEL_TOKEN?.trim() || DEFAULT_MIXPANEL_TOKEN;
}

export function resolveMixpanelApiHost(): string {
  return process.env.MIXPANEL_API_HOST?.trim() || DEFAULT_MIXPANEL_API_HOST;
}

export function resolveMixpanelNodeHost(): string {
  return process.env.MIXPANEL_NODE_HOST?.trim() || DEFAULT_MIXPANEL_NODE_HOST;
}

export function resolvePostHogKey(): string {
  return process.env.POSTHOG_KEY?.trim() || DEFAULT_POSTHOG_KEY;
}

export function resolvePostHogApiHost(): string {
  return process.env.POSTHOG_API_HOST?.trim() || DEFAULT_API_HOST;
}

export function resolvePostHogUiHost(): string {
  return process.env.POSTHOG_UI_HOST?.trim() || DEFAULT_UI_HOST;
}

export function hasPostHogKey(): boolean {
  return resolvePostHogKey().length > 0;
}

export function hasAnalyticsKey(): boolean {
  if (resolveAnalyticsProvider() === 'posthog') {
    return hasPostHogKey();
  }
  return resolveMixpanelToken().length > 0;
}
