import { readdir, stat } from 'node:fs/promises';
import { extname, isAbsolute, join } from 'node:path';
import { ToolDefinition, ToolResult } from '../../core/tool-registry.js';
import { resolveExportPath } from '../../lib/export-paths.js';
import { PhotoshopConnection } from '../../platform/connection.js';
import {
  BATCH_SCRIPT_TIMEOUT_MS,
  clampInt,
  executeRecipe,
  jsString,
  RECIPE_ACTION_HELPERS,
  toolFailure,
} from './_shared.js';
import { MCP_SMART_OBJECT_HELPERS } from '../../api/extendscript.js';

const TOOL_NAME = 'photoshop_recipe_batch_mockup_replace';

const SUPPORTED_ASSET_EXTS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.tif',
  '.tiff',
  '.psd',
  '.psb',
  '.webp',
]);

export function bindBatchMockupReplace(connection: PhotoshopConnection): ToolDefinition {
  return {
    tool: {
      name: TOOL_NAME,
      description:
        "Iterate a directory of asset images, replace the contents of the named Smart Object in the active mockup PSD for each asset, and export a flattened JPEG per variant. The mockup's perspective/warp on the Smart Object is preserved.\n" +
        '\n' +
        'Use when: the user has a mockup PSD and wants to render it once per design asset (logos, screens, product photos).\n' +
        'Do NOT use when: the asset is not a single layer (use photoshop_place_image manually) or when the active document has no Smart Object with the requested name.\n' +
        '\n' +
        'Returns: { ok, summary, output_paths, details: { variants: [{ source_asset, output_path }] } }.\n' +
        '\n' +
        'Preconditions: active document containing a Smart Object layer named exactly as requested; assets_dir must exist and be readable.\n' +
        'Side effects: writes one JPEG per asset; the active mockup PSD ends up with the LAST asset placed.',
      inputSchema: {
        type: 'object',
        properties: {
          smart_object_layer_name: {
            type: 'string',
            description:
              'Exact name of the Smart Object layer in the active document. Case-sensitive.',
          },
          assets_dir: {
            type: 'string',
            description:
              'Absolute path to the directory containing asset files. Subdirectories are NOT recursed. Allowed extensions: jpg/jpeg/png/tif/tiff/psd/psb/webp.',
          },
          quality: {
            type: 'number',
            description: 'JPEG quality on the Photoshop 1-12 scale. Default 10.',
            minimum: 1,
            maximum: 12,
            default: 10,
          },
        },
        required: ['smart_object_layer_name', 'assets_dir'],
      },
    },
    handler: async (args) => runBatchMockupReplace(connection, args),
  };
}

async function runBatchMockupReplace(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const layerName =
    typeof args.smart_object_layer_name === 'string' ? args.smart_object_layer_name.trim() : '';
  const assetsDir = typeof args.assets_dir === 'string' ? args.assets_dir.trim() : '';
  const quality = clampInt(args.quality, 1, 12, 10);

  if (!layerName) {
    return toolFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'smart_object_layer_name is required.',
    });
  }
  if (!assetsDir || !isAbsolute(assetsDir)) {
    return toolFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'assets_dir must be an absolute path.',
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
      message: `No supported assets in ${assetsDir}. Supported: ${[...SUPPORTED_ASSET_EXTS].join(', ')}`,
    });
  }

  const variantsLiteral = assets
    .map((assetPath) => {
      const baseName = baseNameWithoutExt(assetPath);
      const outPath = resolveExportPath(`mockup-${baseName}-${Date.now()}.jpg`, 'jpg');
      return `{ asset: "${jsString(assetPath)}", base: "${jsString(baseName)}", out: "${jsString(outPath)}" }`;
    })
    .join(', ');

  const body = `
    ${RECIPE_ACTION_HELPERS}
    ${MCP_SMART_OBJECT_HELPERS}

    var doc = app.activeDocument;
    var targetName = "${jsString(layerName)}";
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
      return { ok: false, code: 'layer_not_found', message: 'Smart Object layer not found: ' + targetName, suggested_next_tool: 'photoshop_get_layers' };
    }
    if (target.kind !== LayerKind.SMARTOBJECT) {
      return { ok: false, code: 'unsupported_color_mode', message: 'Target layer "' + targetName + '" is not a Smart Object (kind=' + target.kind + ').', suggested_next_tool: 'photoshop_get_layers' };
    }
    doc.activeLayer = target;

    var variants = [${variantsLiteral}];
    var produced = [];

    for (var v = 0; v < variants.length; v++) {
      var spec = variants[v];
      try {
        var assetFile = new File(spec.asset);
        if (!assetFile.exists) {
          return { ok: false, code: 'file_not_found', message: 'Asset missing on disk: ' + spec.asset };
        }
        var rep = __mcp_replaceSmartObjectContents(spec.asset);
        if (!rep.ok) return rep;

        var outFile = new File(spec.out);
        var jpegOptions = new JPEGSaveOptions();
        jpegOptions.quality = ${quality};
        jpegOptions.embedColorProfile = true;
        var flatDup = doc.duplicate('mcp-mockup-out-' + spec.base, true);
        try {
          flatDup.saveAs(outFile, jpegOptions, true);
          produced.push({ source_asset: spec.asset, output_path: outFile.fsName });
        } finally {
          try { flatDup.close(SaveOptions.DONOTSAVECHANGES); } catch (eCloseF) {}
        }
      } catch (eVariant) {
        return { ok: false, code: 'recipe_runtime_error', message: 'Variant ' + spec.asset + ' failed: ' + (eVariant.message || eVariant) };
      }
    }

    var paths = [];
    for (var k = 0; k < produced.length; k++) {
      paths.push(produced[k].output_path);
    }

    return {
      ok: true,
      summary: 'Rendered ' + produced.length + ' mockup variant(s) into the export directory',
      undo_history_states_consumed: produced.length,
      output_paths: paths,
      details: { variants: produced, target_layer: targetName }
    };
  `;

  return executeRecipe(connection, 'Batch Mockup Replace', body, BATCH_SCRIPT_TIMEOUT_MS);
}

function baseNameWithoutExt(p: string): string {
  const segments = p.split(/[/\\]/g);
  const fileName = segments[segments.length - 1] ?? p;
  const idx = fileName.lastIndexOf('.');
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}
