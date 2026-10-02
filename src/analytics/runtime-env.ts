import { cpus, release, totalmem, type, uptime } from 'node:os';
import { getAppVersion } from './app-version.js';
import { getSystemLocale, resolveLocaleLanguage, resolveLocaleRegion } from './locale.js';

const MACHINE_MAX_CHARS = 80;

let knownPhotoshopVersion: string | undefined;

function bucketMemoryGb(totalBytes: number): number {
  const gb = totalBytes / 1024 ** 3;
  if (gb <= 4) return 4;
  if (gb <= 8) return 8;
  if (gb <= 16) return 16;
  if (gb <= 32) return 32;
  if (gb <= 64) return 64;
  return 128;
}

/** Rounded total installed RAM in GB — attached to the anonymous person profile only. */
export function getTotalRamGb(): number {
  return Math.round(totalmem() / 1024 ** 3);
}

/** Bucketed memory tier (GB) for person-profile cohort segmentation. */
export function getMemoryGbBucket(): number {
  return bucketMemoryGb(totalmem());
}

function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'unknown';
  }
}

function getNodeMajorVersion(): number | undefined {
  const match = process.version.match(/^v(\d+)/);
  if (!match) return undefined;
  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : undefined;
}

function envFlag(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

/** CPU model only — no hostname, username, or serial. */
export function getMachineModel(): string | undefined {
  const raw = cpus()[0]?.model?.replace(/\s+/g, ' ').trim();
  if (!raw) return undefined;
  if (raw.length <= MACHINE_MAX_CHARS) return raw;
  return `${raw.slice(0, MACHINE_MAX_CHARS - 1)}…`;
}

/** Whole hours the OS has been up, or undefined when the OS refuses the read. */
export function getUptimeHours(): number | undefined {
  try {
    const seconds = uptime();
    if (!Number.isFinite(seconds) || seconds < 0) return undefined;
    return Math.round(seconds / 3600);
  } catch {
    return undefined;
  }
}

/** Remember a detected Photoshop version so later session events can carry it. */
export function rememberPhotoshopVersion(version: string): void {
  const trimmed = version.trim();
  if (!trimmed || trimmed === 'Unknown') return;
  knownPhotoshopVersion = trimmed;
}

export function getKnownPhotoshopVersion(): string | undefined {
  return knownPhotoshopVersion;
}

/** Anonymous machine/runtime signals safe to attach to every server-side event. */
export function buildAnonymousRuntimeEnv(): Record<string, string | number | boolean> {
  const systemLocale = getSystemLocale();
  const systemLocaleRegion = resolveLocaleRegion(systemLocale);
  const systemLocaleLanguage = resolveLocaleLanguage(systemLocale);
  const nodeMajor = getNodeMajorVersion();
  const machine = getMachineModel();
  const uptimeHours = getUptimeHours();

  return {
    app_version: getAppVersion(),
    os: process.platform,
    arch: process.arch,
    os_type: type(),
    os_release: release(),
    node_version: process.version,
    ...(nodeMajor !== undefined ? { node_major: nodeMajor } : {}),
    cpu_count: cpus().length,
    ...(machine ? { machine } : {}),
    ...(uptimeHours !== undefined ? { uptime_hours: uptimeHours } : {}),
    system_locale: systemLocale,
    system_timezone: getSystemTimezone(),
    ...(systemLocaleRegion ? { system_locale_region: systemLocaleRegion } : {}),
    ...(systemLocaleLanguage ? { system_locale_language: systemLocaleLanguage } : {}),
    is_electron: Boolean(process.versions.electron),
    photoshop_path_configured: envFlag('PHOTOSHOP_PATH'),
    custom_data_dir_configured: envFlag('PHOTOSHOP_MCP_HOME'),
  };
}
