import { ToolDefinition, ToolResult } from '../../core/tool-registry.js';
import { PhotoshopConnection } from '../../platform/connection.js';
import { clampInt, executeRecipe } from './_shared.js';

const TOOL_NAME = 'photoshop_recipe_sticker_outline';

const STROKE_POSITIONS = ['outside', 'inside', 'center'] as const;
type StrokePosition = (typeof STROKE_POSITIONS)[number];

const OUTLINE_STYLES = ['single', 'die_cut'] as const;
type OutlineStyle = (typeof OUTLINE_STYLES)[number];

/** Maps the user-facing position onto the Photoshop `frameStyle` enum value. */
const FRAME_STYLE_BY_POSITION: Record<StrokePosition, string> = {
  outside: 'outsetFrame',
  inside: 'insetFrame',
  center: 'centeredFrame',
};

export function bindStickerOutline(connection: PhotoshopConnection): ToolDefinition {
  return {
    tool: {
      name: TOOL_NAME,
      description:
        'One-shot sticker / white-border outline. single: applies a solid stroke plus (optionally) a soft drop shadow to the active layer. die_cut: the classic double outline — a white border with a thin dark outer line — built by adding two stroked copies of the active layer. Both run in one undoable history step.\n' +
        '\n' +
        'Users often say: sticker, white border, white outline, cut-out border, die-cut sticker, double outline, 贴画, 白边描边, 一键白边, sticker effect, kontur ekle, beyaz çerçeve, çift çizgi.\n' +
        '\n' +
        'Use when: the user wants a sticker-style white outline around the active layer, optionally with a drop shadow, without assembling multiple layer styles by hand. Use outline_style="die_cut" when they ask for a die-cut / double-line sticker.\n' +
        'Do NOT use when: the user wants a single plain effect — use photoshop_apply_layer_style. Do NOT use when: the layer must first be isolated — use photoshop_recipe_remove_background first when there is still a background.\n' +
        '\n' +
        'Returns: { ok, summary, undo_history_states_consumed, details: { outline_style, layer_name, stroke_width, stroke_position, stroke_rgb, shadow, border_layer?, line_layer? } }.\n' +
        '\n' +
        'Preconditions: active document with a non-group active layer (pixel, text, or smart object). The white stroke defaults to 12px outside. die_cut forces the stroke outside and adds two layers named "<layer> - white border" and "<layer> - dark line".\n' +
        'Side effects: single sets the stroke (and adds/removes the drop shadow) on the active layer, preserving other existing effects. die_cut adds two stroked copies (original layer untouched on top). One undo reverts everything.',
      inputSchema: {
        type: 'object',
        properties: {
          red: {
            type: 'number',
            description: 'Stroke color red (0-255, default 255 = white)',
            minimum: 0,
            maximum: 255,
            default: 255,
          },
          green: {
            type: 'number',
            description: 'Stroke color green (0-255, default 255 = white)',
            minimum: 0,
            maximum: 255,
            default: 255,
          },
          blue: {
            type: 'number',
            description: 'Stroke color blue (0-255, default 255 = white)',
            minimum: 0,
            maximum: 255,
            default: 255,
          },
          stroke_width: {
            type: 'number',
            description: 'Stroke width in pixels (default 12)',
            minimum: 0,
            maximum: 250,
            default: 12,
          },
          stroke_opacity: {
            type: 'number',
            description: 'Stroke opacity (0-100, default 100)',
            minimum: 0,
            maximum: 100,
            default: 100,
          },
          stroke_position: {
            type: 'string',
            description:
              'Where the stroke sits relative to the layer edge: outside (default sticker look), inside, or center.',
            enum: [...STROKE_POSITIONS],
            default: 'outside',
          },
          shadow: {
            type: 'boolean',
            description: 'Add a soft drop shadow under the sticker (default true).',
            default: true,
          },
          shadow_opacity: {
            type: 'number',
            description: 'Drop shadow opacity (0-100, default 40)',
            minimum: 0,
            maximum: 100,
            default: 40,
          },
          shadow_size: {
            type: 'number',
            description: 'Drop shadow blur in pixels (default 12)',
            minimum: 0,
            maximum: 250,
            default: 12,
          },
          shadow_distance: {
            type: 'number',
            description: 'Drop shadow offset distance in pixels (default 6)',
            minimum: 0,
            maximum: 250,
            default: 6,
          },
          shadow_angle: {
            type: 'number',
            description: 'Drop shadow light angle in degrees (default 120)',
            minimum: -360,
            maximum: 360,
            default: 120,
          },
          outline_style: {
            type: 'string',
            description:
              "single (default): white border + optional shadow on the active layer. die_cut: the classic double outline — a white border plus a thin dark outer line — built by adding two stroked copies of the active layer (the original stays on top; stroke_position is forced to 'outside').",
            enum: [...OUTLINE_STYLES],
            default: 'single',
          },
          line_width: {
            type: 'number',
            description: 'die_cut only: thickness of the dark outer line in pixels (default 3)',
            minimum: 0,
            maximum: 100,
            default: 3,
          },
          line_red: {
            type: 'number',
            description: 'die_cut only: dark line color red (0-255, default 0 = black)',
            minimum: 0,
            maximum: 255,
            default: 0,
          },
          line_green: {
            type: 'number',
            description: 'die_cut only: dark line color green (0-255, default 0 = black)',
            minimum: 0,
            maximum: 255,
            default: 0,
          },
          line_blue: {
            type: 'number',
            description: 'die_cut only: dark line color blue (0-255, default 0 = black)',
            minimum: 0,
            maximum: 255,
            default: 0,
          },
        },
      },
    },
    handler: async (args) => runStickerOutline(connection, args),
  };
}

