import {
  argInt,
  argString,
  userPrompt,
  type PhotoshopPromptTemplate,
} from '../_shared.js';

export const skyBlendTemplate: PhotoshopPromptTemplate = {
  name: 'ps.sky_blend',
  description:
    'Place an external sky image and blend it at the horizon with a gradient mask — one undo. Users often say: replace sky, fix blown sky, better clouds, swap sky background. Photoshop Sky Replacement menu is not scriptable via ExtendScript.',
  arguments: [
    {
      name: 'sky_image_path',
      description: 'Absolute path to the sky image file (JPEG, PNG, etc.). Required.',
      required: true,
    },
    {
      name: 'horizon_pct',
      description: 'Document-height percentage where sky meets landscape (0-100). Default 50.',
      required: false,
    },
    {
      name: 'feather_pct',
      description: 'Half-width of the transition zone around the horizon (0-50). Default 15.',
      required: false,
    },
    {
      name: 'x',
      description: 'Placement X offset in pixels. Default 0.',
      required: false,
    },
    {
      name: 'y',
      description: 'Placement Y offset in pixels. Default 0.',
      required: false,
    },
  ],
  handler: (args) => {
    const skyPath = argString(args, 'sky_image_path', '');
    const horizonPct = Math.max(0, Math.min(100, argInt(args, 'horizon_pct', 50)));
    const featherPct = Math.max(0, Math.min(50, argInt(args, 'feather_pct', 15)));
    const x = argInt(args, 'x', 0);
    const y = argInt(args, 'y', 0);

    const pathStep =
      skyPath === ''
        ? `2. Ask the user for an absolute \`sky_image_path\` before calling the recipe — do not invoke the recipe with an empty path.`
        : `2. Call \`photoshop_recipe_sky_blend\` with { sky_image_path: "${skyPath}", horizon_pct: ${horizonPct}, feather_pct: ${featherPct}, x: ${x}, y: ${y} }.`;

    const text = [
      `Goal: Composite a sky image into the active document with a horizon gradient blend.`,
      ``,
      `Plan:`,
      `1. Call \`photoshop_get_state\` to confirm an active document.`,
      pathStep,
      skyPath === ''
        ? `   - After the user provides a path, call the recipe with horizon_pct ~${horizonPct} and feather_pct ~${featherPct}.`
        : `   - The recipe places the sky file, names the layer "Sky Blend", adds a mask if needed, and applies a top-to-bottom gradient fade around the horizon.`,
      `3. Call \`photoshop_get_preview\` once.`,
      `4. If placement is off, undo and rerun with adjusted x/y or ask the user to nudge manually.`,
      `5. For a manual multi-step composite, call \`photoshop_place_image\`, \`photoshop_create_layer_mask\`, and \`photoshop_set_layer_blend_mode\`.`,
      ``,
      `End state: a "Sky Blend" layer sits above the landscape with a gradient mask; one undo removes placement and mask.`,
    ].join('\n');

    return userPrompt(
      skyPath
        ? `Sky blend at horizon ${horizonPct}% (feather ${featherPct}%).`
        : `Sky blend (path required, horizon ${horizonPct}%).`,
      text
    );
  },
};
