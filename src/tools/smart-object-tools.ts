import { stat } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';
import { PhotoshopConnection } from '../platform/connection.js';
import {
  atomicFailureFromError,
  atomicSuccess,
  parseSnippetResult,
  runSnippet,
} from './atomic-shared.js';

export function createSmartObjectTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_convert_to_smart_object',
        description:
          'Convert the active layer (or a named layer) to an embedded Smart Object.\n\n' +
          'Users often say: convert to smart object, make smart layer, embed layer.\n\n' +
          'Use when: non-destructive transforms/filters are needed on a raster or shape layer.\n' +
          'Do NOT use when: the layer is already a Smart Object — returns success with already_smart_object.\n' +
          'Do NOT use on background layers — unlock or duplicate first.\n\n' +
          'Returns: JSON { ok, summary, details: { layer_name, kind, already_smart_object? } }.\n' +
          'Preconditions: active document; target layer must be selected or named. Side effects: one history step.',
        inputSchema: {
          type: 'object',
          properties: {
            layer_name: {
              type: 'string',
              description: 'Optional exact layer name (recursive search). Default: active layer.',
            },
          },
        },
      },
      handler: async (args) => convertToSmartObject(connection, args),
    },
    {
      tool: {
        name: 'photoshop_replace_smart_object_contents',
        description:
          'Replace the embedded contents of a Smart Object layer from an image file. Preserves transforms, warps, and Smart Filters on the layer.\n\n' +
          'Users often say: replace smart object, swap mockup screen, relink embedded file.\n\n' +
          'Use when: updating a mockup or template Smart Object with a new asset file.\n' +
          'Do NOT use when: the target is not a Smart Object — convert first or use photoshop_place_image.\n' +
          'Do NOT use for linked Smart Objects that need Relink to File — this replaces embedded contents.\n\n' +
          'Returns: JSON { ok, summary, details: { layer_name, file_path } }.\n' +
          'Preconditions: Smart Object layer active or named; file_path must exist (absolute). Side effects: replaces embedded pixels.',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute path to the replacement image file (JPEG, PNG, PSD, etc.)',
            },
            layer_name: {
              type: 'string',
              description: 'Optional exact Smart Object layer name. Default: active layer.',
            },
          },
          required: ['file_path'],
        },
      },
      handler: async (args) => replaceSmartObjectContents(connection, args),
    },
    {
      tool: {
        name: 'photoshop_edit_smart_object_contents',
        description:
          'Open a Smart Object for editing (double-click / Edit Contents). The embedded .psb becomes the active document until you save and close it.\n\n' +
          'Users often say: edit smart object, open embedded file, double-click smart layer.\n\n' +
          'Use when: modifying pixels inside an embedded Smart Object non-destructively.\n' +
          'Do NOT use when: replacing the whole asset — use photoshop_replace_smart_object_contents.\n\n' +
          'Returns: JSON { ok, summary, details: { parent_document, embedded_document, layer_name } }.\n' +
          'Preconditions: Smart Object layer active or named.\n' +
          'Side effects: active document switches to the embedded .psb — save/close it to return to the parent document.',
        inputSchema: {
          type: 'object',
          properties: {
            layer_name: {
              type: 'string',
              description: 'Optional exact Smart Object layer name. Default: active layer.',
            },
          },
        },
      },
      handler: async (args) => editSmartObjectContents(connection, args),
    },
    {
      tool: {
        name: 'photoshop_create_smart_object_via_copy',
        description:
          'Create an independent Smart Object via Copy — unlinked duplicate with its own embedded contents.\n\n' +
          'Users often say: new smart object via copy, independent smart copy, duplicate smart object separately.\n\n' +
          'Use when: you need a second Smart Object that does not share embedded data with the original.\n' +
          'Do NOT use when: you want linked instances — use photoshop_duplicate_layer (Layer via Copy).\n\n' +
          'Returns: JSON { ok, summary, details: { source_layer_name, new_layer_name, kind } }.\n' +
          'Preconditions: Smart Object layer active or named. Side effects: adds a new Smart Object layer.',
        inputSchema: {
          type: 'object',
          properties: {
            layer_name: {
              type: 'string',
              description: 'Optional source Smart Object layer name. Default: active layer.',
            },
          },
        },
      },
      handler: async (args) => createSmartObjectViaCopy(connection, args),
    },
    {
      tool: {
        name: 'photoshop_get_layer_sources',
        description:
          'Report where layers come from: for every Smart Object, whether it is linked or embedded, its original file name, and the full source path on disk (linked only). Also reports missing/modified links.\n\n' +
          'Users often say: where is this layer from, source path, original file, linked file, which file is this smart object, broken link, missing link.\n\n' +
          'Use when: you need the file path or original name behind a layer, want to audit all links in a document, or need layer ids before relinking.\n' +
          'Do NOT use when: you only need names/visibility/opacity — use photoshop_get_layers.\n' +
          'Embedded Smart Objects (including pasted Illustrator vectors) have no external path: source is "embedded" and original_name is the name Photoshop stored (e.g. "Vector Smart Object.ai"). Pixel, text and shape layers have no source (has_source=false).\n\n' +
          'Returns: JSON { ok, summary, details: { document, document_path, layer_count, linked_count, embedded_count, missing_link_count, layers: [{ id, name, kind, tree_path, has_source, source: "linked"|"embedded", original_name, source_path, link_missing, link_changed, content_type, document_id }] } }.\n' +
          'Preconditions: active document. Side effects: none.',
        inputSchema: {
          type: 'object',
          properties: {
            layer_id: {
              type: 'number',
              description: 'Optional layer id (stable, from this tool or photoshop_get_state). Reports only that layer.',
            },
            layer_name: {
              type: 'string',
              description: 'Optional exact layer name (first depth-first match). Prefer layer_id when names repeat.',
            },
            smart_objects_only: {
              type: 'boolean',
              description: 'When listing the whole document, skip layers without a source. Default false.',
            },
          },
        },
      },
      handler: async (args) => getLayerSources(connection, args),
    },
    {
      tool: {
        name: 'photoshop_relink_smart_object',
        description:
          'Point a linked Smart Object at a different file on disk (Layer > Smart Objects > Relink to File). Fixes missing links and swaps the source while keeping transforms and filters.\n\n' +
          'Users often say: relink, fix broken link, change linked file, point layer to another file, update source path.\n\n' +
          'Use when: a Smart Object is linked (see photoshop_get_layer_sources) and its source file moved, was renamed, or should be swapped.\n' +
          'Also works on an embedded Smart Object: it becomes linked to file_path and its contents are replaced by that file (this is how to turn an embedded layer into a linked one).\n\n' +
          'The original name shown by Photoshop cannot be edited directly; it follows the linked file name, so relinking to a renamed copy is how it changes.\n\n' +
          'Returns: JSON { ok, summary, details: { before, after } } with the source info before and after.\n' +
          'Preconditions: active document; absolute file_path must exist; target layer by layer_id, layer_name, or active layer. Side effects: one history step.',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute path to the new source file (must exist).',
            },
            layer_id: { type: 'number', description: 'Target layer id. Preferred over layer_name.' },
            layer_name: { type: 'string', description: 'Exact layer name. Default: active layer.' },
          },
          required: ['file_path'],
        },
      },
      handler: async (args) => relinkSmartObject(connection, args),
    },
    {
      tool: {
        name: 'photoshop_embed_linked_smart_object',
        description:
          'Embed a linked Smart Object into the document (Layer > Smart Objects > Embed Linked). The layer keeps its transforms and filters but no longer depends on the external file, and its original name is kept.\n\n' +
          'Users often say: embed linked file, unlink smart object, make self-contained, pack linked layer.\n\n' +
          'Use when: a Smart Object is linked (see photoshop_get_layer_sources) and the document should be self-contained.\n' +
          'Do NOT use when: the layer is already embedded — returns success with already_embedded. The reverse (Convert to Linked) is refused by Photoshop when run through scripting; export the contents with photoshop_export_smart_object_contents, then use photoshop_relink_smart_object with that file.\n\n' +
          'Returns: JSON { ok, summary, details: { before, after } } with the source info before and after.\n' +
          'Preconditions: active document; Smart Object layer by layer_id, layer_name, or active layer. Side effects: one history step.',
        inputSchema: {
          type: 'object',
          properties: {
            layer_id: { type: 'number', description: 'Target layer id. Preferred over layer_name.' },
            layer_name: { type: 'string', description: 'Exact layer name. Default: active layer.' },
          },
        },
      },
      handler: async (args) => embedLinkedSmartObject(connection, args),
    },
    {
      tool: {
        name: 'photoshop_export_smart_object_contents',
        description:
          'Save the contents of a Smart Object to a file (Layer > Smart Objects > Export Contents). Recovers the original asset of an embedded Smart Object without changing the document.\n\n' +
          'Users often say: export smart object, extract embedded file, save original, get the source file.\n\n' +
          'Use when: you need the original/embedded file on disk, for example to edit it elsewhere or to link it.\n' +
          'Do NOT use when: you want the layer rendered as pixels — use photoshop_export_as.\n\n' +
          'Returns: JSON { ok, summary, details: { layer_name, file_path, exists } }.\n' +
          'Preconditions: active document; Smart Object layer; absolute file_path in an existing folder. Side effects: writes a file; the document is unchanged.',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Absolute destination path. Photoshop may adjust the extension to the contents type (.ai, .psb, .png ...).',
            },
            layer_id: { type: 'number', description: 'Target layer id. Preferred over layer_name.' },
            layer_name: { type: 'string', description: 'Exact layer name. Default: active layer.' },
          },
          required: ['file_path'],
        },
      },
      handler: async (args) => exportSmartObjectContents(connection, args),
    },
  ];
}

