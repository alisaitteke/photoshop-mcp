import { ToolDefinition, ToolResult } from '../../core/tool-registry.js';
import { resolveExportPath } from '../../lib/export-paths.js';
import { PhotoshopConnection } from '../../platform/connection.js';
import { PhotoshopDetector } from '../../platform/detector.js';
import { clampInt, executeRecipe, jsString, toolFailure } from './_shared.js';

const TOOL_NAME = 'photoshop_recipe_passport_photo';

interface PassportSpec {
  slug: string;
  label: string;
  width: number;
  height: number;
}

/** All specs at 300 DPI. */
const SPECS: Record<string, PassportSpec> = {
  us_2x2: { slug: 'us_2x2', label: 'US passport/visa 2×2 in', width: 600, height: 600 },
  eu_35x45: { slug: 'eu_35x45', label: 'EU/Schengen 35×45 mm', width: 413, height: 531 },
  tr_50x60: { slug: 'tr_50x60', label: 'Türkiye biyometrik 50×60 mm', width: 591, height: 709 },
};

const SHEET_W = 1200; // 10 cm @ 300 DPI
const SHEET_H = 1800; // 15 cm @ 300 DPI

export function bindPassportPhoto(connection: PhotoshopConnection): ToolDefinition {
  return {
    tool: {
      name: TOOL_NAME,
      description:
        'Turn the active portrait into a passport/ID photo: removes the background via Select Subject, replaces it with white, crops around the subject with ICAO-style headroom, resizes to the exact official pixel size at 300 DPI, and exports a JPEG. Optionally also builds a 10×15 cm print sheet with multiple copies.\n' +
        '\n' +
        'Use when: passport photo, visa photo, ID photo, vesikalık, biyometrik fotoğraf.\n' +
        'Do NOT use when: the document has no clear single subject, or official compliance must be guaranteed — head-size rules are approximated from subject bounds (no face detection); official acceptance is NOT guaranteed.\n' +
        '\n' +
        'Returns: { ok, summary, output_paths, details: { spec, width, height, sheet } }.\n' +
        '\n' +
        'Preconditions: PS ≥ 23 (Select Subject v2); active document with a single-person portrait.\n' +
        'Side effects: writes one JPEG (+ one sheet JPEG when make_sheet); source document is unchanged.',
      inputSchema: {
        type: 'object',
        properties: {
          spec: {
            type: 'string',
            enum: Object.keys(SPECS),
            description:
              'Target size: us_2x2 (600×600 px), eu_35x45 (413×531 px), tr_50x60 (591×709 px). All at 300 DPI. Default us_2x2.',
            default: 'us_2x2',
          },
          make_sheet: {
            type: 'boolean',
            description:
              'Also export a 10×15 cm (1200×1800 px @300 DPI) print sheet tiled with copies. Default false.',
            default: false,
          },
          quality: {
            type: 'number',
            description: 'JPEG quality on the Photoshop 1-12 scale. Default 11.',
            minimum: 1,
            maximum: 12,
            default: 11,
          },
        },
      },
    },
    handler: async (args) => runPassportPhoto(connection, args),
  };
}

