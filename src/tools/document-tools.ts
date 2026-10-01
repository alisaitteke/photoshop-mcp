import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';
import {
  atomicFailure,
  atomicFailureFromError,
  atomicSuccess,
  parseSnippetResult,
  runSnippet,
} from './atomic-shared.js';

export function createDocumentTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_create_document',
        description:
          'Create a new empty Photoshop document with specified dimensions and color mode.\n\n' +
          'Use when: starting a design from scratch or no document is open.\n' +
          'Do NOT use when: opening an existing file — use photoshop_open_image.\n\n' +
          'Returns: created document id and name.\n' +
          'Preconditions: none. Side effects: creates a new document and makes it active.',
        inputSchema: {
          type: 'object',
          properties: {
            width: {
              type: 'number',
              description: 'Document width in pixels',
              minimum: 1,
            },
            height: {
              type: 'number',
              description: 'Document height in pixels',
              minimum: 1,
            },
            resolution: {
              type: 'number',
              description: 'Document resolution in DPI (default: 72)',
              default: 72,
            },
            colorMode: {
              type: 'string',
              description: 'Color mode (RGB, CMYK, Grayscale)',
              enum: ['RGB', 'CMYK', 'Grayscale'],
              default: 'RGB',
            },
          },
          required: ['width', 'height'],
        },
      },
      handler: async (args) => createDocument(connection, args),
    },
    {
      tool: {
        name: 'photoshop_get_document_info',
        description:
          'Read the active document id, name, size, resolution, and color mode. Does not change pixels or which tab is active.\n\n' +
          'Use when: you need dimensions or color mode of the front document only.\n' +
          'Do NOT use when: several documents are open and you need every tab — use photoshop_list_documents.\n' +
          'Do NOT use when: you also need the active layer and selection — use photoshop_get_state.\n\n' +
          'Returns: document context JSON.\n' +
          'Preconditions: an open document. Side effects: none.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => getDocumentInfo(connection),
    },
    {
      tool: {
        name: 'photoshop_list_documents',
        description:
          'List every open Photoshop document with id, dimensions, saved flag, artboard_count, and which tab is active.\n\n' +
          'Use when: multiple documents are open and you need document_id before switching tabs, previewing, or closing a specific file.\n' +
          'Do NOT use when: you only need the active document — use photoshop_get_document_info or photoshop_get_state.\n\n' +
          'Returns: JSON { ok, summary, details: { count, documents[] (id, name, width, height, saved, artboard_count, is_active), active_document_id, context } }.\n' +
          'Preconditions: none (safe when zero documents open). Side effects: briefly activates each tab to read artboard_count, then restores the original active document.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => listDocuments(connection),
    },
    {
      tool: {
        name: 'photoshop_set_active_document',
        description:
          'Switch the active document tab by document_id (preferred), zero-based index, or name.\n\n' +
          'Use when: working across multiple open files and mutations must target a specific document.\n' +
          'Do NOT use when: only one document is open — it is already active.\n' +
          'Do NOT use document_name when duplicate names exist — use document_id from photoshop_list_documents.\n\n' +
          'Returns: JSON { ok, summary, details: { activated: { id, name }, context } }.\n' +
          'Preconditions: target document must be open. Provide exactly one of document_id, index, or document_name. Side effects: changes active tab.',
        inputSchema: {
          type: 'object',
          properties: {
            document_id: {
              type: 'number',
              description: 'Unique internal document id from photoshop_list_documents (preferred)',
            },
            index: {
              type: 'number',
              description: 'Zero-based tab order index (leftmost tab is 0)',
              minimum: 0,
            },
            document_name: {
              type: 'string',
              description: 'Document name/title (ambiguous if multiple tabs share the same name)',
            },
          },
        },
      },
      handler: async (args) => setActiveDocument(connection, args),
    },
    {
      tool: {
        name: 'photoshop_save_document',
        description:
          'Save the active document to disk in PSD, JPEG, or PNG format.\n\n' +
          'Use when: user requests export/save with a specific path and format.\n' +
          'Do NOT use when: web-optimized resize+sharpen pipeline is needed — use photoshop_recipe_prepare_for_web.\n\n' +
          'Returns: confirmation with saved path and format.\n' +
          'Preconditions: active document; path required. Side effects: writes file to disk.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Full path where to save the document',
            },
            format: {
              type: 'string',
              description: 'File format (PSD, JPEG, PNG)',
              enum: ['PSD', 'JPEG', 'PNG'],
              default: 'PSD',
            },
            quality: {
              type: 'number',
              description: 'Quality for JPEG (1-12, default: 8)',
              minimum: 1,
              maximum: 12,
              default: 8,
            },
          },
          required: ['path'],
        },
      },
      handler: async (args) => saveDocument(connection, args),
    },
    {
      tool: {
        name: 'photoshop_close_document',
        description:
          'Close a Photoshop document tab. Defaults to the active document; pass document_id to close a specific open file.\n\n' +
          'Use when: the user is done with a file, or when cleaning up extra open tabs after photoshop_list_documents.\n' +
          'Do NOT use when: you only need to switch tabs — use photoshop_set_active_document.\n\n' +
          'Returns: confirmation that the document closed.\n' +
          'Preconditions: target document is open. Side effects: closes that tab; save=true writes unsaved changes first.',
        inputSchema: {
          type: 'object',
          properties: {
            save: {
              type: 'boolean',
              description: 'Whether to save changes before closing',
              default: false,
            },
          },
        },
      },
      handler: async (args) => closeDocument(connection, args),
    },
  ];
}

