import type { PhotoshopConnection } from '../../platform/connection.js';
import { TOOL_ANNOTATIONS } from '../../core/tool-annotations.js';
import { createActionTools } from '../../tools/action-tools.js';
import { createAdjustmentTools } from '../../tools/adjustment-tools.js';
import { createArtboardTools } from '../../tools/artboard-tools.js';
import { createColorAdjustmentTools } from '../../tools/color-adjustment-tools.js';
import { createDataTools } from '../../tools/data-tools.js';
import { createDocumentTools } from '../../tools/document-tools.js';
import { createExportTools } from '../../tools/export-tools.js';
import { createFilterTools } from '../../tools/filter-tools.js';
import { createGenerativeTools } from '../../tools/generative-tools.js';
import { createHistoryTools } from '../../tools/history-tools.js';
import { createImagePlacementTools } from '../../tools/image-placement-tools.js';
import { createImageTools } from '../../tools/image-tools.js';
import { createLayerOrderingTools } from '../../tools/layer-ordering-tools.js';
import { createLayerPropertiesTools } from '../../tools/layer-properties-tools.js';
import { createLayerTools } from '../../tools/layer-tools.js';
import { createLayerTransformTools } from '../../tools/layer-transform-tools.js';
import { createMaskTools } from '../../tools/mask-tools.js';
import { createNeuralTools } from '../../tools/neural-tools.js';
import { createRecipeTools } from '../../tools/recipes/index.js';
import { createSelectionTools } from '../../tools/selection-tools.js';
import { createSessionTools } from '../../tools/session-tools.js';
import { createSmartObjectTools } from '../../tools/smart-object-tools.js';
import { createStackTools } from '../../tools/stack-tools.js';
import { createStateTools } from '../../tools/state-tools.js';
import { createStyleTools } from '../../tools/style-tools.js';
import { createTextTools } from '../../tools/text-tools.js';

export interface ToolSurface {
  name: string;
  description: string;
  inputSchema: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  /** Pixels and document state stay as they are. */
  readOnly: boolean;
}

const noop = async () => ({ content: [] });

/**
 * The same tool set the MCP server registers, without a live Photoshop
 * connection. Schemas are the raw ones (no injected document_id).
 */
export function listToolSurfaces(): ToolSurface[] {
  const connection = undefined as unknown as PhotoshopConnection;
  const definitions = [
    ...createSessionTools({ ping: noop, feedback: noop, version: noop }),
    ...createDocumentTools(connection),
    ...createLayerTools(connection),
    ...createImageTools(connection),
    ...createImagePlacementTools(connection),
    ...createSmartObjectTools(connection),
    ...createLayerTransformTools(connection),
    ...createLayerPropertiesTools(connection),
    ...createFilterTools(connection),
    ...createAdjustmentTools(connection),
    ...createTextTools(connection),
    ...createSelectionTools(connection),
    ...createMaskTools(connection),
    ...createActionTools(connection),
    ...createHistoryTools(connection),
    ...createLayerOrderingTools(connection),
    ...createStateTools(connection),
    ...createGenerativeTools(connection),
    ...createNeuralTools(connection),
    ...createStyleTools(connection),
    ...createColorAdjustmentTools(connection),
    ...createDataTools(connection),
    ...createStackTools(connection),
    ...createExportTools(connection),
    ...createArtboardTools(connection),
    ...createRecipeTools(connection),
  ];
  return definitions.map((definition) => {
    const schema = definition.tool.inputSchema as ToolSurface['inputSchema'] | undefined;
    const annotations = TOOL_ANNOTATIONS[definition.tool.name];
    return {
      name: definition.tool.name,
      description: definition.tool.description ?? '',
      inputSchema: schema ?? { properties: {} },
      readOnly: annotations?.readOnlyHint === true,
    };
  });
}
