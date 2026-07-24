import {
  argEnum,
  argInt,
  argString,
  userPrompt,
  type PhotoshopPromptTemplate,
} from '../_shared.js';

export const splitCarouselTemplate: PhotoshopPromptTemplate = {
  name: 'ps.split_carousel',
  description:
    'Split the active wide document into N equal vertical slices exported as sequentially numbered files for a seamless Instagram/TikTok carousel. Users often say: carousel, seamless carousel, swipe, split panorama, slayt.',
  arguments: [
    {
      name: 'slides',
      description: 'Number of slides to split into (2-10).',
      required: true,
    },
    {
      name: 'size',
      description:
        'Optional final slide size as WxH (e.g. 1080x1350 for Instagram portrait). Omit to keep native slice dimensions.',
      required: false,
    },
    {
      name: 'format',
      description: 'jpg or png. Default jpg.',
      required: false,
    },
  ],
  handler: (args) => {
    const slides = Math.max(2, Math.min(10, argInt(args, 'slides', 3)));
    const format = argEnum(args, 'format', ['jpg', 'png'] as const, 'jpg');
    const sizeRaw = argString(args, 'size', '');
    const sizeMatch = sizeRaw.match(/(\d{2,5})\s*x\s*(\d{2,5})/i);

    const toolArgs: Record<string, unknown> = { slides, format };
    let sizeNote = 'Each slice keeps its native dimensions.';
    if (sizeMatch) {
      toolArgs.slide_width = Number(sizeMatch[1]);
      toolArgs.slide_height = Number(sizeMatch[2]);
      sizeNote = `Each slice is center-cropped/resized to ${sizeMatch[1]}×${sizeMatch[2]} px.`;
    }

    const text = [
      `Goal: Turn the active wide document into a seamless ${slides}-slide carousel.`,
      ``,
      `Plan:`,
      `1. Call \`photoshop_get_state\` to confirm an active document and note its dimensions (width must be >= ${slides} px).`,
      `2. Call \`photoshop_recipe_split_carousel\` with ${JSON.stringify(toolArgs)}.`,
      `   - The recipe duplicates the document per slide, crops slice i to [i·W/${slides}, (i+1)·W/${slides}], exports sequentially numbered files (…-01, …-02, …), and closes the duplicates.`,
      `   - ${sizeNote}`,
      `3. Present the output paths in slide order — that is the exact order to upload in the Instagram carousel picker.`,
      ``,
      `End state: the source document is unchanged; ${slides} files exist under ~/.photoshop-mcp/exports[/<chat-id>].`,
    ].join('\n');

    return userPrompt(`Split the active document into a ${slides}-slide seamless carousel.`, text);
  },
};