async function runStickerOutline(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const red = clampInt(args.red, 0, 255, 255);
  const green = clampInt(args.green, 0, 255, 255);
  const blue = clampInt(args.blue, 0, 255, 255);
  const strokeWidth = clampInt(args.stroke_width, 0, 250, 12);
  const strokeOpacity = clampInt(args.stroke_opacity, 0, 100, 100);
  const position = parseStrokePosition(args.stroke_position);
  const frameStyle = FRAME_STYLE_BY_POSITION[position];
  const shadow = args.shadow === undefined ? true : Boolean(args.shadow);
  const shadowOpacity = clampInt(args.shadow_opacity, 0, 100, 40);
  const shadowSize = clampInt(args.shadow_size, 0, 250, 12);
  const shadowDistance = clampInt(args.shadow_distance, 0, 250, 6);
  const shadowAngle = clampInt(args.shadow_angle, -360, 360, 120);
  const outlineStyle = parseOutlineStyle(args.outline_style);
  const lineWidth = clampInt(args.line_width, 0, 100, 3);
  const lineRed = clampInt(args.line_red, 0, 255, 0);
  const lineGreen = clampInt(args.line_green, 0, 255, 0);
  const lineBlue = clampInt(args.line_blue, 0, 255, 0);

  const body = `
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    if (!layer) {
      return { ok: false, code: 'no_active_layer', message: 'No active layer', suggested_next_tool: 'photoshop_get_state' };
    }
    if (layer.typename === 'LayerSet') {
      return { ok: false, code: 'active_is_group', message: 'Active item is a layer group — select a pixel, text, or smart-object layer first.', suggested_next_tool: 'photoshop_get_state' };
    }

    // ---- die_cut: white border + thin dark outer line via two stroked copies ----
    if ('${outlineStyle}' === 'die_cut') {
      app.displayDialogs = DialogModes.NO;

      function __mcp_dc_rgb(r, g, b) {
        var c = new ActionDescriptor();
        c.putDouble(cTID('Rd  '), r);
        c.putDouble(cTID('Grn '), g);
        c.putDouble(cTID('Bl  '), b);
        return c;
      }
      function __mcp_dc_stroke(width, r, g, b, opacity) {
        var fx = new ActionDescriptor();
        fx.putBoolean(cTID('enab'), true);
        fx.putEnumerated(sTID('style'), sTID('frameStyle'), sTID('outsetFrame'));
        fx.putEnumerated(sTID('paintType'), sTID('frameFill'), sTID('solidColor'));
        fx.putEnumerated(cTID('Md  '), cTID('BlnM'), cTID('Nrml'));
        fx.putUnitDouble(cTID('Opct'), cTID('#Prc'), opacity);
        fx.putUnitDouble(cTID('Sz  '), cTID('#Pxl'), width);
        fx.putObject(cTID('Clr '), cTID('RGBC'), __mcp_dc_rgb(r, g, b));
        fx.putBoolean(sTID('overprint'), false);
        return fx;
      }
      function __mcp_dc_shadow(opacity, size, distance, angle) {
        var sh = new ActionDescriptor();
        sh.putBoolean(cTID('enab'), true);
        sh.putEnumerated(cTID('Md  '), cTID('BlnM'), cTID('Mltp'));
        sh.putObject(cTID('Clr '), cTID('RGBC'), __mcp_dc_rgb(0, 0, 0));
        sh.putUnitDouble(cTID('Opct'), cTID('#Prc'), opacity);
        sh.putBoolean(cTID('uglg'), false);
        sh.putUnitDouble(cTID('lagl'), cTID('#Ang'), angle);
        sh.putUnitDouble(cTID('Dstn'), cTID('#Pxl'), distance);
        sh.putUnitDouble(cTID('Ckmt'), cTID('#Pxl'), 0);
        sh.putUnitDouble(cTID('blur'), cTID('#Pxl'), size);
        sh.putUnitDouble(cTID('Nose'), cTID('#Prc'), 0);
        sh.putBoolean(cTID('AntA'), false);
        sh.putBoolean(sTID('layerConceals'), true);
        return sh;
      }
      function __mcp_dc_apply(effects) {
        var desc = new ActionDescriptor();
        var setRef = new ActionReference();
        setRef.putProperty(cTID('Prpr'), cTID('Lefx'));
        setRef.putEnumerated(cTID('Lyr '), cTID('Ordn'), cTID('Trgt'));
        desc.putReference(cTID('null'), setRef);
        desc.putObject(cTID('T   '), cTID('Lefx'), effects);
        executeAction(cTID('setd'), desc, DialogModes.NO);
      }

      var original = layer;
      var whiteCopy = original.duplicate();
      whiteCopy.name = original.name + ' - white border';
      var darkCopy = original.duplicate();
      darkCopy.name = original.name + ' - dark line';

      // Stack top -> bottom: original, whiteCopy (white border), darkCopy (thick dark line).
      try { darkCopy.move(original, ElementPlacement.PLACEAFTER); } catch (eDcMove1) {}
      try { whiteCopy.move(original, ElementPlacement.PLACEAFTER); } catch (eDcMove2) {}

      var whiteFx = new ActionDescriptor();
      whiteFx.putUnitDouble(cTID('Scl '), cTID('#Prc'), 100);
      whiteFx.putObject(sTID('frameFX'), sTID('frameFX'), __mcp_dc_stroke(${strokeWidth}, ${red}, ${green}, ${blue}, ${strokeOpacity}));
      doc.activeLayer = whiteCopy;
      __mcp_dc_apply(whiteFx);

      var darkFx = new ActionDescriptor();
      darkFx.putUnitDouble(cTID('Scl '), cTID('#Prc'), 100);
      darkFx.putObject(sTID('frameFX'), sTID('frameFX'), __mcp_dc_stroke(${strokeWidth + lineWidth}, ${lineRed}, ${lineGreen}, ${lineBlue}, ${strokeOpacity}));
      if (${shadow ? 'true' : 'false'}) {
        darkFx.putObject(cTID('DrSh'), cTID('DrSh'), __mcp_dc_shadow(${shadowOpacity}, ${shadowSize}, ${shadowDistance}, ${shadowAngle}));
      }
      doc.activeLayer = darkCopy;
      __mcp_dc_apply(darkFx);

      doc.activeLayer = original;

      return {
        ok: true,
        summary: 'Die-cut sticker applied: ${strokeWidth}px white border + ${lineWidth}px dark line' + (${shadow ? 'true' : 'false'} ? ' + drop shadow' : ''),
        undo_history_states_consumed: 1,
        next_suggested_tool: 'photoshop_get_preview',
        details: {
          outline_style: 'die_cut',
          layer_name: original.name,
          stroke_width: ${strokeWidth},
          stroke_position: 'outside',
          stroke_rgb: [${red}, ${green}, ${blue}],
          line_width: ${lineWidth},
          line_rgb: [${lineRed}, ${lineGreen}, ${lineBlue}],
          shadow: ${shadow ? 'true' : 'false'},
          border_layer: whiteCopy.name,
          line_layer: darkCopy.name
        }
      };
    }

    app.displayDialogs = DialogModes.NO;

    function __mcp_sticker_rgb(r, g, b) {
      var c = new ActionDescriptor();
      c.putDouble(cTID('Rd  '), r);
      c.putDouble(cTID('Grn '), g);
      c.putDouble(cTID('Bl  '), b);
      return c;
    }

    // Build a fresh Lefx descriptor (reliable) and carry over any unrelated effects the layer
    // already had (glow, bevel, color overlay…). Only the stroke and the drop shadow are owned
    // by this recipe — a pre-existing drop shadow is intentionally replaced.
    var existing = new ActionDescriptor();
    var getRef = new ActionReference();
    getRef.putProperty(cTID('Prpr'), cTID('Lefx'));
    getRef.putEnumerated(cTID('Lyr '), cTID('Ordn'), cTID('Trgt'));
    var currentEffects = executeActionGet(getRef);
    if (currentEffects.hasKey(cTID('Lefx'))) {
      existing = currentEffects.getObjectValue(cTID('Lefx'));
    }

    var effects = new ActionDescriptor();
    effects.putUnitDouble(cTID('Scl '), cTID('#Prc'), 100);

    var __mcp_preserve = ['IrSh', 'OrGl', 'IrGl', 'ebbl', 'SoFi', 'ClrO', 'GrFl', 'PtFl'];
    for (var __mcp_i = 0; __mcp_i < __mcp_preserve.length; __mcp_i++) {
      var __mcp_pid = cTID(__mcp_preserve[__mcp_i]);
      if (existing.hasKey(__mcp_pid)) {
        effects.putObject(__mcp_pid, __mcp_pid, existing.getObjectValue(__mcp_pid));
      }
    }

    var strokeFx = new ActionDescriptor();
    strokeFx.putBoolean(cTID('enab'), true);
    strokeFx.putEnumerated(sTID('style'), sTID('frameStyle'), sTID('${frameStyle}'));
    strokeFx.putEnumerated(sTID('paintType'), sTID('frameFill'), sTID('solidColor'));
    strokeFx.putEnumerated(cTID('Md  '), cTID('BlnM'), cTID('Nrml'));
    strokeFx.putUnitDouble(cTID('Opct'), cTID('#Prc'), ${strokeOpacity});
    strokeFx.putUnitDouble(cTID('Sz  '), cTID('#Pxl'), ${strokeWidth});
    strokeFx.putObject(cTID('Clr '), cTID('RGBC'), __mcp_sticker_rgb(${red}, ${green}, ${blue}));
    strokeFx.putBoolean(sTID('overprint'), false);
    effects.putObject(sTID('frameFX'), sTID('frameFX'), strokeFx);

    if (${shadow ? 'true' : 'false'}) {
      var sh = new ActionDescriptor();
      sh.putBoolean(cTID('enab'), true);
      sh.putEnumerated(cTID('Md  '), cTID('BlnM'), cTID('Mltp'));
      sh.putObject(cTID('Clr '), cTID('RGBC'), __mcp_sticker_rgb(0, 0, 0));
      sh.putUnitDouble(cTID('Opct'), cTID('#Prc'), ${shadowOpacity});
      sh.putBoolean(cTID('uglg'), false);
      sh.putUnitDouble(cTID('lagl'), cTID('#Ang'), ${shadowAngle});
      sh.putUnitDouble(cTID('Dstn'), cTID('#Pxl'), ${shadowDistance});
      sh.putUnitDouble(cTID('Ckmt'), cTID('#Pxl'), 0);
      sh.putUnitDouble(cTID('blur'), cTID('#Pxl'), ${shadowSize});
      sh.putUnitDouble(cTID('Nose'), cTID('#Prc'), 0);
      sh.putBoolean(cTID('AntA'), false);
      sh.putBoolean(sTID('layerConceals'), true);
      effects.putObject(cTID('DrSh'), cTID('DrSh'), sh);
    }
    // shadow=false: DrSh is simply not carried over, so any pre-existing drop shadow is removed.

    var desc = new ActionDescriptor();
    var setRef = new ActionReference();
    setRef.putProperty(cTID('Prpr'), cTID('Lefx'));
    setRef.putEnumerated(cTID('Lyr '), cTID('Ordn'), cTID('Trgt'));
    desc.putReference(cTID('null'), setRef);
    desc.putObject(cTID('T   '), cTID('Lefx'), effects);
    executeAction(cTID('setd'), desc, DialogModes.NO);

    return {
      ok: true,
      summary: 'Sticker outline applied: ${strokeWidth}px ${position} stroke' + (${shadow ? 'true' : 'false'} ? ' + drop shadow' : ''),
      undo_history_states_consumed: 1,
      next_suggested_tool: 'photoshop_get_preview',
      details: {
        outline_style: 'single',
        layer_name: layer.name,
        stroke_width: ${strokeWidth},
        stroke_position: '${position}',
        stroke_rgb: [${red}, ${green}, ${blue}],
        shadow: ${shadow ? 'true' : 'false'}
      }
    };
  `;

  return executeRecipe(connection, 'Sticker Outline', body);
}

function parseStrokePosition(raw: unknown): StrokePosition {
  if (typeof raw !== 'string') return 'outside';
  const v = raw.trim().toLowerCase();
  return STROKE_POSITIONS.find((o) => o === v) ?? 'outside';
}

function parseOutlineStyle(raw: unknown): OutlineStyle {
  if (typeof raw !== 'string') return 'single';
  const v = raw.trim().toLowerCase();
  return OUTLINE_STYLES.find((o) => o === v) ?? 'single';
}