function optionalLayerId(args: Record<string, unknown>): number | undefined {
  const raw = args.layer_id;
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.trunc(raw) : undefined;
}

function optionalLayerName(args: Record<string, unknown>): string | undefined {
  return typeof args.layer_name === 'string' && args.layer_name.trim()
    ? args.layer_name.trim()
    : undefined;
}

async function getLayerSources(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const raw = await runSnippet(
      connection,
      ExtendScriptSnippets.getLayerSources(
        optionalLayerId(args),
        optionalLayerName(args),
        args.smart_objects_only === true
      )
    );
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Unparseable layer source result: ${String(raw)}`));
    }
    if (parsed.ok === false) {
      return atomicFailureFromError(new Error(String(parsed.message || 'Could not read layer sources')));
    }
    const { ok: _ok, ...details } = parsed;
    const linked = Number(details.linked_count ?? 0);
    const embedded = Number(details.embedded_count ?? 0);
    const missing = Number(details.missing_link_count ?? 0);
    return atomicSuccess(
      `${linked} linked, ${embedded} embedded Smart Object(s)` +
        (missing > 0 ? `, ${missing} with a missing link` : ''),
      details,
      'photoshop_relink_smart_object'
    );
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function runLayerSourceMutation(
  connection: PhotoshopConnection,
  script: string,
  successSummary: string
): Promise<ToolResult> {
  try {
    const raw = await runSnippet(connection, script);
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Unparseable Smart Object result: ${String(raw)}`));
    }
    if (parsed.ok === false) {
      return atomicFailureFromError(new Error(String(parsed.message || 'Smart Object operation failed')));
    }
    const { ok: _ok, ...details } = parsed;
    return atomicSuccess(successSummary, details, 'photoshop_get_layer_sources');
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function requireExistingFile(filePath: string): Promise<Error | null> {
  try {
    await stat(filePath);
    return null;
  } catch (error) {
    return new Error(
      `File not found: ${filePath} (${error instanceof Error ? error.message : String(error)})`
    );
  }
}

