import {
  argEnum,
  userPrompt,
  type PhotoshopPromptTemplate,
} from '../_shared.js';

const BLEND_MODE_OPTIONS = ['overlay', 'soft_light'] as const;

export const dodgeBurnTemplate: PhotoshopPromptTemplate = {
  name: 'ps.dodge_burn',
  description:
    'One-shot dodge & burn setup: 50% gray layer in Overlay or Soft Light for non-destructive light sculpting. Users often say: dodge and burn, sculpt light, lighten face, darken shadows. User paints white (dodge) and black (burn) manually after setup.',
  arguments: [
    {
      name: 'blend_mode',
      description: 'Retouch blend mode: overlay (default, stronger) or soft_light (gentler).',
      required: false,
    },
  ],
  handler: (args) => {
    const blendMode = argEnum(args, 'blend_mode', BLEND_MODE_OPTIONS, 'overlay');

    const text = [
      `Goal: Prepare a dodge & burn layer so the user can paint light and shadow non-destructively.`,
      ``,
      `Plan:`,
      `1. Call \`photoshop_get_state\` to confirm an active document with a portrait or subject layer.`,
      `2. Call \`photoshop_recipe_dodge_burn\` with { blend_mode: "${blendMode}" }.`,
      `   - The recipe adds a "Dodge & Burn" layer filled with 50% gray (${blendMode.replace(/_/g, ' ')} mode) above the active layer.`,
      `3. Tell the user to paint on this layer with white (dodge / lighten) and black (burn / darken) at low brush opacity (5–15%).`,
      `4. Call \`photoshop_get_preview\` once after setup if helpful.`,
      `5. For step-by-step atomic setup, call \`photoshop_create_layer\`, \`photoshop_fill_layer\`, and \`photoshop_set_layer_blend_mode\` separately.`,
      ``,
      `End state: a gray "Dodge & Burn" layer in ${blendMode.replace(/_/g, ' ')} mode; painting is manual; one undo removes the setup.`,
    ].join('\n');

    return userPrompt(`Dodge & burn recipe (${blendMode.replace(/_/g, ' ')}).`, text);
  },
};
