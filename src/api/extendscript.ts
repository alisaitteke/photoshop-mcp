/**
 * Helper functions for ExtendScript API
 * ExtendScript is the legacy scripting API for Photoshop
 */

import { jsString, jsStringLiteral } from '../utils/js-string.js';

/**
 * Helper functions for character/string ID conversion
 */
const helperFunctions = `
function cTID(s) { return app.charIDToTypeID(s); }
function sTID(s) { return app.stringIDToTypeID(s); }
`;

/**
 * Artboard helpers — ExtendScript DOM has no Artboard class; they are LayerSets
 * with Action Manager keys artboardEnabled + artboardRect.
 * @see https://developer.adobe.com/photoshop/uxp/2022/ps-reference/classes/document (document.artboards, 22.5+)
 * @see https://community.adobe.com/questions-712/action-manager-scripting-1094053
 * @see https://graphicdesign.stackexchange.com/questions/122658/scripting-artboards-names-in-photoshop
 */
const artboardHelpers = `
function __mcp_amNumber(desc, key) {
  try { return desc.getDouble(key); } catch (eDouble) {}
  try { return desc.getUnitDoubleValue(key); } catch (eUnit) {}
  return 0;
}

function __mcp_unlockBackgroundIfNeeded() {
  try {
    var bg = app.activeDocument.backgroundLayer;
    if (bg) bg.isBackgroundLayer = false;
  } catch (eBg) {}
}

function __mcp_listArtboards() {
  var artboards = [];
  if (app.documents.length === 0) return artboards;
  var s2t = stringIDToTypeID;
  var count = 0;
  try {
    var refCount = new ActionReference();
    refCount.putProperty(s2t('property'), s2t('numberOfLayers'));
    refCount.putEnumerated(s2t('document'), s2t('ordinal'), s2t('targetEnum'));
    count = executeActionGet(refCount).getInteger(s2t('numberOfLayers'));
  } catch (eCount) {
    return artboards;
  }

  var activeArtboardId = __mcp_activeArtboardId();

  for (var i = 1; i <= count; i++) {
    try {
      var refAb = new ActionReference();
      refAb.putProperty(s2t('property'), s2t('artboardEnabled'));
      refAb.putIndex(s2t('layer'), i);
      var descAb = executeActionGet(refAb);
      if (!descAb.hasKey(s2t('artboardEnabled')) || !descAb.getBoolean(s2t('artboardEnabled'))) {
        continue;
      }

      var refId = new ActionReference();
      refId.putProperty(s2t('property'), s2t('layerID'));
      refId.putIndex(s2t('layer'), i);
      var id = executeActionGet(refId).getInteger(s2t('layerID'));

      var refName = new ActionReference();
      refName.putProperty(s2t('property'), s2t('name'));
      refName.putIndex(s2t('layer'), i);
      var name = executeActionGet(refName).getString(s2t('name'));

      var refRect = new ActionReference();
      refRect.putProperty(s2t('property'), s2t('artboard'));
      refRect.putIndex(s2t('layer'), i);
      var rect = executeActionGet(refRect).getObjectValue(s2t('artboard')).getObjectValue(s2t('artboardRect'));
      var left = __mcp_amNumber(rect, s2t('left'));
      var top = __mcp_amNumber(rect, s2t('top'));
      var right = __mcp_amNumber(rect, s2t('right'));
      var bottom = __mcp_amNumber(rect, s2t('bottom'));

      artboards.push({
        id: id,
        name: name,
        left: left,
        top: top,
        right: right,
        bottom: bottom,
        width: right - left,
        height: bottom - top,
        is_active: activeArtboardId !== null && id === activeArtboardId
      });
    } catch (eSkip) {}
  }
  return artboards;
}

function __mcp_isArtboardId(id) {
  try {
    var s2t = stringIDToTypeID;
    var ref = new ActionReference();
    ref.putProperty(s2t('property'), s2t('artboardEnabled'));
    ref.putIdentifier(s2t('layer'), id);
    var desc = executeActionGet(ref);
    return desc.hasKey(s2t('artboardEnabled')) && desc.getBoolean(s2t('artboardEnabled'));
  } catch (e) {
    return false;
  }
}

function __mcp_activeArtboardId() {
  try {
    var layer = app.activeDocument.activeLayer;
    while (layer) {
      try {
        if (layer.typename === 'LayerSet' && __mcp_isArtboardId(layer.id)) {
          return layer.id;
        }
      } catch (eKind) {}
      try {
        if (!layer.parent || layer.parent.typename === 'Document') break;
        layer = layer.parent;
      } catch (eParent) {
        break;
      }
    }
  } catch (eActive) {}
  return null;
}

function __mcp_findArtboard(artboardId, artboardName) {
  var abs = __mcp_listArtboards();
  if (typeof artboardId === 'number') {
    for (var i = 0; i < abs.length; i++) {
      if (abs[i].id === artboardId) return abs[i];
    }
    return null;
  }
  if (artboardName) {
    var matches = [];
    for (var j = 0; j < abs.length; j++) {
      if (abs[j].name === artboardName) matches.push(abs[j]);
    }
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      return { ambiguous: true, count: matches.length, name: artboardName };
    }
  }
  return null;
}

function __mcp_selectLayerById(id) {
  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putIdentifier(stringIDToTypeID('layer'), id);
  desc.putReference(charIDToTypeID('null'), ref);
  desc.putBoolean(charIDToTypeID('MkVs'), false);
  executeAction(charIDToTypeID('slct'), desc, DialogModes.NO);
}

function __mcp_nextArtboardOrigin() {
  var abs = __mcp_listArtboards();
  if (abs.length === 0) {
    return { left: 0, top: 0 };
  }
  var maxRight = abs[0].right;
  var minTop = abs[0].top;
  for (var i = 1; i < abs.length; i++) {
    if (abs[i].right > maxRight) maxRight = abs[i].right;
    if (abs[i].top < minTop) minTop = abs[i].top;
  }
  return { left: maxRight + 32, top: minTop };
}

function __mcp_makeArtboard(left, top, right, bottom, name) {
  var s2t = stringIDToTypeID;
  var c2t = charIDToTypeID;
  function putName(desc) {
    if (!name) return;
    var using = new ActionDescriptor();
    using.putString(c2t('Nm  '), name);
    desc.putObject(c2t('Usng'), s2t('artboardSection'), using);
  }
  try {
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(s2t('artboardSection'));
    desc.putReference(s2t('null'), ref);
    putName(desc);
    var rect = new ActionDescriptor();
    rect.putDouble(s2t('top'), top);
    rect.putDouble(s2t('left'), left);
    rect.putDouble(s2t('bottom'), bottom);
    rect.putDouble(s2t('right'), right);
    desc.putObject(s2t('artboardRect'), s2t('classFloatRect'), rect);
    executeAction(s2t('make'), desc, DialogModes.NO);
    return;
  } catch (eFloat) {}

  var desc2 = new ActionDescriptor();
  var ref2 = new ActionReference();
  ref2.putClass(s2t('artboardSection'));
  desc2.putReference(s2t('null'), ref2);
  putName(desc2);
  var rect2 = new ActionDescriptor();
  rect2.putUnitDouble(c2t('Top '), c2t('#Pxl'), top);
  rect2.putUnitDouble(c2t('Left'), c2t('#Pxl'), left);
  rect2.putUnitDouble(c2t('Btom'), c2t('#Pxl'), bottom);
  rect2.putUnitDouble(c2t('Rght'), c2t('#Pxl'), right);
  desc2.putObject(s2t('artboardRect'), s2t('rectangle'), rect2);
  executeAction(s2t('make'), desc2, DialogModes.NO);
}

function __mcp_safeFileName(name) {
  var s = String(name);
  var out = '';
  var bad = '\\/:*?"<>|';
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    out += bad.indexOf(ch) >= 0 ? '_' : ch;
  }
  return out;
}

function __mcp_duplicateCropToArtboard(ab) {
  var dup = app.activeDocument.duplicate();
  var w = dup.width.as('px');
  var h = dup.height.as('px');
  var left = Math.max(0, Math.min(w - 1, ab.left));
  var top = Math.max(0, Math.min(h - 1, ab.top));
  var right = Math.max(left + 1, Math.min(w, ab.right));
  var bottom = Math.max(top + 1, Math.min(h, ab.bottom));
  dup.crop([
    new UnitValue(left, 'px'),
    new UnitValue(top, 'px'),
    new UnitValue(right, 'px'),
    new UnitValue(bottom, 'px')
  ]);
  return dup;
}

function __mcp_exportDoc(doc, outFile, format, quality) {
  app.displayDialogs = DialogModes.NO;
  if (format === 'PNG' || format === 'JPEG') {
    var opts = new ExportOptionsSaveForWeb();
    if (format === 'PNG') {
      opts.format = SaveDocumentType.PNG;
      opts.PNG8 = false;
    } else {
      opts.format = SaveDocumentType.JPEG;
      opts.quality = quality;
    }
    doc.exportDocument(outFile, ExportType.SAVEFORWEB, opts);
    return { ok: true, method: 'save_for_web' };
  }
  var saveCandidates = format === 'WEBP'
    ? ['WebPSaveOptions']
    : ['AVIFSaveOptions', 'AvifSaveOptions'];
  var lastError = '';
  for (var c = 0; c < saveCandidates.length; c++) {
    try {
      var opts2 = eval('new ' + saveCandidates[c] + '()');
      try { opts2.quality = quality; } catch (eQ) {}
      doc.saveAs(outFile, opts2, true, Extension.LOWERCASE);
      return { ok: true, method: 'native_save_as' };
    } catch (eSave) {
      lastError = eSave.message || String(eSave);
    }
  }
  return {
    ok: false,
    code: 'version_unsupported',
    message: format + ' export not available in this Photoshop build: ' + lastError,
    suggested_next_tool: 'photoshop_save_document'
  };
}
`;

/**
 * Selection helpers shared by getSelectionBounds and selection modifier snippets.
 * @see https://stackoverflow.com/questions/41552883/determine-if-selection-is-present
 * @see https://www.indesignjs.de/extendscriptAPI/photoshop-latest/Selection.html
 */
const selectionHelpers = `
function __mcp_hasSelection() {
  var ref10 = new ActionReference();
  ref10.putProperty(sTID('property'), sTID('selection'));
  ref10.putEnumerated(cTID('Dcmn'), cTID('Ordn'), cTID('Trgt'));
  var docDesc = executeActionGet(ref10);
  return docDesc.hasKey(sTID('selection'));
}

function __mcp_requireSelection() {
  if (!__mcp_hasSelection()) {
    return { ok: false, code: 'selection_required', message: 'Active pixel selection required' };
  }
  return null;
}

function __mcp_modifySelection(charId, pixels) {
  var desc = new ActionDescriptor();
  var key = charId === 'Fthr' ? 'Rds ' : 'By  ';
  desc.putUnitDouble(cTID(key), cTID('#Pxl'), pixels);
  executeAction(cTID(charId), desc, DialogModes.NO);
}

function __mcp_selectRect(left, top, right, bottom, mode) {
  var modifier = mode || 'replace';
  if (modifier === 'replace') {
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putProperty(cTID('Chnl'), cTID('fsel'));
    desc.putReference(cTID('null'), ref);
    var rect = new ActionDescriptor();
    rect.putUnitDouble(cTID('Top '), cTID('#Pxl'), top);
    rect.putUnitDouble(cTID('Left'), cTID('#Pxl'), left);
    rect.putUnitDouble(cTID('Btom'), cTID('#Pxl'), bottom);
    rect.putUnitDouble(cTID('Rght'), cTID('#Pxl'), right);
    desc.putObject(cTID('T   '), cTID('Rctn'), rect);
    desc.putBoolean(cTID('AntA'), true);
    executeAction(cTID('setd'), desc, DialogModes.NO);
    return;
  }

  var typeName = modifier === 'add' ? 'EXTEND' : (modifier === 'subtract' ? 'DIMINISH' : 'INTERSECT');
  var selType = null;
  try {
    if (typeof SelectionType !== 'undefined') selType = SelectionType[typeName];
  } catch (eEnum) {}
  if (!selType) {
    throw new Error('SelectionType.' + typeName + ' is not available');
  }
  var pts = [[left, top], [right, top], [right, bottom], [left, bottom]];
  app.activeDocument.selection.select(pts, selType, 0, true);
}

function __mcp_readSelectionBounds(doc) {
  try {
    var b = doc.selection.bounds;
    var left = b[0].as('px');
    var top = b[1].as('px');
    var right = b[2].as('px');
    var bottom = b[3].as('px');
    return {
      left: left,
      top: top,
      right: right,
      bottom: bottom,
      width: right - left,
      height: bottom - top
    };
  } catch (eBounds) {
    return null;
  }
}
`;

/**
 * Shared guard for filter snippets that require a raster (non-background) layer.
 */
const filterLayerHelpers = `
function __mcp_requireFilterableLayer(layer) {
  if (layer.isBackgroundLayer) {
    return {
      ok: false,
      code: 'background_layer',
      message: 'Cannot apply filters to the Background layer — convert to a normal layer first (photoshop_rasterize_layer).',
      suggested_next_tool: 'photoshop_rasterize_layer'
    };
  }
  if (layer.kind === LayerKind.TEXT || layer.kind === LayerKind.SMARTOBJECT) {
    return {
      ok: false,
      code: 'layer_not_raster',
      message: 'Cannot apply filters to text or Smart Object layers — rasterize first (photoshop_rasterize_layer).',
      suggested_next_tool: 'photoshop_rasterize_layer'
    };
  }
  if (layer.kind !== LayerKind.NORMAL) {
    return {
      ok: false,
      code: 'layer_not_raster',
      message: 'Can only apply filters to normal (raster) layers. Layer kind: ' + layer.kind + '. Rasterize first (photoshop_rasterize_layer).',
      suggested_next_tool: 'photoshop_rasterize_layer'
    };
  }
  return null;
}
`;

/**
 * Resolve a display or PostScript font name to the PostScript name required by TextItem.font.
 * @see https://theiviaxx.github.io/photoshop-docs/Photoshop/TextItem/font.html
 * @see https://theiviaxx.github.io/photoshop-docs/Photoshop/TextFont.html
 */
const resolveFontPostScriptName = `
function resolveFontPostScriptName(name) {
  for (var i = 0; i < app.fonts.length; i++) {
    var f = app.fonts[i];
    try {
      if (f.postScriptName === name || f.name === name) {
        return f.postScriptName;
      }
    } catch (e) {}
  }
  return null;
}
`;

/**
 * Layer-wide TextItem style (tracking/leading/paragraph box) plus AM textStyleRange
 * for mixed font/color in one layer. DOM covers Photoshop 2020+; ranges use setd/TxLr.
 */
