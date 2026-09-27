import {
  argEnum,
  argInt,
  userPrompt,
  type PhotoshopPromptTemplate,
} from '../_shared.js';

const DIRECTION_OPTIONS = [
  'top_to_bottom',
  'bottom_to_top',
  'left_to_right',
  'right_to_left',
] as const;

export const gradientFadeTemplate: PhotoshopPromptTemplate = {
  name: 'ps.gradient_fade',
  description:
    'One-shot gradient fade on the active layer mask — soft edge blending into the background. Users often say: fade into background, gradient mask, blend subject, soft edge fade, arka planı yumuşat. Applies a linear gradient on the layer mask, not a Gradient Fill layer.',
  arguments: [
    {
      name: 'direction',
      description:
        'Gradient direction on the mask: top_to_bottom, bottom_to_top (default), left_to_right, or right_to_left.',
      required: false,
    },
    {
      name: 'start_pct',
      description: 'Gradient start along the fade axis (0-100). Default 0.',
      required: false,
    },
    {
      name: 'end_pct',
      description: 'Gradient end along the fade axis (0-100). Default 100.',
      required: false,
    },
    {
      name: 'angle_deg',
      description: 'Optional gradient angle override in degrees.',
      required: false,
    },
  ],
  handler: (args) => {
    const direction = argEnum(args, 'direction', DIRECTION_OPTIONS, 'bottom_to_top');
    const startPct = Math.max(0, Math.min(100, argInt(args, 'start_pct', 0)));
    const endPct = Math.max(0, Math.min(100, argInt(args, 'end_pct', 100)));
    const angleRaw = args.angle_deg;
    const angleLine =
      typeof angleRaw === 'string' && angleRaw.trim() !== ''
        ? `, angle_deg: ${argInt(args, 'angle_deg', 90)}`
        : '';

    const text = [
      `Goal: Fade the active layer into the background using a linear gradient on its layer mask.`,
      ``,
      `Plan:`,
      `1. Call \`photoshop_get_state\` to confirm an active document and an active layer to fade.`,
      `2. If the subject is not isolated (no mask, background still visible on the layer), call \`photoshop_recipe_remove_background\` first or ask the user to confirm the active layer.`,
      `3. Call \`photoshop_recipe_gradient_fade\` with { direction: "${direction}", start_pct: ${startPct}, end_pct: ${endPct}${angleLine} }.`,
      `   - The recipe creates a reveal-all mask if needed, then paints a linear black→white gradient (${direction.replace(/_/g, ' ')}) on the mask channel.`,
      `4. Call \`photoshop_get_preview\` once to confirm the fade.`,
      `5. For step-by-step mask education, call \`photoshop_apply_gradient_mask\`; prefer this recipe for a single undo.`,
      ``,
      `End state: the active layer fades into layers below through its mask; one undo reverts mask creation and gradient paint.`,
    ].join('\n');

    return userPrompt(
      `Gradient fade (${direction.replace(/_/g, ' ')}, ${startPct}–${endPct}%).`,
      text
    );
  },
};
