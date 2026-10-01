import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { recordMcpToolCall } from '../analytics/mcp-session.js';
import type { ToolHandler } from '../core/tool-registry.js';
import { readOsDriveFreeBytes } from '../platform/os-free-space.js';
import { EXECUTE_SCRIPT_RETRY_TIMEOUT_MS } from '../platform/script-timeout.js';

export type PhotoshopErrorCode =
  | 'no_active_document'
  | 'no_active_layer'
  | 'layer_not_found'
  | 'document_not_found'
  | 'ambiguous_name'
  | 'invalid_arguments'
  | 'selection_required'
  | 'version_unsupported'
  | 'generative_unavailable'
  | 'generative_timeout'
  | 'extendscript_timeout'
  | 'scratch_disk_full'
  | 'artboard_not_found'
  | 'generative_credits_exhausted'
  | 'generative_no_selection'
  | 'uxp_bridge_unavailable'
  | 'extendscript_runtime_error'
  | 'file_not_found'
  | 'font_not_found'
  | 'not_text_layer'
  | 'unsupported_color_mode'
  | 'no_base_layer_below'
  | 'not_clipping'
  | 'unknown';

export interface PhotoshopErrorEnvelope {
  ok: false;
  code: PhotoshopErrorCode;
  message: string;
  suggested_next_tool?: string;
  suggested_args?: Record<string, unknown>;
}

const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  code: PhotoshopErrorCode;
  suggested_next_tool?: string;
}> = [
  { pattern: /document_not_found/i, code: 'document_not_found', suggested_next_tool: 'photoshop_list_documents' },
  { pattern: /no active document/i, code: 'no_active_document', suggested_next_tool: 'photoshop_get_state' },
  { pattern: /no documents/i, code: 'no_active_document', suggested_next_tool: 'photoshop_get_state' },
  { pattern: /no active layer/i, code: 'no_active_layer', suggested_next_tool: 'photoshop_get_layers' },
  { pattern: /layer not found/i, code: 'layer_not_found', suggested_next_tool: 'photoshop_get_layers' },
  { pattern: /no base layer below|nothing to clip into/i, code: 'no_base_layer_below', suggested_next_tool: 'photoshop_get_layers' },
  { pattern: /not clipping|not a clipping mask/i, code: 'not_clipping', suggested_next_tool: 'photoshop_get_layers' },
  { pattern: /selection/i, code: 'selection_required', suggested_next_tool: 'photoshop_get_state' },
  { pattern: /version_unsupported|not supported.*version/i, code: 'version_unsupported', suggested_next_tool: 'photoshop_get_capabilities' },
  { pattern: /generative.*credit|quota|sign in/i, code: 'generative_credits_exhausted', suggested_next_tool: 'photoshop_get_capabilities' },
  {
    pattern: /script execution timeout|script timed out|waiting in the execution queue|appleevent timed out|ETIMEDOUT/i,
    code: 'extendscript_timeout',
    suggested_next_tool: 'photoshop_ping',
  },
  { pattern: /artboard_not_found|artboard not found|no artboard/i, code: 'artboard_not_found', suggested_next_tool: 'photoshop_list_artboards' },
  { pattern: /generative.*timeout|generative.*timed out/i, code: 'generative_timeout', suggested_next_tool: 'photoshop_get_preview' },
  { pattern: /generative_no_selection|selection required for generative/i, code: 'generative_no_selection', suggested_next_tool: 'photoshop_select_rectangle' },
  { pattern: /uxp.?bridge|neural filter.*bridge/i, code: 'uxp_bridge_unavailable', suggested_next_tool: 'photoshop_get_capabilities' },
  { pattern: /generative/i, code: 'generative_unavailable', suggested_next_tool: 'photoshop_get_capabilities' },
  { pattern: /syntax error|error 8:/i, code: 'extendscript_runtime_error', suggested_next_tool: 'photoshop_get_state' },
  { pattern: /not a text layer/i, code: 'not_text_layer', suggested_next_tool: 'photoshop_create_text_layer' },
  { pattern: /file not found|does not exist/i, code: 'file_not_found' },
  { pattern: /color mode/i, code: 'unsupported_color_mode', suggested_next_tool: 'photoshop_get_document_info' },
];