async function runPassportPhoto(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const specRaw = typeof args.spec === 'string' ? args.spec.trim().toLowerCase() : '';
  const spec = SPECS[specRaw] ?? SPECS.us_2x2;
  const makeSheet = args.make_sheet === true;
  const quality = clampInt(args.quality, 1, 12, 11);

  await connection.ping().catch(() => undefined);
  const info = connection.getPhotoshopInfo();
  if (info) {
    const detector = new PhotoshopDetector();
    if (!detector.supportsSelectSubjectV2(info.version)) {
      return toolFailure({
        ok: false,
        code: 'version_unsupported',
        message: `Select Subject v2 requires Photoshop 23.0+; detected version ${info.version}. Upgrade Photoshop first.`,
        suggested_next_tool: 'photoshop_get_capabilities',
      });
    }
  }

  const photoPath = resolveExportPath(`passport-${spec.slug}-${Date.now()}.jpg`, 'jpg');
  const sheetPath = makeSheet
    ? resolveExportPath(`passport-${spec.slug}-sheet-${Date.now()}.jpg`, 'jpg')
    : '';

  const body = `
    var src = app.activeDocument;
    var doc = src.duplicate('mcp-passport-' + (new Date()).getTime(), true);

    function failPassport(errObj) {
      try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eCloseF) {}
      return errObj;
    }

    try {
      app.displayDialogs = DialogModes.NO;

      var subjectSelected = false;
      try {
        doc.selection.selectSubject();
        subjectSelected = true;
      } catch (eDomSubject) {}
      if (!subjectSelected) {
        try {
          var cutoutDesc = new ActionDescriptor();
          cutoutDesc.putBoolean(stringIDToTypeID('sampleAllLayers'), false);
          executeAction(stringIDToTypeID('autoCutout'), cutoutDesc, DialogModes.NO);
          subjectSelected = true;
        } catch (eSelectSubject) {
          return failPassport({ ok: false, code: 'generative_unavailable', message: 'Select Subject is not available: ' + (eSelectSubject.message || eSelectSubject), suggested_next_tool: 'photoshop_get_capabilities' });
        }
      }

      var sb = null;
      try { sb = doc.selection.bounds; } catch (eBounds) { sb = null; }
      if (!sb) {
        return failPassport({ ok: false, code: 'selection_required', message: 'Select Subject found no subject — use a document with a clear single-person portrait.' });
      }

      var sbL = sb[0].as('px'), sbT = sb[1].as('px'), sbR = sb[2].as('px'), sbB = sb[3].as('px');
      var subjectW = sbR - sbL;
      var subjectH = sbB - sbT;
      if (subjectW < 20 || subjectH < 20) {
        return failPassport({ ok: false, code: 'selection_required', message: 'Detected subject is too small (' + Math.round(subjectW) + 'x' + Math.round(subjectH) + 'px) to frame a passport photo.' });
      }

      // White background: invert subject selection and fill.
      var white = new SolidColor();
      white.rgb.red = 255;
      white.rgb.green = 255;
      white.rgb.blue = 255;
      doc.selection.invert();
      doc.selection.fill(white);
      doc.selection.deselect();

      // ICAO-style framing: subject ≈ 72% of frame height, ~10% headroom above.
      var docW = doc.width.as('px');
      var docH = doc.height.as('px');
      var aspect = ${spec.width} / ${spec.height};
      var cropH = subjectH / 0.72;
      var cropW = cropH * aspect;
      if (cropW > docW) { cropW = docW; cropH = cropW / aspect; }
      if (cropH > docH) { cropH = docH; cropW = cropH * aspect; }
      var cropLeft = (sbL + sbR) / 2 - cropW / 2;
      var cropTop = sbT - 0.10 * cropH;
      if (cropLeft < 0) cropLeft = 0;
      if (cropTop < 0) cropTop = 0;
      if (cropLeft + cropW > docW) cropLeft = docW - cropW;
      if (cropTop + cropH > docH) cropTop = docH - cropH;

      doc.crop([Math.round(cropLeft), Math.round(cropTop), Math.round(cropLeft + cropW), Math.round(cropTop + cropH)]);
      doc.resizeImage(
        UnitValue(${spec.width}, 'px'),
        UnitValue(${spec.height}, 'px'),
        300,
        ResampleMethod.BICUBIC
      );

      var photoFile = new File("${jsString(photoPath)}");
      var jpegOptions = new JPEGSaveOptions();
      jpegOptions.quality = ${quality};
      jpegOptions.embedColorProfile = true;
      doc.saveAs(photoFile, jpegOptions, true);

      var paths = [photoFile.fsName];
      var sheetCopies = 0;

      if (${makeSheet ? 'true' : 'false'}) {
        try { doc.activeLayer.isBackgroundLayer = false; } catch (eBg) {}
        var cols = Math.floor(${SHEET_W} / ${spec.width});
        var rows = Math.floor(${SHEET_H} / ${spec.height});
        var sheet = app.documents.add(
          UnitValue(${SHEET_W}, 'px'),
          UnitValue(${SHEET_H}, 'px'),
          300,
          'mcp-passport-sheet',
          NewDocumentMode.RGB,
          DocumentFill.WHITE
        );
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var copyLayer = doc.artLayers[0].duplicate(sheet, ElementPlacement.PLACEATEND);
            var cb = copyLayer.bounds;
            copyLayer.translate(
              new UnitValue(c * ${spec.width} - cb[0].as('px'), 'px'),
              new UnitValue(r * ${spec.height} - cb[1].as('px'), 'px')
            );
            sheetCopies++;
          }
        }
        var sheetFile = new File("${jsString(sheetPath)}");
        sheet.saveAs(sheetFile, jpegOptions, true);
        sheet.close(SaveOptions.DONOTSAVECHANGES);
        paths.push(sheetFile.fsName);
      }

      doc.close(SaveOptions.DONOTSAVECHANGES);

      return {
        ok: true,
        summary: 'Passport photo exported at ${spec.width}×${spec.height}px @300DPI (${spec.label})' + (sheetCopies ? ' + print sheet with ' + sheetCopies + ' copies' : ''),
        undo_history_states_consumed: 0,
        output_paths: paths,
        details: { spec: '${spec.slug}', width: ${spec.width}, height: ${spec.height}, sheet: ${makeSheet ? 'true' : 'false'}, sheet_copies: sheetCopies }
      };
    } catch (ePassport) {
      try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
      return { ok: false, code: 'recipe_runtime_error', message: 'Passport photo failed: ' + (ePassport.message || ePassport) };
    }
  `;

  return executeRecipe(connection, 'Passport Photo', body);
}
