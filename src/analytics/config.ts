const DEFAULT_RYBBIT_HOST = 'https://hey.sideguard.io';
const DEFAULT_RYBBIT_SITE_ID = '5e488c650441';

function envTruthy(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

/** Legacy alias for ANALYTICS_DISABLED. */
export function isPostHogDisabledByEnv(): boolean {
  return envTruthy('POSTHOG_DISABLED');
}

export function isAnalyticsDisabledByEnv(): boolean {
  return envTruthy('ANALYTICS_DISABLED') || isPostHogDisabledByEnv();
}

export function resolveRybbitHost(): string {
  return (process.env.RYBBIT_HOST?.trim() || DEFAULT_RYBBIT_HOST).replace(/\/$/, '');
}

export function resolveRybbitAnalyticsHost(): string {
  return `${resolveRybbitHost()}/api`;
}

export function resolveRybbitSiteId(): string {
  return process.env.RYBBIT_SITE_ID?.trim() || DEFAULT_RYBBIT_SITE_ID;
}

export function resolveRybbitApiKey(): string | undefined {
  const key = process.env.RYBBIT_API_KEY?.trim();
  return key || undefined;
}

export function hasAnalyticsKey(): boolean {
  return resolveRybbitSiteId().length > 0;
}