/**
 * Photoshop's minimum available hard-disk space.
 * https://helpx.adobe.com/photoshop/system-requirements.html
 */
export const PHOTOSHOP_MIN_FREE_BYTES = 10 * 1024 * 1024 * 1024;

/**
 * Adobe's scratch-disk dialogs, plus error -25010 from the scripts shipped
 * with Photoshop (Presets/Scripts, kErrTempDiskFull).
 * https://helpx.adobe.com/photoshop/desktop/troubleshoot/performance-stability-issues/troubleshoot-scratch-disk-full-errors-in-photoshop.html
 */
const SCRATCH_DISK_FULL_PATTERN =
  /scratch disks are full|scratch disk is full|scratch disk full|scratch disk low|not enough space on the scratch disk|\(number:\s*-25010\)/i;

/**
 * Recovery from Adobe's scratch-disk troubleshooting (updated Feb 23, 2026):
 * free 100 GB on the primary scratch disk, delete "Photoshop Temp*" on C:,
 * clean up Macintosh HD, then restart. Extra drives: Settings / Preferences >
 * Scratch Disks, or Cmd+Option / Ctrl+Alt during launch.
 */
const SCRATCH_DISK_RECOVERY =
  'Free at least 100 GB on the primary scratch disk (the OS drive, unless another disk was chosen). On Windows, delete files whose names begin with "Photoshop Temp" on C:. On macOS, free space on Macintosh HD. Restart Photoshop before calling any tool again. Another drive can be set in Photoshop > Settings > Scratch Disks (macOS) or Edit > Preferences > Scratch Disks (Windows), or by holding Cmd+Option (macOS) or Ctrl+Alt (Windows) while launching.';

export function scratchDiskFullEnvelope(detail: string): PhotoshopErrorEnvelope {
  return {
    ok: false,
    code: 'scratch_disk_full',
    message: `${detail} ${SCRATCH_DISK_RECOVERY}`,
  };
}

/** Startup timeout while the OS drive is below Photoshop's 10 GB minimum. */
export function diagnoseScratchDiskTimeout(freeBytes: number | null): PhotoshopErrorEnvelope | null {
  if (freeBytes === null || freeBytes >= PHOTOSHOP_MIN_FREE_BYTES) return null;
  const freeGb = (freeBytes / (1024 * 1024 * 1024)).toFixed(1);
  return scratchDiskFullEnvelope(
    `Scripting timed out. The OS drive, Photoshop's default scratch disk, has ${freeGb} GB free, below the 10 GB minimum.`
  );
}

export function classifyError(message: string): PhotoshopErrorEnvelope {
  if (SCRATCH_DISK_FULL_PATTERN.test(message)) {
    return scratchDiskFullEnvelope(message);
  }
  if (/font_not_found/i.test(message)) {
    return {
      ok: false,
      code: 'font_not_found',
      message: `${message} Photoshop only lists fonts already installed for this user. Install the .ttf, .otf, or .ttc with photoshop_install_font (it reloads the font list in the open app), then retry with a postScriptName from that result.`,
      suggested_next_tool: 'photoshop_list_fonts',
    };
  }

  for (const { pattern, code, suggested_next_tool } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return {
        ok: false,
        code,
        message,
        ...(suggested_next_tool ? { suggested_next_tool } : {}),
      };
    }
  }

  return {
    ok: false,
    code: message.includes('ERROR:') ? 'extendscript_runtime_error' : 'unknown',
    message,
    suggested_next_tool: 'photoshop_get_state',
  };
}

const TIMEOUT_BUSY_HINT =
  'The MCP wait ended; Photoshop may still be running that script. Call photoshop_ping until it succeeds before more edits.';

/**
 * Timeouts are classified without knowing which tool failed. Once the wrapper
 * has the tool name, point the agent at ping (Photoshop is often still busy)
 * or at a longer execute_script retry.
 */
