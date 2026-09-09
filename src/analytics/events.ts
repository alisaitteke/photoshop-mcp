import { getServerAnalyticsContext } from './context.js';
import { getLaunchMethod } from './launch-method.js';
import { buildAnonymousRuntimeEnv, getMemoryGbBucket, getTotalRamGb } from './runtime-env.js';

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
  'photoshop_connected',
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
  'browser_language',
  'browser_timezone',
  'browser_locale_region',
  'system_locale',
  'system_locale_region',
  'system_locale_language',
  'system_timezone',
  'os_type',
  'os_release',
  'cpu_count',
  'memory_gb',
  'total_ram_gb',
  'photoshop_version',
  'node_major',
  'is_electron',
  'photoshop_path_configured',
  'custom_data_dir_configured',
  'tool_name',
  'duration_ms',
  'usage_surface',
  'shutdown_reason',
  'tools_registered_count',
  'prompt_name',
  'tools_called_count',
  'tools_error_count',
  'unique_tools_count',
  'tool_usage_summary',
  'error_codes_summary',
  'tools_used',
  'error_codes',
  'had_errors',
  'batch_flush_reason',
  'mcp_client_name',
  'mcp_client_version',
  'mcp_client_connect_count',
  'usage_surfaces',
  'active_provider',
  'active_model',
  'model',
  'last_active_at',
]);

const ANALYTICS_RESERVED_PROPERTY_KEYS = new Set(['$current_url', '$pathname', '$screen_name']);

const ARRAY_PROPERTY_KEYS = new Set(['tools_used', 'error_codes']);

/** Install-cohort fields written via identify traits only when not already set. */
const PERSON_ONCE_PROPERTY_KEYS = new Set([
  'first_install_at',
  'first_usage_surface',
  'first_mcp_client_name',
]);

function isAllowedAnalyticsPropertyKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (BLOCKED_PROPERTY_KEYS.has(normalized)) return false;
  if (ALLOWED_PROPERTY_KEYS.has(normalized)) return true;
  return ANALYTICS_RESERVED_PROPERTY_KEYS.has(key);
}

export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown> | undefined
): Record<string, string | number | boolean | string[]> {
  if (!properties) return {};

  const out: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!isAllowedAnalyticsPropertyKey(key)) continue;
    if (value === null || value === undefined) continue;

    const outKey = ANALYTICS_RESERVED_PROPERTY_KEYS.has(key) ? key : key.toLowerCase();

    if (Array.isArray(value)) {
      if (!ARRAY_PROPERTY_KEYS.has(outKey)) continue;
      if (!value.every((item) => typeof item === 'string')) continue;
      out[outKey] = value;
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[outKey] = value;
    }
  }
  return out;
}

/** Sanitize person.set_once cohort properties (not attached to every event). */
export function sanitizePersonOnceProperties(
  properties: Record<string, unknown> | undefined
): Record<string, string | number | boolean> {
  if (!properties) return {};

  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    const normalized = key.toLowerCase();
    if (!PERSON_ONCE_PROPERTY_KEYS.has(normalized)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[normalized] = value;
    }
  }
  return out;
}

export function buildRuntimeProperties(
  properties: Record<string, unknown> | undefined
): Record<string, string | number | boolean | string[]> {
  return {
    ...buildAnonymousRuntimeEnv(),
    launch_method: getLaunchMethod(),
    ...getServerAnalyticsContext(),
    ...sanitizeAnalyticsProperties(properties),
  };
}

/** Person-profile fields merged on identify() — includes install-level hardware signals. */
export function buildPersonIdentifyProperties(
  properties?: Record<string, unknown>
): Record<string, string | number | boolean> {
  const merged = buildRuntimeProperties({
    total_ram_gb: getTotalRamGb(),
    memory_gb: getMemoryGbBucket(),
    ...properties,
  });

  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
}
