/** Default ExtendScript budget for atomic tools (ms). */
export const DEFAULT_SCRIPT_TIMEOUT_MS = 30_000;

/** Floor for any caller- or env-supplied timeout. */
export const MIN_SCRIPT_TIMEOUT_MS = 1_000;

/**
 * Ceiling advertised to tools and env. macOS AppleScript `with timeout` and
 * the Node SIGKILL bound both scale to this (see macos-executor tests).
 */
export const MAX_SCRIPT_TIMEOUT_MS = 600_000;

/**
 * Multi-file / long recipes (batch watermark, CSV cards, mockup replace,
 * social variants, datasets, image stack, artboard export, carousel split).
 */
export const BATCH_SCRIPT_TIMEOUT_MS = 600_000;

/** Extra time a task may sit in the serial queue before the caller gives up. */
export const QUEUE_WAIT_ALLOWANCE_MS = 60_000;

/**
 * Suggested `timeout_ms` when `photoshop_execute_script` itself timed out.
 * MCP killing osascript/cscript does not abort JSX already running inside Photoshop.
 */
export const EXECUTE_SCRIPT_RETRY_TIMEOUT_MS = 180_000;

function clampTimeoutMs(ms: number): number {
  return Math.min(MAX_SCRIPT_TIMEOUT_MS, Math.max(MIN_SCRIPT_TIMEOUT_MS, Math.round(ms)));
}

/**
 * Resolve the per-call script timeout.
 * Explicit `timeoutMs` wins; otherwise `PHOTOSHOP_SCRIPT_TIMEOUT` (ms); else 30s.
 */
export function resolveScriptTimeoutMs(timeoutMs?: number): number {
  if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs)) {
    return clampTimeoutMs(timeoutMs);
  }
  const raw = process.env.PHOTOSHOP_SCRIPT_TIMEOUT?.trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      return clampTimeoutMs(parsed);
    }
  }
  return DEFAULT_SCRIPT_TIMEOUT_MS;
}

export function isScriptTimeoutError(message: string): boolean {
  return (
    /script execution timeout/i.test(message) ||
    /script timed out/i.test(message) ||
    /waiting in the execution queue/i.test(message) ||
    /appleevent timed out/i.test(message) ||
    /ETIMEDOUT/i.test(message)
  );
}
