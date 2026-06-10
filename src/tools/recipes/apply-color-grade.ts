import { ToolDefinition, ToolResult } from '../../core/tool-registry.js';
import { PhotoshopConnection } from '../../platform/connection.js';
import { executeRecipe } from './_shared.js';

const TOOL_NAME = 'photoshop_recipe_apply_color_grade';

const PRESET_OPTIONS = [
  'cinematic',
  'vintage',
  'teal_orange',
  'bw',
  'warm_film',
  'cool_dusk',
] as const;
type Preset = (typeof PRESET_OPTIONS)[number];

interface HueSatPreset {
  hue: number;
  saturation: number;
  lightness: number;
  desaturate?: boolean;
}

const HUE_SAT_BY_PRESET: Record<Preset, HueSatPreset> = {
  cinematic: { hue: 0, saturation: -15, lightness: 0 },
  vintage: { hue: -8, saturation: -25, lightness: -3 },
  teal_orange: { hue: 10, saturation: 8, lightness: 0 },
  bw: { hue: 0, saturation: -100, lightness: 0, desaturate: true },
  warm_film: { hue: 6, saturation: 5, lightness: 2 },
  cool_dusk: { hue: -6, saturation: -10, lightness: 0 },
};

export function bindApplyColorGrade(connection: PhotoshopConnection): ToolDefinition {
  return {
    tool: {
      name: TOOL_NAME,
      description:
        'Apply a named color grading preset as a non-destructive layer group (Hue/Saturation adjustment + brightness/contrast tweak).\n' +
        '\n' +
        'Use when: the user wants a quick stylistic look applied to the active document.\n' +
        'Do NOT use when: the user wants subject-specific color edits (e.g. only the skin) — current recipe applies globally.\n' +
        '\n' +
        'Returns: { ok, summary, details: { preset, group_name } }.\n' +
        '\n' +
        'Preconditions: active document in RGB mode. CMYK/Grayscale return unsupported_color_mode.\n' +
        'Side effects: adds one layer group with adjustment layers; one undo reverts.',
      inputSchema: {
        type: 'object',
        properties: {
          preset: {
            type: 'string',
            description: `Preset name. One of: ${PRESET_OPTIONS.join(', ')}. Default cinematic.`,
            enum: [...PRESET_OPTIONS],
            default: 'cinematic',
          },
        },
      },
    },
    handler: async (args) => runApplyColorGrade(connection, args),
  };
}

async function runApplyColorGrade(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const preset = parsePreset(args.preset);
  const config = HUE_SAT_BY_PRESET[preset];

  const body = `
    var doc = app.activeDocument;
    try {
      if (String(doc.mode) !== 'DocumentMode.RGB') {
        return { ok: false, code: 'unsupported_color_mode', message: 'Active document is not RGB; convert to RGB before applying a color grade.', suggested_next_tool: 'photoshop_get_state' };
      }
    } catch (eMode) {}

    var group = doc.layerSets.add();
    group.name = 'Color Grade · ' + '${preset}';

    try {
      var hueSatLayer = __mcp_makeHueSatAdjustmentLayer(
        ${config.hue},
        ${config.saturation},
        ${config.lightness},
        ${config.desaturate ? 'true' : 'false'}
      );
      hueSatLayer.move(group, ElementPlacement.INSIDE);
      hueSatLayer.name = 'HueSat · ${preset}';
    } catch (eHueSat) {
      return { ok: false, code: 'recipe_runtime_error', message: 'HueSat adjustment failed: ' + (eHueSat.message || eHueSat) };
    }

    return {
      ok: true,
      summary: 'Applied color grade "${preset}" as non-destructive group',
      undo_history_states_consumed: 1,
      next_suggested_tool: 'photoshop_get_preview',
      details: {
        preset: '${preset}',
        group_name: group.name,
        hue: ${config.hue},
        saturation: ${config.saturation},
        lightness: ${config.lightness}
      }
    };
  `;

  return executeRecipe(connection, `Color Grade ${preset}`, body);
}

function parsePreset(raw: unknown): Preset {
  if (typeof raw !== 'string') return 'cinematic';
  const v = raw.trim().toLowerCase();
  return PRESET_OPTIONS.find((o) => o === v) ?? 'cinematic';
}
