import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';
import { atomicFailure, atomicFailureFromError, atomicSuccess, parseSnippetResult } from './atomic-shared.js';
import { emitTextStyleLiteral, hasTextStyle, parseTextStyleArgs } from './text-style-options.js';

export function createLayerTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_create_layer',
        description:
          'Create a new empty layer above the active layer.\n\n' +
          'Use when: user needs a blank layer for painting, fills, or stacking content.\n' +
          'Do NOT use when: adding text — use photoshop_create_text_layer.\n\n' +
          'Returns: created layer name and context.\n' +
          'Preconditions: active document. Side effects: adds layer to history.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name for the new layer (optional)',
            },
          },
        },
      },
      handler: async (args) => createLayer(connection, args),
    },
    {
      tool: {
        name: 'photoshop_delete_layer',
        description:
          'Delete the active layer, including its pixels, mask, and effects.\n\n' +
          'Use when: the user wants that layer removed from the stack.\n' +
          'Do NOT use when: it should only be hidden — use photoshop_set_layer_visibility.\n' +
          'Do NOT use when: only the mask should go — use photoshop_delete_layer_mask.\n' +
          'Do NOT use when: the whole stack should collapse — use photoshop_flatten_image.\n\n' +
          'Returns: confirmation that the layer was deleted.\n' +
          'Preconditions: active document and a deletable active layer. Side effects: destroys the layer. Reversible with photoshop_undo while history holds it.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => deleteLayer(connection),
    },
    {
      tool: {
        name: 'photoshop_create_text_layer',
        description:
          'Create a text layer with content, position, font, and optional typography (tracking, leading, paragraph box, alignment, color).\n\n' +
          'Users often say: add title, letter spacing, line height, text box, 字间距, 行高, 排版.\n\n' +
          'Use when: adding labels, titles, or typography to the design.\n' +
          'Do NOT use when: editing existing text — use photoshop_update_text_content / photoshop_set_text_style.\n' +
          'Do NOT use execute_script for tracking/leading/box — pass those fields here.\n\n' +
          'Returns: JSON { ok, summary, details: { layerName, text, style, context } }.\n' +
          'Use photoshop_list_fonts to discover font names; photoshop_set_text_font / photoshop_set_text_style to change later.\n' +
          'Preconditions: active document. Side effects: adds text layer.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text content',
            },
            x: {
              type: 'number',
              description: 'X position in pixels (default: 100)',
              default: 100,
            },
            y: {
              type: 'number',
              description: 'Y position in pixels (default: 100)',
              default: 100,
            },
            fontSize: {
              type: 'number',
              description: 'Font size in points (default: 24)',
              default: 24,
            },
            fontName: {
              type: 'string',
              description:
                'Optional font display or PostScript name (resolved via app.fonts; see photoshop_list_fonts)',
            },
            tracking: {
              type: 'number',
              description: 'Character spacing in 1/1000 em (−1000 to 10000). Photoshop tracking.',
            },
            leading: {
              type: 'number',
              description: 'Line height in points. Sets auto_leading false.',
              minimum: 0.1,
            },
            auto_leading: {
              type: 'boolean',
              description: 'Use Photoshop auto leading (ignores leading when true)',
            },
            kind: {
              type: 'string',
              enum: ['point', 'paragraph'],
              description: 'point = single-line; paragraph = wrapped text box (default point unless box_width/height set)',
            },
            box_width: {
              type: 'number',
              description: 'Paragraph text box width in pixels (implies kind=paragraph)',
              minimum: 1,
            },
            box_height: {
              type: 'number',
              description: 'Paragraph text box height in pixels (implies kind=paragraph)',
              minimum: 1,
            },
            alignment: {
              type: 'string',
              enum: [
                'LEFT',
                'CENTER',
                'RIGHT',
                'LEFTJUSTIFIED',
                'CENTERJUSTIFIED',
                'RIGHTJUSTIFIED',
                'FULLYJUSTIFIED',
              ],
              description: 'Paragraph/point justification',
            },
            red: { type: 'number', description: 'Text color red 0–255', minimum: 0, maximum: 255 },
            green: { type: 'number', description: 'Text color green 0–255', minimum: 0, maximum: 255 },
            blue: { type: 'number', description: 'Text color blue 0–255', minimum: 0, maximum: 255 },
          },
          required: ['text'],
        },
      },
      handler: async (args) => createTextLayer(connection, args),
    },
    {
      tool: {
        name: 'photoshop_fill_layer',
        description:
          'Fill the active layer with a solid RGB color. If a selection exists, only that region is filled and the selection stays; otherwise the whole layer is filled and the selection is cleared.\n\n' +
          'Use when: a flat color fill on the active layer or on the current selection.\n' +
          'Do NOT use when: a new empty layer is needed first — use photoshop_create_layer, then this.\n' +
          'Do NOT use when: the selection should be filled with surrounding content — use photoshop_content_aware_fill.\n' +
          'Do NOT use when: the active layer is text — rasterize with photoshop_rasterize_layer first, or recolor type with photoshop_set_text_color.\n\n' +
          'Returns: the RGB color applied.\n' +
          'Preconditions: active document and an unlocked non-text layer. Side effects: overwrites those pixels, one history step. The same color on the same pixels is idempotent. Reversible with photoshop_undo.',
        inputSchema: {
          type: 'object',
          properties: {
            red: {
              type: 'number',
              description: 'Red component (0-255)',
              minimum: 0,
              maximum: 255,
            },
            green: {
              type: 'number',
              description: 'Green component (0-255)',
              minimum: 0,
              maximum: 255,
            },
            blue: {
              type: 'number',
              description: 'Blue component (0-255)',
              minimum: 0,
              maximum: 255,
            },
          },
          required: ['red', 'green', 'blue'],
        },
      },
      handler: async (args) => fillLayer(connection, args),
    },
    {
      tool: {
        name: 'photoshop_get_layers',
        description:
          'List all layers in the active document with kind, visibility, and opacity.\n\n' +
          'Use when: choosing a layer to edit, debugging structure, or after organize_layers.\n' +
          'Do NOT use when: only session summary is needed — use photoshop_get_state (lighter).\n\n' +
          'Returns: layerCount, layers array (LayerSets include is_artboard), context.\n' +
          'Preconditions: active document. Side effects: none.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => getLayers(connection),
    },
    {
      tool: {
        name: 'photoshop_select_layer_by_name',
        description:
          'Select the active layer by exact name, including layers inside groups.\n\n' +
          'Use when: a transform or property tool must target a named layer (photoshop_scale_layer, etc.).\n' +
          'Do NOT use when: the layer is already active — check photoshop_get_state first.\n\n' +
          'Returns: selected, layerName, kind, bounds (best-effort), context.\n' +
          'First depth-first name match wins when duplicate names exist in different groups.\n' +
          'Preconditions: active document. Side effects: changes active layer.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Exact layer name (case-sensitive)',
            },
          },
          required: ['name'],
        },
      },
      handler: async (args) => selectLayerByName(connection, args),
    },
  ];
}

