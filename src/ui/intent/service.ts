import { getIntentRouterConfig, maskApiKey, type IntentRouterConfig } from '../config.js';
import { classifyIntent, type IntentDecision, type IntentRoute, type SystemOneClient } from './router.js';

/**
 * Jev routing is opt-in. The key is set in Settings → Routing (stored with the
 * other provider keys in ~/.photoshop-mcp/data.db); TYPESAFE_API_KEY is only a
 * fallback for headless setups. With no key, the UI behaves exactly as before.
 * When routing is on, prompts are also sent to api.typesafe.ai.
 */

const REQUEST_TIMEOUT_MS = 2500;
const VALIDATE_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 100;

const cache = new Map<string, { at: number; decision: IntentDecision }>();
let client: { key: string; promise: Promise<SystemOneClient> } | null = null;

type Env = Record<string, string | undefined>;

export type KeySource = 'settings' | 'env' | null;

export interface IntentRouterStatus {
  /** Routing will run for the next message. */
  active: boolean;
  enabled: boolean;
  instant: boolean;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  source: KeySource;
  /** PSMCP_INTENT_ROUTER=off forces routing off regardless of settings. */
  disabledByEnv: boolean;
}

export function resolveApiKey(cfg: IntentRouterConfig, env: Env): { key?: string; source: KeySource } {
  const fromSettings = cfg.apiKey?.trim();
  if (fromSettings) return { key: fromSettings, source: 'settings' };
  const fromEnv = env.TYPESAFE_API_KEY?.trim();
  if (fromEnv) return { key: fromEnv, source: 'env' };
  return { source: null };
}

export function computeStatus(cfg: IntentRouterConfig, env: Env): IntentRouterStatus {
  const { key, source } = resolveApiKey(cfg, env);
  const flag = env.PSMCP_INTENT_ROUTER?.trim().toLowerCase();
  const disabledByEnv = flag === 'off' || flag === '0' || flag === 'false';
  const enabled = cfg.enabled !== false;
  return {
    active: Boolean(key) && enabled && !disabledByEnv,
    enabled,
    instant: cfg.instant !== false,
    hasApiKey: Boolean(key),
    apiKeyMasked: maskApiKey(key),
    source,
    disabledByEnv,
  };
}

export function getIntentRouterStatus(): IntentRouterStatus {
  return computeStatus(getIntentRouterConfig(), process.env);
}

export function isIntentRouterEnabled(): boolean {
  return getIntentRouterStatus().active;
}

/** With instant commands switched off, a would-be instant route goes through a plan. */
export function applyInstantSetting(decision: IntentDecision, instantAllowed: boolean): IntentDecision {
  if (instantAllowed || decision.route !== 'instant') return decision;
  const rest: IntentDecision = { ...decision };
  delete rest.call;
  return {
    ...rest,
    route: 'plan',
    label: 'Plan',
    reason: 'Instant commands are off in Settings, so the model plans it.',
  };
}

async function createClient(apiKey: string, timeout: number, maxRetries: number): Promise<SystemOneClient> {
  const { TypeSafeClient } = await import('@typesafe-ai/sdk');
  return new TypeSafeClient({ apiKey, timeout, retry: { maxRetries }, logLevel: 'off' }) as unknown as SystemOneClient;
}

function getClient(apiKey: string): Promise<SystemOneClient> {
  if (!client || client.key !== apiKey) {
    const promise = createClient(apiKey, REQUEST_TIMEOUT_MS, 1);
    promise.catch(() => {
      if (client?.promise === promise) client = null;
    });
    client = { key: apiKey, promise };
  }
  return client.promise;
}

/** Drop the cached client and decisions, e.g. after the key or settings change. */
export function resetIntentRouter(): void {
  client = null;
  cache.clear();
}

function cacheKey(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Classify a prompt. Results are cached briefly so the decision shown while
 * typing is reused when the message is sent. Returns null when routing is off.
 */
export async function routeIntent(
  prompt: string,
  signal?: AbortSignal
): Promise<{ decision: IntentDecision; cached: boolean } | null> {
  const cfg = getIntentRouterConfig();
  const status = computeStatus(cfg, process.env);
  if (!status.active) return null;
  const { key } = resolveApiKey(cfg, process.env);
  const normalized = cacheKey(prompt);
  if (!key || !normalized) return null;

  const hit = cache.get(normalized);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { decision: applyInstantSetting(hit.decision, status.instant), cached: true };
  }

  const decision = await classifyIntent(prompt, await getClient(key), { signal, timeoutMs: REQUEST_TIMEOUT_MS });
  cache.set(normalized, { at: Date.now(), decision });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return { decision: applyInstantSetting(decision, status.instant), cached: false };
}

export interface KeyCheckResult {
  ok: boolean;
  latencyMs?: number;
  model?: string;
  error?: string;
}

function describeKeyError(err: unknown): string {
  const e = err as { name?: string; status?: number; message?: string };
  if (e?.name === 'AuthenticationError' || e?.status === 401) return 'The key was rejected. Check it in console.typesafe.ai.';
  if (e?.name === 'PermissionDeniedError' || e?.status === 403) return 'This key has no access to Jev yet (early access).';
  if (e?.name === 'RateLimitError' || e?.status === 429) return 'Rate limited by TypeSafe. Try again in a moment.';
  if (e?.name === 'APITimeoutError') return 'TypeSafe did not answer in time.';
  if (e?.name === 'APIConnectionError') return 'Could not reach api.typesafe.ai.';
  return e?.message || 'Could not verify the key.';
}

/** One tiny request (a single yes/no question) to prove the key works and measure latency. */
export async function checkTypeSafeKey(apiKey?: string): Promise<KeyCheckResult> {
  const key = apiKey?.trim() || resolveApiKey(getIntentRouterConfig(), process.env).key;
  if (!key) return { ok: false, error: 'No key to check.' };
  try {
    const probe = await createClient(key, VALIDATE_TIMEOUT_MS, 0);
    const started = Date.now();
    const result = await probe.systemOne({
      state: { request: 'undo' },
      questions: { ping: { type: 'noul', instructions: 'Is the `request` about Photoshop?' } },
    });
    return { ok: true, latencyMs: Date.now() - started, model: result.model };
  } catch (err) {
    return { ok: false, error: describeKeyError(err) };
  }
}

/** What the browser sees: no tool arguments, just the decision. */
export interface RouteView {
  route: IntentRoute;
  label: string;
  intent: string;
  confidence: number;
  latencyMs: number;
  model: string;
  reason: string;
}

export function toRouteView(decision: IntentDecision): RouteView {
  return {
    route: decision.route,
    label: decision.label,
    intent: decision.intent,
    confidence: decision.confidence,
    latencyMs: decision.latencyMs,
    model: decision.model,
    reason: decision.reason,
  };
}
