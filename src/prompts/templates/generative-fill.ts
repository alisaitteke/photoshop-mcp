import { argString, userPrompt, type PhotoshopPromptTemplate } from '../_shared.js';

export const generativeFillTemplate: PhotoshopPromptTemplate = {
  name: 'ps.generative_fill',
  description:
    'Generative Fill inside the current selection with a text prompt. Users often say: add object, replace selection, generative fill, firefly fill.',
  arguments: [
    {
      name: 'prompt',
      description: 'What to generate inside the selection',
      required: true,
    },
  ],
  handler: (args) => {
    const prompt = argString(args, 'prompt', 'seamless background extension');
    const text = [
      `Goal: Fill the current selection using Generative Fill (Firefly).`,
      ``,
      `Plan:`,
      `1. Call \`photoshop_get_capabilities\` once if not done this session; verify \`generative_fill\`.`,
      `2. Call \`photoshop_get_state\` — ensure a pixel selection exists.`,
      `3. If no selection: \`photoshop_select_subject\` or \`photoshop_select_rectangle\`, then retry.`,
      `4. Call \`photoshop_generative_fill\` with { prompt: ${JSON.stringify(prompt)} }.`,
      `5. Call \`photoshop_get_preview\` to verify the result.`,
      ``,
      `End state: selection filled with generative content; one undo per generative layer.`,
    ].join('\n');
    return userPrompt(`Generative fill: ${prompt}`, text);
  },
};
