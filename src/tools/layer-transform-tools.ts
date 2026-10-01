import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';

export function createLayerTransformTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_fit_layer_to_document',
        description:
          'Scale the active layer to the document canvas, keeping aspect ratio. `fillDocument: false` (default) fits inside and may letterbox; `true` covers the canvas and may crop the layer.\n\n' +
          'Use when: a placed layer should match the canvas size.\n' +
          'Do NOT use when: you want a specific percent — use photoshop_scale_layer.\n' +
          'Do NOT use when: the document canvas itself should change size — use photoshop_resize_image or photoshop_crop_document.\n\n' +
          'Returns: confirmation of the fit.\n' +
          'Preconditions: active document and active layer. Side effects: transforms that layer. Does not change document dimensions. Reversible with photoshop_undo.',
        inputSchema: {
          type: 'object',
          properties: {
            fillDocument: {
              type: 'boolean',
              description:
                'If true, fills entire canvas (may crop). If false, fits within canvas (may have margins). Default: false',
              default: false,
            },
          },
        },
      },
      handler: async (args) => fitLayerToDocument(connection, args),
    },
    {
      tool: {
        name: 'photoshop_scale_layer',
        description:
          'Scale the active layer by a percentage (100 leaves the size unchanged). `centerAnchor` true (default) scales from the center; false scales from the top-left.\n\n' +
          'Use when: a numeric percent scale on one layer.\n' +
          'Do NOT use when: the layer should fit the canvas automatically — use photoshop_fit_layer_to_document.\n' +
          'Do NOT use when: the document dimensions should change — use photoshop_resize_image.\n' +
          'Do NOT use when: the layer has no pixels yet — fill it first. An empty layer fails with an empty bounding rectangle.\n\n' +
          'Returns: the scale percent applied.\n' +
          'Preconditions: active document and active layer. Side effects: transforms that layer, one history step. 100% does not change size; any other percent is not idempotent. Reversible with photoshop_undo.',
        inputSchema: {
          type: 'object',
          properties: {
            scalePercent: {
              type: 'number',
              description: 'Scale percentage (e.g., 50 for 50%, 200 for 200%)',
              minimum: 1,
            },
            centerAnchor: {
              type: 'boolean',
              description: 'Scale from center (true) or top-left (false). Default: true',
              default: true,
            },
          },
          required: ['scalePercent'],
        },
      },
      handler: async (args) => scaleLayer(connection, args),
    },
    {
      tool: {
        name: 'photoshop_move_layer',
        description: 'Move the active layer by specified offset',
        inputSchema: {
          type: 'object',
          properties: {
            deltaX: {
              type: 'number',
              description: 'Horizontal offset in pixels (can be negative)',
            },
            deltaY: {
              type: 'number',
              description: 'Vertical offset in pixels (can be negative)',
            },
          },
          required: ['deltaX', 'deltaY'],
        },
      },
      handler: async (args) => moveLayer(connection, args),
    },
    {
      tool: {
        name: 'photoshop_rotate_layer',
        description:
          'Rotate the active layer by `degrees` (positive is clockwise) around its center. The document canvas does not rotate.\n\n' +
          'Use when: one layer needs a rotation.\n' +
          'Do NOT use when: the layer should scale or move in pixels — use photoshop_scale_layer or photoshop_move_layer.\n' +
          'Do NOT use when: the whole canvas orientation should change — this tool does not rotate the document.\n\n' +
          'Returns: the degrees applied.\n' +
          'Preconditions: active document and active layer. Side effects: transforms that layer, one history step. A second call adds another rotation. Reversible with photoshop_undo.',
        inputSchema: {
          type: 'object',
          properties: {
            degrees: {
              type: 'number',
              description: 'Rotation angle in degrees (positive = clockwise, negative = counter-clockwise)',
            },
          },
          required: ['degrees'],
        },
      },
      handler: async (args) => rotateLayer(connection, args),
    },
  ];
}

async function fitLayerToDocument(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const fillDocument = (args.fillDocument as boolean) || false;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.fitLayerToDocument(fillDocument);
    const result = await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Layer ${fillDocument ? 'filled' : 'fitted'} to document\nResult: ${JSON.stringify(result)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error fitting layer to document: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function scaleLayer(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const scalePercent = args.scalePercent as number;
  const centerAnchor = args.centerAnchor !== undefined ? (args.centerAnchor as boolean) : true;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.scaleLayer(scalePercent, centerAnchor);
    const result = await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Layer scaled to ${scalePercent}%\nResult: ${JSON.stringify(result)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error scaling layer: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function moveLayer(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const deltaX = args.deltaX as number;
  const deltaY = args.deltaY as number;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.moveLayer(deltaX, deltaY);
    const result = await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Layer moved by (${deltaX}, ${deltaY})px\nResult: ${JSON.stringify(result)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error moving layer: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function rotateLayer(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const degrees = args.degrees as number;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.rotateLayer(degrees);
    const result = await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Layer rotated ${degrees} degrees\nResult: ${JSON.stringify(result)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error rotating layer: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
