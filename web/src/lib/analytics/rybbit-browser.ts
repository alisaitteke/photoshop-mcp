import { buildBrowserLocaleProperties } from './locale';

export interface BrowserAnalyticsConfig {
  enabled: boolean;
  provider: 'rybbit';
  siteId: string;
  analyticsHost: string;
  distinctId: string;
}

const OPT_OUT_KEY = 'disable-rybbit';

let initialized = false;
let registeredContext: Record<string, string | number | boolean> = {};
let installTraits: Record<string, string | number | boolean> = {};
let distinctId = '';
let scriptEl: HTMLScriptElement | null = null;
const pending: Array<(rybbit: NonNullable<Window['rybbit']>) => void> = [];

export function initRybbitBrowser(config: BrowserAnalyticsConfig): void {
  if (initialized || !config.enabled || !config.siteId || !config.analyticsHost) return;
  if (isOptedOut()) return;

  distinctId = config.distinctId;
  const localeProps = buildBrowserLocaleProperties();
  installTraits = {
    ...localeProps,
    first_install_at: new Date().toISOString(),
    first_usage_surface: 'web',
  };
  registeredContext = { ...localeProps };

  injectScript(config);
  initialized = true;
}

export function registerBrowserAnalyticsContext(
  properties: Record<string, string | number | boolean>
): void {
  registeredContext = { ...registeredContext, ...properties };
}

export function captureBrowserEvent(
  name: string,
  properties?: Record<string, string | number | boolean>
): void {
  if (!initialized || isOptedOut()) return;
  const payload = {
    ...registeredContext,
    ...properties,
    event_source: 'ui',
  };
  withRybbit((rybbit) => rybbit.event(name, payload));
}

export function optOutBrowserCapturing(): void {
  try {
    localStorage.setItem(OPT_OUT_KEY, 'true');
  } catch {
    // ignore
  }
  window.__RYBBIT_OPTOUT__ = true;
  window.rybbit?.clearUserId?.();
  scriptEl?.remove();
  scriptEl = null;
  pending.length = 0;
  initialized = false;
}

export function optInBrowserCapturing(): void {
  try {
    localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // ignore
  }
  window.__RYBBIT_OPTOUT__ = false;
}

export function isBrowserAnalyticsInitialized(): boolean {
  return initialized;
}

function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === 'true';
  } catch {
    return Boolean(window.__RYBBIT_OPTOUT__);
  }
}

function injectScript(config: BrowserAnalyticsConfig): void {
  if (scriptEl) return;
  const script = document.createElement('script');
  script.src = `${config.analyticsHost.replace(/\/$/, '')}/script.js`;
  script.dataset.siteId = config.siteId;
  script.defer = true;
  script.addEventListener('load', flushPending);
  document.head.appendChild(script);
  scriptEl = script;
}

function flushPending(): void {
  const run = (rybbit: NonNullable<Window['rybbit']>) => {
    if (distinctId) {
      rybbit.identify(distinctId, installTraits);
    }
    const queued = pending.splice(0, pending.length);
    for (const fn of queued) fn(rybbit);
  };

  const rybbit = window.rybbit;
  if (rybbit?.onReady) {
    rybbit.onReady(run);
    return;
  }
  if (rybbit?.event) run(rybbit);
}

function withRybbit(fn: (rybbit: NonNullable<Window['rybbit']>) => void): void {
  const rybbit = window.rybbit;
  if (rybbit?.event) {
    fn(rybbit);
    return;
  }
  pending.push(fn);
}
