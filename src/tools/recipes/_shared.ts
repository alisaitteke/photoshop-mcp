import type { ToolResult } from '../../core/tool-registry.js';
import type { PhotoshopConnection } from '../../platform/connection.js';
import {
  MCP_CURVES_ADJUSTMENT_HELPER,
  MCP_LAYER_MASK_HELPERS,
  type GradientMaskDirection,
} from '../../api/extendscript.js';
import { PhotoshopAPIFactory } from '../../api/photoshop-api.js';
import { parseExtendScriptPayload } from '../../utils/extendscript-result.js';

export interface RecipeSuccess {
  ok: true;
  summary: string;
  created_layer_ids?: number[];
  output_paths?: string[];
  next_suggested_tool?: string;
  undo_history_states_consumed: number;
  details?: Record<string, unknown>;
}

export interface RecipeFailure {
  ok: false;
  code: string;
  message: string;
  suggested_next_tool?: string;
}

/** PS 26-compatible Action Manager helpers shared by all recipes. */
export const RECIPE_ACTION_HELPERS = `
function __mcp_s2t(s) { return app.stringIDToTypeID(s); }
function __mcp_c2t(s) { return app.charIDToTypeID(s); }
function cTID(s) { return __mcp_c2t(s); }
function sTID(s) { return __mcp_s2t(s); }

function __mcp_ensureRasterActiveLayer() {
  var doc = app.activeDocument;
  var layer = doc.activeLayer;
  if (layer.typename === 'LayerSet') {
    throw new Error('Active item is a layer group — select a raster layer first.');
  }
  var kind = layer.kind;
  if (kind === LayerKind.NORMAL) {
    if (layer.isBackgroundLayer) {
      try { layer.isBackgroundLayer = false; } catch (eBg) {}
    }
    return layer;
  }
  if (kind === LayerKind.TEXT) {
    layer.rasterize(RasterizeType.TEXTCONTENTS);
    return doc.activeLayer;
  }
  if (kind === LayerKind.SMARTOBJECT) {
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated(__mcp_s2t('layer'), __mcp_s2t('ordinal'), __mcp_s2t('targetEnum'));
    desc.putReference(__mcp_s2t('null'), ref);
    executeAction(__mcp_s2t('rasterizePlaced'), desc, DialogModes.NO);
    return doc.activeLayer;
  }
  try { layer.rasterize(RasterizeType.ENTIRELAYER); } catch (e) {}
  return doc.activeLayer;
}

function __mcp_applyFrequencyHighFromLow(lowLayer, highLayer) {
  var doc = app.activeDocument;
  doc.activeLayer = highLayer;

  function applyStringCalculation() {
    var applyDesc = new ActionDescriptor();
    var calcDesc = new ActionDescriptor();
    var srcRef = new ActionReference();
    srcRef.putEnumerated(__mcp_s2t('channel'), __mcp_s2t('channel'), __mcp_s2t('RGB'));
    srcRef.putName(__mcp_s2t('layer'), lowLayer.name);
    calcDesc.putReference(__mcp_s2t('to'), srcRef);
    calcDesc.putEnumerated(__mcp_s2t('calculation'), __mcp_s2t('calculationType'), __mcp_s2t('subtract'));
    calcDesc.putDouble(__mcp_s2t('scale'), 2);
    calcDesc.putInteger(__mcp_s2t('offset'), 128);
    applyDesc.putObject(__mcp_s2t('with'), __mcp_s2t('calculation'), calcDesc);
    executeAction(__mcp_s2t('applyImageEvent'), applyDesc, DialogModes.NO);
  }

  function applyNestedClcl() {
    var applyDesc = new ActionDescriptor();
    var srcDesc = new ActionDescriptor();
    var srcRef = new ActionReference();
    srcRef.putName(__mcp_c2t('Lyr '), lowLayer.name);
    srcDesc.putReference(__mcp_c2t('T   '), srcRef);
    srcDesc.putEnumerated(__mcp_c2t('Clcl'), __mcp_c2t('Clcn'), __mcp_c2t('Sbtr'));
    srcDesc.putInteger(__mcp_c2t('Scl '), 2);
    srcDesc.putInteger(__mcp_c2t('Ofst'), 128);
    applyDesc.putObject(__mcp_c2t('With'), __mcp_c2t('Clcl'), srcDesc);
    executeAction(__mcp_c2t('AppI'), applyDesc, DialogModes.NO);
  }

  var lastError = null;
  try {
    applyStringCalculation();
    return;
  } catch (eString) {
    lastError = eString;
  }
  try {
    applyNestedClcl();
    return;
  } catch (eNested) {
    lastError = eNested;
  }
  throw lastError || new Error('Apply Image failed');
}

function __mcp_makeLayerMaskRevealSelection() {
  var desc = new ActionDescriptor();
  desc.putClass(__mcp_s2t('new'), __mcp_s2t('channel'));
  var atRef = new ActionReference();
  atRef.putEnumerated(__mcp_s2t('layer'), __mcp_s2t('ordinal'), __mcp_s2t('targetEnum'));
  desc.putReference(__mcp_s2t('at'), atRef);
  desc.putEnumerated(__mcp_s2t('using'), __mcp_s2t('userMaskEnabled'), __mcp_s2t('revealSelection'));
  executeAction(__mcp_s2t('make'), desc, DialogModes.NO);
}

function __mcp_makeHueSatAdjustmentLayer(hue, saturation, lightness, colorize) {
  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putClass(__mcp_s2t('adjustmentLayer'));
  desc.putReference(__mcp_s2t('null'), ref);
  var using = new ActionDescriptor();
  var typeDesc = new ActionDescriptor();
  typeDesc.putEnumerated(__mcp_s2t('presetKind'), __mcp_s2t('presetKindType'), __mcp_s2t('presetKindCustom'));
  typeDesc.putBoolean(__mcp_c2t('Clrz'), colorize);
  var adjustments = new ActionList();
  var adjustment = new ActionDescriptor();
  adjustment.putInteger(__mcp_c2t('H   '), hue);
  adjustment.putInteger(__mcp_c2t('Strt'), saturation);
  adjustment.putInteger(__mcp_c2t('Lght'), lightness);
  adjustments.putObject(__mcp_c2t('Hsrt'), adjustment);
  typeDesc.putList(__mcp_c2t('Adjs'), adjustments);
  using.putObject(__mcp_s2t('type'), __mcp_s2t('hueSaturation'), typeDesc);
  desc.putObject(__mcp_s2t('using'), __mcp_s2t('adjustmentLayer'), using);
  executeAction(__mcp_s2t('make'), desc, DialogModes.NO);
  return app.activeDocument.activeLayer;
}

${MCP_CURVES_ADJUSTMENT_HELPER}

${MCP_LAYER_MASK_HELPERS}
`;

