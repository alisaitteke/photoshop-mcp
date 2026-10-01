import { ToolDefinition, ToolResult } from '../../core/tool-registry.js';
import { resolveExportPath } from '../../lib/export-paths.js';
import { PhotoshopConnection } from '../../platform/connection.js';
import { clampInt, executeRecipe, jsString, BATCH_SCRIPT_TIMEOUT_MS } from './_shared.js';

const TOOL_NAME = 'photoshop_recipe_export_social_variants';

interface PlatformSpec {
  slug: string;
  width: number;
  height: number;
}

const PLATFORM_SPECS: Record<string, PlatformSpec> = {
  instagram_post: { slug: 'instagram_post', width: 1080, height: 1080 },
  instagram_story: { slug: 'instagram_story', width: 1080, height: 1920 },
  instagram_reel: { slug: 'instagram_reel', width: 1080, height: 1920 },
  x_post: { slug: 'x_post', width: 1600, height: 900 },
  x_header: { slug: 'x_header', width: 1500, height: 500 },
  facebook_post: { slug: 'facebook_post', width: 1200, height: 630 },
  facebook_cover: { slug: 'facebook_cover', width: 1640, height: 624 },
  linkedin_post: { slug: 'linkedin_post', width: 1200, height: 627 },
  linkedin_banner: { slug: 'linkedin_banner', width: 1584, height: 396 },
  youtube_thumbnail: { slug: 'youtube_thumbnail', width: 1280, height: 720 },
  tiktok_vertical: { slug: 'tiktok_vertical', width: 1080, height: 1920 },
  pinterest_pin: { slug: 'pinterest_pin', width: 1000, height: 1500 },
};

const DEFAULT_PLATFORMS = ['instagram_post', 'instagram_story', 'x_post'];

export function bindExportSocialVariants(connection: PhotoshopConnection): ToolDefinition {
  return {
    tool: {
      name: TOOL_NAME,
      description:
        'Render one JPEG per requested social-media platform from the active document. Each variant is center-cropped/resized to the platform spec and saved to disk.\n' +
        '\n' +
        'Use when: the user wants multi-platform deliverables in one shot.\n' +
        'Do NOT use when: only one export is needed (use photoshop_recipe_prepare_for_web instead) or when platforms differ by content rather than crop (recipe does not change content, only frame).\n' +
        '\n' +
        'Returns: { ok, summary, output_paths, details: { variants } }.\n' +
        '\n' +
        'Preconditions: active document. Aspect ratios that differ from the source result in a center-crop (no padding).\n' +
        'Side effects: writes one file per platform; source unchanged.',
      inputSchema: {
        type: 'object',
        properties: {
          platforms: {
            type: 'array',
            description: `Slugs of platforms to export. Known: ${Object.keys(PLATFORM_SPECS).join(', ')}. Default: ${DEFAULT_PLATFORMS.join(', ')}.`,
            items: { type: 'string', enum: Object.keys(PLATFORM_SPECS) },
            default: DEFAULT_PLATFORMS,
          },
          quality: {
            type: 'number',
            description: 'JPEG quality on the Photoshop 1-12 scale. Default 9.',
            minimum: 1,
            maximum: 12,
            default: 9,
          },
        },
      },
    },
    handler: async (args) => runExportSocialVariants(connection, args),
  };
}

async function runExportSocialVariants(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const platforms = parsePlatforms(args.platforms);
  if (platforms.length === 0) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              ok: false,
              code: 'invalid_arguments',
              message: 'No valid platform slugs provided.',
              suggested_next_tool: TOOL_NAME,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const quality = clampQuality(args.quality);

  const variants = platforms.map((spec) => {
    const path = resolveExportPath(`social-${spec.slug}-${Date.now()}.jpg`, 'jpg');
    return { ...spec, path };
  });

  const variantsLiteral = variants
    .map(
      (v) =>
        `{ slug: "${jsString(v.slug)}", width: ${v.width}, height: ${v.height}, path: "${jsString(v.path)}" }`
    )
    .join(', ');

  const body = `
    var src = app.activeDocument;
    var variants = [${variantsLiteral}];
    var produced = [];

    for (var i = 0; i < variants.length; i++) {
      var spec = variants[i];
      var dupName = 'mcp-social-' + spec.slug + '-' + (new Date()).getTime();
      var dup = src.duplicate(dupName, true);
      try {
        try {
          dup.convertProfile('sRGB IEC61966-2.1', Intent.RELATIVECOLORIMETRIC, true, true);
        } catch (eProfile) {}

        var sw = dup.width.as('px');
        var sh = dup.height.as('px');
        var srcRatio = sw / sh;
        var tgtRatio = spec.width / spec.height;
        var cropW, cropH;
        if (srcRatio > tgtRatio) {
          cropH = sh;
          cropW = Math.round(sh * tgtRatio);
        } else {
          cropW = sw;
          cropH = Math.round(sw / tgtRatio);
        }
        var left = Math.round((sw - cropW) / 2);
        var top = Math.round((sh - cropH) / 2);
        try {
          dup.crop([left, top, left + cropW, top + cropH]);
        } catch (eCrop) {
          return { ok: false, code: 'recipe_runtime_error', message: 'Crop failed for ' + spec.slug + ': ' + (eCrop.message || eCrop) };
        }

        dup.resizeImage(
          UnitValue(spec.width, 'px'),
          UnitValue(spec.height, 'px'),
          null,
          ResampleMethod.BICUBICSHARPER
        );

        var outFile = new File(spec.path);
        var jpegOptions = new JPEGSaveOptions();
        jpegOptions.quality = ${quality};
        jpegOptions.embedColorProfile = true;
        dup.saveAs(outFile, jpegOptions, true);

        produced.push({ slug: spec.slug, path: outFile.fsName, width: spec.width, height: spec.height });
        dup.close(SaveOptions.DONOTSAVECHANGES);
      } catch (eVariant) {
        try { dup.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
        return { ok: false, code: 'recipe_runtime_error', message: 'Variant ' + spec.slug + ' failed: ' + (eVariant.message || eVariant) };
      }
    }

    var paths = [];
    for (var k = 0; k < produced.length; k++) {
      paths.push(produced[k].path);
    }

    return {
      ok: true,
      summary: 'Exported ' + produced.length + ' social variant(s)',
      undo_history_states_consumed: 0,
      output_paths: paths,
      details: { variants: produced }
    };
  `;

  return executeRecipe(connection, 'Export Social Variants', body, BATCH_SCRIPT_TIMEOUT_MS);
}

function parsePlatforms(raw: unknown): PlatformSpec[] {
  let slugs: string[];
  if (Array.isArray(raw)) {
    slugs = raw.filter((s): s is string => typeof s === 'string');
  } else if (typeof raw === 'string') {
    slugs = raw.split(/[,\s]+/g).filter((s) => s.length > 0);
  } else {
    slugs = DEFAULT_PLATFORMS;
  }
  if (slugs.length === 0) slugs = DEFAULT_PLATFORMS;
  const out: PlatformSpec[] = [];
  const seen = new Set<string>();
  for (const s of slugs) {
    const key = s.trim().toLowerCase();
    if (seen.has(key)) continue;
    const spec = PLATFORM_SPECS[key];
    if (spec) {
      out.push(spec);
      seen.add(key);
    }
  }
  return out;
}

function clampQuality(raw: unknown): number {
  return clampInt(raw, 1, 12, 9);
}
