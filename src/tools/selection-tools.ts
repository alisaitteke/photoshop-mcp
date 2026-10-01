import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';
import { PhotoshopDetector } from '../platform/detector.js';
import {
  atomicFailure,
  atomicFailureFromError,
  atomicSuccess,
  parseSnippetResult,
  runSnippet,
} from './atomic-shared.js';
import type { PhotoshopErrorCode } from '../errors/envelope.js';

function mapSelectionSnippetFailure(parsed: Record<string, unknown>): ToolResult | null {
  if (parsed.ok !== false) return null;
  const rawCode = typeof parsed.code === 'string' ? parsed.code : 'extendscript_runtime_error';
  const code: PhotoshopErrorCode =
    rawCode === 'no_document'
      ? 'no_active_document'
      : rawCode === 'selection_required'
        ? 'selection_required'
        : 'extendscript_runtime_error';
  return atomicFailure({
    ok: false,
    code,
    message: String(parsed.message || 'Selection operation failed'),
    suggested_next_tool:
      code === 'selection_required' ? 'photoshop_select_rectangle' : 'photoshop_get_state',
  });
}

function parseRequiredPixels(args: Record<string, unknown>): number | null {
  const value = args.pixels;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(1, Math.round(value));
}

function parseSelectionBounds(
  parsed: Record<string, unknown>
): Record<string, unknown> | undefined {
  const details: Record<string, unknown> = {};
  if (parsed.bounds !== undefined) details.bounds = parsed.bounds;
  if (parsed.pixels !== undefined) details.pixels = parsed.pixels;
  if (parsed.operation !== undefined) details.operation = parsed.operation;
  if (parsed.shape !== undefined) details.shape = parsed.shape;
  if (parsed.channel_name !== undefined) details.channel_name = parsed.channel_name;
  if (parsed.context !== undefined) details.context = parsed.context;
  return Object.keys(details).length > 0 ? details : undefined;
}

