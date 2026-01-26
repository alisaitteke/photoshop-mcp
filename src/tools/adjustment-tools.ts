import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';

export function createAdjustmentTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_adjust_brightness_contrast',
        description: 'Adjust brightness and contrast of the active layer',
        inputSchema: {
          type: 'object',
          properties: {
            brightness: {
              type: 'number',
              description: 'Brightness adjustment (-100 to 100)',
              minimum: -100,
              maximum: 100,
            },
            contrast: {
              type: 'number',
              description: 'Contrast adjustment (-100 to 100)',
              minimum: -100,
              maximum: 100,
            },
          },
          required: ['brightness', 'contrast'],
        },
      },
      handler: async (args) => adjustBrightnessContrast(connection, args),
    },
    {
      tool: {
        name: 'photoshop_adjust_hue_saturation',
        description: 'Adjust hue, saturation, and lightness of the active layer',
        inputSchema: {
          type: 'object',
          properties: {
            hue: {
              type: 'number',
              description: 'Hue shift (-180 to 180)',
              minimum: -180,
              maximum: 180,
            },
            saturation: {
              type: 'number',
              description: 'Saturation adjustment (-100 to 100)',
              minimum: -100,
              maximum: 100,
            },
            lightness: {
              type: 'number',
              description: 'Lightness adjustment (-100 to 100)',
              minimum: -100,
              maximum: 100,
            },
          },
          required: ['hue', 'saturation', 'lightness'],
        },
      },
      handler: async (args) => adjustHueSaturation(connection, args),
    },
    {
      tool: {
        name: 'photoshop_auto_levels',
        description: 'Apply auto levels adjustment to the active layer',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => autoLevels(connection),
    },
    {
      tool: {
        name: 'photoshop_auto_contrast',
        description: 'Apply auto contrast adjustment to the active layer',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => autoContrast(connection),
    },
    {
      tool: {
        name: 'photoshop_desaturate',
        description: 'Desaturate the active layer (convert to grayscale)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => desaturate(connection),
    },
    {
      tool: {
        name: 'photoshop_invert',
        description: 'Invert colors of the active layer',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => invert(connection),
    },
  ];
}

async function adjustBrightnessContrast(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const brightness = args.brightness as number;
  const contrast = args.contrast as number;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.adjustBrightnessContrast(brightness, contrast);
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Brightness/Contrast adjusted: brightness ${brightness}, contrast ${contrast}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error adjusting brightness/contrast: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function adjustHueSaturation(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const hue = args.hue as number;
  const saturation = args.saturation as number;
  const lightness = args.lightness as number;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.adjustHueSaturation(hue, saturation, lightness);
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Hue/Saturation adjusted: hue ${hue}, saturation ${saturation}, lightness ${lightness}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error adjusting hue/saturation: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function autoLevels(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.autoLevels();
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: 'Auto Levels applied',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error applying auto levels: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function autoContrast(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.autoContrast();
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: 'Auto Contrast applied',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error applying auto contrast: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function desaturate(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.desaturate();
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: 'Layer desaturated (converted to grayscale)',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error desaturating layer: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function invert(connection: PhotoshopConnection): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.invert();
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: 'Colors inverted',
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error inverting colors: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
