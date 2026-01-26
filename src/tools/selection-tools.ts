import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';

export function createSelectionTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_select_rectangle',
        description: 'Create a rectangular selection',
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
          },
          required: ['left', 'top', 'right', 'bottom'],
        },
      },
      handler: async (args) => selectRectangle(connection, args),
    },
    {
      tool: {
        name: 'photoshop_select_all',
        description: 'Select the entire document',
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
        description: 'Deselect all selections',
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
        description: 'Invert the current selection',
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
        description: 'Create a layer mask from the current selection',
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
        description: 'Apply (merge) the layer mask to the layer',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => applyLayerMask(connection),
    },
  ];
}

async function selectRectangle(
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

    const script = ExtendScriptSnippets.selectRectangle(left, top, right, bottom);
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
