import {
  argEnum,
  userPrompt,
  type PhotoshopPromptTemplate,
} from '../_shared.js';

const BLEND_MODE_OPTIONS = ['overlay', 'soft_light'] as const;
type BlendModeArg = (typeof BLEND_MODE_OPTIONS)[number];

const BLEND_MODE_BY_ARG: Record<BlendModeArg, string> = {
  overlay: 'OVERLAY',
  soft_light: 'SOFTLIGHT',
};

export const dodgeBurnGuideTemplate: PhotoshopPromptTemplate = {
  name: 'ps.dodge_burn_guide',
  description:
    'Set up a non-destructive dodge & burn layer (50% gray + Overlay or Soft Light) for manual light sculpting.',
  arguments: [
    {
      name: 'blend_mode',
      description: 'Retouch blend mode: overlay (default, stronger) or soft_light (gentler).',
      required: false,
    },
  ],
  handler: (args) => {
    const blendArg = argEnum(args, 'blend_mode', BLEND_MODE_OPTIONS, 'overlay');
    const blendMode = BLEND_MODE_BY_ARG[blendArg];

    const text = [
      `Goal: Prepare a dodge & burn layer so the user can paint light and shadow non-destructively.`,
      ``,
      `Intent: dodge and burn, sculpt light, lighten face, darken shadows`,
      ``,
      `Plan:`,
      `1. Call \`photoshop_get_state\` to confirm an active document with a portrait or subject layer.`,
      `2. Call \`photoshop_create_layer\` with { name: "Dodge & Burn" } above the subject.`,
      `3. Call \`photoshop_fill_layer\` with { red: 128, green: 128, blue: 128 } (50% gray).`,
      `4. Call \`photoshop_set_layer_blend_mode\` with { blendMode: "${blendMode}" }.`,
      `5. Tell the user to paint on this layer with white (dodge / lighten) and black (burn / darken) at low brush opacity (5–15%).`,
      `6. Prefer \`photoshop_recipe_dodge_burn\` for a one-undo setup.`,
      ``,
      `End state: a gray "Dodge & Burn" layer sits above the subject in ${blendArg.replace(/_/g, ' ')} mode; painting is manual; undo removes the setup layer.`,
    ].join('\n');

    return userPrompt(`Dodge & burn setup (${blendArg.replace(/_/g, ' ')}).`, text);
  },
};