async function relinkSmartObject(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const filePath = typeof args.file_path === 'string' ? args.file_path.trim() : '';
  if (!filePath) return atomicFailureFromError(new Error('file_path is required.'));
  if (!isAbsolute(filePath)) {
    return atomicFailureFromError(new Error('file_path must be an absolute path.'));
  }
  const missing = await requireExistingFile(filePath);
  if (missing) return atomicFailureFromError(missing);

  return runLayerSourceMutation(
    connection,
    ExtendScriptSnippets.relinkSmartObject(filePath, optionalLayerId(args), optionalLayerName(args)),
    `Smart Object relinked to ${filePath}`
  );
}

async function embedLinkedSmartObject(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  return runLayerSourceMutation(
    connection,
    ExtendScriptSnippets.embedLinkedSmartObject(optionalLayerId(args), optionalLayerName(args)),
    'Smart Object embedded'
  );
}

async function exportSmartObjectContents(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const filePath = typeof args.file_path === 'string' ? args.file_path.trim() : '';
  if (!filePath) return atomicFailureFromError(new Error('file_path is required.'));
  if (!isAbsolute(filePath)) {
    return atomicFailureFromError(new Error('file_path must be an absolute path.'));
  }
  const folder = dirname(filePath);
  try {
    await stat(folder);
  } catch {
    return atomicFailureFromError(new Error(`Destination folder does not exist: ${folder}`));
  }
  return runLayerSourceMutation(
    connection,
    ExtendScriptSnippets.exportSmartObjectContents(filePath, optionalLayerId(args), optionalLayerName(args)),
    `Smart Object contents exported to ${filePath}`
  );
}