async function createLayer(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const name = args.name as string | undefined;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.newLayer(name);
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Layer created${name ? `: ${name}` : ''}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error creating layer: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function deleteLayer(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.deleteLayer();
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: 'Layer deleted successfully',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error deleting layer: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function createTextLayer(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const text = args.text as string;
  if (typeof text !== 'string' || text.length === 0) {
    return atomicFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'text is required',
    });
  }
  const x = typeof args.x === 'number' && Number.isFinite(args.x) ? args.x : 100;
  const y = typeof args.y === 'number' && Number.isFinite(args.y) ? args.y : 100;
  const fontSize = typeof args.fontSize === 'number' && Number.isFinite(args.fontSize) ? args.fontSize : 24;
  const fontName = typeof args.fontName === 'string' && args.fontName.trim() ? args.fontName.trim() : undefined;
  const parsed = parseTextStyleArgs(args, { requireSome: false });
  if (parsed.error) return atomicFailure(parsed.error);

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const styleLiteral = hasTextStyle(parsed.style) ? emitTextStyleLiteral(parsed.style) : '{}';
    const raw = await api.executeScript(
      ExtendScriptSnippets.createTextLayer(text, x, y, fontSize, fontName, styleLiteral)
    );
    const details = parseSnippetResult(raw) ?? { text, position: { x, y }, fontSize, font: fontName };
    return atomicSuccess(
      `Text layer created: "${text}" at (${x}, ${y})${fontName ? ` with font ${fontName}` : ''}`,
      details,
      'photoshop_get_preview'
    );
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

async function fillLayer(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const red = args.red as number;
  const green = args.green as number;
  const blue = args.blue as number;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.fillLayer(red, green, blue);
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Layer filled with RGB(${red}, ${green}, ${blue})`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error filling layer: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function getLayers(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.getLayerNames();
    const result = await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Layers:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error getting layers: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function selectLayerByName(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const name = args.name as string;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.selectLayerByName(name);
    const result = await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Layer selected:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error selecting layer: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
