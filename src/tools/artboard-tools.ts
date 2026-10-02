import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';
import { BATCH_SCRIPT_TIMEOUT_MS } from '../platform/script-timeout.js';
import {
  atomicFailure,
  atomicFailureFromError,
  atomicSuccess,
  parseSnippetResult,
  runSnippet,
} from './atomic-shared.js';

const EXPORT_FORMATS = ['PNG', 'JPEG', 'WEBP', 'AVIF'] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function createArtboardTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_list_artboards',
        description:
          'List artboards in the active document with id, name, pixel bounds, and which one contains the active layer.\n\n' +
          'Users often say: artboards, 画板, multi-screen, iPhone and iPad frames, device layouts.\n\n' +
          'Use when: the document is an artboard file (UI/multi-screen) and you need artboard_id before export or edits.\n' +
          'Do NOT use when: listing open document tabs — use photoshop_list_documents.\n\n' +
          'Returns: JSON { ok, summary, details: { count, artboards[] } }. Empty list if the document has no artboards.\n' +
          'Preconditions: active document. Side effects: none.',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => listArtboards(connection),
    },
    {
      tool: {
        name: 'photoshop_create_artboard',
        description:
          'Create a Photoshop artboard (AM artboardSection) at an explicit origin or placed to the right of existing artboards.\n\n' +
          'Users often say: add iPhone frame, new artboard, multi-screen layout, 画板 ekle.\n\n' +
          'Use when: building a multi-device / multi-screen document. First artboard converts a regular canvas into an artboard document.\n' +
          'Do NOT use when: you only need a new document tab — use photoshop_create_document.\n\n' +
          'Returns: JSON { ok, summary, details: { artboard, count } }.\n' +
          'Preconditions: active document. Side effects: adds an artboard layer group.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Artboard name (default Artboard)' },
            width: { type: 'number', description: 'Artboard width in pixels', minimum: 1 },
            height: { type: 'number', description: 'Artboard height in pixels', minimum: 1 },
            left: {
              type: 'number',
              description: 'Left origin in pixels (default: 32px to the right of existing artboards, or 0)',
            },
            top: {
              type: 'number',
              description: 'Top origin in pixels (default: aligned with existing artboards, or 0)',
            },
          },
          required: ['width', 'height'],
        },
      },
      handler: async (args) => createArtboard(connection, args),
    },
    {
      tool: {
        name: 'photoshop_set_active_artboard',
        description:
          'Select an artboard layer group by artboard_id (preferred) or unique name so subsequent edits and Select All target that board.\n\n' +
          'Use when: switching between device frames in an artboard document.\n' +
          'Do NOT use when: switching document tabs — use photoshop_set_active_document.\n\n' +
          'Returns: JSON { ok, summary, details: { artboard } }.\n' +
          'Preconditions: target artboard exists (photoshop_list_artboards). Side effects: changes the active layer.',
        inputSchema: {
          type: 'object',
          properties: {
            artboard_id: {
              type: 'number',
              description: 'Layer id from photoshop_list_artboards / photoshop_get_state',
            },
            name: {
              type: 'string',
              description: 'Exact artboard name (ambiguous if duplicates — use artboard_id)',
            },
          },
        },
      },
      handler: async (args) => setActiveArtboard(connection, args),
    },
    {
      tool: {
        name: 'photoshop_export_artboards',
        description:
          'Export every artboard in the active document to a folder (duplicate + crop to artboardRect, then PNG/JPEG/WebP/AVIF).\n\n' +
          'Users often say: export all artboards, multi-screen PNG, 画板 çıktısı.\n\n' +
          'Use when: delivering one file per artboard. Long jobs use a 600s script timeout.\n' +
          'Do NOT use when: exporting the whole canvas once — use photoshop_export_as.\n\n' +
          'Returns: JSON { ok, summary, details: { exported[], failed[], folder } }.\n' +
          'Preconditions: document with at least one artboard. Side effects: writes files; does not modify the original.',
        inputSchema: {
          type: 'object',
          properties: {
            folder: { type: 'string', description: 'Absolute output folder (created if missing)' },
            format: {
              type: 'string',
              enum: EXPORT_FORMATS,
              description: 'Export format',
              default: 'PNG',
            },
            quality: {
              type: 'number',
              description: 'Quality 0-100 (JPEG/WebP/AVIF)',
              minimum: 0,
              maximum: 100,
              default: 80,
            },
          },
          required: ['folder'],
        },
      },
      handler: async (args) => exportArtboards(connection, args),
    },
  ];
}

