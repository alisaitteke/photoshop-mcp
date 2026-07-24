import { readdir, stat } from 'node:fs/promises';
import { extname, isAbsolute, join } from 'node:path';
import { ToolDefinition, ToolResult } from '../../core/tool-registry.js';
import { resolveExportPath } from '../../lib/export-paths.js';
import { PhotoshopConnection } from '../../platform/connection.js';
import { clampInt, executeStandaloneRecipe, jsString, toolFailure } from './_shared.js';

const TOOL_NAME = 'photoshop_recipe_batch_watermark';

const SUPPORTED_ASSET_EXTS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp']);

const POSITIONS = ['bottom_right', 'bottom_left', 'top_right', 'top_left', 'center'] as const;
type WatermarkPosition = (typeof POSITIONS)[number];

export function bindBatchWatermark(connection: PhotoshopConnection): ToolDefinition {
  return {
    tool: {
      name: TOOL_NAME,
      description:
        'Apply a text or logo watermark to every image in a folder and export watermarked JPEGs. Replaces the clunky record-an-action + File > Automate > Batch workflow.\n' +
        '\n' +
        'Use when: the user wants to watermark many photos at once (copyright text, studio logo).\n' +
        'Do NOT use when: watermarking a single open document (use photoshop_create_text_layer / photoshop_place_image directly) or removing watermarks (not supported).\n' +
        '\n' +
        'Returns: { ok, summary, output_paths, details: { processed, failed: [{ file, error }] } }. Files that fail are skipped, not fatal.\n' +
        '\n' +
        'Preconditions: assets_dir exists; either text or logo_path given. No active document required.\n' +
        'Side effects: writes one JPEG per source image; source files are never modified.',
      inputSchema: {
        type: 'object',
        properties: {
          assets_dir: {
            type: 'string',
            description:
              'Absolute path to the folder of images to watermark. Subdirectories are NOT recursed. Allowed extensions: jpg/jpeg/png/tif/tiff/webp.',
          },
          text: {
            type: 'string',
            description:
              'Watermark text (e.g. "© Jane Doe 2026"). White, semi-transparent. Required unless logo_path is given.',
          },
          logo_path: {
            type: 'string',
            description:
              'Absolute path to a logo image (transparent PNG recommended). Required unless text is given. If both are given, text wins.',
          },
          position: {
            type: 'string',
            enum: POSITIONS,
            description: 'Watermark placement. Default bottom_right.',
            default: 'bottom_right',
          },
          opacity: {
            type: 'number',
            description: 'Watermark layer opacity 0-100. Default 40.',
            minimum: 0,
            maximum: 100,
            default: 40,
          },
          margin_px: {
            type: 'number',
            description:
              'Distance from the chosen edge(s) in pixels. Default 24 (ignored for center).',
            minimum: 0,
            default: 24,
          },
          font_size: {
            type: 'number',
            description:
              'Text watermark size in pixels. Default 0 = auto (4% of each image height, min 8px).',
            minimum: 0,
            default: 0,
          },
          scale_pct: {
            type: 'number',
            description:
              'Logo watermark width as a percentage of image width (1-100). Default 15. Logo mode only.',
            minimum: 1,
            maximum: 100,
            default: 15,
          },
          quality: {
            type: 'number',
            description: 'JPEG quality on the Photoshop 1-12 scale. Default 10.',
            minimum: 1,
            maximum: 12,
            default: 10,
          },
        },
        required: ['assets_dir'],
      },
    },
    handler: async (args) => runBatchWatermark(connection, args),
  };
}