async function createDocument(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const width = args.width as number;
  const height = args.height as number;
  const resolution = (args.resolution as number) || 72;
  const colorMode = (args.colorMode as string) || 'RGB';

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const colorModeMap: Record<string, string> = {
      RGB: 'NewDocumentMode.RGB',
      CMYK: 'NewDocumentMode.CMYK',
      Grayscale: 'NewDocumentMode.GRAYSCALE',
    };

    const script = ExtendScriptSnippets.newDocument(
      width,
      height,
      resolution,
      colorModeMap[colorMode] || 'NewDocumentMode.RGB'
    );

    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Document created: ${width}x${height}px at ${resolution}dpi (${colorMode})`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error creating document: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function listDocuments(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const raw = await runSnippet(connection, ExtendScriptSnippets.listDocuments());
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Snippet returned unparseable payload: ${String(raw)}`));
    }

    if (parsed.ok === false) {
      return atomicFailure({
        ok: false,
        code: 'extendscript_runtime_error',
        message: String(parsed.message || 'Failed to list documents'),
        suggested_next_tool: 'photoshop_get_state',
      });
    }

    const count = typeof parsed.count === 'number' ? parsed.count : 0;
    const details: Record<string, unknown> = {
      count,
      documents: parsed.documents ?? [],
      active_document_id: parsed.active_document_id ?? null,
    };
    if (parsed.context !== undefined) {
      details.context = parsed.context;
    }

    return atomicSuccess(
      count === 0 ? 'No documents open' : `${count} open document${count === 1 ? '' : 's'}`,
      details,
      count === 0 ? 'photoshop_create_document' : 'photoshop_get_document_info'
    );
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

function countSetActiveIdentifiers(args: Record<string, unknown>): number {
  let count = 0;
  if (args.document_id !== undefined && args.document_id !== null) count++;
  if (args.index !== undefined && args.index !== null) count++;
  if (typeof args.document_name === 'string' && args.document_name.length > 0) count++;
  return count;
}

async function setActiveDocument(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const identifierCount = countSetActiveIdentifiers(args);
  if (identifierCount !== 1) {
    return atomicFailure({
      ok: false,
      code: 'invalid_arguments',
      message:
        'Exactly one of document_id, index, or document_name is required to set the active document',
      suggested_next_tool: 'photoshop_list_documents',
    });
  }

  const params: { documentId?: number; documentName?: string; index?: number } = {};
  if (args.document_id !== undefined && args.document_id !== null) {
    params.documentId = args.document_id as number;
  } else if (args.index !== undefined && args.index !== null) {
    params.index = args.index as number;
  } else {
    params.documentName = args.document_name as string;
  }

  try {
    const raw = await runSnippet(connection, ExtendScriptSnippets.setActiveDocument(params));
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Snippet returned unparseable payload: ${String(raw)}`));
    }

    if (parsed.ok === false) {
      const code =
        parsed.code === 'document_not_found' || parsed.code === 'ambiguous_name'
          ? parsed.code
          : 'extendscript_runtime_error';
      return atomicFailure({
        ok: false,
        code,
        message: String(parsed.message || 'Failed to set active document'),
        suggested_next_tool: 'photoshop_list_documents',
        ...(parsed.matching_document_ids
          ? { suggested_args: { matching_document_ids: parsed.matching_document_ids } }
          : {}),
      });
    }

    const activated = parsed.activated as { id?: number; name?: string } | undefined;
    const details: Record<string, unknown> = {};
    if (activated) {
      details.activated = activated;
    }
    if (parsed.context !== undefined) {
      details.context = parsed.context;
    }

    return atomicSuccess(
      activated?.name
        ? `Active document set to "${activated.name}"`
        : 'Active document switched',
      details,
      'photoshop_get_document_info'
    );
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function getDocumentInfo(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.getDocumentInfo();
    const result = await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Document info:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error getting document info: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function saveDocument(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const path = args.path as string;
  const format = (args.format as string) || 'PSD';
  const quality = (args.quality as number) || 8;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    let script;
    switch (format.toUpperCase()) {
      case 'JPEG':
        script = ExtendScriptSnippets.saveAsJPEG(path, quality);
        break;
      case 'PNG':
        script = ExtendScriptSnippets.saveAsPNG(path);
        break;
      default:
        script = ExtendScriptSnippets.saveAsPSD(path);
    }
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Document saved as ${format} to: ${path}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error saving document: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function closeDocument(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const save = (args.save as boolean) || false;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.closeDocument(save);
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: save ? 'Document closed and saved' : 'Document closed without saving',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error closing document: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
