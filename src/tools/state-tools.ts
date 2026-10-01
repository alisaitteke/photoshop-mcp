import { readFile, unlink } from 'node:fs/promises';
import { PREVIEW_APP_URI } from '../apps/preview-frames.js';
import { buildPreviewToolResult, parsePreviewScriptPayload } from '../apps/preview-result.js';
import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import { resolvePhotoshopCapabilities } from '../platform/capabilities.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { envelopeToToolResult, classifyError } from '../errors/envelope.js';
import { parseExtendScriptPayload } from '../utils/extendscript-result.js';

const PREVIEW_MAX_BYTES = 4 * 1024 * 1024;

async function runScript(connection: PhotoshopConnection, script: string): Promise<unknown> {
  const apiFactory = new PhotoshopAPIFactory(connection);
  const api = await apiFactory.createAPI();
  return api.executeScript(script);
}

export function createStateTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_get_state',
        description:
          'Return a cheap read-only snapshot of Photoshop session state (active document, layer, selection).\n\n' +
          'Use when: before any tool that needs an active document/layer, or after an error to recover context.\n' +
          'Do NOT use when: you only need a visual preview — use photoshop_get_preview instead.\n\n' +
          'Returns: JSON with hasDocument, openDocumentCount, documents[] (id, name, width, height, saved, is_active for every open file), document (id, name, path, saved, width, height, resolution, colorMode, bitsPerChannel, layerCount, layers[] up to 40 top-level layers, artboards), activeLayer, activeArtboard, hasSelection. path is omitted until the file has been saved. Capture document.id and pass it as document_id on later mutating calls. Artboard ids come from document.artboards[].id.\n' +
          'Preconditions: none (safe on empty session). Side effects: none.',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => getState(connection),
    },
    {
      tool: {
        name: 'photoshop_get_preview',
        description:
          'Export the active document as a base64 JPEG preview for visual verification.\n\n' +
          'Use when: after visual edits to confirm result before reporting success to the user.\n' +
          'Do NOT use when: you only need numeric state — use photoshop_get_state (much cheaper).\n\n' +
          'Returns: MCP image content block (JPEG) plus metadata text (document size, color mode, up to 40 top-level layer names). Hosts that support MCP Apps also render ui://photoshop/preview.\n' +
          'Preconditions: active document required. Side effects: creates and deletes a temp file; does not modify the document.',
        _meta: {
          ui: { resourceUri: PREVIEW_APP_URI },
        },
        inputSchema: {
          type: 'object',
          properties: {
            max_dimension_px: {
              type: 'number',
              description: 'Maximum long edge in pixels (default 1024)',
              default: 1024,
            },
            quality: {
              type: 'number',
              description: 'JPEG quality 1–12 (default 8)',
              minimum: 1,
              maximum: 12,
              default: 8,
            },
          },
        },
      },
      handler: async (args) => getPreview(connection, args),
    },
    {
      tool: {
        name: 'photoshop_get_capabilities',
        description:
          'Return version-aware feature flags for the installed Photoshop (Select Subject v2, Generative Fill, etc.).\n\n' +
          'Use when: once per session before suggesting AI-powered features or gated recipes.\n' +
          'Do NOT use when: Photoshop version is already known from photoshop_get_version.\n\n' +
          'Returns: JSON { version, features: { select_subject_v2, generative_fill, ... } }.\n' +
          'Preconditions: none. Side effects: none.',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => getCapabilities(connection),
    },
  ];
}

async function getState(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const raw = await runScript(connection, ExtendScriptSnippets.getState());
    const result = parseExtendScriptPayload(raw);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return envelopeToToolResult(
      classifyError(error instanceof Error ? error.message : String(error))
    );
  }
}

async function getPreview(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const maxDimension = (args.max_dimension_px as number) || 1024;
  const quality = (args.quality as number) || 8;

  let tempPath: string | undefined;

  try {
    const payload = parsePreviewScriptPayload(
      parseExtendScriptPayload(
        await runScript(connection, ExtendScriptSnippets.exportPreview(maxDimension, quality))
      )
    );
    if (!payload) {
      return envelopeToToolResult(classifyError('Preview script returned no file path'));
    }

    tempPath = payload.path;
    const buffer = await readFile(tempPath);

    if (buffer.byteLength > PREVIEW_MAX_BYTES) {
      return envelopeToToolResult(
        classifyError(
          `Preview exceeds ${PREVIEW_MAX_BYTES} byte limit (${buffer.byteLength} bytes). Lower max_dimension_px or quality.`
        )
      );
    }

    return buildPreviewToolResult(payload, buffer.toString('base64'), buffer.byteLength);
  } catch (error) {
    return envelopeToToolResult(
      classifyError(error instanceof Error ? error.message : String(error))
    );
  } finally {
    if (tempPath) {
      await unlink(tempPath).catch(() => undefined);
    }
  }
}

async function getCapabilities(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const version = await connection.getVersion();
    const capabilities = await resolvePhotoshopCapabilities(version);
    return {
      content: [{ type: 'text', text: JSON.stringify(capabilities, null, 2) }],
    };
  } catch (error) {
    return envelopeToToolResult(
      classifyError(error instanceof Error ? error.message : String(error))
    );
  }
}