const textStyleHelpers = `
function __mcp_unitAs(value, unit) {
  try { return value.as(unit); } catch (eAs) {}
  try { return Number(value); } catch (eNum) {}
  return null;
}

function __mcp_justificationName(j) {
  try {
    if (j === Justification.LEFT) return 'LEFT';
    if (j === Justification.CENTER) return 'CENTER';
    if (j === Justification.RIGHT) return 'RIGHT';
    if (j === Justification.LEFTJUSTIFIED) return 'LEFTJUSTIFIED';
    if (j === Justification.CENTERJUSTIFIED) return 'CENTERJUSTIFIED';
    if (j === Justification.RIGHTJUSTIFIED) return 'RIGHTJUSTIFIED';
    if (j === Justification.FULLYJUSTIFIED) return 'FULLYJUSTIFIED';
  } catch (eJust) {}
  return String(j);
}

function __mcp_textKindName(k) {
  try {
    if (k === TextType.PARAGRAPHTEXT) return 'paragraph';
  } catch (eKind) {}
  return 'point';
}

function __mcp_requireTextLayer() {
  if (app.documents.length === 0) {
    throw new Error('No active document');
  }
  var layer = app.activeDocument.activeLayer;
  if (!layer || layer.kind !== LayerKind.TEXT) {
    throw new Error('Active layer is not a text layer');
  }
  return layer;
}

function __mcp_readTextStyle(t) {
  var out = {
    contents: '',
    font: null,
    size: null,
    tracking: null,
    auto_leading: false,
    leading: null,
    kind: 'point',
    box_width: null,
    box_height: null,
    alignment: 'LEFT',
    red: null,
    green: null,
    blue: null
  };
  try { out.contents = String(t.contents); } catch (eContents) {}
  try { out.font = t.font; } catch (eFont) {}
  try { out.size = __mcp_unitAs(t.size, 'pt'); } catch (eSize) {}
  try { out.tracking = t.tracking; } catch (eTrack) {}
  try {
    var useAuto = false;
    try { useAuto = !!t.useAutoLeading; } catch (eUse) {
      try { useAuto = !!t.autoLeading; } catch (eAuto) {}
    }
    out.auto_leading = useAuto;
  } catch (eAutoLead) {}
  try {
    var leadVal = t.leading;
    var leadNum = null;
    try { leadNum = leadVal.as('pt'); } catch (eAsPt) {}
    if (leadNum === null || isNaN(leadNum)) {
      try { leadNum = leadVal.value; } catch (eVal) {}
    }
    if (leadNum === null || isNaN(leadNum)) {
      leadNum = Number(leadVal);
    }
    if (!isNaN(leadNum)) out.leading = leadNum;
  } catch (eLead) {}
  try { out.kind = __mcp_textKindName(t.kind); } catch (eKind) {}
  if (out.kind === 'paragraph') {
    try { out.box_width = __mcp_unitAs(t.width, 'px'); } catch (eW) {}
    try { out.box_height = __mcp_unitAs(t.height, 'px'); } catch (eH) {}
  }
  try { out.alignment = __mcp_justificationName(t.justification); } catch (eAlign) {}
  try {
    out.red = Math.round(t.color.rgb.red);
    out.green = Math.round(t.color.rgb.green);
    out.blue = Math.round(t.color.rgb.blue);
  } catch (eColor) {}
  return out;
}

function __mcp_applyTextStyle(t, opts) {
  if (!opts) return;
  if (opts.font) {
    var ps = resolveFontPostScriptName(opts.font);
    if (!ps) throw new Error('font_not_found: ' + opts.font);
    t.font = ps;
  }
  if (opts.size !== undefined && opts.size !== null) {
    t.size = opts.size;
  }
  if (opts.tracking !== undefined && opts.tracking !== null) {
    t.tracking = opts.tracking;
  }
  var kind = opts.kind;
  if (!kind && (opts.box_width || opts.box_height)) kind = 'paragraph';
  if (kind === 'paragraph') {
    t.kind = TextType.PARAGRAPHTEXT;
    if (opts.box_width) t.width = new UnitValue(opts.box_width, 'px');
    if (opts.box_height) t.height = new UnitValue(opts.box_height, 'px');
  } else if (kind === 'point') {
    t.kind = TextType.POINTTEXT;
  }
  if (opts.auto_leading === true) {
    try { t.useAutoLeading = true; } catch (eUseOn) {}
    try { t.autoLeading = true; } catch (eAutoOn) {}
  } else if (opts.leading !== undefined && opts.leading !== null) {
    try { t.useAutoLeading = false; } catch (eUseOff) {}
    try { t.autoLeading = false; } catch (eAutoOff) {}
    try {
      t.leading = opts.leading;
    } catch (eLeadNum) {
      t.leading = new UnitValue(opts.leading, 'pt');
    }
  }
  if (opts.alignment) {
    t.justification = Justification[opts.alignment];
  }
  if (opts.red !== undefined && opts.red !== null) {
    var color = new SolidColor();
    color.rgb.red = opts.red;
    color.rgb.green = opts.green;
    color.rgb.blue = opts.blue;
    t.color = color;
  }
}

function __mcp_defaultRangeStyle(t) {
  var d = {
    font: null,
    size: 12,
    red: 0,
    green: 0,
    blue: 0
  };
  try { d.font = t.font; } catch (eFont) {}
  try {
    var sz = __mcp_unitAs(t.size, 'pt');
    if (sz !== null && !isNaN(sz)) d.size = sz;
  } catch (eSize) {}
  try {
    d.red = Math.round(t.color.rgb.red);
    d.green = Math.round(t.color.rgb.green);
    d.blue = Math.round(t.color.rgb.blue);
  } catch (eColor) {}
  return d;
}

function __mcp_putRangeStyle(st, font, size, red, green, blue) {
  var s2t = stringIDToTypeID;
  var c2t = charIDToTypeID;
  if (font) st.putString(s2t('fontPostScriptName'), font);
  if (size !== undefined && size !== null) {
    st.putUnitDouble(c2t('Sz  '), c2t('#Pnt'), size);
  }
  if (red !== undefined && red !== null) {
    var col = new ActionDescriptor();
    col.putDouble(c2t('Rd  '), red);
    col.putDouble(c2t('Grn '), green);
    col.putDouble(c2t('Bl  '), blue);
    st.putObject(c2t('Clr '), c2t('RGBC'), col);
  }
}

function __mcp_setTextRanges(ranges) {
  var layer = __mcp_requireTextLayer();
  var t = layer.textItem;
  var snap = __mcp_readTextStyle(t);
  var contents = String(t.contents);
  var len = contents.length;
  var def = __mcp_defaultRangeStyle(t);
  var covering = [];
  var cursor = 0;
  var i;
  for (i = 0; i < ranges.length; i++) {
    var r = ranges[i];
    var from = r.from;
    var to = r.to;
    if (from > len) continue;
    if (to > len) to = len;
    if (to <= from) continue;
    if (from > cursor) {
      covering.push({ from: cursor, to: from, font: def.font, size: def.size, red: def.red, green: def.green, blue: def.blue });
    }
    var spanFont = def.font;
    if (r.font) {
      spanFont = resolveFontPostScriptName(r.font);
      if (!spanFont) throw new Error('font_not_found: ' + r.font);
    }
    covering.push({
      from: from,
      to: to,
      font: spanFont,
      size: r.size !== undefined && r.size !== null ? r.size : def.size,
      red: r.red !== undefined && r.red !== null ? r.red : def.red,
      green: r.green !== undefined && r.green !== null ? r.green : def.green,
      blue: r.blue !== undefined && r.blue !== null ? r.blue : def.blue
    });
    cursor = to;
  }
  if (cursor < len) {
    covering.push({ from: cursor, to: len, font: def.font, size: def.size, red: def.red, green: def.green, blue: def.blue });
  }

  var c2t = charIDToTypeID;
  var textDesc = new ActionDescriptor();
  textDesc.putString(c2t('Txt '), contents);
  var list = new ActionList();
  for (i = 0; i < covering.length; i++) {
    var span = covering[i];
    var rd = new ActionDescriptor();
    rd.putInteger(c2t('From'), span.from);
    rd.putInteger(c2t('T   '), span.to);
    var st = new ActionDescriptor();
    __mcp_putRangeStyle(st, span.font, span.size, span.red, span.green, span.blue);
    rd.putObject(c2t('TxtS'), c2t('TxtS'), st);
    list.putObject(c2t('Txtt'), rd);
  }
  textDesc.putList(c2t('Txtt'), list);

  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putEnumerated(c2t('TxLr'), c2t('Ordn'), c2t('Trgt'));
  desc.putReference(c2t('null'), ref);
  desc.putObject(c2t('T   '), c2t('TxLr'), textDesc);
  executeAction(c2t('setd'), desc, DialogModes.NO);

  t = app.activeDocument.activeLayer.textItem;
  __mcp_applyTextStyle(t, {
    tracking: snap.tracking,
    leading: snap.leading,
    auto_leading: snap.auto_leading,
    kind: snap.kind,
    box_width: snap.box_width,
    box_height: snap.box_height,
    alignment: snap.alignment
  });
  return { style: __mcp_readTextStyle(t), ranges: covering };
}

function __mcp_readTextRanges() {
  var s2t = stringIDToTypeID;
  var ranges = [];
  try {
    var ref = new ActionReference();
    ref.putProperty(s2t('property'), s2t('textKey'));
    ref.putEnumerated(s2t('layer'), s2t('ordinal'), s2t('targetEnum'));
    var desc = executeActionGet(ref);
    if (!desc.hasKey(s2t('textKey'))) return ranges;
    var textKey = desc.getObjectValue(s2t('textKey'));
    if (!textKey.hasKey(s2t('textStyleRange'))) return ranges;
    var list = textKey.getList(s2t('textStyleRange'));
    for (var i = 0; i < list.count; i++) {
      var item = list.getObjectValue(i);
      var from = item.getInteger(s2t('from'));
      var to = item.getInteger(s2t('to'));
      var entry = { from: from, to: to, font: null, size: null, red: null, green: null, blue: null };
      if (item.hasKey(s2t('textStyle'))) {
        var st = item.getObjectValue(s2t('textStyle'));
        try {
          if (st.hasKey(s2t('fontPostScriptName'))) entry.font = st.getString(s2t('fontPostScriptName'));
        } catch (eFont) {}
        try {
          if (st.hasKey(s2t('size'))) entry.size = st.getUnitDoubleValue(s2t('size'));
        } catch (eSize) {}
        try {
          if (st.hasKey(s2t('color'))) {
            var col = st.getObjectValue(s2t('color'));
            entry.red = Math.round(col.getDouble(s2t('red')));
            entry.green = Math.round(col.getDouble(s2t('green')));
            entry.blue = Math.round(col.getDouble(s2t('blue')));
          }
        } catch (eCol) {}
      }
      ranges.push(entry);
    }
  } catch (eRead) {}
  return ranges;
}
`;

/**
 * Helper function to get current context information
 */
const getContextInfo = `
function getContextInfo() {
  var context = {
    hasDocument: app.documents.length > 0,
    openDocumentCount: app.documents.length
  };
  
  if (context.hasDocument) {
    var doc = null;
    try {
      doc = app.activeDocument;
    } catch (e) {
      doc = null;
    }

    if (doc) {
      context.document = {};
      try { context.document.id = doc.id; } catch (e) {}
      try { context.document.name = doc.name; } catch (e) {}
      try { context.document.width = doc.width.as('px'); } catch (e) {}
      try { context.document.height = doc.height.as('px'); } catch (e) {}
      try { context.document.resolution = doc.resolution; } catch (e) {}
      try { context.document.colorMode = String(doc.mode); } catch (e) {}
      try { context.document.layerCount = doc.layers.length; } catch (e) {}
      try {
        context.document.hasSelection = !!(doc.selection && doc.selection.bounds);
      } catch (e) {
        // ExtendScript throws "No such element" when there is no active selection
        context.document.hasSelection = false;
      }

      try {
        if (doc.activeLayer) {
          var layer = doc.activeLayer;
          context.activeLayer = {
            name: layer.name,
            kind: String(layer.kind),
            opacity: layer.opacity,
            blendMode: String(layer.blendMode),
            visible: layer.visible,
            locked: layer.allLocked
          };
          try {
            context.activeLayer.isBackground = layer.isBackgroundLayer;
          } catch (e) {
            context.activeLayer.isBackground = false;
          }
          try {
            var bounds = layer.bounds;
            context.activeLayer.bounds = {
              left: bounds[0].as('px'),
              top: bounds[1].as('px'),
              right: bounds[2].as('px'),
              bottom: bounds[3].as('px')
            };
          } catch (e) {
            // Bounds not available for some layer types
          }
        }
      } catch (e) {
        context.activeLayer = null;
      }
    }
  }
  
  return context;
}
`;

/** Curves adjustment layer helper — shared by atomics and recipes (uses __mcp_s2t / __mcp_c2t). */
export const MCP_CURVES_ADJUSTMENT_HELPER = `
function __mcp_makeCurvesAdjustmentLayer(preset) {
  var usePreset = preset || 'auto_tone';
  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putClass(__mcp_s2t('adjustmentLayer'));
  desc.putReference(__mcp_s2t('null'), ref);
  var using = new ActionDescriptor();
  var curvesAdjust = new ActionDescriptor();
  var curvesAdjustments = new ActionList();
  var curvesPair = new ActionDescriptor();
  var curvesPoints = new ActionList();
  var ptBlack = new ActionDescriptor();
  var ptWhite = new ActionDescriptor();
  if (usePreset === 'neutral') {
    ptBlack.putDouble(__mcp_c2t('Hrzn'), 0);
    ptBlack.putDouble(__mcp_c2t('Vrtc'), 0);
    ptWhite.putDouble(__mcp_c2t('Hrzn'), 255);
    ptWhite.putDouble(__mcp_c2t('Vrtc'), 255);
  } else {
    ptBlack.putDouble(__mcp_c2t('Hrzn'), 12);
    ptBlack.putDouble(__mcp_c2t('Vrtc'), 0);
    ptWhite.putDouble(__mcp_c2t('Hrzn'), 243);
    ptWhite.putDouble(__mcp_c2t('Vrtc'), 255);
  }
  curvesPoints.putObject(__mcp_c2t('Pnt '), ptBlack);
  curvesPoints.putObject(__mcp_c2t('Pnt '), ptWhite);
  curvesPair.putList(__mcp_c2t('Crv '), curvesPoints);
  var channelRef = new ActionReference();
  channelRef.putEnumerated(__mcp_c2t('Chnl'), __mcp_c2t('Chnl'), __mcp_c2t('Cmps'));
  curvesPair.putReference(__mcp_c2t('Chnl'), channelRef);
  curvesAdjustments.putObject(__mcp_c2t('CrvA'), curvesPair);
  curvesAdjust.putList(__mcp_c2t('Adjs'), curvesAdjustments);
  using.putObject(__mcp_s2t('type'), __mcp_s2t('curves'), curvesAdjust);
  desc.putObject(__mcp_s2t('using'), __mcp_s2t('adjustmentLayer'), using);
  executeAction(__mcp_s2t('make'), desc, DialogModes.NO);
  return app.activeDocument.activeLayer;
}
`;

const mcpActionHelperAliases = `
function __mcp_s2t(s) { return sTID(s); }
function __mcp_c2t(s) { return cTID(s); }
`;

/**
 * Layer mask helpers — Adobe Community / StackSupport.jsx patterns.
 * @see https://community.adobe.com/t5/photoshop-ecosystem-discussions/is-it-possible-to-make-a-layer-mask-with-the-current-selection-using-extendscript/td-p/10872052
 * @see https://github.com/LeZuse/photoshop-scripts/blob/master/default/Stack%20Scripts%20Only/StackSupport.jsx
 */
/**
 * Smart Object helpers — newPlacedLayer, placedLayerReplaceContents, placedLayerEditContents,
 * placedLayerMakeCopy (Adobe Community, Photopea, laryn gist, c.pfaffenbichler).
 * Requires `helperFunctions` (cTID/sTID) in the enclosing script.
 */
export const MCP_SMART_OBJECT_HELPERS = `
function __mcp_findLayer(container, name) {
  for (var i = 0; i < container.layers.length; i++) {
    var l = container.layers[i];
    if (l.name === name) return l;
  }
  for (var j = 0; j < container.layerSets.length; j++) {
    var nested = __mcp_findLayer(container.layerSets[j], name);
    if (nested) return nested;
  }
  return null;
}

function __mcp_activateLayerByName(layerName) {
  var doc = app.activeDocument;
  if (!layerName) {
    if (!doc.activeLayer) {
      return { ok: false, code: 'layer_not_found', message: 'No active layer' };
    }
    return { ok: true, layer: doc.activeLayer };
  }
  var target = __mcp_findLayer(doc, layerName);
  if (!target) {
    return {
      ok: false,
      code: 'layer_not_found',
      message: 'Layer not found: ' + layerName,
      suggested_next_tool: 'photoshop_get_layers'
    };
  }
  doc.activeLayer = target;
  return { ok: true, layer: target };
}

function __mcp_replaceSmartObjectContents(filePath) {
  var layer = app.activeDocument.activeLayer;
  if (layer.kind !== LayerKind.SMARTOBJECT) {
    return {
      ok: false,
      code: 'unsupported_layer_kind',
      message: 'Target layer "' + layer.name + '" is not a Smart Object (kind=' + layer.kind + ').',
      suggested_next_tool: 'photoshop_get_layers'
    };
  }
  var assetFile = new File(filePath);
  if (!assetFile.exists) {
    return { ok: false, code: 'file_not_found', message: 'Replacement file not found: ' + filePath };
  }
  var replaceDesc = new ActionDescriptor();
  replaceDesc.putPath(cTID('null'), assetFile);
  replaceDesc.putInteger(cTID('PgNm'), 1);
  executeAction(sTID('placedLayerReplaceContents'), replaceDesc, DialogModes.NO);
  return {
    ok: true,
    layerName: app.activeDocument.activeLayer.name,
    filePath: filePath
  };
}
`;

export const MCP_LAYER_MASK_HELPERS = `
function __mcp_hasLayerMaskAM() {
  var ref = new ActionReference();
  var args = new ActionDescriptor();
  ref.putProperty(cTID('Prpr'), cTID('UsrM'));
  ref.putEnumerated(cTID('Lyr '), cTID('Ordn'), cTID('Trgt'));
  args.putReference(cTID('null'), ref);
  try {
    var resultDesc = executeAction(cTID('getd'), args, DialogModes.NO);
    return resultDesc.hasKey(cTID('UsrM'));
  } catch (e) {
    return false;
  }
}

function __mcp_makeLayerMaskAtChannel(maskMode) {
  var desc = new ActionDescriptor();
  var atRef = new ActionReference();
  desc.putClass(sTID('new'), sTID('channel'));
  atRef.putEnumerated(sTID('channel'), sTID('channel'), sTID('mask'));
  desc.putReference(sTID('at'), atRef);
  desc.putEnumerated(sTID('using'), sTID('userMaskEnabled'), sTID(maskMode));
  executeAction(sTID('make'), desc, DialogModes.NO);
}

function __mcp_selectLayerMaskChannel() {
  var selRef = new ActionReference();
  selRef.putEnumerated(cTID('Chnl'), cTID('Ordn'), cTID('Trgt'));
  var selDesc = new ActionDescriptor();
  selDesc.putReference(cTID('null'), selRef);
  selDesc.putBoolean(cTID('MkVs'), true);
  executeAction(cTID('slct'), selDesc, DialogModes.NO);
}

function __mcp_pointDescPx(x, y) {
  var desc = new ActionDescriptor();
  desc.putUnitDouble(cTID('Hrzn'), cTID('#Pxl'), x);
  desc.putUnitDouble(cTID('Vrtc'), cTID('#Pxl'), y);
  return desc;
}

function __mcp_gradientStop(location, midPoint) {
  var desc = new ActionDescriptor();
  desc.putInteger(cTID('Lctn'), location);
  desc.putInteger(cTID('Mdpn'), midPoint);
  return desc;
}

function __mcp_grayColor(grayValue) {
  var desc = new ActionDescriptor();
  desc.putDouble(cTID('Gry '), grayValue);
  return desc;
}

/** Linear black-to-white gradient on the active mask channel (StackSupport.jsx pattern). */
function __mcp_gradientFillLayerMask(fromXPx, fromYPx, toXPx, toYPx, reverseGradient) {
  var args = new ActionDescriptor();
  args.putObject(cTID('From'), cTID('Pnt '), __mcp_pointDescPx(fromXPx, fromYPx));
  args.putObject(cTID('T   '), cTID('Pnt '), __mcp_pointDescPx(toXPx, toYPx));
  args.putEnumerated(cTID('Md  '), cTID('BlnM'), cTID('Nrml'));
  args.putEnumerated(cTID('Type'), cTID('GrdT'), cTID('Lnr '));
  args.putBoolean(cTID('Dthr'), true);
  args.putBoolean(cTID('UsMs'), true);
  args.putBoolean(cTID('Rvrs'), !!reverseGradient);

  var gradDesc = new ActionDescriptor();
  gradDesc.putString(cTID('Nm  '), 'Black, White');
  gradDesc.putEnumerated(cTID('GrdF'), cTID('GrdF'), cTID('CstS'));
  gradDesc.putDouble(cTID('Intr'), 4096.0);

  var colorList = new ActionList();
  var stopWhite = __mcp_gradientStop(0, 50);
  stopWhite.putObject(cTID('Clr '), cTID('Grsc'), __mcp_grayColor(100.0));
  stopWhite.putEnumerated(cTID('Type'), cTID('Clry'), cTID('UsrS'));
  colorList.putObject(cTID('Clrt'), stopWhite);
  var stopBlack = __mcp_gradientStop(4096, 50);
  stopBlack.putObject(cTID('Clr '), cTID('Grsc'), __mcp_grayColor(0.0));
  stopBlack.putEnumerated(cTID('Type'), cTID('Clry'), cTID('UsrS'));
  colorList.putObject(cTID('Clrt'), stopBlack);
  gradDesc.putList(cTID('Clrs'), colorList);

  var xferList = new ActionList();
  var xferA = __mcp_gradientStop(0, 50);
  xferA.putUnitDouble(cTID('Opct'), cTID('#Prc'), 100.0);
  xferList.putObject(cTID('TrnS'), xferA);
  var xferB = __mcp_gradientStop(4096, 50);
  xferB.putUnitDouble(cTID('Opct'), cTID('#Prc'), 100.0);
  xferList.putObject(cTID('TrnS'), xferB);
  gradDesc.putList(cTID('Trns'), xferList);

  args.putObject(cTID('Grad'), cTID('Grdn'), gradDesc);
  executeAction(cTID('Grdn'), args, DialogModes.NO);
}
`;