const EXTENDSCRIPT_JSON_HELPER = `
function __mcp_json_stringify(value) {
  if (value === null) return 'null';
  var t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') return isFinite(value) ? String(value) : 'null';
  if (t === 'string') {
    return '"' + value
      .replace(/\\\\/g, '\\\\\\\\')
      .replace(/"/g, '\\\\"')
      .replace(/\\n/g, '\\\\n')
      .replace(/\\r/g, '\\\\r')
      .replace(/\\t/g, '\\\\t') + '"';
  }
  if (value instanceof Array) {
    var items = [];
    for (var i = 0; i < value.length; i++) {
      items.push(__mcp_json_stringify(value[i]));
    }
    return '[' + items.join(',') + ']';
  }
  if (t === 'object') {
    var pairs = [];
    for (var key in value) {
      if (!value.hasOwnProperty(key)) continue;
      pairs.push(__mcp_json_stringify(String(key)) + ':' + __mcp_json_stringify(value[key]));
    }
    return '{' + pairs.join(',') + '}';
  }
  return 'null';
}
`;

export function wrapInSuspendHistory(historyName: string, body: string): string {
  const escapedName = historyName.replace(/"/g, '\\"');
  return `
    ${RECIPE_ACTION_HELPERS}
    ${EXTENDSCRIPT_JSON_HELPER}
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var __mcp_recipe_doc = app.activeDocument;
    var __mcp_recipe_result = null;
    var __mcp_recipe_fn = function() {
      ${body}
    };
    __mcp_recipe_doc.suspendHistory(
      "${escapedName}",
      "try { __mcp_recipe_result = __mcp_recipe_fn(); } catch (eRecipe) { __mcp_recipe_result = { ok: false, code: 'recipe_runtime_error', message: eRecipe.message || String(eRecipe) }; }"
    );
    if (!__mcp_recipe_result) {
      __mcp_recipe_result = { ok: false, code: 'recipe_no_result', message: 'Recipe produced no result' };
    }
    return __mcp_json_stringify(__mcp_recipe_result);
  `;
}

/**
 * Standalone wrapper for recipes that do NOT operate on the active document
 * (e.g. batch jobs that open/close their own documents). No suspendHistory,
 * no active-document precondition.
 */
export function wrapInStandaloneScript(body: string): string {
  return `
    ${RECIPE_ACTION_HELPERS}
    ${EXTENDSCRIPT_JSON_HELPER}
    var __mcp_recipe_result = null;
    var __mcp_recipe_fn = function() {
      ${body}
    };
    try {
      __mcp_recipe_result = __mcp_recipe_fn();
    } catch (eRecipe) {
      __mcp_recipe_result = { ok: false, code: 'recipe_runtime_error', message: eRecipe.message || String(eRecipe) };
    }
    if (!__mcp_recipe_result) {
      __mcp_recipe_result = { ok: false, code: 'recipe_no_result', message: 'Recipe produced no result' };
    }
    return __mcp_json_stringify(__mcp_recipe_result);
  `;
}

export function parseRecipeResult(raw: unknown): RecipeSuccess | RecipeFailure | null {
  const payload = parseExtendScriptPayload(raw);
  if (payload === null || typeof payload !== 'object') return null;
  const rec = payload as Record<string, unknown>;
  if (rec.ok === true) {
    return {
      ok: true,
      summary: typeof rec.summary === 'string' ? rec.summary : 'Recipe completed',
      created_layer_ids: Array.isArray(rec.created_layer_ids)
        ? (rec.created_layer_ids as number[])
        : undefined,
      output_paths: Array.isArray(rec.output_paths) ? (rec.output_paths as string[]) : undefined,
      next_suggested_tool:
        typeof rec.next_suggested_tool === 'string' ? rec.next_suggested_tool : undefined,
      undo_history_states_consumed:
        typeof rec.undo_history_states_consumed === 'number' ? rec.undo_history_states_consumed : 1,
      details:
        rec.details && typeof rec.details === 'object'
          ? (rec.details as Record<string, unknown>)
          : undefined,
    };
  }
  if (rec.ok === false) {
    return {
      ok: false,
      code: typeof rec.code === 'string' ? rec.code : 'recipe_unknown_error',
      message: typeof rec.message === 'string' ? rec.message : 'Unknown recipe error',
      suggested_next_tool:
        typeof rec.suggested_next_tool === 'string' ? rec.suggested_next_tool : undefined,
    };
  }
  return null;
}

export function toolSuccess(result: RecipeSuccess): ToolResult {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}

export function toolFailure(result: RecipeFailure): ToolResult {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    isError: true,
  };
}

