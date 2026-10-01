import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';

export function createImageTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_resize_image',
        description:
          'Resample the active document to a new pixel width and height (bicubic). Every layer scales and the canvas size changes.\n\n' +
          'Use when: the user gives exact output pixel dimensions for the whole document.\n' +
          'Do NOT use when: only one layer should scale — use photoshop_scale_layer or photoshop_fit_layer_to_document.\n' +
          'Do NOT use when: AI upscale is requested and photoshop_get_capabilities reports generative_upscale — use photoshop_generative_upscale.\n' +
          'Do NOT use when: cropping to a region — use photoshop_crop_document.\n\n' +
          'Returns: the resulting width and height in pixels.\n' +
          'Preconditions: active document. Side effects: resamples all layers, one history step. Reversible with photoshop_undo.',
        inputSchema: {
          type: 'object',
          properties: {
            width: {
              type: 'number',
              description: 'New width in pixels',
              minimum: 1,
            },
            height: {
              type: 'number',
              description: 'New height in pixels',
              minimum: 1,
            },
          },
          required: ['width', 'height'],
        },
      },
      handler: async (args) => resizeImage(connection, args),
    },
    {
      tool: {
        name: 'photoshop_crop_document',
        description:
          'Crop the active document to a pixel rectangle (left, top, right, bottom). Pixels outside that rectangle are deleted and the canvas shrinks.\n\n' +
          'Use when: the user gives explicit crop bounds in pixels.\n' +
          'Do NOT use when: only one layer should scale inside the existing canvas — use photoshop_fit_layer_to_document or photoshop_scale_layer.\n' +
          'Do NOT use when: the whole image should be resampled to a new width and height — use photoshop_resize_image.\n\n' +
          'Returns: the new document width and height.\n' +
          'Preconditions: active document; right > left and bottom > top. Side effects: destructive crop of every layer, one history step. Reversible with photoshop_undo.',
        inputSchema: {
          type: 'object',
          properties: {
            left: {
              type: 'number',
              description: 'Left edge position in pixels',
              minimum: 0,
            },
            top: {
              type: 'number',
              description: 'Top edge position in pixels',
              minimum: 0,
            },
            right: {
              type: 'number',
              description: 'Right edge position in pixels',
              minimum: 1,
            },
            bottom: {
              type: 'number',
              description: 'Bottom edge position in pixels',
              minimum: 1,
            },
          },
          required: ['left', 'top', 'right', 'bottom'],
        },
      },
      handler: async (args) => cropDocument(connection, args),
    },
  ];
}

async function resizeImage(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const width = args.width as number;
  const height = args.height as number;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.resizeImage(width, height);
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Image resized to ${width}x${height}px`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error resizing image: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function cropDocument(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const left = args.left as number;
  const top = args.top as number;
  const right = args.right as number;
  const bottom = args.bottom as number;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.cropDocument(left, top, right, bottom);
    const result = await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Document cropped\nResult: ${JSON.stringify(result)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error cropping document: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
