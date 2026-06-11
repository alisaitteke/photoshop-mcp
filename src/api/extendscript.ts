/**
 * Helper functions for ExtendScript API
 * ExtendScript is the legacy scripting API for Photoshop
 */

import { jsString } from '../utils/js-string.js';

/**
 * Helper functions for character/string ID conversion
 */
const helperFunctions = `
function cTID(s) { return app.charIDToTypeID(s); }
function sTID(s) { return app.stringIDToTypeID(s); }
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
 * Helper function to get current context information
 */
const getContextInfo = `
function getContextInfo() {
  var context = {
    hasDocument: app.documents.length > 0
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
   * Create a text layer
   */
  createTextLayer: (text: string, x = 100, y = 100, fontSize = 24, fontName?: string) => `
    ${getContextInfo}
    ${resolveFontPostScriptName}
    
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
    
    var result = {
      created: true,
      layerName: textLayer.name,
      text: "${jsString(text)}",
      position: { x: ${x}, y: ${y} },
      fontSize: ${fontSize},
      ${fontName ? `font: textLayer.textItem.font,` : ''}
      context: getContextInfo()
    };
    return result;
  `,

  /**
   * Place an image file as a layer
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
    
    // Place image using ActionDescriptor
    var desc = new ActionDescriptor();
    desc.putPath(cTID('null'), imageFile);
    desc.putEnumerated(cTID('FTcs'), cTID('QCSt'), cTID('Qcsa'));
    
    var offsetDesc = new ActionDescriptor();
    offsetDesc.putUnitDouble(cTID('Hrzn'), cTID('#Pxl'), ${x});
    offsetDesc.putUnitDouble(cTID('Vrtc'), cTID('#Pxl'), ${y});
    desc.putObject(cTID('Ofst'), cTID('Ofst'), offsetDesc);
    
    executeAction(cTID('Plc '), desc, DialogModes.NO);
    
    var result = {
      placed: true,
      filePath: "${jsString(filePath)}",
      position: { x: ${x}, y: ${y} },
      context: getContextInfo()
    };
    try {
      var layer = app.activeDocument.activeLayer;
      result.layerName = layer.name;
      var bounds = layer.bounds;
      result.layerBounds = {
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
          layers.push({
            name: layer.name,
            kind: String(layer.kind),
            visible: layer.visible,
            opacity: layer.opacity,
            blendMode: String(layer.blendMode)
          });
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
   * Set layer blend mode
   */
  setLayerBlendMode: (blendMode: string) => `
    ${getContextInfo}
    
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    layer.blendMode = BlendMode.${blendMode};
    
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
   * Duplicate active layer
   */
  duplicateLayer: (newName?: string) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    
    var duplicated = layer.duplicate();
    ${newName ? `duplicated.name = "${jsString(newName)}";` : ''}
    
    return { 
      originalName: layer.name,
      newName: duplicated.name
    };
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

  /**
   * Create rectangular selection
   */
  selectRectangle: (left: number, top: number, right: number, bottom: number) => `
    if (app.documents.length === 0) {
      throw new Error('No active document');
    }
    var doc = app.activeDocument;
    
    var bounds = [[${left}, ${top}], [${right}, ${top}], [${right}, ${bottom}], [${left}, ${bottom}]];
    doc.selection.select(bounds);
    
    return { 
      selection: 'rectangle',
      bounds: [${left}, ${top}, ${right}, ${bottom}]
    };
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
    ${getContextInfo}
    return getContextInfo();
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