/**
 * Clipping mask helpers — groupEvent AM create; grouped DOM release.
 * @see https://stackoverflow.com/questions/13842581/photoshop-js-script-to-create-and-apply-a-layer-mask
 * @see https://community.adobe.com/t5/photoshop-ecosystem-discussions/clipping-mask-script-issues-in-ps-2025-on-mac/td-p/1178313
 * @see https://www.ps-scripts.com/viewtopic.php?t=10955 (layer.grouped property)
 */
export const MCP_CLIPPING_MASK_HELPERS = `
function __mcp_getLayerBelow(layer) {
  var container = layer.parent;
  var stack = container.layers;
  for (var i = 0; i < stack.length; i++) {
    if (stack[i] === layer) {
      if (i >= stack.length - 1) return null;
      return stack[i + 1];
    }
  }
  return null;
}

function __mcp_createClippingMaskAM() {
  var desc = new ActionDescriptor();
  var ref = new ActionReference();
  ref.putEnumerated(sTID('layer'), sTID('ordinal'), sTID('targetEnum'));
  desc.putReference(sTID('null'), ref);
  executeAction(sTID('groupEvent'), desc, DialogModes.NO);
}
`;

export type CurvesPreset = 'auto_tone' | 'neutral';

export type GradientMaskDirection =
  | 'top_to_bottom'
  | 'bottom_to_top'
  | 'left_to_right'
  | 'right_to_left';

/**
 * Common ExtendScript snippets
 */
