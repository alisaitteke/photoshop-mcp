import { ToolDefinition, ToolResult } from '../../core/tool-registry.js';
import { resolveExportPath } from '../../lib/export-paths.js';
import { PhotoshopConnection } from '../../platform/connection.js';
import { clampInt, executeRecipe, jsString, toolFailure } from './_shared.js';

const TOOL_NAME = 'photoshop_recipe_split_carousel';

const MIN_SLIDES = 2;
const MAX_SLIDES = 10;

type CarouselFormat = 'jpg' | 'png';

export function bindSplitCarousel(connection: PhotoshopConnection): ToolDefinition {
  return {
    tool: {
      name: TOOL_NAME,
      description:
        'Split the active wide document into N equal vertical slices and export them as sequentially numbered files for a seamless Instagram/TikTok carousel (panorama swipe effect).\n' +
        '\n' +
        'Use when: the user wants a seamless/swipeable carousel, split panorama, or multi-slide export of one wide design. Typical request: "split this into a 5-slide carousel".\n' +
        'Do NOT use when: the user wants the same content reframed per platform (use photoshop_recipe_export_social_variants) or a single crop (use photoshop_crop_document).\n' +
        '\n' +
        'Returns: { ok, summary, output_paths (in slide order), details: { slides, slice_width } }.\n' +
        '\n' +
        'Preconditions: active document whose width is at least `slides` pixels.\n' +
        'Side effects: writes one file per slide; source document is unchanged.',
      inputSchema: {
        type: 'object',
        properties: {
          slides: {
            type: 'number',
            description: `Number of carousel slides to split into (${MIN_SLIDES}-${MAX_SLIDES}).`,
            minimum: MIN_SLIDES,
            maximum: MAX_SLIDES,
          },
          slide_width: {
            type: 'number',
            description:
              'Optional final slide width in px (e.g. 1080). Requires slide_height. Each slice is center-cropped/resized to this size. Omit to keep native slice dimensions.',
          },
          slide_height: {
            type: 'number',
            description:
              'Optional final slide height in px (e.g. 1350 for Instagram portrait). Requires slide_width.',
          },
          format: {
            type: 'string',
            enum: ['jpg', 'png'],
            description: 'Output format. Default jpg.',
            default: 'jpg',
          },
          quality: {
            type: 'number',
            description: 'JPEG quality on the Photoshop 1-12 scale (jpg only). Default 10.',
            minimum: 1,
            maximum: 12,
            default: 10,
          },
        },
        required: ['slides'],
      },
    },
    handler: async (args) => runSplitCarousel(connection, args),
  };
}

async function runSplitCarousel(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const slides = clampInt(args.slides, MIN_SLIDES, MAX_SLIDES, 0);
  if (slides < MIN_SLIDES) {
    return toolFailure({
      ok: false,
      code: 'invalid_arguments',
      message: `slides is required and must be between ${MIN_SLIDES} and ${MAX_SLIDES}.`,
      suggested_next_tool: TOOL_NAME,
    });
  }

  const format: CarouselFormat = args.format === 'png' ? 'png' : 'jpg';
  const quality = clampInt(args.quality, 1, 12, 10);

  const hasWidth = typeof args.slide_width === 'number' && args.slide_width > 0;
  const hasHeight = typeof args.slide_height === 'number' && args.slide_height > 0;
  if (hasWidth !== hasHeight) {
    return toolFailure({
      ok: false,
      code: 'invalid_arguments',
      message: 'slide_width and slide_height must be provided together.',
      suggested_next_tool: TOOL_NAME,
    });
  }
  const resize = hasWidth && hasHeight;
  const slideWidth = resize ? Math.round(args.slide_width as number) : 0;
  const slideHeight = resize ? Math.round(args.slide_height as number) : 0;

  const stamp = Date.now();
  const paths: string[] = [];
  for (let i = 0; i < slides; i++) {
    const seq = String(i + 1).padStart(2, '0');
    paths.push(resolveExportPath(`carousel-${stamp}-${seq}.${format}`, format));
  }

  const pathsLiteral = paths.map((p) => `"${jsString(p)}"`).join(', ');
  const saveSnippet =
    format === 'png'
      ? `var saveOptions = new PNGSaveOptions();`
      : `var saveOptions = new JPEGSaveOptions();
        saveOptions.quality = ${quality};
        saveOptions.embedColorProfile = true;`;

  const resizeSnippet = resize
    ? `
      var cw = dup.width.as('px');
      var ch = dup.height.as('px');
      var srcRatio = cw / ch;
      var tgtRatio = ${slideWidth} / ${slideHeight};
      var cropW, cropH;
      if (srcRatio > tgtRatio) {
        cropH = ch;
        cropW = Math.round(ch * tgtRatio);
      } else {
        cropW = cw;
        cropH = Math.round(cw / tgtRatio);
      }
      var cropLeft = Math.round((cw - cropW) / 2);
      var cropTop = Math.round((ch - cropH) / 2);
      dup.crop([cropLeft, cropTop, cropLeft + cropW, cropTop + cropH]);
      dup.resizeImage(
        UnitValue(${slideWidth}, 'px'),
        UnitValue(${slideHeight}, 'px'),
        null,
        ResampleMethod.BICUBICSHARPER
      );
    `
    : '';

  const body = `
    var src = app.activeDocument;
    var W = src.width.as('px');
    var H = src.height.as('px');
    var slides = ${slides};
    if (W < slides) {
      return { ok: false, code: 'invalid_arguments', message: 'Document width ' + W + 'px is smaller than the requested slide count (' + slides + ').' };
    }
    var paths = [${pathsLiteral}];
    var produced = [];

    for (var i = 0; i < slides; i++) {
      var left = Math.round((i * W) / slides);
      var right = Math.round(((i + 1) * W) / slides);
      var dup = src.duplicate('mcp-carousel-' + (i + 1) + '-' + (new Date()).getTime(), true);
      try {
        try {
          dup.convertProfile('sRGB IEC61966-2.1', Intent.RELATIVECOLORIMETRIC, true, true);
        } catch (eProfile) {}

        dup.crop([left, 0, right, H]);
        ${resizeSnippet}

        var outFile = new File(paths[i]);
        ${saveSnippet}
        dup.saveAs(outFile, saveOptions, true);

        produced.push(outFile.fsName);
        dup.close(SaveOptions.DONOTSAVECHANGES);
      } catch (eSlide) {
        try { dup.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose) {}
        return { ok: false, code: 'recipe_runtime_error', message: 'Slide ' + (i + 1) + ' failed: ' + (eSlide.message || eSlide) };
      }
    }

    return {
      ok: true,
      summary: 'Split document into ' + produced.length + ' carousel slide(s)',
      undo_history_states_consumed: 0,
      output_paths: produced,
      details: { slides: slides, slice_width: Math.round(W / slides) }
    };
  `;

  return executeRecipe(connection, 'Split Carousel', body);
}
