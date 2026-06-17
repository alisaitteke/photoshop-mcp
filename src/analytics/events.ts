import { getServerAnalyticsContext } from './context.js';
import { getLaunchMethod } from './launch-method.js';

const BLOCKED_PROPERTY_KEYS = new Set([
  'api_key',
  'apikey',
  'key',
  'token',
  'secret',
  'password',
  'email',
  'account_label',
  'cli_path',
  'path',
  'file_path',
  'filepath',
  'message',
  'content',
  'prompt',
  'chat_id',
  'session_id',
]);

const ALLOWED_PROPERTY_KEYS = new Set([
  'app_version',
  'os',
  'arch',
  'node_version',
  'provider_id',
  'auth_method',
  'ok',
  'error_code',
  'photoshop_detected',
  'action_plan_enabled',
  'event_source',
  'port',
  'host',
  'no_open',
  'has_auth',
  'has_custom_path',
  'opted_out',
  'opted_in',
  'privacy_mode',
  'analytics_enabled',
  'beta_telemetry_opt_in',
  'theme',
  'launch_method',
]);

export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown> | undefined
): Record<string, string | number | boolean> {
  if (!properties) return {};

  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    const normalized = key.toLowerCase();
    if (BLOCKED_PROPERTY_KEYS.has(normalized)) continue;
    if (!ALLOWED_PROPERTY_KEYS.has(normalized)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[normalized] = value;
    }
  }
  return out;
}

export function buildRuntimeProperties(
  properties: Record<string, unknown> | undefined
): Record<string, string | number | boolean> {
  return {
    os: process.platform,
    arch: process.arch,
    node_version: process.version,
    launch_method: getLaunchMethod(),
    ...getServerAnalyticsContext(),
    ...sanitizeAnalyticsProperties(properties),
  };
}