export const ExtendScriptSnippets = {
  /**
   * Get Photoshop application info
   */
  getAppInfo: () => `
    return {
      name: app.name,
      version: app.version,
      build: app.build
    };
  `,

  /**
   * Create a new document
   */
  newDocument: (width: number, height: number, resolution = 72, colorMode = 'NewDocumentMode.RGB') => `
    var doc = app.documents.add(
      UnitValue(${width}, 'px'),
      UnitValue(${height}, 'px'),
      ${resolution},
      'New Document',
      ${colorMode}
    );
    return { id: doc.id, name: doc.name };
  `,

  /**
   * Get active document info
   */
  getDocumentInfo: () => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    
    var context = getContextInfo();
    return context;
  `,

  /**
   * List all open documents (read-only).
   * @see https://developer.adobe.com/photoshop/uxp/ps_reference/classes/documents/
   */
  listDocuments: () => `
    ${helperFunctions}
    ${artboardHelpers}
    ${getContextInfo}

    var docs = [];
    var activeId = null;
    try {
      if (app.documents.length > 0) {
        activeId = app.activeDocument.id;
      }
    } catch (eActive) {
      activeId = null;
    }

    for (var i = 0; i < app.documents.length; i++) {
      var d = app.documents[i];
      var entry = {
        id: d.id,
        name: d.name,
        is_active: false,
        artboard_count: 0,
        saved: null
      };
      try { entry.width = d.width.as('px'); } catch (eW) {}
      try { entry.height = d.height.as('px'); } catch (eH) {}
      try { entry.resolution = d.resolution; } catch (eR) {}
      try { entry.is_active = activeId !== null && d.id === activeId; } catch (eA) {}
      try { entry.saved = d.saved; } catch (eS) {}
      try {
        app.activeDocument = d;
        entry.artboard_count = __mcp_listArtboards().length;
      } catch (eAb) {
        entry.artboard_count = 0;
      }
      docs.push(entry);
    }

    if (activeId !== null) {
      for (var r = 0; r < app.documents.length; r++) {
        if (app.documents[r].id === activeId) {
          try { app.activeDocument = app.documents[r]; } catch (eRest) {}
          break;
        }
      }
    }

    return {
      ok: true,
      count: docs.length,
      documents: docs,
      active_document_id: activeId,
      context: getContextInfo()
    };
  `,

  /**
   * Activate an open document by id, tab index, or name.
   * @see https://stackoverflow.com/questions/4537506/how-to-switch-between-open-documents-in-photoshop-using-javascript
   */
  setActiveDocument: (params: {
    documentId?: number;
    documentName?: string;
    index?: number;
  }) => {
    let modeBlock = '';
    if (params.documentId !== undefined) {
      modeBlock = `var __mode = 'id'; var __targetId = ${params.documentId};`;
    } else if (params.index !== undefined) {
      modeBlock = `var __mode = 'index'; var __targetIndex = ${params.index};`;
    } else {
      modeBlock = `var __mode = 'name'; var __targetName = "${jsString(params.documentName!)}";`;
    }

    return `
    ${getContextInfo}
    ${modeBlock}

    var targetDoc = null;

    if (__mode === 'id') {
      for (var i = 0; i < app.documents.length; i++) {
        if (app.documents[i].id === __targetId) {
          targetDoc = app.documents[i];
          break;
        }
      }
      if (!targetDoc) {
        return {
          ok: false,
          code: 'document_not_found',
          message: 'No open document with id ' + __targetId
        };
      }
    } else if (__mode === 'index') {
      if (__targetIndex < 0 || __targetIndex >= app.documents.length) {
        return {
          ok: false,
          code: 'document_not_found',
          message: 'Document index out of range: ' + __targetIndex + ' (open count: ' + app.documents.length + ')'
        };
      }
      targetDoc = app.documents[__targetIndex];
    } else {
      var matches = [];
      for (var j = 0; j < app.documents.length; j++) {
        if (app.documents[j].name === __targetName) {
          matches.push(app.documents[j]);
        }
      }
      if (matches.length === 0) {
        return {
          ok: false,
          code: 'document_not_found',
          message: 'No open document named "' + __targetName + '"'
        };
      }
      if (matches.length > 1) {
        var matchIds = [];
        for (var k = 0; k < matches.length; k++) {
          matchIds.push(matches[k].id);
        }
        return {
          ok: false,
          code: 'ambiguous_name',
          message: 'Multiple open documents named "' + __targetName + '". Use document_id instead.',
          matching_document_ids: matchIds
        };
      }
      targetDoc = matches[0];
    }

    app.activeDocument = targetDoc;

    return {
      ok: true,
      activated: { id: targetDoc.id, name: targetDoc.name },
      context: getContextInfo()
    };
  `;
  },

  /**
   * Create a text layer
   */
  createTextLayer: (
    text: string,
    x = 100,
    y = 100,
    fontSize = 24,
    fontName?: string,
    styleLiteral = '{}'
  ) => `
    ${getContextInfo}
    ${resolveFontPostScriptName}
    ${textStyleHelpers}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var textLayer = doc.artLayers.add();
    textLayer.kind = LayerKind.TEXT;
    textLayer.textItem.contents = "${jsString(text)}";
    textLayer.textItem.position = [${x}, ${y}];
    textLayer.textItem.size = ${fontSize};
    ${fontName ? `
    var __psFont = resolveFontPostScriptName("${jsString(fontName)}");
    if (!__psFont) {
      throw new Error('font_not_found: ${jsString(fontName)}');
    }
    textLayer.textItem.font = __psFont;
    ` : ''}
    __mcp_applyTextStyle(textLayer.textItem, ${styleLiteral});
    
    var result = {
      created: true,
      layerName: textLayer.name,
      text: "${jsString(text)}",
      position: { x: ${x}, y: ${y} },
      fontSize: ${fontSize},
      ${fontName ? `font: textLayer.textItem.font,` : ''}
      style: __mcp_readTextStyle(textLayer.textItem),
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Place an image file as a layer.
   * x/y are absolute canvas coordinates for the placed layer's top-left bound
   * (not an offset from Photoshop's default centered Place).
   */
  placeImage: (filePath: string, x = 0, y = 0) => `
    ${helperFunctions}
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    
    var imageFile = new File("${jsString(filePath)}");
    if (!imageFile.exists) {
      throw new Error('Image file not found: ${jsString(filePath)}');
    }

    var targetX = ${x};
    var targetY = ${y};
    
    var desc = new ActionDescriptor();
    desc.putPath(cTID('null'), imageFile);
    desc.putEnumerated(cTID('FTcs'), cTID('QCSt'), cTID('Qcsa'));
    
    var offsetDesc = new ActionDescriptor();
    offsetDesc.putUnitDouble(cTID('Hrzn'), cTID('#Pxl'), 0);
    offsetDesc.putUnitDouble(cTID('Vrtc'), cTID('#Pxl'), 0);
    desc.putObject(cTID('Ofst'), cTID('Ofst'), offsetDesc);
    
    executeAction(cTID('Plc '), desc, DialogModes.NO);

    var layer = app.activeDocument.activeLayer;
    var placedBounds = layer.bounds;
    var left = placedBounds[0].as('px');
    var top = placedBounds[1].as('px');
    layer.translate(targetX - left, targetY - top);
    
    var result = {
      placed: true,
      filePath: "${jsString(filePath)}",
      position: { x: targetX, y: targetY, semantics: 'absolute_top_left' },
      context: getContextInfo()
    };
    try {
      result.layerName = layer.name;
      var bounds = layer.bounds;
      result.layerBounds = {
        left: bounds[0].as('px'),
        top: bounds[1].as('px'),
        width: bounds[2].as('px') - bounds[0].as('px'),
        height: bounds[3].as('px') - bounds[1].as('px')
      };
    } catch (e) {
      // Place succeeded; layer metadata is best-effort
    }
    return result;
  `,

  /**
   * Open an image file as a new document
   */
  openImage: (filePath: string) => `
    var imageFile = new File("${jsString(filePath)}");
    if (!imageFile.exists) {
      throw new Error('Image file not found: ${jsString(filePath)}');
    }
    
    var doc = app.open(imageFile);
    return {
      id: doc.id,
      name: doc.name,
      width: doc.width.as('px'),
      height: doc.height.as('px')
    };
  `,

  /**
   * Save document as PSD
   */
  saveAsPSD: (path: string) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var saveFile = new File("${path.replace(/\\/g, '\\\\')}");
    var psdOptions = new PhotoshopSaveOptions();
    psdOptions.embedColorProfile = true;
    doc.saveAs(saveFile, psdOptions, true);
    return { path: saveFile.fsName };
  `,

  /**
   * Save document as JPEG
   */
  saveAsJPEG: (path: string, quality = 8) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var saveFile = new File("${path.replace(/\\/g, '\\\\')}");
    var jpegOptions = new JPEGSaveOptions();
    jpegOptions.quality = ${quality};
    jpegOptions.embedColorProfile = true;
    doc.saveAs(saveFile, jpegOptions, true);
    return { path: saveFile.fsName };
  `,

  /**
   * Save document as PNG
   */
  saveAsPNG: (path: string) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var saveFile = new File("${path.replace(/\\/g, '\\\\')}");
    var pngOptions = new PNGSaveOptions();
    pngOptions.compression = 9;
    doc.saveAs(saveFile, pngOptions, true);
    return { path: saveFile.fsName };
  `,

  /**
   * Close active document
   */
  closeDocument: (save = false) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    doc.close(${save ? 'SaveOptions.SAVECHANGES' : 'SaveOptions.DONOTSAVECHANGES'});
    return { closed: true };
  `,

  /**
   * Create a new layer
   */
  newLayer: (name?: string) => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.artLayers.add();
    ${name ? `layer.name = "${jsString(name)}";` : ''}
    
    var result = { 
      created: true,
      layerName: layer.name,
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Delete active layer
   */
  deleteLayer: () => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    if (doc.activeLayer) {
      doc.activeLayer.remove();
      return { deleted: true };
    }
    throw new Error('No active layer');
  `,

  /**
   * Fill the active layer with a solid RGB color.
   *
   * ArtLayer has no fillPath() method (that exists on PathItem only).
   * The correct approach is Selection.fill(): preserve any existing
   * selection, otherwise select the whole canvas, fill, then deselect.
   * Background / fully-locked layers cannot be filled, so fail clearly.
   */
  fillLayer: (red: number, green: number, blue: number) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;

    if (layer.allLocked) {
      throw new Error('Cannot fill a fully locked layer: ' + layer.name);
    }
    if (layer.kind === LayerKind.TEXT) {
      throw new Error('Cannot fill a text layer. Rasterize it first.');
    }

    var color = new SolidColor();
    color.rgb.red = ${red};
    color.rgb.green = ${green};
    color.rgb.blue = ${blue};

    var hadSelection = false;
    try {
      hadSelection = doc.selection.bounds != null;
    } catch (e) {
      hadSelection = false;
    }

    if (!hadSelection) {
      doc.selection.selectAll();
    }
    doc.selection.fill(color);
    if (!hadSelection) {
      doc.selection.deselect();
    }

    return {
      filled: true,
      layerName: layer.name,
      color: { red: ${red}, green: ${green}, blue: ${blue} }
    };
  `,

  /**
   * Resize image
   */
  resizeImage: (width: number, height: number) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    doc.resizeImage(
      UnitValue(${width}, 'px'),
      UnitValue(${height}, 'px'),
      null,
      ResampleMethod.BICUBIC
    );
    return { 
      width: doc.width.as('px'), 
      height: doc.height.as('px') 
    };
  `,

  /**
   * Get all layer names
   */
  getLayerNames: () => `
    ${helperFunctions}
    ${artboardHelpers}
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layers = [];
    function collectLayers(container) {
      for (var i = 0; i < container.layers.length; i++) {
        var layer = container.layers[i];
        try {
          var entry = {
            name: layer.name,
            kind: String(layer.kind),
            visible: layer.visible,
            opacity: layer.opacity,
            blendMode: String(layer.blendMode),
            is_artboard: false
          };
          try {
            if (layer.typename === 'LayerSet') {
              entry.is_artboard = __mcp_isArtboardId(layer.id);
            }
          } catch (eAb) {}
          layers.push(entry);
        } catch (e) {
          var layerName = 'layer_' + layers.length;
          try { layerName = layer.name; } catch (e2) {}
          layers.push({ name: layerName, error: e.message || String(e) });
        }
        if (layer.typename === 'LayerSet') {
          collectLayers(layer);
        }
      }
    }
    collectLayers(doc);
    
    var result = {
      layerCount: layers.length,
      layers: layers,
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Select layer by name (recursive search including layer groups)
   */
  selectLayerByName: (name: string) => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var targetName = "${jsString(name)}";
    var target = null;
    function findLayer(container, name) {
      for (var i = 0; i < container.layers.length; i++) {
        var l = container.layers[i];
        if (l.name === name) return l;
      }
      for (var j = 0; j < container.layerSets.length; j++) {
        var nested = findLayer(container.layerSets[j], name);
        if (nested) return nested;
      }
      return null;
    }
    target = findLayer(doc, targetName);
    if (!target) {
      throw new Error('Layer not found: ' + targetName);
    }
    doc.activeLayer = target;
    var result = {
      selected: true,
      layerName: target.name,
      kind: String(target.kind),
      context: getContextInfo()
    };
    try {
      var b = target.bounds;
      result.bounds = {
        left: b[0].as('px'),
        top: b[1].as('px'),
        right: b[2].as('px'),
        bottom: b[3].as('px'),
        width: b[2].as('px') - b[0].as('px'),
        height: b[3].as('px') - b[1].as('px')
      };
    } catch (e) {}
    return result;
  `,

  /**
   * Scale active layer to fit document (maintain aspect ratio)
   */
  fitLayerToDocument: (fillDocument = false) => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    if (layer.isBackgroundLayer) {
      throw new Error('Cannot transform background layer');
    }
    
    // Get canvas dimensions
    var canvasWidth = doc.width.as('px');
    var canvasHeight = doc.height.as('px');
    
    // Get layer bounds
    var bounds = layer.bounds;
    var layerWidth = bounds[2].as('px') - bounds[0].as('px');
    var layerHeight = bounds[3].as('px') - bounds[1].as('px');
    
    // Calculate scale ratios
    var widthRatio = canvasWidth / layerWidth;
    var heightRatio = canvasHeight / layerHeight;
    
    // Choose scale factor based on fill or fit mode
    var scaleFactor;
    if (${fillDocument}) {
      // Fill: scale to cover entire canvas (may crop)
      scaleFactor = Math.max(widthRatio, heightRatio);
    } else {
      // Fit: scale to fit within canvas (may have margins)
      scaleFactor = Math.min(widthRatio, heightRatio);
    }
    
    // Apply scale
    var scalePercent = scaleFactor * 100;
    layer.resize(scalePercent, scalePercent, AnchorPosition.MIDDLECENTER);
    
    // Center the layer
    layer.translate(
      canvasWidth / 2 - (bounds[0].as('px') + layerWidth / 2),
      canvasHeight / 2 - (bounds[1].as('px') + layerHeight / 2)
    );
    
    var result = {
      fitted: true,
      mode: ${fillDocument} ? 'fill' : 'fit',
      originalSize: { width: layerWidth, height: layerHeight },
      newSize: { 
        width: layerWidth * scaleFactor, 
        height: layerHeight * scaleFactor 
      },
      scaleFactor: scaleFactor,
      scalePercent: scalePercent,
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Scale active layer by percentage
   */
  scaleLayer: (scalePercent: number, centerAnchor = true) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    if (layer.isBackgroundLayer) {
      throw new Error('Cannot transform background layer');
    }
    
    var anchor = ${centerAnchor ? 'AnchorPosition.MIDDLECENTER' : 'AnchorPosition.TOPLEFT'};
    layer.resize(${scalePercent}, ${scalePercent}, anchor);
    
    return { 
      scaled: true,
      percent: ${scalePercent}
    };
  `,

  /**
   * Move/translate active layer
   */
  moveLayer: (deltaX: number, deltaY: number) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    if (layer.isBackgroundLayer) {
      throw new Error('Cannot move background layer');
    }
    
    layer.translate(${deltaX}, ${deltaY});
    
    return { 
      moved: true,
      deltaX: ${deltaX},
      deltaY: ${deltaY}
    };
  `,

  /**
   * Rotate active layer
   */
  rotateLayer: (degrees: number) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    if (layer.isBackgroundLayer) {
      throw new Error('Cannot rotate background layer');
    }
    
    layer.rotate(${degrees}, AnchorPosition.MIDDLECENTER);
    
    return { 
      rotated: true,
      degrees: ${degrees}
    };
  `,

  /**
   * Set layer opacity
   */
  setLayerOpacity: (opacity: number) => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    layer.opacity = ${opacity};
    
    var result = { 
      updated: true,
      property: 'opacity',
      value: layer.opacity,
      layerName: layer.name,
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Set layer blend mode.
   * `blendMode` is an ExtendScript BlendMode identifier (e.g. COLORBLEND, not COLOR).
   * Darker Color / Lighter Color fall back to Action Manager when the DOM enum is absent.
   */
  setLayerBlendMode: (blendMode: string) => `
    ${helperFunctions}
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    var token = "${jsString(blendMode)}";
    var applied = false;
    try {
      if (typeof BlendMode !== 'undefined' && BlendMode[token] !== undefined) {
        layer.blendMode = BlendMode[token];
        applied = true;
      }
    } catch (eDom) {}
    if (!applied) {
      var amKey = {
        DARKERCOLOR: 'darkerColor',
        LIGHTERCOLOR: 'lighterColor',
        COLORBLEND: 'color',
        COLOR: 'color'
      }[token];
      if (!amKey) {
        throw new Error('Invalid enumeration value: BlendMode.' + token);
      }
      var desc = new ActionDescriptor();
      var ref = new ActionReference();
      ref.putEnumerated(cTID('Lyr '), cTID('Ordn'), cTID('Trgt'));
      desc.putReference(cTID('null'), ref);
      desc.putEnumerated(cTID('Md  '), cTID('BlnM'), sTID(amKey));
      executeAction(cTID('setd'), desc, DialogModes.NO);
    }
    
    var result = { 
      updated: true,
      property: 'blendMode',
      value: String(layer.blendMode),
      layerName: layer.name,
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Set layer visibility
   */
  setLayerVisibility: (visible: boolean) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    layer.visible = ${visible};
    
    return { 
      visible: layer.visible,
      name: layer.name
    };
  `,

  /**
   * Lock/unlock layer
   */
  setLayerLocked: (locked: boolean) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    layer.allLocked = ${locked};
    
    return { 
      locked: layer.allLocked,
      name: layer.name
    };
  `,

  /**
   * Rename active layer
   */
  renameLayer: (newName: string) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    var oldName = layer.name;
    layer.name = "${jsString(newName)}";
    
    return { 
      oldName: oldName,
      newName: layer.name
    };
  `,

  /**
   * Duplicate active layer.
   *
   * DOM layer.duplicate() does NOT activate the duplicate — the original
   * layer stays active, so without the explicit activeLayer assignment any
   * follow-up active-layer tool (masks, filters, transforms) would target
   * the original instead of the copy.
   */
  duplicateLayer: (newName?: string) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    var duplicated = layer.duplicate();
    ${newName ? `duplicated.name = "${jsString(newName)}";` : ''}
    doc.activeLayer = duplicated;
    
    var result = {
      originalName: layer.name,
      newName: duplicated.name,
      activated: true
    };
    try { result.newLayerId = duplicated.id; } catch (e) {}
    return result;
  `,

  /**
   * Merge visible layers
   */
  mergeVisibleLayers: () => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    doc.mergeVisibleLayers();
    
    return { 
      merged: true
    };
  `,

  /**
   * Flatten image (merge all layers)
   */
  flattenImage: () => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    doc.flatten();
    
    return { 
      flattened: true
    };
  `,

  /**
   * Apply Gaussian Blur filter
   */
  applyGaussianBlur: (radius: number) => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;
    var wasRasterized = false;
    
    // Auto-rasterize if needed
    if (layer.kind === LayerKind.TEXT || layer.kind === LayerKind.SMARTOBJECT) {
      layer.rasterize(RasterizeType.ENTIRELAYER);
      wasRasterized = true;
    }
    
    if (layer.kind !== LayerKind.NORMAL) {
      throw new Error('Can only apply filters to normal (raster) layers. Layer kind: ' + layer.kind);
    }
    
    layer.applyGaussianBlur(${radius});
    
    var result = { 
      applied: true,
      filter: 'Gaussian Blur',
      radius: ${radius},
      wasRasterized: wasRasterized,
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Apply Unsharp Mask (sharpen)
   */
  applyUnsharpMask: (amount: number, radius: number, threshold: number) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;
    
    // Auto-rasterize if needed
    if (layer.kind === LayerKind.TEXT || layer.kind === LayerKind.SMARTOBJECT) {
      layer.rasterize(RasterizeType.ENTIRELAYER);
    }
    
    if (layer.kind !== LayerKind.NORMAL) {
      throw new Error('Can only apply filters to normal (raster) layers');
    }
    
    layer.applyUnSharpMask(${amount}, ${radius}, ${threshold});
    
    return { 
      filter: 'Unsharp Mask',
      amount: ${amount},
      radius: ${radius},
      threshold: ${threshold}
    };
  `,

  /**
   * Apply Add Noise filter
   */
  applyAddNoise: (amount: number, distribution: string, monochromatic: boolean) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;
    
    // Auto-rasterize if needed
    if (layer.kind === LayerKind.TEXT || layer.kind === LayerKind.SMARTOBJECT) {
      layer.rasterize(RasterizeType.ENTIRELAYER);
    }
    
    if (layer.kind !== LayerKind.NORMAL) {
      throw new Error('Can only apply filters to normal (raster) layers');
    }
    
    var distEnum = NoiseDistribution.${distribution};
    layer.applyAddNoise(${amount}, distEnum, ${monochromatic});
    
    return { 
      filter: 'Add Noise',
      amount: ${amount},
      distribution: '${distribution}',
      monochromatic: ${monochromatic}
    };
  `,

  /**
   * Apply Motion Blur filter
   */
  applyMotionBlur: (angle: number, radius: number) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;
    
    // Auto-rasterize if needed
    if (layer.kind === LayerKind.TEXT || layer.kind === LayerKind.SMARTOBJECT) {
      layer.rasterize(RasterizeType.ENTIRELAYER);
    }
    
    if (layer.kind !== LayerKind.NORMAL) {
      throw new Error('Can only apply filters to normal (raster) layers');
    }
    
    layer.applyMotionBlur(${angle}, ${radius});
    
    return { 
      filter: 'Motion Blur',
      angle: ${angle},
      radius: ${radius}
    };
  `,

  /**
   * Apply High Pass filter via Action Manager.
   * @see https://community.adobe.com/t5/photoshop-ecosystem-discussions/high-pass-filter-using-javascript/td-p/1144836
   * @see https://theiviaxx.github.io/photoshop-docs/Photoshop/ArtLayer/applyHighPass.html
   */
  applyHighPass: (radius: number) => `
    ${helperFunctions}
    ${getContextInfo}
    ${filterLayerHelpers}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }

    var layer = app.activeDocument.activeLayer;
    var layerErr = __mcp_requireFilterableLayer(layer);
    if (layerErr) return layerErr;

    try {
      var desc = new ActionDescriptor();
      desc.putUnitDouble(cTID('Rds '), cTID('#Pxl'), ${radius});
      executeAction(sTID('highPass'), desc, DialogModes.NO);
    } catch (eFilter) {
      return {
        ok: false,
        code: 'filter_failed',
        message: 'High Pass filter failed: ' + eFilter.message + '. If the layer is text or a Smart Object, rasterize first (photoshop_rasterize_layer).',
        suggested_next_tool: 'photoshop_rasterize_layer'
      };
    }

    return {
      ok: true,
      filter: 'High Pass',
      radius: ${radius},
      context: getContextInfo()
    };
  `,

  /**
   * Apply Smart Blur filter.
   * @see https://theiviaxx.github.io/photoshop-docs/Photoshop/ArtLayer/applySmartBlur.html
   */
  applySmartBlur: (radius: number, threshold: number, mode: string, quality: string) => `
    ${getContextInfo}
    ${filterLayerHelpers}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }

    var layer = app.activeDocument.activeLayer;
    var layerErr = __mcp_requireFilterableLayer(layer);
    if (layerErr) return layerErr;

    try {
      layer.applySmartBlur(${radius}, ${threshold}, SmartBlurQuality.${quality}, SmartBlurMode.${mode});
    } catch (eFilter) {
      return {
        ok: false,
        code: 'filter_failed',
        message: 'Smart Blur filter failed: ' + eFilter.message + '. If the layer is text or a Smart Object, rasterize first (photoshop_rasterize_layer).',
        suggested_next_tool: 'photoshop_rasterize_layer'
      };
    }

    return {
      ok: true,
      filter: 'Smart Blur',
      radius: ${radius},
      threshold: ${threshold},
      mode: '${mode}',
      quality: '${quality}',
      context: getContextInfo()
    };
  `,

  /**
   * Adjust brightness and contrast
   */
  adjustBrightnessContrast: (brightness: number, contrast: number) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;
    
    // Auto-rasterize if needed
    if (layer.kind === LayerKind.TEXT || layer.kind === LayerKind.SMARTOBJECT) {
      layer.rasterize(RasterizeType.ENTIRELAYER);
    }
    
    layer.adjustBrightnessContrast(${brightness}, ${contrast});
    
    return { 
      adjustment: 'Brightness/Contrast',
      brightness: ${brightness},
      contrast: ${contrast}
    };
  `,

  /**
   * Adjust hue, saturation and lightness on the active layer.
   *
   * ArtLayer has no DOM method for Hue/Saturation - adjustColorBalance()
   * is for Color Balance (cyan/red, magenta/green, yellow/blue) and would
   * throw here. The correct path is the "HStr" Action Descriptor which
   * matches the Image > Adjustments > Hue/Saturation menu command.
   */
  adjustHueSaturation: (hue: number, saturation: number, lightness: number) => `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;

    if (layer.kind === LayerKind.TEXT || layer.kind === LayerKind.SMARTOBJECT) {
      layer.rasterize(RasterizeType.ENTIRELAYER);
    }

    if (layer.blendMode !== BlendMode.NORMAL) {
      layer.blendMode = BlendMode.NORMAL;
    }

    if (layer.kind === LayerKind.NORMAL) {
      try { layer.rasterize(RasterizeType.ENTIRELAYER); } catch (eRaster) {}
    }

    function __runHueSatAction(hueVal, satVal, lightVal) {
      var desc = new ActionDescriptor();
      desc.putEnumerated(sTID('presetKind'), sTID('presetKindType'), sTID('presetKindCustom'));
      desc.putBoolean(cTID('Clrz'), false);
      var adjustments = new ActionList();
      var adjustment = new ActionDescriptor();
      adjustment.putEnumerated(cTID('Chnl'), cTID('Chnl'), cTID('Cmps'));
      adjustment.putInteger(cTID('H   '), hueVal);
      adjustment.putInteger(cTID('Strt'), satVal);
      adjustment.putInteger(cTID('Lght'), lightVal);
      adjustments.putObject(cTID('Hst2'), adjustment);
      desc.putList(cTID('Adjs'), adjustments);
      executeAction(cTID('HStr'), desc, DialogModes.NO);
    }

    try {
      __runHueSatAction(${hue}, ${saturation}, ${lightness});
    } catch (eHst2) {
      var legacy = new ActionDescriptor();
      legacy.putEnumerated(sTID('presetKind'), sTID('presetKindType'), sTID('presetKindCustom'));
      legacy.putBoolean(cTID('Clrz'), false);
      var legacyAdj = new ActionList();
      var legacyItem = new ActionDescriptor();
      legacyItem.putInteger(cTID('H   '), ${hue});
      legacyItem.putInteger(cTID('Strt'), ${saturation});
      legacyItem.putInteger(cTID('Lght'), ${lightness});
      legacyAdj.putObject(cTID('Hsrt'), legacyItem);
      legacy.putList(cTID('Adjs'), legacyAdj);
      executeAction(cTID('HStr'), legacy, DialogModes.NO);
    }

    return {
      adjustment: 'Hue/Saturation',
      hue: ${hue},
      saturation: ${saturation},
      lightness: ${lightness}
    };
  `,

  /**
   * Auto levels adjustment
   */
  autoLevels: () => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;
    
    // Auto-rasterize if needed
    if (layer.kind === LayerKind.TEXT || layer.kind === LayerKind.SMARTOBJECT) {
      layer.rasterize(RasterizeType.ENTIRELAYER);
    }
    
    layer.autoLevels();
    
    return { 
      adjustment: 'Auto Levels'
    };
  `,

  /**
   * Auto contrast adjustment
   */
  autoContrast: () => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;
    
    // Auto-rasterize if needed
    if (layer.kind === LayerKind.TEXT || layer.kind === LayerKind.SMARTOBJECT) {
      layer.rasterize(RasterizeType.ENTIRELAYER);
    }
    
    layer.autoContrast();
    
    return { 
      adjustment: 'Auto Contrast'
    };
  `,

  /**
   * Create a Curves adjustment layer (auto-tone S-curve or neutral identity curve).
   */
  adjustCurves: (preset: CurvesPreset = 'auto_tone') => `
    ${helperFunctions}
    ${mcpActionHelperAliases}
    ${MCP_CURVES_ADJUSTMENT_HELPER}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }

    app.displayDialogs = DialogModes.NO;
    var layer = __mcp_makeCurvesAdjustmentLayer('${preset}');

    return {
      created: true,
      layer_name: layer.name,
      preset: '${preset}'
    };
  `,

  /**
   * Desaturate (convert to grayscale without changing color mode)
   */
  desaturate: () => `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;

    if (layer.blendMode !== BlendMode.NORMAL) {
      layer.blendMode = BlendMode.NORMAL;
    }

    if (layer.kind === LayerKind.TEXT || layer.kind === LayerKind.SMARTOBJECT) {
      layer.rasterize(RasterizeType.ENTIRELAYER);
    }

    if (layer.kind === LayerKind.NORMAL) {
      try { layer.rasterize(RasterizeType.ENTIRELAYER); } catch (eRaster) {}
    }

    try {
      layer.desaturate();
    } catch (eDom) {
      try {
        executeAction(sTID('desaturate'), undefined, DialogModes.NO);
      } catch (eAction) {
        var desc = new ActionDescriptor();
        desc.putEnumerated(sTID('presetKind'), sTID('presetKindType'), sTID('presetKindCustom'));
        desc.putBoolean(cTID('Clrz'), false);
        var adjustments = new ActionList();
        var adjustment = new ActionDescriptor();
        adjustment.putEnumerated(cTID('Chnl'), cTID('Chnl'), cTID('Cmps'));
        adjustment.putInteger(cTID('H   '), 0);
        adjustment.putInteger(cTID('Strt'), -100);
        adjustment.putInteger(cTID('Lght'), 0);
        adjustments.putObject(cTID('Hst2'), adjustment);
        desc.putList(cTID('Adjs'), adjustments);
        executeAction(cTID('HStr'), desc, DialogModes.NO);
      }
    }

    return {
      adjustment: 'Desaturate'
    };
  `,

  /**
   * Invert colors
   */
  invert: () => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;
    
    // Auto-rasterize if needed
    if (layer.kind === LayerKind.TEXT || layer.kind === LayerKind.SMARTOBJECT) {
      layer.rasterize(RasterizeType.ENTIRELAYER);
    }
    
    layer.invert();
    
    return { 
      adjustment: 'Invert'
    };
  `,

  /**
   * Crop document
   */
  cropDocument: (left: number, top: number, right: number, bottom: number) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    
    var bounds = [${left}, ${top}, ${right}, ${bottom}];
    doc.crop(bounds);
    
    return { 
      cropped: true,
      newWidth: doc.width.as('px'),
      newHeight: doc.height.as('px')
    };
  `,

  /**
   * Set text layer font
   */
  setTextFont: (fontName: string, fontSize?: number) => `
    ${resolveFontPostScriptName}
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;
    
    if (layer.kind !== LayerKind.TEXT) {
      throw new Error('Active layer is not a text layer');
    }
    
    var __psFont = resolveFontPostScriptName("${jsString(fontName)}");
    if (!__psFont) {
      throw new Error('font_not_found: ${jsString(fontName)}');
    }
    layer.textItem.font = __psFont;
    ${fontSize ? `layer.textItem.size = ${fontSize};` : ''}
    
    return { 
      font: layer.textItem.font,
      size: layer.textItem.size
    };
  `,

  /**
   * List installed fonts (PostScript names required for TextItem.font).
   */
  listFonts: (query?: string, limit = 200) => `
    var query = ${query !== undefined ? `"${jsString(query)}"` : 'null'};
    var limit = ${limit};
    var fonts = [];
    var total = app.fonts.length;
    var truncated = false;
    for (var i = 0; i < total; i++) {
      var f = app.fonts[i];
      try {
        var entry = {
          name: f.name,
          postScriptName: f.postScriptName,
          family: f.family,
          style: f.style
        };
        if (query) {
          var q = query.toLowerCase();
          if (
            entry.name.toLowerCase().indexOf(q) < 0 &&
            entry.postScriptName.toLowerCase().indexOf(q) < 0 &&
            entry.family.toLowerCase().indexOf(q) < 0
          ) {
            continue;
          }
        }
        fonts.push(entry);
        if (fonts.length >= limit) {
          truncated = i < total - 1;
          break;
        }
      } catch (e) {}
    }
    return {
      fonts: fonts,
      total: total,
      truncated: truncated
    };
  `,

  /**
   * Set text color
   */
  setTextColor: (red: number, green: number, blue: number) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;
    
    if (layer.kind !== LayerKind.TEXT) {
      throw new Error('Active layer is not a text layer');
    }
    
    var color = new SolidColor();
    color.rgb.red = ${red};
    color.rgb.green = ${green};
    color.rgb.blue = ${blue};
    layer.textItem.color = color;
    
    return { 
      color: 'RGB(' + ${red} + ', ' + ${green} + ', ' + ${blue} + ')'
    };
  `,

  /**
   * Set text alignment
   */
  setTextAlignment: (alignment: string) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;
    
    if (layer.kind !== LayerKind.TEXT) {
      throw new Error('Active layer is not a text layer');
    }
    
    layer.textItem.justification = Justification.${alignment};
    
    return { 
      alignment: '${alignment}'
    };
  `,

  /**
   * Update text content
   */
  updateTextContent: (newText: string) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;
    
    if (layer.kind !== LayerKind.TEXT) {
      throw new Error('Active layer is not a text layer');
    }
    
    layer.textItem.contents = "${jsString(newText)}";
    
    return { 
      text: layer.textItem.contents
    };
  `,

  setTextStyle: (styleLiteral: string) => `
    ${resolveFontPostScriptName}
    ${textStyleHelpers}
    var layer = __mcp_requireTextLayer();
    __mcp_applyTextStyle(layer.textItem, ${styleLiteral});
    return { style: __mcp_readTextStyle(layer.textItem) };
  `,

  setTextRanges: (rangesLiteral: string) => `
    ${resolveFontPostScriptName}
    ${textStyleHelpers}
    var applied = __mcp_setTextRanges(${rangesLiteral});
    return {
      style: applied.style,
      ranges: __mcp_readTextRanges()
    };
  `,

  /**
   * Read active pixel selection bounds (read-only).
   * Uses executeActionGet hasSelection (c.pfaffenbichler) then bounds[].as('px').
   * @see https://stackoverflow.com/questions/41552883/determine-if-selection-is-present
   * @see https://community.adobe.com/t5/photoshop-ecosystem-discussions/can-the-presence-of-a-selection-be-set-to-a-boolean/td-p/1144178
   * @see https://community.adobe.com/t5/photoshop-ecosystem-discussions/selection-bounds-operation/td-p/1101762
   */
  getSelectionBounds: () => `
    ${helperFunctions}
    ${getContextInfo}
    ${selectionHelpers}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }

    var doc = app.activeDocument;
    var hasSel = __mcp_hasSelection();
    var result = {
      ok: true,
      has_selection: hasSel,
      context: getContextInfo()
    };

    if (hasSel) {
      var boundsRead = __mcp_readSelectionBounds(doc);
      if (!boundsRead) {
        return {
          ok: false,
          code: 'selection_bounds_error',
          message: 'Failed to read selection bounds'
        };
      }
      result.bounds = boundsRead;
    }

    return result;
  `,

  /**
   * Create elliptical marquee selection via Action Manager (setd + Elps).
   * @see https://stackoverflow.com/questions/37082583/elliptical-marquee-selection-then-fill-with-color-in-photoshop-using-javascript
   * @see https://stackoverflow.com/questions/35235191/how-do-i-create-a-circular-or-elliptical-selections-in-javascript-for-use-in-pho
   */
  selectEllipse: (left: number, top: number, right: number, bottom: number) => `
    ${helperFunctions}
    ${getContextInfo}
    ${selectionHelpers}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }

    var doc = app.activeDocument;
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putProperty(cTID('Chnl'), cTID('fsel'));
    desc.putReference(cTID('null'), ref);
    var elps = new ActionDescriptor();
    elps.putUnitDouble(cTID('Top '), cTID('#Pxl'), ${top});
    elps.putUnitDouble(cTID('Left'), cTID('#Pxl'), ${left});
    elps.putUnitDouble(cTID('Btom'), cTID('#Pxl'), ${bottom});
    elps.putUnitDouble(cTID('Rght'), cTID('#Pxl'), ${right});
    desc.putObject(cTID('T   '), cTID('Elps'), elps);
    desc.putBoolean(cTID('AntA'), true);
    executeAction(cTID('setd'), desc, DialogModes.NO);

    var result = {
      ok: true,
      has_selection: true,
      shape: 'ellipse',
      context: getContextInfo()
    };
    var boundsRead = __mcp_readSelectionBounds(doc);
    if (boundsRead) result.bounds = boundsRead;
    return result;
  `,

  /**
   * Expand the active selection by pixels.
   * @see https://theiviaxx.github.io/photoshop-docs/Photoshop/Selection/expand.html
   */
  expandSelection: (pixels: number) => `
    ${helperFunctions}
    ${getContextInfo}
    ${selectionHelpers}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }

    var doc = app.activeDocument;
    var selErr = __mcp_requireSelection();
    if (selErr) return selErr;

    try {
      __mcp_modifySelection('Expn', ${pixels});
    } catch (eExp) {
      doc.selection.expand(new UnitValue(${pixels}, 'px'));
    }

    var result = {
      ok: true,
      has_selection: true,
      pixels: ${pixels},
      operation: 'expand',
      context: getContextInfo()
    };
    var boundsRead = __mcp_readSelectionBounds(doc);
    if (boundsRead) result.bounds = boundsRead;
    return result;
  `,

  /**
   * Contract the active selection by pixels.
   * @see https://theiviaxx.github.io/photoshop-docs/Photoshop/Selection/contract.html
   */
  contractSelection: (pixels: number) => `
    ${helperFunctions}
    ${getContextInfo}
    ${selectionHelpers}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }

    var doc = app.activeDocument;
    var selErr = __mcp_requireSelection();
    if (selErr) return selErr;

    try {
      __mcp_modifySelection('Cntc', ${pixels});
    } catch (eCnt) {
      doc.selection.contract(new UnitValue(${pixels}, 'px'));
    }

    var result = {
      ok: true,
      has_selection: true,
      pixels: ${pixels},
      operation: 'contract',
      context: getContextInfo()
    };
    var boundsRead = __mcp_readSelectionBounds(doc);
    if (boundsRead) result.bounds = boundsRead;
    return result;
  `,

  /**
   * Feather the active selection edges by pixels.
   * @see https://www.indesignjs.de/extendscriptAPI/photoshop-latest/Selection.html
   */
  featherSelection: (pixels: number) => `
    ${helperFunctions}
    ${getContextInfo}
    ${selectionHelpers}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }

    var doc = app.activeDocument;
    var selErr = __mcp_requireSelection();
    if (selErr) return selErr;

    try {
      __mcp_modifySelection('Fthr', ${pixels});
    } catch (eFth) {
      doc.selection.feather(new UnitValue(${pixels}, 'px'));
    }

    var result = {
      ok: true,
      has_selection: true,
      pixels: ${pixels},
      operation: 'feather',
      context: getContextInfo()
    };
    var boundsRead = __mcp_readSelectionBounds(doc);
    if (boundsRead) result.bounds = boundsRead;
    return result;
  `,

  /**
   * Save the active selection to a new alpha channel.
   * @see https://theiviaxx.github.io/photoshop-docs/Photoshop/Selection/store.html
   */
  saveSelection: (channelName?: string) => {
    const channelNameLiteral = channelName ? jsStringLiteral(channelName) : 'null';
    return `
    ${helperFunctions}
    ${getContextInfo}
    ${selectionHelpers}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }

    var doc = app.activeDocument;
    var selErr = __mcp_requireSelection();
    if (selErr) return selErr;

    var channelName = ${channelNameLiteral};
    var name = channelName || ('MCP Selection ' + (new Date().getTime()));
    var chan = doc.channels.add();
    chan.name = name;
    chan.kind = ChannelType.SELECTEDAREA;
    try {
      doc.selection.store(chan);
    } catch (eStore) {
      var replaceMode = 1;
      try { replaceMode = SelectionType.REPLACE; } catch (eEnum) {}
      doc.selection.store(chan, replaceMode);
    }

    return {
      ok: true,
      channel_name: chan.name,
      context: getContextInfo()
    };
  `;
  },

  /**
   * Create rectangular selection
   */
  selectRectangle: (
    left: number,
    top: number,
    right: number,
    bottom: number,
    mode: 'replace' | 'add' | 'subtract' | 'intersect' = 'replace'
  ) => `
    ${helperFunctions}
    ${selectionHelpers}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    __mcp_selectRect(${left}, ${top}, ${right}, ${bottom}, '${mode}');

    var result = {
      selection: 'rectangle',
      mode: '${mode}',
      bounds: [${left}, ${top}, ${right}, ${bottom}]
    };
    var boundsRead = __mcp_readSelectionBounds(doc);
    if (boundsRead) result.selection_bounds = boundsRead;
    return result;
  `,

  /**
   * Select all
   */
  selectAll: () => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    doc.selection.selectAll();
    
    return { 
      selection: 'all'
    };
  `,

  /**
   * Deselect
   */
  deselect: () => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    doc.selection.deselect();
    
    return { 
      deselected: true
    };
  `,

  /**
   * Invert selection
   */
  invertSelection: () => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    doc.selection.invert();
    
    return { 
      inverted: true
    };
  `,

  /**
   * Select the main subject on the active layer (DOM selectSubject, then autoCutout fallback).
   */
  selectSubject: (sampleAllLayers = false) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }

    var doc = app.activeDocument;
    app.displayDialogs = DialogModes.NO;

    var subjectSelected = false;
    var method = '';
    try {
      doc.selection.selectSubject();
      subjectSelected = true;
      method = 'selectSubject';
    } catch (eDomSubject) {}

    if (!subjectSelected) {
      try {
        ${helperFunctions}
        var cutoutDesc = new ActionDescriptor();
        cutoutDesc.putBoolean(sTID('sampleAllLayers'), ${sampleAllLayers});
        executeAction(sTID('autoCutout'), cutoutDesc, DialogModes.NO);
        subjectSelected = true;
        method = 'autoCutout';
      } catch (eSelectSubject) {
        throw new Error('Select Subject is not available: ' + (eSelectSubject.message || eSelectSubject));
      }
    }

    var hasSel = false;
    try { hasSel = doc.selection.bounds != null; } catch (e) { hasSel = false; }
    if (!hasSel) {
      throw new Error('Select Subject produced no selection');
    }

    return {
      selected: true,
      method: method
    };
  `,

  /**
   * Content-aware fill on the current pixel selection.
   */
  contentAwareFill: () => `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }

    var doc = app.activeDocument;
    var hasSel = false;
    try { hasSel = doc.selection.bounds != null; } catch (e) { hasSel = false; }
    if (!hasSel) {
      throw new Error('selection_required');
    }

    app.displayDialogs = DialogModes.NO;

    var desc = new ActionDescriptor();
    desc.putEnumerated(sTID('using'), sTID('fillContents'), sTID('contentAware'));
    executeAction(sTID('fill'), desc, DialogModes.NO);
    doc.selection.deselect();

    return {
      filled: true
    };
  `,

  /**
   * Create layer mask from selection
   */
  createLayerMask: () => `
    ${helperFunctions}
    ${MCP_LAYER_MASK_HELPERS}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }

    if (__mcp_hasLayerMaskAM()) {
      return {
        maskCreated: false,
        fromSelection: false,
        message: 'Layer already has a mask'
      };
    }

    var hasSelection = false;
    try { hasSelection = !!(app.activeDocument.selection.bounds); } catch (e) { hasSelection = false; }

    app.displayDialogs = DialogModes.NO;
    __mcp_makeLayerMaskAtChannel(hasSelection ? 'revealSelection' : 'revealAll');

    return {
      maskCreated: true,
      fromSelection: hasSelection
    };
  `,

  /**
   * Apply a linear black-to-white gradient on the active layer's mask channel.
   */
  applyGradientMask: (
    direction: GradientMaskDirection = 'bottom_to_top',
    startPct = 0,
    endPct = 100,
    angleDeg?: number
  ) => {
    const gradientEndpoints: Record<
      GradientMaskDirection,
      { fromH: number; fromV: number; toH: number; toV: number; reverse: boolean }
    > = {
      bottom_to_top: { fromH: 50, fromV: endPct, toH: 50, toV: startPct, reverse: false },
      top_to_bottom: { fromH: 50, fromV: startPct, toH: 50, toV: endPct, reverse: false },
      left_to_right: { fromH: startPct, fromV: 50, toH: endPct, toV: 50, reverse: false },
      right_to_left: { fromH: endPct, fromV: 50, toH: startPct, toV: 50, reverse: false },
    };
    const endpoints = gradientEndpoints[direction];
    const angle = angleDeg ?? (direction === 'left_to_right' || direction === 'right_to_left' ? 0 : 90);

    return `
    ${helperFunctions}
    ${MCP_LAYER_MASK_HELPERS}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }

    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    if (!layer) {
      throw new Error('No active layer');
    }

    if (!__mcp_hasLayerMaskAM()) {
      throw new Error('Active layer has no layer mask');
    }

    app.displayDialogs = DialogModes.NO;
    doc.activeLayer = layer;
    __mcp_selectLayerMaskChannel();

    var docW = doc.width.as('px');
    var docH = doc.height.as('px');
    var fromXPx = docW * (${endpoints.fromH} / 100.0);
    var fromYPx = docH * (${endpoints.fromV} / 100.0);
    var toXPx = docW * (${endpoints.toH} / 100.0);
    var toYPx = docH * (${endpoints.toV} / 100.0);
    __mcp_gradientFillLayerMask(fromXPx, fromYPx, toXPx, toYPx, ${endpoints.reverse});

    try {
      doc.activeChannels = doc.componentChannels;
    } catch (eRestore) {
      doc.activeLayer = layer;
    }

    return {
      applied: true,
      direction: '${direction}',
      angle: ${angle}
    };
  `;
  },

  /**
   * Delete layer mask
   */
  deleteLayerMask: () => `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }

    var layer = app.activeDocument.activeLayer;
    if (!layer.hasLayerMask) {
      return { maskDeleted: false, message: 'Layer has no mask' };
    }

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated(cTID('Chnl'), cTID('Chnl'), cTID('Msk '));
    desc.putReference(cTID('null'), ref);
    executeAction(cTID('Dlt '), desc, DialogModes.NO);

    return {
      maskDeleted: true
    };
  `,

  /**
   * Create a clipping mask on the active or named layer (groupEvent AM).
   * Active layer must sit directly above the layer to clip into.
   */
  createClippingMask: (layerName?: string) => {
    const layerSelect = layerName
      ? `var sel = __mcp_activateLayerByName("${jsString(layerName)}"); if (!sel.ok) return sel;`
      : '';
    return `
    ${helperFunctions}
    ${getContextInfo}
    ${MCP_SMART_OBJECT_HELPERS}
    ${MCP_CLIPPING_MASK_HELPERS}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }
    app.displayDialogs = DialogModes.NO;
    var doc = app.activeDocument;
    ${layerSelect}
    if (!doc.activeLayer) {
      return {
        ok: false,
        code: 'no_active_layer',
        message: 'No active layer',
        suggested_next_tool: 'photoshop_get_layers'
      };
    }
    var layer = doc.activeLayer;
    if (!__mcp_getLayerBelow(layer)) {
      return {
        ok: false,
        code: 'no_base_layer_below',
        message: 'No base layer below the active layer — nothing to clip into. The target layer must sit directly above the layer it should clip to.',
        suggested_next_tool: 'photoshop_get_layers'
      };
    }
    if (layer.grouped === true) {
      return {
        ok: true,
        layer_name: layer.name,
        is_clipping: true,
        already_clipping: true,
        context: getContextInfo()
      };
    }
    try {
      __mcp_createClippingMaskAM();
    } catch (eClip) {
      return {
        ok: false,
        code: 'extendscript_runtime_error',
        message: 'Create clipping mask failed: ' + (eClip.message || eClip)
      };
    }
    return {
      ok: true,
      layer_name: app.activeDocument.activeLayer.name,
      is_clipping: true,
      context: getContextInfo()
    };
  `;
  },

  /**
   * Release clipping mask on the active or named layer (layer.grouped = false).
   */
  releaseClippingMask: (layerName?: string) => {
    const layerSelect = layerName
      ? `var sel = __mcp_activateLayerByName("${jsString(layerName)}"); if (!sel.ok) return sel;`
      : '';
    return `
    ${helperFunctions}
    ${getContextInfo}
    ${MCP_SMART_OBJECT_HELPERS}
    ${MCP_CLIPPING_MASK_HELPERS}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }
    app.displayDialogs = DialogModes.NO;
    var doc = app.activeDocument;
    ${layerSelect}
    if (!doc.activeLayer) {
      return {
        ok: false,
        code: 'no_active_layer',
        message: 'No active layer',
        suggested_next_tool: 'photoshop_get_layers'
      };
    }
    var layer = doc.activeLayer;
    if (layer.grouped !== true) {
      return {
        ok: false,
        code: 'not_clipping',
        message: 'Layer "' + layer.name + '" is not a clipping mask',
        suggested_next_tool: 'photoshop_get_layers'
      };
    }
    try {
      layer.grouped = false;
    } catch (eRelease) {
      return {
        ok: false,
        code: 'extendscript_runtime_error',
        message: 'Release clipping mask failed: ' + (eRelease.message || eRelease)
      };
    }
    return {
      ok: true,
      layer_name: layer.name,
      is_clipping: false,
      context: getContextInfo()
    };
  `;
  },

  /**
   * Apply layer mask
   */
  applyLayerMask: () => `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated(sTID('channel'), sTID('ordinal'), sTID('targetEnum'));
    desc.putReference(sTID('null'), ref);
    desc.putBoolean(sTID('apply'), true);
    try {
      executeAction(sTID('delete'), desc, DialogModes.NO);
    } catch (eDeleteApply) {
      var legacy = new ActionDescriptor();
      var legacyRef = new ActionReference();
      legacyRef.putEnumerated(cTID('Chnl'), cTID('Chnl'), cTID('Msk '));
      legacy.putReference(cTID('null'), legacyRef);
      executeAction(cTID('Aply'), legacy, DialogModes.NO);
    }

    return {
      maskApplied: true
    };
  `,

  /**
   * Play an action from Actions palette
   */
  playAction: (actionName: string, actionSetName: string) => `
    app.doAction("${jsString(actionName)}", "${jsString(actionSetName)}");
    
    return { 
      action: '${actionName}',
      set: '${actionSetName}'
    };
  `,

  /**
   * Execute custom JavaScript code
   */
  executeCustomScript: (code: string) => `
    ${code}
  `,

  /**
   * Rasterize active layer
   */
  rasterizeLayer: () => `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var layer = app.activeDocument.activeLayer;

    if (layer.typename === 'LayerSet') {
      throw new Error('Cannot rasterize a layer group — select a single layer');
    }

    var originalKind = String(layer.kind);
    if (layer.kind === LayerKind.NORMAL) {
      return {
        message: 'Layer is already rasterized',
        kind: 'NORMAL'
      };
    }

    if (layer.kind === LayerKind.TEXT) {
      layer.rasterize(RasterizeType.TEXTCONTENTS);
    } else if (layer.kind === LayerKind.SMARTOBJECT) {
      var desc = new ActionDescriptor();
      var ref = new ActionReference();
      ref.putEnumerated(sTID('layer'), sTID('ordinal'), sTID('targetEnum'));
      desc.putReference(sTID('null'), ref);
      executeAction(sTID('rasterizePlaced'), desc, DialogModes.NO);
    } else {
      try {
        layer.rasterize(RasterizeType.ENTIRELAYER);
      } catch (eDom) {
        var desc2 = new ActionDescriptor();
        var ref2 = new ActionReference();
        ref2.putEnumerated(sTID('layer'), sTID('ordinal'), sTID('targetEnum'));
        desc2.putReference(sTID('null'), ref2);
        executeAction(sTID('rasterizeLayer'), desc2, DialogModes.NO);
      }
    }

    return {
      rasterized: true,
      originalKind: originalKind,
      newKind: 'NORMAL'
    };
  `,

  /**
   * Undo last operation (step backward in history)
   */
  undo: (steps = 1) => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    
    // Get current history state index
    var currentIndex = -1;
    for (var i = 0; i < doc.historyStates.length; i++) {
      if (doc.historyStates[i] === doc.activeHistoryState) {
        currentIndex = i;
        break;
      }
    }
    
    if (currentIndex === -1) {
      throw new Error('Could not find current history state');
    }
    
    // Calculate target index
    var targetIndex = Math.max(0, currentIndex - ${steps});
    
    // Set active history state to go back
    if (targetIndex < doc.historyStates.length) {
      doc.activeHistoryState = doc.historyStates[targetIndex];
    }
    
    var result = {
      undone: true,
      steps: currentIndex - targetIndex,
      currentHistoryState: doc.activeHistoryState.name,
      remainingStates: currentIndex - targetIndex,
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Redo operation (step forward in history)
   */
  redo: (steps = 1) => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    
    // Get current history state index
    var currentIndex = -1;
    for (var i = 0; i < doc.historyStates.length; i++) {
      if (doc.historyStates[i] === doc.activeHistoryState) {
        currentIndex = i;
        break;
      }
    }
    
    if (currentIndex === -1) {
      throw new Error('Could not find current history state');
    }
    
    // Calculate target index
    var targetIndex = Math.min(doc.historyStates.length - 1, currentIndex + ${steps});
    
    // Set active history state to go forward
    if (targetIndex >= 0) {
      doc.activeHistoryState = doc.historyStates[targetIndex];
    }
    
    var result = {
      redone: true,
      steps: targetIndex - currentIndex,
      currentHistoryState: doc.activeHistoryState.name,
      availableRedoSteps: doc.historyStates.length - 1 - targetIndex,
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Get history states
   */
  getHistoryStates: () => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    
    var states = [];
    var currentIndex = -1;
    
    for (var i = 0; i < doc.historyStates.length; i++) {
      var state = doc.historyStates[i];
      states.push({
        name: state.name,
        snapshot: state.snapshot || false
      });
      
      if (state === doc.activeHistoryState) {
        currentIndex = i;
      }
    }
    
    var result = {
      totalStates: states.length,
      currentIndex: currentIndex,
      currentState: currentIndex >= 0 ? states[currentIndex].name : 'Unknown',
      canUndo: currentIndex > 0,
      canRedo: currentIndex < states.length - 1,
      states: states,
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Move layer to specific position (reorder)
   */
  moveLayerToPosition: (targetLayerName: string, position: string) => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var activeLayer = doc.activeLayer;
    
    // Find target layer
    var targetLayer = null;
    for (var i = 0; i < doc.layers.length; i++) {
      if (doc.layers[i].name === "${jsString(targetLayerName)}") {
        targetLayer = doc.layers[i];
        break;
      }
    }
    
    if (!targetLayer) {
      throw new Error('Target layer not found: ${targetLayerName}');
    }
    
    // Determine ElementPlacement
    var placement;
    if ("${position}" === "ABOVE") {
      placement = ElementPlacement.PLACEBEFORE;
    } else if ("${position}" === "BELOW") {
      placement = ElementPlacement.PLACEAFTER;
    } else if ("${position}" === "TOP") {
      placement = ElementPlacement.PLACEATBEGINNING;
    } else if ("${position}" === "BOTTOM") {
      placement = ElementPlacement.PLACEATEND;
    } else {
      throw new Error('Invalid position. Use: ABOVE, BELOW, TOP, or BOTTOM');
    }
    
    // Move the layer
    activeLayer.move(targetLayer, placement);
    
    var result = {
      moved: true,
      layerName: activeLayer.name,
      position: "${position}",
      relativeTo: targetLayer.name,
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Move layer to top of layer stack
   */
  moveLayerToTop: () => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    if (doc.layers.length > 0) {
      layer.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
    }
    
    var result = {
      moved: true,
      layerName: layer.name,
      position: 'top',
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Move layer to bottom of layer stack
   */
  moveLayerToBottom: () => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;

    if (layer.isBackgroundLayer) {
      throw new Error('Cannot move background layer');
    }

    if (doc.layers.length > 0) {
      var bottomLayer = doc.layers[doc.layers.length - 1];
      layer.move(bottomLayer, ElementPlacement.PLACEBEFORE);
    }
    
    var result = {
      moved: true,
      layerName: layer.name,
      position: 'bottom',
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Move layer up one position
   */
  moveLayerUp: () => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    // Find current layer index
    var currentIndex = -1;
    for (var i = 0; i < doc.layers.length; i++) {
      if (doc.layers[i] === layer) {
        currentIndex = i;
        break;
      }
    }
    
    if (currentIndex <= 0) {
      return {
        moved: false,
        message: 'Layer is already at the top',
        context: getContextInfo()
      };
    }
    
    // Move before the layer above
    layer.move(doc.layers[currentIndex - 1], ElementPlacement.PLACEBEFORE);
    
    var result = {
      moved: true,
      layerName: layer.name,
      direction: 'up',
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Move layer down one position
   */
  moveLayerDown: () => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    // Find current layer index
    var currentIndex = -1;
    for (var i = 0; i < doc.layers.length; i++) {
      if (doc.layers[i] === layer) {
        currentIndex = i;
        break;
      }
    }
    
    if (currentIndex === -1 || currentIndex >= doc.layers.length - 1) {
      return {
        moved: false,
        message: 'Layer is already at the bottom',
        context: getContextInfo()
      };
    }
    
    // Move after the layer below
    layer.move(doc.layers[currentIndex + 1], ElementPlacement.PLACEAFTER);
    
    var result = {
      moved: true,
      layerName: layer.name,
      direction: 'down',
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Lightweight session state snapshot (read-only).
   */
  getState: () => `
    ${helperFunctions}
    ${artboardHelpers}
    ${getContextInfo}
    var context = getContextInfo();
    if (context.hasDocument && context.document) {
      var abs = __mcp_listArtboards();
      context.document.artboards = abs;
      context.document.artboardCount = abs.length;
      var activeAb = null;
      for (var i = 0; i < abs.length; i++) {
        if (abs[i].is_active) {
          activeAb = abs[i];
          break;
        }
      }
      context.activeArtboard = activeAb;
    }
    return context;
  `,

  /**
   * Export a JPEG preview to the system temp folder. Returns filesystem path for Node to read.
   */
  exportPreview: (maxDimension = 1024, jpegQuality = 8) => `
    ${getContextInfo}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }

    var doc = app.activeDocument;
    var w = doc.width.as('px');
    var h = doc.height.as('px');
    var maxDim = ${maxDimension};
    var scale = 1;
    if (w > maxDim || h > maxDim) {
      scale = maxDim / Math.max(w, h);
    }

    var dup = doc.duplicate('__mcp_preview__', true);
    if (scale < 1) {
      dup.resizeImage(
        UnitValue(Math.round(w * scale), 'px'),
        UnitValue(Math.round(h * scale), 'px'),
        doc.resolution,
        ResampleMethod.BICUBIC
      );
    }

    var tmpFile = new File(Folder.temp.fsName + '/ps-preview-' + (new Date().getTime()) + '.jpg');
    var saveOptions = new JPEGSaveOptions();
    saveOptions.quality = ${jpegQuality};
    saveOptions.embedColorProfile = true;
    saveOptions.formatOptions = FormatOptions.STANDARDBASELINE;
    dup.flatten();
    dup.saveAs(tmpFile, saveOptions, true);
    dup.close(SaveOptions.DONOTSAVECHANGES);

    return {
      path: tmpFile.fsName,
      width: Math.round(w * scale),
      height: Math.round(h * scale),
      mimeType: 'image/jpeg'
    };
  `,

  /**
   * Shared helpers for Firefly generative actions via Action Manager.
   * See docs/plans/2026-07-03-1149-photoshop-ai-features/ and scripts/spike-photoshop-actions.ts.
   */
  generativeHelpers: () => `
    ${helperFunctions}

    function __mcp_tryGenerativeAction(actionIds, buildDesc) {
      var lastError = '';
      for (var i = 0; i < actionIds.length; i++) {
        var actionId = actionIds[i];
        try {
          var desc = buildDesc ? buildDesc(actionId) : new ActionDescriptor();
          executeAction(sTID(actionId), desc, DialogModes.NO);
          return { ok: true, action_id: actionId };
        } catch (e) {
          lastError = actionId + ': ' + (e.message || String(e));
        }
      }
      return { ok: false, error: lastError || 'No generative action succeeded' };
    }

    function __mcp_waitGenerativeComplete(doc, baselineHist, maxWaitMs) {
      var waited = 0;
      var step = 500;
      var maxMs = maxWaitMs || 90000;
      var baseline = baselineHist;
      while (waited < maxMs) {
        try {
          if (doc.historyStates.length > baseline + 1) {
            return { completed: true, waited_ms: waited, history_states: doc.historyStates.length };
          }
        } catch (e) {}
        $.sleep(step);
        waited += step;
      }
      return { completed: false, waited_ms: waited, history_states: doc.historyStates.length };
    }

    function __mcp_hasSelection(doc) {
      try { return doc.selection.bounds != null; } catch (e) { return false; }
    }

    function __mcp_historyIndex(doc) {
      try {
        if (doc.activeHistoryState && doc.activeHistoryState.index != null) {
          return doc.activeHistoryState.index;
        }
      } catch (eHist) {}
      try { return doc.historyStates.length; } catch (eLen) {}
      return 0;
    }

    /**
     * Firefly inpainting. Empty descriptors on removeTool/generativeFill raise
     * Photoshop Error 8 ("Syntax error"). The recorded event is syntheticFill.
     * @see https://community.adobe.com/feature-requests-713/please-please-create-a-larger-generative-ai-prompt-field-1615149
     */
    function __mcp_syntheticFill(doc, prompt, workflow) {
      try {
        var bg = doc.backgroundLayer;
        if (bg) bg.isBackgroundLayer = false;
      } catch (eBg) {}
      var text = prompt || '';
      var flow = workflow || 'in_painting';
      var last = '';
      var withOptions = [false, true];
      for (var i = 0; i < withOptions.length; i++) {
        try {
          var desc = new ActionDescriptor();
          var ref = new ActionReference();
          ref.putEnumerated(sTID('document'), sTID('ordinal'), sTID('targetEnum'));
          desc.putReference(sTID('null'), ref);
          try { desc.putInteger(sTID('documentID'), doc.id); } catch (eDoc) {}
          try { desc.putInteger(sTID('layerID'), doc.activeLayer.id); } catch (eLayer) {}
          desc.putString(sTID('prompt'), text);
          desc.putString(sTID('serviceID'), 'clio');
          desc.putEnumerated(sTID('workflowType'), sTID('genWorkflow'), sTID(flow));
          if (withOptions[i]) {
            var clio = new ActionDescriptor();
            clio.putString(sTID('gi_PROMPT'), text);
            clio.putString(sTID('gi_MODE'), flow === 'text_to_image' ? 't2i' : 'ginp');
            var opts = new ActionDescriptor();
            opts.putObject(sTID('clio'), sTID('clio'), clio);
            desc.putObject(sTID('serviceOptionsList'), sTID('null'), opts);
          }
          executeAction(sTID('syntheticFill'), desc, DialogModes.NO);
          return withOptions[i] ? 'syntheticFill_clio' : 'syntheticFill';
        } catch (eFill) {
          last = eFill.message || String(eFill);
        }
      }
      throw new Error(last || 'syntheticFill failed');
    }
  `,

  generativeFill: (prompt: string) => {
    const escaped = jsStringLiteral(prompt);
    return `
      ${helperFunctions}
      ${ExtendScriptSnippets.generativeHelpers()}

      if (app.documents.length === 0) throw new Error('No active document');
      var doc = app.activeDocument;
      app.displayDialogs = DialogModes.NO;

      if (!__mcp_hasSelection(doc)) {
        return { ok: false, code: 'generative_no_selection', message: 'Active pixel selection required for generative fill' };
      }

      var baselineHist = doc.activeHistoryState.index;
      var result = __mcp_tryGenerativeAction(
        ['generativeFill', 'generativeLayerFill', 'firefly'],
        function(actionId) {
          var desc = new ActionDescriptor();
          try { desc.putString(sTID('prompt'), ${escaped}); } catch (eP) {}
          try { desc.putString(sTID('text'), ${escaped}); } catch (eT) {}
          try { desc.putString(sTID('promptText'), ${escaped}); } catch (ePT) {}
          return desc;
        }
      );

      if (!result.ok) {
        var msg = String(result.error || '');
        if (/credit|quota|sign in|subscription/i.test(msg)) {
          return { ok: false, code: 'generative_credits_exhausted', message: msg };
        }
        return { ok: false, code: 'generative_unavailable', message: msg };
      }

      var wait = __mcp_waitGenerativeComplete(doc, baselineHist, 90000);
      try { doc.selection.deselect(); } catch (eDesel) {}

      return {
        ok: true,
        summary: 'Generative fill invoked via ' + result.action_id,
        details: { action_id: result.action_id, prompt: ${escaped}, wait: wait },
        next_suggested_tool: 'photoshop_get_preview'
      };
    `;
  },

  generativeRemove: (featherPx: number, autoSelectSubject: boolean) => `
    ${helperFunctions}
    ${ExtendScriptSnippets.generativeHelpers()}

    if (app.documents.length === 0) throw new Error('No active document');
    var doc = app.activeDocument;
    app.displayDialogs = DialogModes.NO;

    var hasSel = __mcp_hasSelection(doc);
    if (!hasSel && ${autoSelectSubject ? 'true' : 'false'}) {
      try {
        doc.selection.selectSubject();
        hasSel = __mcp_hasSelection(doc);
      } catch (eSub) {}
    }
    if (!hasSel) {
      return { ok: false, code: 'generative_no_selection', message: 'Selection required for generative remove' };
    }

    if (${featherPx} > 0) {
      try { doc.selection.feather(new UnitValue(${featherPx}, 'px')); } catch (eF) {}
    }

    var baselineHist = __mcp_historyIndex(doc);
    var actionId = '';
    try {
      actionId = __mcp_syntheticFill(doc, 'remove the selected object');
    } catch (eGen) {
      var msg = String(eGen.message || eGen);
      var code = /credit|quota|sign in|subscription/i.test(msg)
        ? 'generative_credits_exhausted'
        : 'generative_unavailable';
      return { ok: false, code: code, message: msg };
    }

    var wait = __mcp_waitGenerativeComplete(doc, baselineHist, 90000);
    try { doc.selection.deselect(); } catch (eDesel) {}

    return {
      ok: true,
      summary: 'Generative remove invoked via ' + actionId,
      details: { action_id: actionId, feather_px: ${featherPx}, wait: wait },
      next_suggested_tool: 'photoshop_get_preview'
    };
  `,

  generativeExpand: (direction: string, prompt: string) => {
    const escaped = jsStringLiteral(prompt);
    const dir = jsStringLiteral(direction);
    return `
      ${helperFunctions}
      ${ExtendScriptSnippets.generativeHelpers()}

      if (app.documents.length === 0) throw new Error('No active document');
      var doc = app.activeDocument;
      app.displayDialogs = DialogModes.NO;

      var baselineHist = doc.activeHistoryState.index;
      var result = __mcp_tryGenerativeAction(
        ['generativeExpand', 'expandCanvas', 'generativeCanvasExpand'],
        function(actionId) {
          var desc = new ActionDescriptor();
          try { desc.putString(sTID('prompt'), ${escaped}); } catch (eP) {}
          try { desc.putString(sTID('direction'), ${dir}); } catch (eD) {}
          return desc;
        }
      );

      if (!result.ok) {
        return { ok: false, code: 'generative_unavailable', message: String(result.error || '') };
      }

      var wait = __mcp_waitGenerativeComplete(doc, baselineHist, 120000);

      return {
        ok: true,
        summary: 'Generative expand invoked via ' + result.action_id,
        details: { action_id: result.action_id, direction: ${dir}, prompt: ${escaped}, wait: wait },
        next_suggested_tool: 'photoshop_get_preview'
      };
    `;
  },

  generativeUpscale: (targetScale: number) => `
    ${helperFunctions}
    ${ExtendScriptSnippets.generativeHelpers()}

    if (app.documents.length === 0) throw new Error('No active document');
    var doc = app.activeDocument;
    app.displayDialogs = DialogModes.NO;

    var baselineHist = doc.activeHistoryState.index;
    var result = __mcp_tryGenerativeAction(
      ['generativeUpscale', 'superResolution', 'enhanceDetail'],
      function(actionId) {
        var desc = new ActionDescriptor();
        try { desc.putInteger(sTID('scale'), ${targetScale}); } catch (eS) {}
        return desc;
      }
    );

    if (!result.ok) {
      return { ok: false, code: 'generative_unavailable', message: String(result.error || '') };
    }

    var wait = __mcp_waitGenerativeComplete(doc, baselineHist, 120000);

    return {
      ok: true,
      summary: 'Generative upscale invoked via ' + result.action_id,
      details: { action_id: result.action_id, target_scale: ${targetScale}, wait: wait },
      next_suggested_tool: 'photoshop_get_preview'
    };
  `,

  skyReplacement: (skyImagePath: string) => {
    const escaped = jsStringLiteral(skyImagePath);
    return `
      ${helperFunctions}
      ${ExtendScriptSnippets.generativeHelpers()}

      if (app.documents.length === 0) throw new Error('No active document');
      var doc = app.activeDocument;
      app.displayDialogs = DialogModes.NO;

      var skyFile = new File(${escaped});
      var baselineHist = doc.activeHistoryState.index;
      var result = __mcp_tryGenerativeAction(
        ['skyReplacement', 'replaceSky', 'replaceSkyBackground'],
        function(actionId) {
          var desc = new ActionDescriptor();
          if (skyFile.exists) {
            try { desc.putPath(sTID('skyImage'), skyFile); } catch (eP) {}
            try { desc.putPath(sTID('null'), skyFile); } catch (eN) {}
          }
          return desc;
        }
      );

      if (!result.ok) {
        return { ok: false, code: 'generative_unavailable', message: String(result.error || '') };
      }

      var wait = __mcp_waitGenerativeComplete(doc, baselineHist, 120000);

      return {
        ok: true,
        summary: 'Sky replacement invoked via ' + result.action_id,
        details: { action_id: result.action_id, sky_image_path: ${escaped}, wait: wait },
        next_suggested_tool: 'photoshop_get_preview'
      };
    `;
  },

  generateImage: (prompt: string, width: number, height: number) => {
    const escaped = jsStringLiteral(prompt);
    return `
      ${helperFunctions}
      ${ExtendScriptSnippets.generativeHelpers()}

      app.displayDialogs = DialogModes.NO;

      var doc;
      if (app.documents.length === 0) {
        doc = app.documents.add(
          UnitValue(${width}, 'px'),
          UnitValue(${height}, 'px'),
          72,
          'Generated',
          NewDocumentMode.RGB,
          DocumentFill.WHITE
        );
      } else {
        doc = app.activeDocument;
      }

      var baselineHist = __mcp_historyIndex(doc);
      var actionId = '';
      try {
        actionId = __mcp_syntheticFill(doc, ${escaped}, 'text_to_image');
      } catch (eT2i) {
        try {
          doc.selection.selectAll();
          actionId = __mcp_syntheticFill(doc, ${escaped}, 'in_painting');
        } catch (eGen) {
          var msg = String(eGen.message || eGen);
          var code = /credit|quota|sign in|subscription/i.test(msg)
            ? 'generative_credits_exhausted'
            : 'generative_unavailable';
          return { ok: false, code: code, message: msg };
        }
      }

      var wait = __mcp_waitGenerativeComplete(doc, baselineHist, 120000);

      return {
        ok: true,
        summary: 'Generate image invoked via ' + actionId,
        details: { action_id: actionId, prompt: ${escaped}, width: ${width}, height: ${height}, wait: wait },
        next_suggested_tool: 'photoshop_get_preview'
      };
    `;
  },

  /**
   * Apply a layer style (drop shadow / outer glow / stroke / bevel) via Action Manager layerEffects.
   */
  applyLayerStyle: (options: {
    style: 'drop_shadow' | 'outer_glow' | 'stroke' | 'bevel_emboss';
    red: number;
    green: number;
    blue: number;
    opacity: number;
    size: number;
    distance: number;
    angle: number;
  }) => {
    const { style, red, green, blue, opacity, size, distance, angle } = options;
    let styleDescriptor: string;
    if (style === 'drop_shadow') {
      styleDescriptor = `
      var fx = new ActionDescriptor();
      fx.putBoolean(cTID('enab'), true);
      fx.putEnumerated(cTID('Md  '), cTID('BlnM'), cTID('Mltp'));
      fx.putObject(cTID('Clr '), cTID('RGBC'), rgb);
      fx.putUnitDouble(cTID('Opct'), cTID('#Prc'), ${opacity});
      fx.putBoolean(cTID('uglg'), false);
      fx.putUnitDouble(cTID('lagl'), cTID('#Ang'), ${angle});
      fx.putUnitDouble(cTID('Dstn'), cTID('#Pxl'), ${distance});
      fx.putUnitDouble(cTID('Ckmt'), cTID('#Pxl'), 0);
      fx.putUnitDouble(cTID('blur'), cTID('#Pxl'), ${size});
      fx.putUnitDouble(cTID('Nose'), cTID('#Prc'), 0);
      fx.putBoolean(cTID('AntA'), false);
      fx.putBoolean(sTID('layerConceals'), true);
      effects.putObject(cTID('DrSh'), cTID('DrSh'), fx);`;
    } else if (style === 'outer_glow') {
      styleDescriptor = `
      var fx = new ActionDescriptor();
      fx.putBoolean(cTID('enab'), true);
      fx.putEnumerated(cTID('Md  '), cTID('BlnM'), cTID('Scrn'));
      fx.putObject(cTID('Clr '), cTID('RGBC'), rgb);
      fx.putUnitDouble(cTID('Opct'), cTID('#Prc'), ${opacity});
      fx.putUnitDouble(cTID('Ckmt'), cTID('#Pxl'), 0);
      fx.putUnitDouble(cTID('blur'), cTID('#Pxl'), ${size});
      fx.putUnitDouble(cTID('Nose'), cTID('#Prc'), 0);
      fx.putUnitDouble(cTID('ShdN'), cTID('#Prc'), 0);
      fx.putBoolean(cTID('AntA'), true);
      effects.putObject(cTID('OrGl'), cTID('OrGl'), fx);`;
    } else if (style === 'stroke') {
      styleDescriptor = `
      var fx = new ActionDescriptor();
      fx.putBoolean(cTID('enab'), true);
      fx.putEnumerated(sTID('style'), sTID('frameStyle'), sTID('outsetFrame'));
      fx.putEnumerated(sTID('paintType'), sTID('frameFill'), sTID('solidColor'));
      fx.putEnumerated(cTID('Md  '), cTID('BlnM'), cTID('Nrml'));
      fx.putUnitDouble(cTID('Opct'), cTID('#Prc'), ${opacity});
      fx.putUnitDouble(cTID('Sz  '), cTID('#Pxl'), ${size});
      fx.putObject(cTID('Clr '), cTID('RGBC'), rgb);
      fx.putBoolean(sTID('overprint'), false);
      effects.putObject(sTID('frameFX'), sTID('frameFX'), fx);`;
    } else {
      styleDescriptor = `
      var fx = new ActionDescriptor();
      fx.putBoolean(cTID('enab'), true);
      fx.putEnumerated(cTID('bvlS'), cTID('BESL'), cTID('InrB'));
      fx.putEnumerated(cTID('bvlT'), cTID('BSLT'), cTID('SfBl'));
      fx.putEnumerated(cTID('bvlD'), cTID('BESD'), cTID('In  '));
      fx.putUnitDouble(cTID('srg '), cTID('#Prc'), 100);
      fx.putUnitDouble(cTID('blur'), cTID('#Pxl'), ${size});
      fx.putUnitDouble(cTID('Sftn'), cTID('#Pxl'), 0);
      fx.putUnitDouble(cTID('lagl'), cTID('#Ang'), ${angle});
      fx.putUnitDouble(cTID('Lald'), cTID('#Ang'), 30);
      var hiRgb = new ActionDescriptor();
      hiRgb.putDouble(cTID('Rd  '), 255); hiRgb.putDouble(cTID('Grn '), 255); hiRgb.putDouble(cTID('Bl  '), 255);
      fx.putEnumerated(cTID('hglM'), cTID('BlnM'), cTID('Scrn'));
      fx.putObject(cTID('hglC'), cTID('RGBC'), hiRgb);
      fx.putUnitDouble(cTID('hglO'), cTID('#Prc'), 75);
      fx.putEnumerated(cTID('sdwM'), cTID('BlnM'), cTID('Mltp'));
      fx.putObject(cTID('sdwC'), cTID('RGBC'), rgb);
      fx.putUnitDouble(cTID('sdwO'), cTID('#Prc'), ${opacity});
      effects.putObject(cTID('ebbl'), cTID('ebbl'), fx);`;
    }
    return `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    app.displayDialogs = DialogModes.NO;

    var rgb = new ActionDescriptor();
    rgb.putDouble(cTID('Rd  '), ${red});
    rgb.putDouble(cTID('Grn '), ${green});
    rgb.putDouble(cTID('Bl  '), ${blue});

    var effects = new ActionDescriptor();
    effects.putUnitDouble(cTID('Scl '), cTID('#Prc'), 100);
    ${styleDescriptor}

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putProperty(cTID('Prpr'), cTID('Lefx'));
    ref.putEnumerated(cTID('Lyr '), cTID('Ordn'), cTID('Trgt'));
    desc.putReference(cTID('null'), ref);
    desc.putObject(cTID('T   '), cTID('Lefx'), effects);
    executeAction(cTID('setd'), desc, DialogModes.NO);

    return {
      applied: true,
      style: '${style}',
      layer_name: doc.activeLayer.name
    };
  `;
  },

  /**
   * Color Lookup (3D LUT) adjustment layer — cinematic grades via built-in or file-based LUTs.
   */
  applyLut: (lut: string) => {
    const escaped = jsString(lut);
    return `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    app.displayDialogs = DialogModes.NO;

    var lutFile = new File("${escaped}");
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(sTID('adjustmentLayer'));
    desc.putReference(sTID('null'), ref);
    var using = new ActionDescriptor();
    var lookup = new ActionDescriptor();
    lookup.putEnumerated(sTID('lookupType'), sTID('colorLookupType'), sTID('3DLUT'));
    if (lutFile.exists) {
      lookup.putPath(sTID('LUT3DFileName'), lutFile);
    } else {
      // Built-in LUT name (e.g. 'Crisp_Warm.3dl', 'Kodak 5218 Fuji 3510.3dl')
      lookup.putString(sTID('LUT3DFileName'), "${escaped}");
    }
    using.putObject(sTID('type'), sTID('colorLookup'), lookup);
    desc.putObject(sTID('using'), sTID('adjustmentLayer'), using);
    executeAction(sTID('make'), desc, DialogModes.NO);

    return {
      created: true,
      layer_name: app.activeDocument.activeLayer.name,
      lut: "${escaped}",
      lut_source: lutFile.exists ? 'file' : 'builtin'
    };
  `;
  },

  /**
   * Vibrance adjustment layer.
   */
  adjustVibrance: (vibrance: number, saturation: number) => `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    app.displayDialogs = DialogModes.NO;

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(sTID('adjustmentLayer'));
    desc.putReference(sTID('null'), ref);
    var using = new ActionDescriptor();
    var vib = new ActionDescriptor();
    vib.putInteger(sTID('vibrance'), ${vibrance});
    vib.putInteger(sTID('saturation'), ${saturation});
    using.putObject(sTID('type'), sTID('vibrance'), vib);
    desc.putObject(sTID('using'), sTID('adjustmentLayer'), using);
    executeAction(sTID('make'), desc, DialogModes.NO);

    return {
      created: true,
      layer_name: app.activeDocument.activeLayer.name,
      vibrance: ${vibrance},
      saturation: ${saturation}
    };
  `,

  /**
   * Exposure adjustment layer.
   */
  adjustExposure: (exposure: number, offset: number, gamma: number) => `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    app.displayDialogs = DialogModes.NO;

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(sTID('adjustmentLayer'));
    desc.putReference(sTID('null'), ref);
    var using = new ActionDescriptor();
    var exp = new ActionDescriptor();
    exp.putEnumerated(sTID('presetKind'), sTID('presetKindType'), sTID('presetKindCustom'));
    exp.putDouble(sTID('exposure'), ${exposure});
    exp.putDouble(sTID('offset'), ${offset});
    exp.putDouble(sTID('gammaCorrection'), ${gamma});
    using.putObject(sTID('type'), sTID('exposure'), exp);
    desc.putObject(sTID('using'), sTID('adjustmentLayer'), using);
    executeAction(sTID('make'), desc, DialogModes.NO);

    return {
      created: true,
      layer_name: app.activeDocument.activeLayer.name,
      exposure: ${exposure},
      offset: ${offset},
      gamma: ${gamma}
    };
  `,

  /**
   * Photo Filter adjustment layer (warming/cooling/tint with density).
   */
  applyPhotoFilter: (red: number, green: number, blue: number, density: number, preserveLuminosity: boolean) => `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    app.displayDialogs = DialogModes.NO;

    var rgb = new ActionDescriptor();
    rgb.putDouble(cTID('Rd  '), ${red});
    rgb.putDouble(cTID('Grn '), ${green});
    rgb.putDouble(cTID('Bl  '), ${blue});

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(sTID('adjustmentLayer'));
    desc.putReference(sTID('null'), ref);
    var using = new ActionDescriptor();
    var filter = new ActionDescriptor();
    filter.putEnumerated(sTID('type'), sTID('photoFilterType'), sTID('photoFilterColor'));
    filter.putObject(cTID('Clr '), cTID('RGBC'), rgb);
    filter.putUnitDouble(cTID('Dns '), cTID('#Prc'), ${density});
    filter.putBoolean(sTID('preserveLuminosity'), ${preserveLuminosity ? 'true' : 'false'});
    using.putObject(sTID('type'), sTID('photoFilter'), filter);
    desc.putObject(sTID('using'), sTID('adjustmentLayer'), using);
    executeAction(sTID('make'), desc, DialogModes.NO);

    return {
      created: true,
      layer_name: app.activeDocument.activeLayer.name,
      color: { red: ${red}, green: ${green}, blue: ${blue} },
      density: ${density}
    };
  `,

  /**
   * Gradient Map adjustment layer (black→white custom gradient by default).
   */
  applyGradientMap: (reverse: boolean) => `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    app.displayDialogs = DialogModes.NO;

    function grayStop(location, grayValue) {
      var stop = new ActionDescriptor();
      var gray = new ActionDescriptor();
      gray.putDouble(cTID('Gry '), grayValue);
      stop.putObject(cTID('Clr '), cTID('Grsc'), gray);
      stop.putEnumerated(cTID('Type'), cTID('Clry'), cTID('UsrS'));
      stop.putInteger(cTID('Lctn'), location);
      stop.putInteger(cTID('Mdpn'), 50);
      return stop;
    }
    function xferStop(location) {
      var stop = new ActionDescriptor();
      stop.putUnitDouble(cTID('Opct'), cTID('#Prc'), 100);
      stop.putInteger(cTID('Lctn'), location);
      stop.putInteger(cTID('Mdpn'), 50);
      return stop;
    }

    var grad = new ActionDescriptor();
    grad.putString(cTID('Nm  '), 'MCP Gradient Map');
    grad.putEnumerated(cTID('GrdF'), cTID('GrdF'), cTID('CstS'));
    grad.putDouble(cTID('Intr'), 4096);
    var colors = new ActionList();
    colors.putObject(cTID('Clrt'), grayStop(${reverse ? '4096' : '0'}, 0));
    colors.putObject(cTID('Clrt'), grayStop(${reverse ? '0' : '4096'}, 100));
    grad.putList(cTID('Clrs'), colors);
    var xfer = new ActionList();
    xfer.putObject(cTID('TrnS'), xferStop(0));
    xfer.putObject(cTID('TrnS'), xferStop(4096));
    grad.putList(cTID('Trns'), xfer);

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(sTID('adjustmentLayer'));
    desc.putReference(sTID('null'), ref);
    var using = new ActionDescriptor();
    var gm = new ActionDescriptor();
    gm.putObject(cTID('Grad'), cTID('Grdn'), grad);
    using.putObject(sTID('type'), sTID('gradientMapClass'), gm);
    desc.putObject(sTID('using'), sTID('adjustmentLayer'), using);
    executeAction(sTID('make'), desc, DialogModes.NO);

    return {
      created: true,
      layer_name: app.activeDocument.activeLayer.name,
      reverse: ${reverse ? 'true' : 'false'}
    };
  `,

  /**
   * List data sets defined on the active document (data-driven graphics).
   */
  listDataSets: () => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var names = [];
    try {
      for (var i = 0; i < doc.dataSets.length; i++) {
        names.push(doc.dataSets[i].name);
      }
    } catch (e) {}
    var active = null;
    try { active = doc.activeDataSet ? doc.activeDataSet.name : null; } catch (eActive) {}
    return {
      datasets: names,
      active: active,
      count: names.length
    };
  `,

  /**
   * Import variables/data sets XML (Image > Variables > Data Sets > Import).
   */
  importDataSets: (xmlPath: string) => {
    const escaped = jsString(xmlPath);
    return `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var xmlFile = new File("${escaped}");
    if (!xmlFile.exists) {
      throw new Error('variables_xml_not_found: ${escaped}');
    }
    var doc = app.activeDocument;
    doc.importVariables(xmlFile);
    var names = [];
    try {
      for (var i = 0; i < doc.dataSets.length; i++) {
        names.push(doc.dataSets[i].name);
      }
    } catch (e) {}
    return {
      imported: true,
      xml_path: "${escaped}",
      count: names.length,
      datasets: names
    };
  `;
  },

  /**
   * Batch-export one file per data set: applies each data set then saves a copy.
   */
  applyDataSetsExport: (outputDir: string, format: 'JPEG' | 'PNG' | 'PSD', datasetNames: string[]) => {
    const escapedDir = jsString(outputDir);
    const namesJson = JSON.stringify(datasetNames);
    return `
    ${helperFunctions}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    if (!doc.dataSets || doc.dataSets.length === 0) {
      throw new Error('no_datasets: active document has no data sets — import a variables XML first');
    }
    var folder = new Folder("${escapedDir}");
    if (!folder.exists && !folder.create()) {
      throw new Error('output_dir_not_writable: ${escapedDir}');
    }
    var requested = ${namesJson};
    var outputs = [];
    var skipped = [];
    for (var n = 0; n < requested.length; n++) {
      var name = requested[n];
      var set = null;
      try { set = doc.dataSets.getByName(name); } catch (eFind) { set = null; }
      if (!set) {
        skipped.push(name);
        continue;
      }
      doc.activeDataSet = set;
      var base = "${escapedDir}/" + name.replace(/[^a-zA-Z0-9_\\-]+/g, '_');
      if ('${format}' === 'JPEG') {
        var jpg = new JPEGSaveOptions();
        jpg.quality = 10;
        doc.saveAs(new File(base + '.jpg'), jpg, true, Extension.LOWERCASE);
        outputs.push(base + '.jpg');
      } else if ('${format}' === 'PNG') {
        var png = new PNGSaveOptions();
        doc.saveAs(new File(base + '.png'), png, true, Extension.LOWERCASE);
        outputs.push(base + '.png');
      } else {
        doc.saveAs(new File(base + '.psd'), new PhotoshopSaveOptions(), true, Extension.LOWERCASE);
        outputs.push(base + '.psd');
      }
    }
    return {
      exported: outputs.length,
      skipped: skipped,
      output_paths: outputs,
      output_dir: "${escapedDir}",
      format: '${format}'
    };
  `;
  },

  /**
   * Convert the active or named layer to an embedded Smart Object (newPlacedLayer).
   */
  convertToSmartObject: (layerName?: string) => {
    const layerSelect = layerName
      ? `var sel = __mcp_activateLayerByName("${jsString(layerName)}"); if (!sel.ok) return sel;`
      : '';
    return `
    ${helperFunctions}
    ${getContextInfo}
    ${MCP_SMART_OBJECT_HELPERS}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }
    app.displayDialogs = DialogModes.NO;
    ${layerSelect}
    var layer = app.activeDocument.activeLayer;
    if (layer.isBackgroundLayer) {
      return {
        ok: false,
        code: 'background_layer',
        message: 'Cannot convert background layer to Smart Object. Unlock or duplicate it first.'
      };
    }
    if (layer.kind === LayerKind.SMARTOBJECT) {
      return {
        ok: true,
        already_smart_object: true,
        layer_name: layer.name,
        kind: String(layer.kind),
        context: getContextInfo()
      };
    }
    try {
      executeAction(sTID('newPlacedLayer'), undefined, DialogModes.NO);
    } catch (eConvert) {
      return {
        ok: false,
        code: 'smart_object_error',
        message: 'Convert to Smart Object failed: ' + (eConvert.message || eConvert)
      };
    }
    var converted = app.activeDocument.activeLayer;
    return {
      ok: true,
      layer_name: converted.name,
      kind: String(converted.kind),
      context: getContextInfo()
    };
  `;
  },

  /**
   * Replace Smart Object contents from a file (placedLayerReplaceContents + PgNm).
   */
  replaceSmartObjectContents: (filePath: string, layerName?: string) => {
    const layerSelect = layerName
      ? `var sel = __mcp_activateLayerByName("${jsString(layerName)}"); if (!sel.ok) return sel;`
      : '';
    return `
    ${helperFunctions}
    ${getContextInfo}
    ${MCP_SMART_OBJECT_HELPERS}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }
    app.displayDialogs = DialogModes.NO;
    ${layerSelect}
    var rep = __mcp_replaceSmartObjectContents("${jsString(filePath)}");
    if (!rep.ok) return rep;
    return {
      ok: true,
      layer_name: rep.layerName,
      file_path: rep.filePath,
      context: getContextInfo()
    };
  `;
  },

  /**
   * Open Smart Object embedded contents for editing (placedLayerEditContents).
   * Active document becomes the embedded .psb until saved and closed.
   */
  editSmartObjectContents: (layerName?: string) => {
    const layerSelect = layerName
      ? `var sel = __mcp_activateLayerByName("${jsString(layerName)}"); if (!sel.ok) return sel;`
      : '';
    return `
    ${helperFunctions}
    ${getContextInfo}
    ${MCP_SMART_OBJECT_HELPERS}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }
    app.displayDialogs = DialogModes.NO;
    ${layerSelect}
    var layer = app.activeDocument.activeLayer;
    if (layer.kind !== LayerKind.SMARTOBJECT) {
      return {
        ok: false,
        code: 'unsupported_layer_kind',
        message: 'Target layer "' + layer.name + '" is not a Smart Object (kind=' + layer.kind + ').',
        suggested_next_tool: 'photoshop_get_layers'
      };
    }
    var parentDoc = app.activeDocument;
    var parentName = parentDoc.name;
    var parentId = parentDoc.id;
    var soLayerName = layer.name;
    try {
      executeAction(sTID('placedLayerEditContents'), new ActionDescriptor(), DialogModes.NO);
    } catch (eEdit) {
      return {
        ok: false,
        code: 'smart_object_error',
        message: 'Edit Smart Object contents failed: ' + (eEdit.message || eEdit)
      };
    }
    var embedded = app.activeDocument;
    return {
      ok: true,
      parent_document: { name: parentName, id: parentId },
      embedded_document: { name: embedded.name, id: embedded.id },
      layer_name: soLayerName,
      context: getContextInfo()
    };
  `;
  },

  /**
   * Create an independent Smart Object copy (placedLayerMakeCopy).
   */
  createSmartObjectViaCopy: (layerName?: string) => {
    const layerSelect = layerName
      ? `var sel = __mcp_activateLayerByName("${jsString(layerName)}"); if (!sel.ok) return sel;`
      : '';
    return `
    ${helperFunctions}
    ${getContextInfo}
    ${MCP_SMART_OBJECT_HELPERS}

    if (app.documents.length === 0) {
      return { ok: false, code: 'no_document', message: 'No active document' };
    }
    app.displayDialogs = DialogModes.NO;
    ${layerSelect}
    var source = app.activeDocument.activeLayer;
    if (source.kind !== LayerKind.SMARTOBJECT) {
      return {
        ok: false,
        code: 'unsupported_layer_kind',
        message: 'Target layer "' + source.name + '" is not a Smart Object (kind=' + source.kind + ').',
        suggested_next_tool: 'photoshop_get_layers'
      };
    }
    var sourceName = source.name;
    try {
      executeAction(sTID('placedLayerMakeCopy'), undefined, DialogModes.NO);
    } catch (eCopy) {
      return {
        ok: false,
        code: 'smart_object_error',
        message: 'New Smart Object via Copy failed: ' + (eCopy.message || eCopy)
      };
    }
    var copyLayer = app.activeDocument.activeLayer;
    return {
      ok: true,
      source_layer_name: sourceName,
      new_layer_name: copyLayer.name,
      kind: String(copyLayer.kind),
      context: getContextInfo()
    };
  `;
  },

  /**
   * Load image files into one document, convert to a smart object and apply a stack mode.
   * Classic "remove tourists with median stack" without any generative AI.
   */
  imageStackMode: (files: string[], mode: string) => {
    const filesJson = JSON.stringify(files.map((f) => jsString(f)));
    const modeId = jsString(mode);
    return `
    ${helperFunctions}

    var files = [${filesJson}];
    if (files.length < 2) {
      throw new Error('stack_needs_two_files: image stack requires at least 2 images');
    }
    app.displayDialogs = DialogModes.NO;

    var base = null;
    var opened = [];
    for (var i = 0; i < files.length; i++) {
      var f = new File(files[i]);
      if (!f.exists) {
        throw new Error('stack_file_not_found: ' + files[i]);
      }
      var d = app.open(f);
      opened.push(d);
      if (!base) {
        base = d;
      } else {
        d.selection.selectAll();
        d.activeLayer.copy();
        base.paste();
        d.close(SaveOptions.DONOTSAVECHANGES);
      }
    }
    app.activeDocument = base;
    base.activeLayer = base.layers[0];

    var selDesc = new ActionDescriptor();
    var selRef = new ActionReference();
    selRef.putEnumerated(cTID('Lyr '), cTID('Ordn'), cTID('Trgt'));
    selDesc.putReference(cTID('null'), selRef);
    executeAction(sTID('selectAllLayers'), selDesc, DialogModes.NO);
    executeAction(sTID('newPlacedLayer'), undefined, DialogModes.NO);

    var setDesc = new ActionDescriptor();
    var setRef = new ActionReference();
    setRef.putEnumerated(cTID('Lyr '), cTID('Ordn'), cTID('Trgt'));
    setDesc.putReference(cTID('null'), setRef);
    var smart = new ActionDescriptor();
    smart.putEnumerated(sTID('stackMode'), sTID('stackMode'), sTID("${modeId}"));
    setDesc.putObject(cTID('T   '), sTID('smartObject'), smart);
    executeAction(cTID('setd'), setDesc, DialogModes.NO);

    return {
      stacked: true,
      file_count: files.length,
      mode: "${modeId}",
      layer_name: base.activeLayer.name
    };
  `;
  },

  /**
   * Export a copy of the active document as PNG/JPEG (Save for Web) or WebP/AVIF (native, PS 23.2+).
   * Optional artboardId crops a duplicate to that artboard first (AM artboardRect).
   */
  exportAs: (
    filePath: string,
    format: 'PNG' | 'JPEG' | 'WEBP' | 'AVIF',
    quality: number,
    artboardId?: number
  ) => {
    const escaped = jsString(filePath);
    const q = Math.max(0, Math.min(100, Math.round(quality)));
    const abId =
      typeof artboardId === 'number' && Number.isFinite(artboardId) ? Math.trunc(artboardId) : null;
    return `
    ${helperFunctions}
    ${artboardHelpers}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var openedDup = false;
    app.displayDialogs = DialogModes.NO;

    ${
      abId !== null
        ? `
    var ab = __mcp_findArtboard(${abId}, null);
    if (!ab || ab.ambiguous) {
      return {
        ok: false,
        code: 'artboard_not_found',
        message: 'No artboard with id ${abId}',
        suggested_next_tool: 'photoshop_list_artboards'
      };
    }
    doc = __mcp_duplicateCropToArtboard(ab);
    openedDup = true;
    `
        : ''
    }

    var outFile = new File("${escaped}");
    var exported = __mcp_exportDoc(doc, outFile, '${format}', ${q});
    if (openedDup) {
      try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
    }
    if (exported.ok === false) {
      return exported;
    }
    return {
      exported: true,
      ok: true,
      path: "${escaped}",
      format: '${format}',
      method: exported.method${abId !== null ? `,
      artboard_id: ${abId}` : ''}
    };
  `;
  },

  listArtboards: () => `
    ${helperFunctions}
    ${artboardHelpers}
    ${getContextInfo}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var abs = __mcp_listArtboards();
    return {
      ok: true,
      count: abs.length,
      artboards: abs,
      context: getContextInfo()
    };
  `,

  createArtboard: (name: string, width: number, height: number, left?: number, top?: number) => {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const hasOrigin = typeof left === 'number' && typeof top === 'number';
    return `
    ${helperFunctions}
    ${artboardHelpers}
    ${getContextInfo}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }

    var origin = ${
      hasOrigin ? `{ left: ${left}, top: ${top} }` : `__mcp_nextArtboardOrigin()`
    };
    var leftPos = origin.left;
    var topPos = origin.top;
    var right = leftPos + ${w};
    var bottom = topPos + ${h};
    var requestedName = "${jsString(name)}";
    try { __mcp_unlockBackgroundIfNeeded(); } catch (eBg) {}
    try {
      __mcp_makeArtboard(leftPos, topPos, right, bottom, requestedName);
    } catch (eMake) {
      return {
        ok: false,
        code: 'version_unsupported',
        message: 'Could not create artboard: ' + (eMake.message || String(eMake)),
        suggested_next_tool: 'photoshop_get_capabilities'
      };
    }
    var layer = app.activeDocument.activeLayer;
    if (requestedName) {
      try { layer.name = requestedName; } catch (eName) {}
    }
    var abs = __mcp_listArtboards();
    var created = null;
    try { created = __mcp_findArtboard(layer.id, null); } catch (eFind) {}
    return {
      ok: true,
      artboard: created || {
        id: layer.id,
        name: layer.name,
        left: leftPos,
        top: topPos,
        right: right,
        bottom: bottom,
        width: ${w},
        height: ${h},
        is_active: true
      },
      artboards: abs,
      count: abs.length,
      context: getContextInfo()
    };
  `;
  },

  setActiveArtboard: (artboardId?: number, artboardName?: string) => {
    const idPart =
      typeof artboardId === 'number' && Number.isFinite(artboardId)
        ? String(Math.trunc(artboardId))
        : 'null';
    const namePart = artboardName ? `"${jsString(artboardName)}"` : 'null';
    return `
    ${helperFunctions}
    ${artboardHelpers}
    ${getContextInfo}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var found = __mcp_findArtboard(${idPart}, ${namePart});
    if (!found) {
      return {
        ok: false,
        code: 'artboard_not_found',
        message: 'Artboard not found',
        suggested_next_tool: 'photoshop_list_artboards'
      };
    }
    if (found.ambiguous) {
      return {
        ok: false,
        code: 'ambiguous_name',
        message: 'Multiple artboards named "' + found.name + '" — use artboard_id',
        suggested_next_tool: 'photoshop_list_artboards'
      };
    }
    __mcp_selectLayerById(found.id);
    var abs = __mcp_listArtboards();
    var current = __mcp_findArtboard(found.id, null);
    return {
      ok: true,
      artboard: current || found,
      artboards: abs,
      context: getContextInfo()
    };
  `;
  },

  exportArtboards: (
    folderPath: string,
    format: 'PNG' | 'JPEG' | 'WEBP' | 'AVIF',
    quality: number
  ) => {
    const escaped = jsString(folderPath);
    const q = Math.max(0, Math.min(100, Math.round(quality)));
    const ext = format === 'JPEG' ? 'jpg' : format.toLowerCase();
    return `
    ${helperFunctions}
    ${artboardHelpers}
    ${getContextInfo}

    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var abs = __mcp_listArtboards();
    if (abs.length === 0) {
      return {
        ok: false,
        code: 'artboard_not_found',
        message: 'Document has no artboards',
        suggested_next_tool: 'photoshop_create_artboard'
      };
    }
    var folder = new Folder("${escaped}");
    if (!folder.exists) {
      folder.create();
    }
    var ext = '${ext}';
    var used = {};
    var exported = [];
    var failed = [];
    for (var i = 0; i < abs.length; i++) {
      var ab = abs[i];
      var base = __mcp_safeFileName(ab.name || ('Artboard_' + ab.id));
      if (used[base]) {
        base = base + '_' + ab.id;
      }
      used[base] = true;
      var outPath = folder.fsName + '/' + base + '.' + ext;
      var dup = null;
      try {
        dup = __mcp_duplicateCropToArtboard(ab);
        var outFile = new File(outPath);
        var result = __mcp_exportDoc(dup, outFile, '${format}', ${q});
        dup.close(SaveOptions.DONOTSAVECHANGES);
        dup = null;
        if (result.ok === false) {
          failed.push({ id: ab.id, name: ab.name, error: result.message || 'export failed' });
        } else {
          exported.push({ id: ab.id, name: ab.name, path: outFile.fsName, method: result.method });
        }
      } catch (eExp) {
        if (dup) {
          try { dup.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
        }
        failed.push({ id: ab.id, name: ab.name, error: eExp.message || String(eExp) });
      }
    }
    if (exported.length === 0) {
      return {
        ok: false,
        code: 'version_unsupported',
        message: 'No artboards exported. First error: ' + (failed.length ? failed[0].error : 'unknown'),
        suggested_next_tool: 'photoshop_export_as'
      };
    }
    return {
      ok: true,
      count: exported.length,
      exported: exported,
      failed: failed,
      folder: folder.fsName,
      format: '${format}',
      context: getContextInfo()
    };
  `;
  },
};

/**
 * Generate ExtendScript code with error handling
 */
export function generateExtendScript(code: string): string {
  return `
(function() {
  try {
    ${code}
  } catch (error) {
    return 'ERROR: ' + (error.message || String(error));
  }
})();
  `.trim();
}
