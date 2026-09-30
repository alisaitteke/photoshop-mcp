import { argEnum, argString, userPrompt, type PhotoshopPromptTemplate } from '../_shared.js';

const DIRECTIONS = ['left', 'right', 'top', 'bottom', 'all'] as const;

export const generativeExpandTemplate: PhotoshopPromptTemplate = {
  name: 'ps.generative_expand',
  description:
    'Generative Expand beyond canvas edges. Users often say: extend canvas, outpainting, expand background, generative expand.',
  arguments: [
    {
      name: 'prompt',
      description: 'How to extend the image (default: extend the background naturally)',
      required: false,
    },
    {
      name: 'direction',
      description: 'left | right | top | bottom | all (default all)',
      required: false,
    },
  ],
  handler: (args) => {
    const prompt = argString(args, 'prompt', 'extend the background naturally');
    const direction = argEnum(args, 'direction', DIRECTIONS, 'all');
    const text = [
      `Goal: Extend the canvas with Generative Expand.`,
      ``,
      `Plan:`,
      `1. Verify \`generative_expand\` via \`photoshop_get_capabilities\`.`,
      `2. Call \`photoshop_generative_expand\` with { prompt: ${JSON.stringify(prompt)}, direction: "${direction}" }.`,
      `3. Call \`photoshop_get_preview\` to confirm expanded canvas.`,
      ``,
      `End state: document enlarged with generated border content.`,
    ].join('\n');
    return userPrompt(`Generative expand (${direction})`, text);
  },
};