async function runBatchWatermark(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const assetsDir = typeof args.assets_dir === 'string' ? args.assets_dir.trim() : '';
  const text = typeof args.text === 'string' ? args.text.trim() : '';
  const logoPath = typeof args.logo_path === 'string' ? args.logo_path.trim() : '';
  const quality = clampInt(args.quality, 1, 12, 10);
  const opacity = clampInt(args.opacity, 0, 100, 40);
  const marginPx = clampInt(args.margin_px, 0, 10000, 24);
  const fontSize = clampInt(args.font_size, 0, 2000, 0);
  const scalePct = clampInt(args.scale_pct, 1, 100, 15);

  const positionRaw = typeof args.position === 'string' ? args.position.trim() : '';
  const position: WatermarkPosition = (POSITIONS as readonly string[]).includes(positionRaw)
    ? (positionRaw as WatermarkPosition)
    : 'bottom_right';

  if (!assetsDir || !isAbsolute(assetsDir)) {
    return toolFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'assets_dir must be an absolute path.',
    });
  }
  if (!text && !logoPath) {
    return toolFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'Provide either text or logo_path for the watermark.',
      suggested_next_tool: TOOL_NAME,
    });
  }
  if (logoPath && !text && !isAbsolute(logoPath)) {
    return toolFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'logo_path must be an absolute path.',
    });
  }

  let entries: string[];
  try {
    const dirStat = await stat(assetsDir);
    if (!dirStat.isDirectory()) {
      return toolFailure({
        ok: false,
        code: 'file_not_found',
        message: `assets_dir is not a directory: ${assetsDir}`,
      });
    }
    entries = await readdir(assetsDir);
  } catch (error) {
    return toolFailure({
      ok: false,
      code: 'file_not_found',
      message: `Cannot read assets_dir: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const assets = entries
    .filter((name) => SUPPORTED_ASSET_EXTS.has(extname(name).toLowerCase()))
    .sort()
    .map((name) => join(assetsDir, name));

  if (assets.length === 0) {
    return toolFailure({
      ok: false,
      code: 'file_not_found',
      message: `No supported images in ${assetsDir}. Supported: ${[...SUPPORTED_ASSET_EXTS].join(', ')}`,
    });
  }

  if (logoPath && !text) {
    try {
      const logoStat = await stat(logoPath);
      if (!logoStat.isFile()) {
        return toolFailure({
          ok: false,
          code: 'file_not_found',
          message: `logo_path is not a file: ${logoPath}`,
        });
      }
    } catch {
      return toolFailure({
        ok: false,
        code: 'file_not_found',
        message: `Cannot read logo_path: ${logoPath}`,
      });
    }
  }

  const useText = text.length > 0;
  const stamp = Date.now();
  const jobsLiteral = assets
    .map((assetPath) => {
      const outPath = resolveExportPath(`wm-${baseNameWithoutExt(assetPath)}-${stamp}.jpg`, 'jpg');
      return `{ asset: "${jsString(assetPath)}", out: "${jsString(outPath)}" }`;
    })
    .join(', ');

  const watermarkSnippet = useText
    ? `
      var wmLayer = doc.artLayers.add();
      wmLayer.kind = LayerKind.TEXT;
      var ti = wmLayer.textItem;
      ti.contents = "${jsString(text)}";
      var fs = ${fontSize};
      if (fs <= 0) fs = Math.max(8, Math.round(H * 0.04));
      ti.size = new UnitValue(fs, 'px');
      var wmColor = new SolidColor();
      wmColor.rgb.red = 255;
      wmColor.rgb.green = 255;
      wmColor.rgb.blue = 255;
      ti.color = wmColor;
      ti.position = [new UnitValue(${marginPx}, 'px'), new UnitValue(fs + ${marginPx}, 'px')];
      __mcp_positionLayer(wmLayer, doc, "${position}", ${marginPx});
      wmLayer.opacity = ${opacity};
    `
    : `
      var placeDesc = new ActionDescriptor();
      placeDesc.putPath(cTID('null'), new File("${jsString(logoPath)}"));
      executeAction(cTID('Plc '), placeDesc, DialogModes.NO);
      var wmLayer = doc.activeLayer;
      var pb = wmLayer.bounds;
      var pw = pb[2].as('px') - pb[0].as('px');
      if (pw > 0) {
        var factor = ((W * ${scalePct}) / 100 / pw) * 100;
        wmLayer.resize(factor, factor, AnchorPosition.MIDDLECENTER);
      }
      __mcp_positionLayer(wmLayer, doc, "${position}", ${marginPx});
      wmLayer.opacity = ${opacity};
    `;

  const body = `
    function __mcp_positionLayer(layer, doc, position, margin) {
      var b = layer.bounds;
      var lw = b[2].as('px') - b[0].as('px');
      var lh = b[3].as('px') - b[1].as('px');
      var W = doc.width.as('px');
      var H = doc.height.as('px');
      var targetLeft, targetTop;
      if (position === 'top_left') {
        targetLeft = margin; targetTop = margin;
      } else if (position === 'top_right') {
        targetLeft = W - margin - lw; targetTop = margin;
      } else if (position === 'bottom_left') {
        targetLeft = margin; targetTop = H - margin - lh;
      } else if (position === 'center') {
        targetLeft = (W - lw) / 2; targetTop = (H - lh) / 2;
      } else {
        targetLeft = W - margin - lw; targetTop = H - margin - lh;
      }
      layer.translate(
        new UnitValue(targetLeft - b[0].as('px'), 'px'),
        new UnitValue(targetTop - b[1].as('px'), 'px')
      );
    }

    var jobs = [${jobsLiteral}];
    var produced = [];
    var failed = [];
    var previousDialogs = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;

    for (var j = 0; j < jobs.length; j++) {
      var spec = jobs[j];
      var doc = null;
      try {
        doc = app.open(new File(spec.asset));
        var W = doc.width.as('px');
        var H = doc.height.as('px');
        ${watermarkSnippet}

        var outFile = new File(spec.out);
        var jpegOptions = new JPEGSaveOptions();
        jpegOptions.quality = ${quality};
        jpegOptions.embedColorProfile = true;
        doc.saveAs(outFile, jpegOptions, true);
        produced.push(outFile.fsName);
      } catch (eJob) {
        failed.push({ file: spec.asset, error: String(eJob.message || eJob) });
      } finally {
        if (doc) {
          try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
        }
      }
    }

    app.displayDialogs = previousDialogs;

    if (produced.length === 0) {
      return { ok: false, code: 'recipe_runtime_error', message: 'No images could be watermarked. First error: ' + (failed.length ? failed[0].error : 'unknown') };
    }

    return {
      ok: true,
      summary: 'Watermarked ' + produced.length + ' image(s)' + (failed.length ? ', ' + failed.length + ' failed' : ''),
      undo_history_states_consumed: 0,
      output_paths: produced,
      details: { processed: produced.length, failed: failed }
    };
  `;

  return executeStandaloneRecipe(connection, body);
}

function baseNameWithoutExt(p: string): string {
  const segments = p.split(/[/\\]/g);
  const fileName = segments[segments.length - 1] ?? p;
  const idx = fileName.lastIndexOf('.');
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}
