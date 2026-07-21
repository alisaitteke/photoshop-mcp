import {
  argEnum,
  argInt,
  argString,
  userPrompt,
  type PhotoshopPromptTemplate,
} from '../_shared.js';

const POSITIONS = ['bottom_right', 'bottom_left', 'top_right', 'top_left', 'center'] as const;

export const batchWatermarkTemplate: PhotoshopPromptTemplate = {
  name: 'ps.batch_watermark',
  description:
    'Apply a text or logo watermark to every image in a folder and export watermarked JPEGs. Users often say: watermark these photos, add my logo to all, toplu filigran.',
  arguments: [
    {
      name: 'assets_dir',
      description: 'Absolute path to the folder of images to watermark.',
      required: true,
    },
    {
      name: 'text',
      description: 'Watermark text (e.g. "© Jane Doe 2026"). Required unless logo_path is given.',
      required: false,
    },
    {
      name: 'logo_path',
      description: 'Absolute path to a logo image (transparent PNG recommended).',
      required: false,
    },
    {
      name: 'position',
      description: `One of: ${POSITIONS.join(', ')}. Default bottom_right.`,
      required: false,
    },
    {
      name: 'opacity',
      description: 'Watermark opacity 0-100. Default 40.',
      required: false,
    },
  ],
  handler: (args) => {
    const assetsDir = argString(args, 'assets_dir', '');
    const wmText = argString(args, 'text', '');
    const logoPath = argString(args, 'logo_path', '');
    const position = argEnum(args, 'position', POSITIONS, 'bottom_right');
    const opacity = Math.max(0, Math.min(100, argInt(args, 'opacity', 40)));

    const toolArgs: Record<string, unknown> = {
      assets_dir: assetsDir,
      position,
      opacity,
    };
    let modeNote: string;
    if (wmText) {
      toolArgs.text = wmText;
      modeNote = `White text watermark "${wmText}" at ${opacity}% opacity, ${position}.`;
    } else {
      toolArgs.logo_path = logoPath;
      modeNote = `Logo watermark from ${logoPath} at ${opacity}% opacity, ${position}, scaled to 15% of image width.`;
    }

    const text = [
      `Goal: Watermark every image in ${assetsDir}.`,
      ``,
      `Plan:`,
      `1. Call \`photoshop_recipe_batch_watermark\` with ${JSON.stringify(toolArgs)}.`,
      `   - ${modeNote}`,
      `   - The recipe opens each supported image (jpg/png/tif/webp) in turn, applies the watermark, saves a JPEG copy, and closes the original untouched. Files that fail are skipped and reported, not fatal.`,
      `2. Report how many images were watermarked and list any failures from details.failed.`,
      ``,
      `End state: one watermarked JPEG per source image under ~/.photoshop-mcp/exports[/<chat-id>]; source files unmodified.`,
    ].join('\n');

    return userPrompt(`Batch watermark the images in ${assetsDir}.`, text);
  },
};