async function runSmartObjectSnippet(
  connection: PhotoshopConnection,
  script: string,
  successSummary: string,
  detailsKeys?: string[]
): Promise<ToolResult> {
  try {
    const raw = await runSnippet(connection, script);
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Unparseable Smart Object result: ${String(raw)}`));
    }
    if (parsed.ok === false) {
      return atomicFailureFromError(new Error(String(parsed.message || 'Smart Object operation failed')));
    }
    const details: Record<string, unknown> = {};
    if (detailsKeys) {
      for (const key of detailsKeys) {
        if (parsed[key] !== undefined) details[key] = parsed[key];
      }
    }
    if (parsed.context !== undefined) details.context = parsed.context;
    return atomicSuccess(successSummary, details);
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function convertToSmartObject(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const layerName = typeof args.layer_name === 'string' ? args.layer_name.trim() : undefined;
  return runSmartObjectSnippet(
    connection,
    ExtendScriptSnippets.convertToSmartObject(layerName),
    layerName ? `Layer "${layerName}" converted to Smart Object` : 'Active layer converted to Smart Object',
    ['layer_name', 'kind', 'already_smart_object']
  );
}

async function replaceSmartObjectContents(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const filePath = typeof args.file_path === 'string' ? args.file_path.trim() : '';
  const layerName = typeof args.layer_name === 'string' ? args.layer_name.trim() : undefined;

  if (!filePath) {
    return atomicFailureFromError(new Error('file_path is required.'));
  }
  if (!isAbsolute(filePath)) {
    return atomicFailureFromError(new Error('file_path must be an absolute path.'));
  }

  try {
    await stat(filePath);
  } catch (error) {
    return atomicFailureFromError(
      new Error(
        `Replacement file not found: ${filePath} (${error instanceof Error ? error.message : String(error)})`
      )
    );
  }

  return runSmartObjectSnippet(
    connection,
    ExtendScriptSnippets.replaceSmartObjectContents(filePath, layerName),
    `Smart Object contents replaced from ${filePath}`,
    ['layer_name', 'file_path']
  );
}

async function editSmartObjectContents(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const layerName = typeof args.layer_name === 'string' ? args.layer_name.trim() : undefined;
  return runSmartObjectSnippet(
    connection,
    ExtendScriptSnippets.editSmartObjectContents(layerName),
    'Smart Object opened for editing — active document is now the embedded contents',
    ['parent_document', 'embedded_document', 'layer_name']
  );
}

async function createSmartObjectViaCopy(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const layerName = typeof args.layer_name === 'string' ? args.layer_name.trim() : undefined;
  return runSmartObjectSnippet(
    connection,
    ExtendScriptSnippets.createSmartObjectViaCopy(layerName),
    'New Smart Object created via copy',
    ['source_layer_name', 'new_layer_name', 'kind']
  );
}
