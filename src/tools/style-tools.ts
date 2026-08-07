import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';
import {
  atomicFailureFromError,
  atomicSuccess,
  parseSnippetResult,
  runSnippet,
} from './atomic-shared.js';

const LAYER_STYLES = ['drop_shadow', 'outer_glow', 'stroke', 'bevel_emboss'] as const;
type LayerStyle = (typeof LAYER_STYLES)[number];

function parseStyle(value: unknown): LayerStyle {
  if (typeof value === 'string' && LAYER_STYLES.includes(value as LayerStyle)) {
    return value as LayerStyle;
  }
  return 'drop_shadow';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function createStyleTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_apply_layer_style',
        description:
          'Apply a layer style (drop shadow, outer glow, stroke, bevel & emboss) to the active layer via Action Manager layer effects.\n\n' +
          'Users often say: add shadow, glow effect, outline this layer, stroke, bevel, 3D button look, katmana gölge ver.\n\n' +
          'Use when: quick presentational effects on the active layer (cards, buttons, mockups, text pop).\n' +
          'Do NOT use when: you need full custom layer-effects control — use photoshop_execute_script with a custom layerEffects descriptor.\n\n' +
          'Returns: JSON { ok, summary, details: { style, layer_name } }.\n' +
          'Preconditions: active document with an active pixel/text layer. Side effects: sets the chosen effect on the active layer.',
        inputSchema: {
          type: 'object',
          properties: {
            style: {
              type: 'string',
              enum: LAYER_STYLES,
              description: 'Which effect to apply',
              default: 'drop_shadow',
            },
            red: { type: 'number', description: 'Effect color red (0-255)', minimum: 0, maximum: 255, default: 0 },
            green: { type: 'number', description: 'Effect color green (0-255)', minimum: 0, maximum: 255, default: 0 },
            blue: { type: 'number', description: 'Effect color blue (0-255)', minimum: 0, maximum: 255, default: 0 },
            opacity: { type: 'number', description: 'Effect opacity (0-100)', minimum: 0, maximum: 100, default: 60 },
            size: { type: 'number', description: 'Blur/size in pixels (stroke width for stroke)', minimum: 0, maximum: 250, default: 10 },
            distance: { type: 'number', description: 'Offset distance in pixels (drop shadow only)', minimum: 0, maximum: 250, default: 8 },
            angle: { type: 'number', description: 'Light angle in degrees (drop shadow / bevel)', minimum: -360, maximum: 360, default: 120 },
          },
        },
      },
      handler: async (args) => applyLayerStyle(connection, args),
    },
  ];
}

async function applyLayerStyle(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const style = parseStyle(args.style);
  const options = {
    style,
    red: clampNumber(args.red, 0, 255, 0),
    green: clampNumber(args.green, 0, 255, 0),
    blue: clampNumber(args.blue, 0, 255, 0),
    opacity: clampNumber(args.opacity, 0, 100, 60),
    size: clampNumber(args.size, 0, 250, 10),
    distance: clampNumber(args.distance, 0, 250, 8),
    angle: clampNumber(args.angle, -360, 360, 120),
  };

  try {
    const raw = await runSnippet(connection, ExtendScriptSnippets.applyLayerStyle(options));
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Unparseable layer-style result: ${String(raw)}`));
    }
    return atomicSuccess(`Layer style ${style} applied`, {
      style,
      layer_name: parsed.layer_name,
    });
  } catch (error) {
    return atomicFailureFromError(error);
  }
}