export function refineTimeoutEnvelope(
  toolName: string,
  envelope: PhotoshopErrorEnvelope
): PhotoshopErrorEnvelope {
  if (envelope.code !== 'extendscript_timeout') return envelope;
  if (toolName === 'photoshop_execute_script') {
    return {
      ...envelope,
      message: `${envelope.message} ${TIMEOUT_BUSY_HINT} Retry once with timeout_ms.`,
      suggested_next_tool: 'photoshop_execute_script',
      suggested_args: { timeout_ms: EXECUTE_SCRIPT_RETRY_TIMEOUT_MS },
    };
  }
  if (toolName === 'photoshop_ping') {
    return {
      ...envelope,
      message: `${envelope.message} Photoshop is still running a previous script. Retry photoshop_ping until it succeeds before photoshop_get_state or photoshop_get_layers.`,
      suggested_next_tool: 'photoshop_ping',
    };
  }
  return {
    ...envelope,
    message: `${envelope.message} ${TIMEOUT_BUSY_HINT}`,
    suggested_next_tool: 'photoshop_ping',
  };
}

function refineTimeoutToolResult(toolName: string, result: CallToolResult): CallToolResult {
  const text = result.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  if (!text) return result;
  try {
    const parsed = JSON.parse(text) as PhotoshopErrorEnvelope;
    if (parsed.ok === false && parsed.code === 'extendscript_timeout') {
      return envelopeToToolResult(refineTimeoutEnvelope(toolName, parsed));
    }
  } catch {
    // not JSON
  }
  return result;
}

export function envelopeToToolResult(envelope: PhotoshopErrorEnvelope): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
    isError: true,
  };
}

export function enrichErrorResult(result: CallToolResult): CallToolResult {
  const text = result.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  if (!text) return result;

  try {
    const parsed = JSON.parse(text) as { ok?: boolean; code?: string };
    if (parsed.ok === false && parsed.code) return result;
  } catch {
    // not JSON — classify plain error text
  }

  if (text.startsWith('Error:') || text.toLowerCase().includes('error')) {
    const message = text.replace(/^Error:\s*/i, '').trim();
    return envelopeToToolResult(classifyError(message));
  }

  return result;
}

export function buildEnvelopeFromError(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return envelopeToToolResult(classifyError(message));
}

function extractErrorCodeFromResult(result: CallToolResult): string {
  const text = result.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  if (!text) return 'unknown';

  try {
    const parsed = JSON.parse(text) as { ok?: boolean; code?: string };
    if (parsed.ok === false && parsed.code) return parsed.code;
  } catch {
    // not JSON — fall through
  }

  return 'unknown';
}

async function finishToolError(toolName: string, result: CallToolResult): Promise<CallToolResult> {
  const diagnosed = await applyScratchDiskDiagnosis(result);
  return refineTimeoutToolResult(toolName, diagnosed);
}

/**
 * Photoshop freezes on "Could not initialize Photoshop because the scratch
 * disks are full" before any script can return -25010. The Apple event then
 * times out. When the OS drive is below the 10 GB minimum, say so.
 */
export async function applyScratchDiskDiagnosis(result: CallToolResult): Promise<CallToolResult> {
  const text = result.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  if (!text) return result;
  try {
    const parsed = JSON.parse(text) as PhotoshopErrorEnvelope;
    if (parsed.ok !== false || parsed.code !== 'extendscript_timeout') return result;
  } catch {
    return result;
  }

  try {
    const diagnosed = diagnoseScratchDiskTimeout(await readOsDriveFreeBytes());
    return diagnosed ? envelopeToToolResult(diagnosed) : result;
  } catch {
    return result;
  }
}

export function wrapToolHandler(toolName: string, handler: ToolHandler): ToolHandler {
  return async (args) => {
    const started = Date.now();
    try {
      let result = await handler(args);
      if (result.isError) {
        result = await finishToolError(toolName, enrichErrorResult(result));
      }

      const ok = !result.isError;
      recordMcpToolCall({
        toolName,
        ok,
        errorCode: ok ? undefined : extractErrorCodeFromResult(result),
        durationMs: Date.now() - started,
      });

      return result;
    } catch (error) {
      const result = await finishToolError(toolName, buildEnvelopeFromError(error));
      recordMcpToolCall({
        toolName,
        ok: false,
        errorCode: extractErrorCodeFromResult(result),
        durationMs: Date.now() - started,
      });
      return result;
    }
  };
}
