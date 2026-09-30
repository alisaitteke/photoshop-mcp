import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { recordMcpToolCall } from '../analytics/mcp-session.js';
import type { ToolHandler } from '../core/tool-registry.js';
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
  { pattern: /font_not_found/i, code: 'font_not_found', suggested_next_tool: 'photoshop_list_fonts' },
  { pattern: /not a text layer/i, code: 'not_text_layer', suggested_next_tool: 'photoshop_create_text_layer' },
  { pattern: /file not found|does not exist/i, code: 'file_not_found' },
  { pattern: /color mode/i, code: 'unsupported_color_mode', suggested_next_tool: 'photoshop_get_document_info' },
];

export function classifyError(message: string): PhotoshopErrorEnvelope {
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

export function wrapToolHandler(toolName: string, handler: ToolHandler): ToolHandler {
  return async (args) => {
    const started = Date.now();
    try {
      let result = await handler(args);
      if (result.isError) {
        result = refineTimeoutToolResult(toolName, enrichErrorResult(result));
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
      const result = refineTimeoutToolResult(toolName, buildEnvelopeFromError(error));
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
