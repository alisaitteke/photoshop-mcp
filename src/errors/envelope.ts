import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ToolHandler } from '../core/tool-registry.js';

export type PhotoshopErrorCode =
  | 'no_active_document'
  | 'no_active_layer'
  | 'layer_not_found'
  | 'selection_required'
  | 'version_unsupported'
  | 'generative_unavailable'
  | 'extendscript_runtime_error'
  | 'file_not_found'
  | 'font_not_found'
  | 'unsupported_color_mode'
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
  { pattern: /no active document/i, code: 'no_active_document', suggested_next_tool: 'photoshop_get_state' },
  { pattern: /no documents/i, code: 'no_active_document', suggested_next_tool: 'photoshop_get_state' },
  { pattern: /no active layer/i, code: 'no_active_layer', suggested_next_tool: 'photoshop_get_layers' },
  { pattern: /layer not found/i, code: 'layer_not_found', suggested_next_tool: 'photoshop_get_layers' },
  { pattern: /selection/i, code: 'selection_required', suggested_next_tool: 'photoshop_get_state' },
  { pattern: /version_unsupported|not supported.*version/i, code: 'version_unsupported', suggested_next_tool: 'photoshop_get_capabilities' },
  { pattern: /generative/i, code: 'generative_unavailable', suggested_next_tool: 'photoshop_get_capabilities' },
  { pattern: /font_not_found/i, code: 'font_not_found', suggested_next_tool: 'photoshop_list_fonts' },
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

export function wrapToolHandler(handler: ToolHandler): ToolHandler {
  return async (args) => {
    try {
      const result = await handler(args);
      if (result.isError) {
        return enrichErrorResult(result);
      }
      return result;
    } catch (error) {
      return buildEnvelopeFromError(error);
    }
  };
}