export function createSelectionTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_get_selection_bounds',
        description:
          'Read the active pixel selection bounds in document pixels (read-only).\n\n' +
          'Use when: verifying selection exists and its size/position before mask, fill, or recipe steps.\n' +
          'Do NOT use when: creating or modifying a selection — use photoshop_select_rectangle or photoshop_select_subject.\n\n' +
          'Returns: JSON { ok, summary, details: { has_selection, bounds?, context } }.\n' +
          'Preconditions: active document. Side effects: none.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => getSelectionBounds(connection),
    },
    {
      tool: {
        name: 'photoshop_select_ellipse',
        description:
          'Create an elliptical pixel selection from a bounding box (anti-aliased).\n\n' +
          'Use when: circular or oval masks, vignettes, or radial edits inside a region.\n' +
          'Do NOT use when: a rectangular region is enough — use photoshop_select_rectangle.\n\n' +
          'Returns: JSON { ok, summary, details: { shape, bounds?, context } }.\n' +
          'Preconditions: active document; right > left and bottom > top. Side effects: replaces current selection.',
        inputSchema: {
          type: 'object',
          properties: {
            left: {
              type: 'number',
              description: 'Left edge of bounding box in pixels',
            },
            top: {
              type: 'number',
              description: 'Top edge of bounding box in pixels',
            },
            right: {
              type: 'number',
              description: 'Right edge of bounding box in pixels',
            },
            bottom: {
              type: 'number',
              description: 'Bottom edge of bounding box in pixels',
            },
          },
          required: ['left', 'top', 'right', 'bottom'],
        },
      },
      handler: async (args) => selectEllipse(connection, args),
    },
    {
      tool: {
        name: 'photoshop_expand_selection',
        description:
          'Expand the active pixel selection outward by a pixel amount.\n\n' +
          'Use when: growing a tight subject selection or adding padding before feather/fill.\n' +
          'Do NOT use when: no selection exists — create one first.\n\n' +
          'Returns: JSON { ok, summary, details: { pixels, bounds?, context } }.\n' +
          'Preconditions: active document and active pixel selection. Side effects: modifies selection.',
        inputSchema: {
          type: 'object',
          properties: {
            pixels: {
              type: 'number',
              description: 'Pixels to expand by (minimum 1)',
              minimum: 1,
            },
          },
          required: ['pixels'],
        },
      },
      handler: async (args) => expandSelection(connection, args),
    },
    {
      tool: {
        name: 'photoshop_contract_selection',
        description:
          'Contract (shrink) the active pixel selection inward by a pixel amount.\n\n' +
          'Use when: tightening a loose selection or trimming halo after expand.\n' +
          'Do NOT use when: no selection exists — create one first.\n\n' +
          'Returns: JSON { ok, summary, details: { pixels, bounds?, context } }.\n' +
          'Preconditions: active document and active pixel selection. Side effects: modifies selection.',
        inputSchema: {
          type: 'object',
          properties: {
            pixels: {
              type: 'number',
              description: 'Pixels to contract by (minimum 1)',
              minimum: 1,
            },
          },
          required: ['pixels'],
        },
      },
      handler: async (args) => contractSelection(connection, args),
    },
    {
      tool: {
        name: 'photoshop_feather_selection',
        description:
          'Feather (soften) the edges of the active pixel selection.\n\n' +
          'Use when: soft transitions before fill, mask, or delete operations.\n' +
          'Do NOT use when: a hard edge is required or no selection exists.\n\n' +
          'Returns: JSON { ok, summary, details: { pixels, bounds?, context } }.\n' +
          'Preconditions: active document and active pixel selection. Side effects: modifies selection edges.',
        inputSchema: {
          type: 'object',
          properties: {
            pixels: {
              type: 'number',
              description: 'Feather radius in pixels (minimum 1)',
              minimum: 1,
            },
          },
          required: ['pixels'],
        },
      },
      handler: async (args) => featherSelection(connection, args),
    },
    {
      tool: {
        name: 'photoshop_save_selection',
        description:
          'Save the active pixel selection to a new alpha channel.\n\n' +
          'Use when: preserving a selection for later reload or batch workflows.\n' +
          'Do NOT use when: no selection exists — create one first.\n\n' +
          'Returns: JSON { ok, summary, details: { channel_name, context } }.\n' +
          'Preconditions: active document and active pixel selection. Side effects: adds alpha channel.',
        inputSchema: {
          type: 'object',
          properties: {
            channel_name: {
              type: 'string',
              description: 'Optional name for the new alpha channel (auto-generated if omitted)',
            },
          },
        },
      },
      handler: async (args) => saveSelection(connection, args),
    },
    {
      tool: {
        name: 'photoshop_select_rectangle',
        description:
          'Create a rectangular pixel selection from corner coordinates.\n\n' +
          'Use when: masking, cropping a region, or preparing for layer mask.\n' +
          'Do NOT use when: subject isolation is needed — use photoshop_recipe_remove_background.\n\n' +
          'Returns: selection bounds [left, top, right, bottom].\n' +
          'Preconditions: active document. Side effects: replaces, adds, subtracts, or intersects the current selection.\n' +
          'mode intersect/add/subtract uses Action Manager and does not depend on the SelectionType enum.',
        inputSchema: {
          type: 'object',
          properties: {
            left: {
              type: 'number',
              description: 'Left edge in pixels',
            },
            top: {
              type: 'number',
              description: 'Top edge in pixels',
            },
            right: {
              type: 'number',
              description: 'Right edge in pixels',
            },
            bottom: {
              type: 'number',
              description: 'Bottom edge in pixels',
            },
            mode: {
              type: 'string',
              enum: ['replace', 'add', 'subtract', 'intersect'],
              description:
                'How this rectangle combines with the current selection. Default replace. Use intersect when SelectionType.INTERSECT is unavailable.',
            },
          },
          required: ['left', 'top', 'right', 'bottom'],
        },
      },
      handler: async (args) => selectRectangle(connection, args),
    },
    {
      tool: {
        name: 'photoshop_select_all',
        description:
          'Select every pixel of the active document. Does not change layer pixels.\n\n' +
          'Use when: the next fill, mask, or filter should cover the whole canvas.\n' +
          'Do NOT use when: only a region is needed — use photoshop_select_rectangle or photoshop_select_subject.\n' +
          'Do NOT use when: the selection should be cleared — use photoshop_deselect.\n\n' +
          'Returns: confirmation that the document is selected.\n' +
          'Preconditions: active document. Side effects: replaces the current selection. Idempotent. Reversible with photoshop_undo.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => selectAll(connection),
    },
    {
      tool: {
        name: 'photoshop_deselect',
        description:
          'Clear the current pixel selection. Pixels are unchanged.\n\n' +
          'Use when: a selection should be cleared before the next edit.\n' +
          'Do NOT use when: you want the inverse region selected — use photoshop_invert_selection.\n' +
          'Do NOT use when: you want every pixel selected — use photoshop_select_all.\n\n' +
          'Returns: confirmation that the selection was cleared.\n' +
          'Preconditions: active document. Safe when nothing is selected. Side effects: selection only. Idempotent. Reversible with photoshop_undo if a selection existed.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => deselect(connection),
    },
    {
      tool: {
        name: 'photoshop_invert_selection',
        description:
          'Invert the current pixel selection: selected pixels become unselected and the rest become selected. Layer pixels are unchanged.\n\n' +
          'Use when: a selection exists and the user wants the opposite region.\n' +
          'Do NOT use when: no selection exists — create one with photoshop_select_rectangle or photoshop_select_all.\n' +
          'Do NOT use when: the layer colors should invert — use photoshop_invert.\n\n' +
          'Returns: confirmation that the selection was inverted.\n' +
          'Preconditions: active document and an existing selection. Side effects: selection only. Calling twice restores the original selection. Reversible with photoshop_undo.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => invertSelection(connection),
    },
    {
      tool: {
        name: 'photoshop_create_layer_mask',
        description:
          'Create a layer mask on the active layer from the current selection (reveal selection).\n\n' +
          'Users often say: mask this, hide the background, non-destructive cutout (after selection).\n\n' +
          'Use when: non-destructive hide/show after a selection exists.\n' +
          'Do NOT use when: no selection exists — create selection first or use remove_background recipe.\n\n' +
          'Returns: maskCreated confirmation.\n' +
          'Preconditions: active document and active selection. Side effects: adds mask to active layer.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => createLayerMask(connection),
    },
    {
      tool: {
        name: 'photoshop_delete_layer_mask',
        description: 'Delete the layer mask from active layer',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => deleteLayerMask(connection),
    },
    {
      tool: {
        name: 'photoshop_apply_layer_mask',
        description:
          'Bake the active layer mask into its pixels and remove the mask. Pixels the mask hid are deleted.\n\n' +
          'Use when: the user wants the mask permanently applied.\n' +
          'Do NOT use when: the mask should stay editable — leave it, or create one with photoshop_create_layer_mask.\n' +
          'Do NOT use when: the mask should be discarded without changing pixels — use photoshop_delete_layer_mask.\n\n' +
          'Returns: confirmation that the mask was applied.\n' +
          'Preconditions: active document and an active layer that has a mask. Side effects: destroys masked-out pixels and the mask. Reversible with photoshop_undo while history holds it.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => applyLayerMask(connection),
    },
    {
      tool: {
        name: 'photoshop_select_subject',
        description:
          'Run Select Subject on the active layer (creates a pixel selection only, no mask).\n\n' +
          'Users often say: cut out, isolate subject, select person, select object.\n\n' +
          'Use when: you need a subject selection for masking, fill, or further edits.\n' +
          'Do NOT use when: full background removal with mask — use photoshop_recipe_remove_background.\n\n' +
          'Returns: JSON { ok, summary, details: { selected, method } }.\n' +
          'Preconditions: PS ≥ 23, active document, non-Background active layer with a recognizable subject.\n' +
          'Side effects: replaces current selection.',
        inputSchema: {
          type: 'object',
          properties: {
            sample_all_layers: {
              type: 'boolean',
              description: 'Sample all layers for autoCutout fallback (default false)',
              default: false,
            },
          },
        },
      },
      handler: async (args) => selectSubject(connection, args),
    },
    {
      tool: {
        name: 'photoshop_content_aware_fill',
        description:
          'Fill the current pixel selection using Content-Aware Fill.\n\n' +
          'Users often say: remove distraction, erase object, content aware fill, inpaint selection.\n\n' +
          'Use when: a rectangular or other selection covers the area to remove/replace.\n' +
          'Do NOT use when: no selection exists — use photoshop_select_rectangle first.\n' +
          'Do NOT use when: generative remove is requested — not scriptable; use this fill or manual touch-up.\n\n' +
          'Returns: JSON { ok, summary, details: { filled } }.\n' +
          'Preconditions: active document and active pixel selection.\n' +
          'Side effects: modifies pixels inside selection; deselects afterward.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => contentAwareFill(connection),
    },
  ];
}

async function getSelectionBounds(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const raw = await runSnippet(connection, ExtendScriptSnippets.getSelectionBounds());
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Snippet returned unparseable payload: ${String(raw)}`));
    }

    if (parsed.ok === false) {
      const code = parsed.code === 'no_document' ? 'no_active_document' : 'extendscript_runtime_error';
      return atomicFailure({
        ok: false,
        code,
        message: String(parsed.message || 'Failed to read selection bounds'),
        suggested_next_tool: 'photoshop_get_state',
      });
    }

    const hasSelection = parsed.has_selection === true;
    const details: Record<string, unknown> = {
      has_selection: hasSelection,
    };
    if (hasSelection && parsed.bounds) {
      details.bounds = parsed.bounds;
    }
    if (parsed.context !== undefined) {
      details.context = parsed.context;
    }

    return atomicSuccess(
      hasSelection ? 'Active pixel selection present' : 'No active pixel selection',
      details,
      hasSelection ? 'photoshop_get_preview' : 'photoshop_select_rectangle'
    );
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function selectEllipse(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const left = args.left as number;
  const top = args.top as number;
  const right = args.right as number;
  const bottom = args.bottom as number;

  if (right <= left || bottom <= top) {
    return atomicFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'Invalid ellipse bounds: right must be greater than left and bottom greater than top',
      suggested_next_tool: 'photoshop_get_selection_bounds',
    });
  }

  try {
    const raw = await runSnippet(connection, ExtendScriptSnippets.selectEllipse(left, top, right, bottom));
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Snippet returned unparseable payload: ${String(raw)}`));
    }

    const failure = mapSelectionSnippetFailure(parsed);
    if (failure) return failure;

    return atomicSuccess('Elliptical selection created', parseSelectionBounds(parsed));
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function expandSelection(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const pixels = parseRequiredPixels(args);
  if (pixels === null) {
    return atomicFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'pixels must be a finite number >= 1',
      suggested_next_tool: 'photoshop_get_selection_bounds',
    });
  }

  try {
    const raw = await runSnippet(connection, ExtendScriptSnippets.expandSelection(pixels));
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Snippet returned unparseable payload: ${String(raw)}`));
    }

    const failure = mapSelectionSnippetFailure(parsed);
    if (failure) return failure;

    return atomicSuccess(`Selection expanded by ${pixels}px`, parseSelectionBounds(parsed));
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function contractSelection(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const pixels = parseRequiredPixels(args);
  if (pixels === null) {
    return atomicFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'pixels must be a finite number >= 1',
      suggested_next_tool: 'photoshop_get_selection_bounds',
    });
  }

  try {
    const raw = await runSnippet(connection, ExtendScriptSnippets.contractSelection(pixels));
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Snippet returned unparseable payload: ${String(raw)}`));
    }

    const failure = mapSelectionSnippetFailure(parsed);
    if (failure) return failure;

    return atomicSuccess(`Selection contracted by ${pixels}px`, parseSelectionBounds(parsed));
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function featherSelection(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const pixels = parseRequiredPixels(args);
  if (pixels === null) {
    return atomicFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'pixels must be a finite number >= 1',
      suggested_next_tool: 'photoshop_get_selection_bounds',
    });
  }

  try {
    const raw = await runSnippet(connection, ExtendScriptSnippets.featherSelection(pixels));
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Snippet returned unparseable payload: ${String(raw)}`));
    }

    const failure = mapSelectionSnippetFailure(parsed);
    if (failure) return failure;

    return atomicSuccess(`Selection feathered by ${pixels}px`, parseSelectionBounds(parsed));
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function saveSelection(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const channelName =
    typeof args.channel_name === 'string' && args.channel_name.length > 0
      ? args.channel_name
      : undefined;

  try {
    const raw = await runSnippet(connection, ExtendScriptSnippets.saveSelection(channelName));
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Snippet returned unparseable payload: ${String(raw)}`));
    }

    const failure = mapSelectionSnippetFailure(parsed);
    if (failure) return failure;

    const name = typeof parsed.channel_name === 'string' ? parsed.channel_name : channelName;
    return atomicSuccess(
      name ? `Selection saved to channel "${name}"` : 'Selection saved to new alpha channel',
      parseSelectionBounds(parsed)
    );
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function selectRectangle(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const left = args.left as number;
  const top = args.top as number;
  const right = args.right as number;
  const bottom = args.bottom as number;
  const modeRaw = typeof args.mode === 'string' ? args.mode : 'replace';
  const mode = (['replace', 'add', 'subtract', 'intersect'] as const).includes(
    modeRaw as 'replace' | 'add' | 'subtract' | 'intersect'
  )
    ? (modeRaw as 'replace' | 'add' | 'subtract' | 'intersect')
    : 'replace';

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.selectRectangle(left, top, right, bottom, mode);
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Rectangular selection created: (${left}, ${top}) to (${right}, ${bottom})`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error creating selection: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function selectAll(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.selectAll();
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: 'All selected',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error selecting all: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function deselect(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.deselect();
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: 'Selection cleared',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error deselecting: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function invertSelection(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.invertSelection();
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: 'Selection inverted',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error inverting selection: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function createLayerMask(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.createLayerMask();
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: 'Layer mask created from selection',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error creating layer mask: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function deleteLayerMask(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.deleteLayerMask();
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: 'Layer mask deleted',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error deleting layer mask: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function applyLayerMask(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.applyLayerMask();
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: 'Layer mask applied (merged to layer)',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error applying layer mask: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function selectSubject(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const sampleAllLayers = args.sample_all_layers === true;

  await connection.ping().catch(() => undefined);
  const info = connection.getPhotoshopInfo();
  if (info) {
    const detector = new PhotoshopDetector();
    if (!detector.supportsSelectSubjectV2(info.version)) {
      return atomicFailure({
        ok: false,
        code: 'version_unsupported',
        message: `Select Subject v2 requires Photoshop 23.0+; detected version ${info.version}. Upgrade Photoshop or select manually.`,
        suggested_next_tool: 'photoshop_get_capabilities',
      });
    }
  }

  try {
    const raw = await runSnippet(connection, ExtendScriptSnippets.selectSubject(sampleAllLayers));
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Snippet returned unparseable payload: ${String(raw)}`));
    }

    const method = typeof parsed.method === 'string' ? parsed.method : 'selectSubject';
    return atomicSuccess(`Subject selected via ${method}`, parsed);
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function contentAwareFill(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const raw = await runSnippet(connection, ExtendScriptSnippets.contentAwareFill());
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Snippet returned unparseable payload: ${String(raw)}`));
    }

    return atomicSuccess('Content-aware fill applied', parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/selection_required/i.test(message)) {
      return atomicFailure({
        ok: false,
        code: 'selection_required',
        message: 'Active pixel selection required before content-aware fill',
        suggested_next_tool: 'photoshop_select_rectangle',
      });
    }
    return atomicFailureFromError(error);
  }
}
