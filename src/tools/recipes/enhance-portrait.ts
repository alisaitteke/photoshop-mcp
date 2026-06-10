import { ToolDefinition, ToolResult } from '../../core/tool-registry.js';
import { PhotoshopConnection } from '../../platform/connection.js';
import { executeRecipe } from './_shared.js';

const TOOL_NAME = 'photoshop_recipe_enhance_portrait';

const INTENSITY_OPTIONS = ['low', 'medium', 'high'] as const;
type Intensity = (typeof INTENSITY_OPTIONS)[number];

const RADIUS_BY_INTENSITY: Record<Intensity, number> = {
  low: 2,
  medium: 4,
  high: 7,
};

export function bindEnhancePortrait(connection: PhotoshopConnection): ToolDefinition {
  return {
    tool: {
      name: TOOL_NAME,
      description:
        'Set up a non-destructive portrait enhancement: duplicates the active layer, builds a frequency separation pair (low/high) for skin smoothing, and adds an auto-tone curves adjustment on top. Grouped as "Enhance Portrait" and reversible with one undo.\n' +
        '\n' +
        'Use when: the user asks to "enhance", "retouch", "clean up" or "smooth" a portrait photo and is happy with a baseline that they can further tweak interactively.\n' +
        'Do NOT use when: the user wants destructive, final edits — recommend manual frequency separation work via photoshop_recipe_frequency_separation instead so they can paint by hand.\n' +
        '\n' +
        'Returns: { ok, summary, details: { intensity, radius_px, group_name } }.\n' +
        '\n' +
        'Preconditions: active document with a NORMAL or background-converted raster layer.\n' +
        'Side effects: appends one layer group of 2-3 layers above the active layer; original layer untouched.',
      inputSchema: {
        type: 'object',
        properties: {
          intensity: {
            type: 'string',
            description:
              'Retouch strength: low (subtle), medium (default), high (heavier smoothing).',
            enum: ['low', 'medium', 'high'],
            default: 'medium',
          },
          skin_smoothing: {
            type: 'boolean',
            description:
              'Whether to build the frequency separation pair. When false, only the auto-tone curves are added.',
            default: true,
          },
        },
      },
    },
    handler: async (args) => runEnhancePortrait(connection, args),
  };
}

async function runEnhancePortrait(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const intensity = parseIntensity(args.intensity);
  const skinSmoothing = args.skin_smoothing !== false;
  const radius = RADIUS_BY_INTENSITY[intensity];

  const body = `
    var doc = app.activeDocument;
    var src;
    try {
      src = __mcp_ensureRasterActiveLayer();
    } catch (eRaster) {
      return { ok: false, code: 'unsupported_color_mode', message: eRaster.message || String(eRaster), suggested_next_tool: 'photoshop_rasterize_layer' };
    }

    var group = doc.layerSets.add();
    group.name = 'Enhance Portrait';

    var createdNames = [];

    if (${skinSmoothing ? 'true' : 'false'}) {
      var low = src.duplicate(group, ElementPlacement.INSIDE);
      low.name = 'FS Low';
      low.applyGaussianBlur(${radius});
      createdNames.push(low.name);

      var high = src.duplicate(group, ElementPlacement.INSIDE);
      high.name = 'FS High';
      try {
        __mcp_applyFrequencyHighFromLow(low, high);
      } catch (eApplyImage) {
        try { group.remove(); } catch (eRmG) {}
        return { ok: false, code: 'recipe_runtime_error', message: 'Apply Image step failed: ' + (eApplyImage.message || eApplyImage) };
      }
      high.blendMode = BlendMode.LINEARLIGHT;
      createdNames.push(high.name);
    }

    try {
      var curvesLayer = __mcp_makeCurvesAdjustmentLayer();
      curvesLayer.move(group, ElementPlacement.INSIDE);
      curvesLayer.name = 'Auto-tone (curves)';
      createdNames.push(curvesLayer.name);
    } catch (eCurves) {
      return { ok: false, code: 'recipe_runtime_error', message: 'Curves adjustment failed: ' + (eCurves.message || eCurves) };
    }

    return {
      ok: true,
      summary: 'Portrait enhancement set up at intensity "' + '${intensity}' + '" — ' + createdNames.length + ' layers grouped under "Enhance Portrait"',
      undo_history_states_consumed: 1,
      next_suggested_tool: 'photoshop_get_preview',
      details: {
        intensity: '${intensity}',
        radius_px: ${radius},
        group_name: group.name,
        created_layers: createdNames
      }
    };
  `;

  return executeRecipe(connection, 'Enhance Portrait', body);
}

function parseIntensity(raw: unknown): Intensity {
  if (typeof raw !== 'string') return 'medium';
  const v = raw.trim().toLowerCase();
  return INTENSITY_OPTIONS.find((o) => o === v) ?? 'medium';
}