async function listArtboards(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const raw = await runSnippet(connection, ExtendScriptSnippets.listArtboards());
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Unparseable artboard list: ${String(raw)}`));
    }
    const count = typeof parsed.count === 'number' ? parsed.count : 0;
    return atomicSuccess(
      count === 0 ? 'No artboards in the active document' : `${count} artboard(s)`,
      parsed,
      count === 0 ? 'photoshop_create_artboard' : 'photoshop_export_artboards'
    );
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function createArtboard(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const width = typeof args.width === 'number' ? args.width : NaN;
  const height = typeof args.height === 'number' ? args.height : NaN;
  if (!Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) {
    return atomicFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'width and height must be positive pixel sizes',
    });
  }
  const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : 'Artboard';
  const left = typeof args.left === 'number' && Number.isFinite(args.left) ? args.left : undefined;
  const top = typeof args.top === 'number' && Number.isFinite(args.top) ? args.top : undefined;

  try {
    const raw = await runSnippet(
      connection,
      ExtendScriptSnippets.createArtboard(name, width, height, left, top)
    );
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Unparseable create artboard result: ${String(raw)}`));
    }
    if (parsed.ok === false) {
      return atomicFailureFromError(new Error(String(parsed.message || 'Create artboard failed')), {
        code:
          parsed.code === 'version_unsupported' ? 'version_unsupported' : 'extendscript_runtime_error',
        suggested_next_tool: 'photoshop_list_artboards',
      });
    }
    const artboardName =
      parsed.artboard && typeof parsed.artboard === 'object' && 'name' in parsed.artboard
        ? String((parsed.artboard as { name?: string }).name || name)
        : name;
    return atomicSuccess(`Created artboard "${artboardName}" (${Math.round(width)}x${Math.round(height)})`, parsed);
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function setActiveArtboard(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const artboardId =
    typeof args.artboard_id === 'number' && Number.isFinite(args.artboard_id)
      ? Math.trunc(args.artboard_id)
      : undefined;
  const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : undefined;
  if (artboardId === undefined && !name) {
    return atomicFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'Provide artboard_id or name',
      suggested_next_tool: 'photoshop_list_artboards',
    });
  }

  try {
    const raw = await runSnippet(
      connection,
      ExtendScriptSnippets.setActiveArtboard(artboardId, name)
    );
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Unparseable set artboard result: ${String(raw)}`));
    }
    if (parsed.ok === false) {
      const code = parsed.code === 'ambiguous_name' ? 'ambiguous_name' : 'artboard_not_found';
      return atomicFailureFromError(new Error(String(parsed.message || 'Artboard not found')), {
        code,
        suggested_next_tool: 'photoshop_list_artboards',
      });
    }
    const artboardName =
      parsed.artboard && typeof parsed.artboard === 'object' && 'name' in parsed.artboard
        ? String((parsed.artboard as { name?: string }).name || 'artboard')
        : 'artboard';
    return atomicSuccess(`Active artboard is "${artboardName}"`, parsed, 'photoshop_get_preview');
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function exportArtboards(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const folder = typeof args.folder === 'string' ? args.folder.trim() : '';
  if (!folder) {
    return atomicFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'folder parameter is required',
    });
  }
  const format: ExportFormat = EXPORT_FORMATS.includes(args.format as ExportFormat)
    ? (args.format as ExportFormat)
    : 'PNG';
  const quality =
    typeof args.quality === 'number' && Number.isFinite(args.quality)
      ? Math.max(0, Math.min(100, Math.round(args.quality)))
      : 80;

  try {
    const raw = await runSnippet(
      connection,
      ExtendScriptSnippets.exportArtboards(folder, format, quality),
      BATCH_SCRIPT_TIMEOUT_MS
    );
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Unparseable artboard export result: ${String(raw)}`));
    }
    if (parsed.ok === false) {
      return atomicFailureFromError(new Error(String(parsed.message || 'Artboard export failed')), {
        code:
          parsed.code === 'artboard_not_found'
            ? 'artboard_not_found'
            : parsed.code === 'version_unsupported'
              ? 'version_unsupported'
              : 'extendscript_runtime_error',
        suggested_next_tool:
          parsed.code === 'artboard_not_found'
            ? 'photoshop_create_artboard'
            : 'photoshop_export_as',
      });
    }
    const count = typeof parsed.count === 'number' ? parsed.count : 0;
    return atomicSuccess(`Exported ${count} artboard(s) to ${folder}`, parsed);
  } catch (error) {
    return atomicFailureFromError(error);
  }
}
