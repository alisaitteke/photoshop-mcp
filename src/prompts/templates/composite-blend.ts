import {
  argEnum,
  argString,
  userPrompt,
  type PhotoshopPromptTemplate,
} from '../_shared.js';

const BLEND_MODE_OPTIONS = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'soft_light',
] as const;
type BlendModeArg = (typeof BLEND_MODE_OPTIONS)[number];

const BLEND_MODE_BY_ARG: Record<BlendModeArg, string> = {
  normal: 'NORMAL',
  multiply: 'MULTIPLY',
  screen: 'SCREEN',
  overlay: 'OVERLAY',
  soft_light: 'SOFTLIGHT',
};

export const compositeBlendTemplate: PhotoshopPromptTemplate = {
  name: 'ps.composite_blend',
  description:
    'Place an external image into the active document, mask it, and set blend mode — interim workflow for sky replacement and compositing.',
  arguments: [
    {
      name: 'image_path',
      description: 'Absolute path to the image file to place (sky, background, texture). Required.',
      required: true,
    },
    {
      name: 'blend_mode',
      description: 'Layer blend mode after placement: normal (default), multiply, screen, overlay, soft_light.',
      required: false,
    },
  ],
  handler: (args) => {
    const imagePath = argString(args, 'image_path', '');
    const blendArg = argEnum(args, 'blend_mode', BLEND_MODE_OPTIONS, 'normal');
    const blendMode = BLEND_MODE_BY_ARG[blendArg];

    const pathWarning =
      imagePath === ''
        ? `   - WARNING: no image_path provided — ask the user for an absolute file path before placing.`
        : `   - Place with { filePath: "${imagePath}", x, y } where x/y are absolute canvas top-left pixels (0,0 = document corner).`;

    const text = [
      `Goal: Composite an external image into the active document with optional masking and blend mode.`,
      ``,
      `Intent: replace sky, composite in new background, blend layers, place and mask`,
      ``,
      `Plan:`,
      `1. Call \`photoshop_get_state\` to confirm an active document.`,
      `2. Call \`photoshop_place_image\`:`,
      pathWarning,
      `3. Reposition or scale if needed using transform tools after preview.`,
      `4. Add a layer mask with \`photoshop_create_layer_mask\` when a selection defines the blend region (e.g. sky area).`,
      `5. For sky replacement with a sky file, prefer \`photoshop_recipe_sky_blend\` (one undo).`,
      `6. For horizon fades on an existing mask, use \`photoshop_apply_gradient_mask\`.`,
      `7. Call \`photoshop_set_layer_blend_mode\` with { blendMode: "${blendMode}" } on the placed layer if needed.`,
      `8. Call \`photoshop_get_preview\` once.`,
      `9. Note: Photoshop's Sky Replacement menu is not scriptable via ExtendScript — this composite path is the manual multi-step fallback.`,
      ``,
      `End state: placed layer is visible in the document with optional mask and blend mode; user can refine mask edges manually; one undo per atomic step.`,
    ].join('\n');

    return userPrompt(
      `Composite blend${imagePath ? ` (${imagePath})` : ''} — ${blendArg.replace(/_/g, ' ')} mode.`,
      text
    );
  },
};
