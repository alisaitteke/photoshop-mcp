import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';

export function createDocumentTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_create_document',
        description: 'Create a new Photoshop document with specified dimensions',
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
        description: 'Get information about the active Photoshop document',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => getDocumentInfo(connection),
    },
    {
      tool: {
        name: 'photoshop_save_document',
        description: 'Save the active document in specified format',
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
        description: 'Close the active Photoshop document',
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