export function toolException(error: unknown, code = 'recipe_exception'): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return toolFailure({ ok: false, code, message });
}

export async function executeRecipe(
  connection: PhotoshopConnection,
  historyName: string,
  body: string
): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();
    const script = wrapInSuspendHistory(historyName, body);
    const raw = await api.executeScript(script);
    const parsed = parseRecipeResult(raw);
    if (!parsed) {
      return toolFailure({
        ok: false,
        code: 'recipe_no_result',
        message: `Recipe returned an unparseable payload: ${typeof raw === 'string' ? raw : JSON.stringify(raw)}`,
      });
    }
    return parsed.ok ? toolSuccess(parsed) : toolFailure(parsed);
  } catch (error) {
    return toolException(error);
  }
}

/** Like executeRecipe but without suspendHistory or an active-document requirement. */
export async function executeStandaloneRecipe(
  connection: PhotoshopConnection,
  body: string
): Promise<ToolResult> {
  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();
    const script = wrapInStandaloneScript(body);
    const raw = await api.executeScript(script);
    const parsed = parseRecipeResult(raw);
    if (!parsed) {
      return toolFailure({
        ok: false,
        code: 'recipe_no_result',
        message: `Recipe returned an unparseable payload: ${typeof raw === 'string' ? raw : JSON.stringify(raw)}`,
      });
    }
    return parsed.ok ? toolSuccess(parsed) : toolFailure(parsed);
  } catch (error) {
    return toolException(error);
  }
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export { jsString } from '../../utils/js-string.js';

export function gradientMaskAxisPercents(
  direction: GradientMaskDirection,
  startPct: number,
  endPct: number
): { fromH: number; fromV: number; toH: number; toV: number; reverse: boolean } {
  const gradientEndpoints: Record<
    GradientMaskDirection,
    { fromH: number; fromV: number; toH: number; toV: number; reverse: boolean }
  > = {
    bottom_to_top: { fromH: 50, fromV: endPct, toH: 50, toV: startPct, reverse: false },
    top_to_bottom: { fromH: 50, fromV: startPct, toH: 50, toV: endPct, reverse: false },
    left_to_right: { fromH: startPct, fromV: 50, toH: endPct, toV: 50, reverse: false },
    right_to_left: { fromH: endPct, fromV: 50, toH: startPct, toV: 50, reverse: false },
  };
  return gradientEndpoints[direction];
}

export function gradientMaskDefaultAngle(direction: GradientMaskDirection): number {
  return direction === 'left_to_right' || direction === 'right_to_left' ? 0 : 90;
}
