import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';
import {
  atomicFailureFromError,
  atomicSuccess,
  parseSnippetResult,
  runSnippet,
} from './atomic-shared.js';

const EXPORT_FORMATS = ['PNG', 'JPEG', 'WEBP', 'AVIF'] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function createExportTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_export_as',
        description:
          'Export a copy of the active document as PNG, JPEG, WebP or AVIF without changing the open document. WebP/AVIF require Photoshop 23.2+/recent builds and return a clear error when unsupported.\n\n' +
          'Users often say: export for web, save as webp, quick export png.\n\n' +
          'Use when: web-ready delivery formats are needed (WebP/AVIF/modern pipelines), or one artboard from a multi-screen file.\n' +
          'Do NOT use when: saving the working document itself — use photoshop_save_document. For every artboard at once use photoshop_export_artboards.\n\n' +
          'Returns: JSON { ok, summary, details: { path, format, method, artboard_id? } }.\n' +
          'Preconditions: active document. Side effects: writes one file to path. Optional artboard_id exports only that board (duplicate + crop).',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute output file path (extension should match format)' },
            format: { type: 'string', enum: EXPORT_FORMATS, description: 'Export format', default: 'PNG' },
            quality: { type: 'number', description: 'Quality 0-100 (JPEG/WebP/AVIF)', minimum: 0, maximum: 100, default: 80 },
            artboard_id: {
              type: 'number',
              description:
                'Optional artboard layer id from photoshop_list_artboards — export that board only instead of the full canvas',
            },
          },
          required: ['path'],
        },
      },
      handler: async (args) => exportAs(connection, args),
    },
  ];
}

async function exportAs(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const filePath = typeof args.path === 'string' ? args.path.trim() : '';
  if (!filePath) {
    return atomicFailureFromError(new Error('path parameter is required'));
  }
  const format: ExportFormat = EXPORT_FORMATS.includes(args.format as ExportFormat)
    ? (args.format as ExportFormat)
    : 'PNG';
  const quality =
    typeof args.quality === 'number' && Number.isFinite(args.quality)
      ? Math.max(0, Math.min(100, Math.round(args.quality)))
      : 80;
  const artboardId =
    typeof args.artboard_id === 'number' && Number.isFinite(args.artboard_id)
      ? Math.trunc(args.artboard_id)
      : undefined;

  try {
    const raw = await runSnippet(
      connection,
      ExtendScriptSnippets.exportAs(filePath, format, quality, artboardId)
    );
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Unparseable export result: ${String(raw)}`));
    }
    if (parsed.ok === false) {
      return atomicFailureFromError(new Error(String(parsed.message || 'Export failed')), {
        code:
          parsed.code === 'artboard_not_found'
            ? 'artboard_not_found'
            : 'version_unsupported',
        suggested_next_tool:
          parsed.code === 'artboard_not_found' ? 'photoshop_list_artboards' : 'photoshop_save_document',
      });
    }
    return atomicSuccess(`Exported ${format} to ${filePath}`, {
      path: filePath,
      format,
      method: parsed.method,
      ...(artboardId !== undefined ? { artboard_id: artboardId } : {}),
    });
  } catch (error) {
    return atomicFailureFromError(error);
  }
}
