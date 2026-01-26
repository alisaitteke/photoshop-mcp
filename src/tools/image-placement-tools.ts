import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';

export function createImagePlacementTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_place_image',
        description: 'Place an image file as a layer in the active document',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Full path to the image file (JPEG, PNG, PSD, etc.)',
            },
            x: {
              type: 'number',
              description: 'X position offset in pixels (default: 0)',
              default: 0,
            },
            y: {
              type: 'number',
              description: 'Y position offset in pixels (default: 0)',
              default: 0,
            },
          },
          required: ['filePath'],
        },
      },
      handler: async (args) => placeImage(connection, args),
    },
    {
      tool: {
        name: 'photoshop_open_image',
        description: 'Open an image file as a new document',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Full path to the image file',
            },
          },
          required: ['filePath'],
        },
      },
      handler: async (args) => openImage(connection, args),
    },
  ];
}

async function placeImage(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const filePath = args.filePath as string;
  const x = (args.x as number) || 0;
  const y = (args.y as number) || 0;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.placeImage(filePath, x, y);
    const result = await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Image placed successfully: ${filePath}\nPosition: (${x}, ${y})\nResult: ${JSON.stringify(result)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error placing image: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function openImage(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const filePath = args.filePath as string;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.openImage(filePath);
    const result = await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Image opened as new document: ${filePath}\nResult: ${JSON.stringify(result)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error opening image: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
