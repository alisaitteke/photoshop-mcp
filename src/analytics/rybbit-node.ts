import { Logger } from '../utils/logger.js';
import { getAppVersion } from './app-version.js';
import { resolveRybbitAnalyticsHost, resolveRybbitApiKey, resolveRybbitSiteId } from './config.js';
import { buildPersonIdentifyProperties, sanitizePersonOnceProperties } from './events.js';
import { getOrCreateDistinctId } from './identity.js';
import type { AnalyticsEvent, AnalyticsProvider, AnalyticsPropertyValue } from './types.js';

const PROPERTIES_MAX_CHARS = 2048;
const TRAITS_MAX_CHARS = 2048;
const HOSTNAME = 'photoshop-mcp.com';
const FLUSH_AT = 10;
const FLUSH_INTERVAL_MS = 5000;

const DROP_WHEN_OVER_BUDGET = [
  'os_release',
  'system_timezone',
  'system_locale',
  'system_locale_language',
  'system_locale_region',
  'node_major',
  'is_electron',
  'photoshop_path_configured',
  'custom_data_dir_configured',
  'cpu_count',
  'arch',
  'os_type',
];

type TrackKind = 'pageview' | 'custom_event';

interface QueuedRequest {
  url: string;
  body: Record<string, unknown>;
}

export class RybbitNodeProvider implements AnalyticsProvider {
  private logger = new Logger('Analytics');
  private distinctId: string;
  private analyticsHost: string;
  private siteId: string;
  private apiKey: string | undefined;
  private queue: QueuedRequest[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private identified = false;
  private draining = false;

  constructor() {
    this.analyticsHost = resolveRybbitAnalyticsHost();
    this.siteId = resolveRybbitSiteId();
    this.apiKey = resolveRybbitApiKey();
    this.distinctId = getOrCreateDistinctId();
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
    this.flushTimer.unref?.();
    this.identify({ event_source: 'server' });
    this.setPersonOnce({ first_install_at: new Date().toISOString() });
  }

  identify(properties?: Record<string, unknown>): void {
    const traits = compactTraits(buildPersonIdentifyProperties(properties));
    const isNew = !this.identified;
    this.identified = true;
    this.enqueue({
      url: `${this.analyticsHost}/identify`,
      body: {
        site_id: this.siteId,
        user_id: this.distinctId,
        traits,
        is_new_identify: isNew,
      },
    });
  }

  setPersonOnce(properties: Record<string, unknown>): void {
    const props = sanitizePersonOnceProperties(properties);
    if (Object.keys(props).length === 0) return;
    const isNew = !this.identified;
    this.identified = true;
    this.enqueue({
      url: `${this.analyticsHost}/identify`,
      body: {
        site_id: this.siteId,
        user_id: this.distinctId,
        traits: compactTraits(props),
        is_new_identify: isNew,
      },
    });
  }

  capture(event: AnalyticsEvent): void {
    const props = { ...(event.properties ?? {}) };
    const pathname = resolvePathname(props);
    const type: TrackKind = event.name === '$pageview' ? 'pageview' : 'custom_event';
    const eventName = type === 'pageview' ? undefined : mapEventName(event.name);

    const body: Record<string, unknown> = {
      site_id: this.siteId,
      type,
      hostname: HOSTNAME,
      pathname,
      user_id: this.distinctId,
    };
    if (eventName) body.event_name = eventName;
    const encoded = encodeProperties(props);
    if (encoded) body.properties = encoded;

    this.enqueue({
      url: `${this.analyticsHost}/track`,
      body,
    });
  }

  async flush(): Promise<void> {
    if (this.draining || this.queue.length === 0) return;
    this.draining = true;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      await Promise.all(batch.map((item) => this.send(item)));
    } finally {
      this.draining = false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  private enqueue(request: QueuedRequest): void {
    this.queue.push(request);
    if (this.queue.length >= FLUSH_AT) {
      void this.flush();
    }
  }

  private async send(request: QueuedRequest): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'user-agent': `photoshop-mcp/${getAppVersion()}`,
      };
      if (this.apiKey) {
        headers.authorization = `Bearer ${this.apiKey}`;
      }
      await fetch(request.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request.body),
      });
    } catch (err) {
      this.logger.debug('Failed to send analytics request', err);
    }
  }
}

function mapEventName(name: string): string {
  if (name === '$pageleave') return 'pageleave';
  return name;
}

function resolvePathname(properties: Record<string, AnalyticsPropertyValue>): string {
  const explicit = properties.$pathname;
  if (typeof explicit === 'string' && explicit.startsWith('/')) return explicit;
  const source = properties.event_source;
  const surface = properties.usage_surface;
  if (source === 'mcp' || surface === 'mcp') return '/mcp';
  if (source === 'ui' || surface === 'ui' || surface === 'web') return '/ui';
  return '/ui-server';
}

function encodeProperties(properties: Record<string, AnalyticsPropertyValue>): string | undefined {
  const compact = compactRecord(stripPayloadFields(properties));
  if (Object.keys(compact).length === 0) return undefined;
  return JSON.stringify(compact);
}

function stripPayloadFields(
  properties: Record<string, AnalyticsPropertyValue>
): Record<string, string | number | boolean | string[]> {
  const out: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (key.startsWith('$')) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      out[key] = value;
    }
  }
  return out;
}

function compactRecord(
  properties: Record<string, string | number | boolean | string[]>
): Record<string, string | number | boolean | string[]> {
  const next = { ...properties };
  let encoded = JSON.stringify(next);
  if (encoded.length <= PROPERTIES_MAX_CHARS) return next;

  for (const key of DROP_WHEN_OVER_BUDGET) {
    if (!(key in next)) continue;
    delete next[key];
    encoded = JSON.stringify(next);
    if (encoded.length <= PROPERTIES_MAX_CHARS) return next;
  }

  for (const [key, value] of Object.entries(next)) {
    if (typeof value !== 'string' || value.length < 40) continue;
    next[key] = `${value.slice(0, 80)}…`;
    encoded = JSON.stringify(next);
    if (encoded.length <= PROPERTIES_MAX_CHARS) return next;
  }

  while (encoded.length > PROPERTIES_MAX_CHARS && Object.keys(next).length > 1) {
    const keys = Object.keys(next);
    delete next[keys[keys.length - 1]!];
    encoded = JSON.stringify(next);
  }
  return next;
}

function compactTraits(
  properties: Record<string, unknown>
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (key.startsWith('$')) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  let encoded = JSON.stringify(out);
  if (encoded.length <= TRAITS_MAX_CHARS) return out;

  for (const key of DROP_WHEN_OVER_BUDGET) {
    if (!(key in out)) continue;
    delete out[key];
    encoded = JSON.stringify(out);
    if (encoded.length <= TRAITS_MAX_CHARS) return out;
  }
  return out;
}
