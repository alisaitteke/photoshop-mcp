import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';

export function createImageTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_resize_image',
        description: 'Resize the active image to specified dimensions',
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
        description: 'Crop the document to specified bounds',
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
