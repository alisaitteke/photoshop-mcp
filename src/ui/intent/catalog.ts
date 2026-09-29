import { LAYER_BLEND_MODE_ENUM } from '../../tools/blend-mode.js';

/**
 * Commands the standalone UI may run without a language model when Jev
 * (TypeSafe's System One model) is confident the request is exactly one of
 * them, or a short chain of them. Anything destructive is marked `risky` and
 * never runs this way.
 *
 * Recipes are listed here too: a recipe is already a fixed multi-tool
 * workflow, so matching one runs many Photoshop steps with no LLM call. Only
 * recipes whose inputs are choices, numbers or yes/no flags qualify, because
 * Jev picks from options and cannot write free text (paths, prompts, copy).
 */

/**
 * How a slot is filled. Jev never writes the value; it picks one:
 * - `choice`: one of the listed options (or "not stated").
 * - `number`: one of the numbers found in the text (pre-parsed value pattern).
 * - `flag`: a yes/no question; a confident yes sets `value`.
 * - `multi`: one yes/no question per option; every confident yes is kept.
 */
export type SlotSpec =
  | { kind: 'choice'; key: string; question: string; options: Record<string, string> }
  | { kind: 'number'; key: string; question: string; min: number; max: number; integer?: boolean }
  | { kind: 'flag'; key: string; question: string; value: unknown }
  | { kind: 'multi'; key: string; question: string; options: Record<string, string> };

export type SlotValues = Record<string, unknown>;

export interface InstantIntent {
  /** Choice label sent to Jev; stable snake_case. */
  id: string;
  /** Criterion description sent to Jev. */
  describe: string;
  /** Short label for the UI chip, e.g. "Undo". */
  label: string;
  /** MCP tool to call. */
  tool: string;
  /** Values Jev may fill. Unresolved optional slots fall back to the tool's defaults. */
  slots?: SlotSpec[];
  /** Slot keys that must be resolved before the intent can run instantly. */
  requires?: string[];
  /** Destructive or hard to undo: route to a plan instead. */
  risky?: boolean;
  /** Pixels change, so fetch a preview afterwards. */
  preview?: boolean;
  args: (slots: SlotValues) => Record<string, unknown>;
  /** Label with slot values, e.g. "Opacity 60%". */
  describeCall?: (slots: SlotValues) => string;
}

export function humanBlendMode(mode: string): string {
  const spaced = mode
    .toLowerCase()
    .replace(/^(color|linear|vivid|pin|hard|soft|darker|lighter)(?=[a-z])/, '$1 ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const BLEND_MODES: readonly string[] = LAYER_BLEND_MODE_ENUM;

const none = (): Record<string, unknown> => ({});

/** Copy only the resolved slots into tool arguments, renaming keys where needed. */
function pick(slots: SlotValues, map: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [slot, arg] of Object.entries(map)) {
    if (slots[slot] !== undefined) out[arg] = slots[slot];
  }
  return out;
}

const COUNT_SLOT: SlotSpec = {
  kind: 'number',
  key: 'count',
  question: 'Which of these numbers is how many steps the `request` wants to undo or redo?',
  min: 1,
  max: 50,
  integer: true,
};

const COLOR_GRADE_PRESETS: Record<string, string> = {
  cinematic: 'Cinematic film look.',
  vintage: 'Vintage, retro, faded old-photo look.',
  teal_orange: 'Teal and orange look.',
  bw: 'Black-and-white color grade.',
  warm_film: 'Warm film tones, golden, sunny.',
  cool_dusk: 'Cool, bluish, dusky or moody tones.',
};

const GRADIENT_DIRECTIONS: Record<string, string> = {
  bottom_to_top: 'Hidden at the bottom edge, fully visible at the top (fades out towards the bottom).',
  top_to_bottom: 'Hidden at the top edge, fully visible at the bottom (fades out towards the top).',
  left_to_right: 'Hidden at the left edge, fully visible at the right (fades out towards the left).',
  right_to_left: 'Hidden at the right edge, fully visible at the left (fades out towards the right).',
};

const PASSPORT_SPECS: Record<string, string> = {
  us_2x2: 'US passport or visa photo, 2×2 inch.',
  eu_35x45: 'EU / Schengen passport or visa photo, 35×45 mm.',
  tr_50x60: 'Turkish biometric photo (biyometrik, vesikalık), 50×60 mm.',
};

const SOCIAL_PLATFORMS: Record<string, string> = {
  instagram_post: 'Instagram post (square 1080×1080).',
  instagram_story: 'Instagram story (1080×1920).',
  instagram_reel: 'Instagram reel cover (1080×1920).',
  x_post: 'X / Twitter post (1600×900).',
  x_header: 'X / Twitter header banner (1500×500).',
  facebook_post: 'Facebook post (1200×630).',
  facebook_cover: 'Facebook cover photo (1640×624).',
  linkedin_post: 'LinkedIn post (1200×627).',
  linkedin_banner: 'LinkedIn banner (1584×396).',
  youtube_thumbnail: 'YouTube thumbnail (1280×720).',
  tiktok_vertical: 'TikTok vertical video cover (1080×1920).',
  pinterest_pin: 'Pinterest pin (1000×1500).',
};

const presetLabel = (id: unknown): string =>
  typeof id === 'string' ? id.replace(/_/g, ' ').replace(/\bbw\b/, 'B&W') : '';

export const INSTANT_INTENTS: readonly InstantIntent[] = [
  {
    id: 'undo',
    describe: 'Undo the most recent change (optionally a number of steps).',
    label: 'Undo',
    tool: 'photoshop_undo',
    slots: [COUNT_SLOT],
    args: (s) => pick(s, { count: 'steps' }),
    describeCall: (s) => (typeof s.count === 'number' && s.count > 1 ? `Undo ${s.count} steps` : 'Undo 1 step'),
  },
  {
    id: 'redo',
    describe: 'Redo the change that was just undone (optionally a number of steps).',
    label: 'Redo',
    tool: 'photoshop_redo',
    slots: [COUNT_SLOT],
    args: (s) => pick(s, { count: 'steps' }),
    describeCall: (s) => (typeof s.count === 'number' && s.count > 1 ? `Redo ${s.count} steps` : 'Redo 1 step'),
  },
  {
    id: 'remove_background',
    describe: 'Remove or cut out the background so only the main subject remains.',
    label: 'Remove background',
    tool: 'photoshop_recipe_remove_background',
    preview: true,
    args: none,
  },
  {
    id: 'select_subject',
    describe: 'Select the main subject (person or object) in the image.',
    label: 'Select subject',
    tool: 'photoshop_select_subject',
    args: none,
  },
  {
    id: 'select_all',
    describe: 'Select the whole canvas.',
    label: 'Select all',
    tool: 'photoshop_select_all',
    args: none,
  },
  {
    id: 'deselect',
    describe: 'Clear the current selection.',
    label: 'Deselect',
    tool: 'photoshop_deselect',
    args: none,
  },
  {
    id: 'invert_selection',
    describe: 'Invert the current selection.',
    label: 'Invert selection',
    tool: 'photoshop_invert_selection',
    args: none,
  },
  {
    id: 'black_and_white',
    describe: 'Make the image or layer black and white / grayscale / desaturated.',
    label: 'Black & white',
    tool: 'photoshop_desaturate',
    preview: true,
    args: none,
  },
  {
    id: 'invert_colors',
    describe: 'Invert the colors (make a negative).',
    label: 'Invert colors',
    tool: 'photoshop_invert',
    preview: true,
    args: none,
  },
  {
    id: 'auto_contrast',
    describe: 'Apply automatic contrast.',
    label: 'Auto contrast',
    tool: 'photoshop_auto_contrast',
    preview: true,
    args: none,
  },
  {
    id: 'auto_levels',
    describe: 'Apply automatic levels / auto tone.',
    label: 'Auto levels',
    tool: 'photoshop_auto_levels',
    preview: true,
    args: none,
  },
  {
    id: 'set_blend_mode',
    describe: 'Change the blend mode of the active layer only.',
    label: 'Blend mode',
    tool: 'photoshop_set_layer_blend_mode',
    slots: [
      {
        kind: 'choice',
        key: 'blendMode',
        question: 'Which layer blend mode does the `request` name?',
        options: Object.fromEntries(BLEND_MODES.map((mode) => [mode, humanBlendMode(mode)])),
      },
    ],
    requires: ['blendMode'],
    preview: true,
    args: (s) => ({ blendMode: s.blendMode }),
    describeCall: (s) => `Blend mode ${typeof s.blendMode === 'string' ? humanBlendMode(s.blendMode) : ''}`.trim(),
  },
  {
    id: 'set_opacity',
    describe: 'Change the opacity of the active layer only.',
    label: 'Opacity',
    tool: 'photoshop_set_layer_opacity',
    slots: [
      {
        kind: 'number',
        key: 'opacity',
        question: 'Which of these numbers is the layer opacity the `request` asks for?',
        min: 0,
        max: 100,
        integer: true,
      },
    ],
    requires: ['opacity'],
    preview: true,
    args: (s) => ({ opacity: s.opacity }),
    describeCall: (s) => `Opacity ${s.opacity}%`,
  },
  {
    id: 'duplicate_layer',
    describe: 'Duplicate the active layer.',
    label: 'Duplicate layer',
    tool: 'photoshop_duplicate_layer',
    args: none,
  },
  {
    id: 'new_layer',
    describe: 'Add a new empty layer.',
    label: 'New layer',
    tool: 'photoshop_create_layer',
    args: none,
  },
  {
    id: 'show_preview',
    describe: 'Show what the document looks like right now, without changing it.',
    label: 'Show preview',
    tool: 'photoshop_get_preview',
    args: none,
  },
  {
    id: 'merge_visible',
    describe: 'Merge all visible layers into one.',
    label: 'Merge visible layers',
    tool: 'photoshop_merge_visible_layers',
    risky: true,
    args: none,
  },
  {
    id: 'flatten_image',
    describe: 'Flatten the whole image into a single layer.',
    label: 'Flatten image',
    tool: 'photoshop_flatten_image',
    risky: true,
    args: none,
  },

  // ── Recipes: one intent, many Photoshop steps ────────────────────────────
  {
    id: 'color_grade',
    describe:
      'Give the whole image a color grade or stylistic look (cinematic, vintage, teal and orange, warm film, cool or moody tones).',
    label: 'Color grade',
    tool: 'photoshop_recipe_apply_color_grade',
    slots: [{ kind: 'choice', key: 'preset', question: 'Which look does the `request` ask for?', options: COLOR_GRADE_PRESETS }],
    preview: true,
    args: (s) => pick(s, { preset: 'preset' }),
    describeCall: (s) => (s.preset ? `Color grade: ${presetLabel(s.preset)}` : 'Color grade'),
  },
  {
    id: 'enhance_portrait',
    describe: 'Retouch or enhance a portrait automatically: smooth skin, clean up the face, fix blemishes.',
    label: 'Enhance portrait',
    tool: 'photoshop_recipe_enhance_portrait',
    slots: [
      {
        kind: 'choice',
        key: 'intensity',
        question: 'How strong a retouch does the `request` ask for?',
        options: {
          low: 'Subtle, light, natural.',
          medium: 'Normal, moderate.',
          high: 'Strong, heavy smoothing.',
        },
      },
    ],
    preview: true,
    args: (s) => pick(s, { intensity: 'intensity' }),
    describeCall: (s) => (s.intensity ? `Enhance portrait (${s.intensity})` : 'Enhance portrait'),
  },
  {
    id: 'gradient_fade',
    describe: 'Fade the active layer softly into the background with a gradient layer mask (soft edge fade).',
    label: 'Gradient fade',
    tool: 'photoshop_recipe_gradient_fade',
    slots: [{ kind: 'choice', key: 'direction', question: 'Which way does the `request` want the layer to fade?', options: GRADIENT_DIRECTIONS }],
    preview: true,
    args: (s) => pick(s, { direction: 'direction' }),
    describeCall: (s) => (s.direction ? `Gradient fade (${presetLabel(s.direction)})` : 'Gradient fade'),
  },
  {
    id: 'dodge_burn',
    describe: 'Set up a dodge and burn layer (50% gray) for painting light and shadow by hand.',
    label: 'Dodge & burn layer',
    tool: 'photoshop_recipe_dodge_burn',
    slots: [
      {
        kind: 'choice',
        key: 'blend',
        question: 'Which blend mode does the `request` want for the dodge and burn layer?',
        options: { overlay: 'Overlay (stronger).', soft_light: 'Soft light (gentler).' },
      },
    ],
    args: (s) => pick(s, { blend: 'blend_mode' }),
  },
  {
    id: 'frequency_separation',
    describe: 'Set up a frequency separation (low and high frequency layers) for manual retouching.',
    label: 'Frequency separation',
    tool: 'photoshop_recipe_frequency_separation',
    slots: [
      {
        kind: 'number',
        key: 'radius',
        question: 'Which of these numbers is the blur radius in pixels the `request` asks for?',
        min: 1,
        max: 50,
      },
    ],
    args: (s) => pick(s, { radius: 'radius_px' }),
    describeCall: (s) => (s.radius !== undefined ? `Frequency separation (${s.radius}px)` : 'Frequency separation'),
  },
  {
    id: 'organize_layers',
    describe: 'Tidy up the layers panel: rename messy layers consistently and group them by kind.',
    label: 'Organize layers',
    tool: 'photoshop_recipe_organize_layers',
    slots: [
      {
        kind: 'choice',
        key: 'naming',
        question: 'How does the `request` want the layers renamed?',
        options: {
          type_index: 'By layer type and number, e.g. text_01.',
          content_summary: 'After their content (text layers named after their text).',
          preserve: 'Keep the current names.',
        },
      },
      { kind: 'flag', key: 'auto_group', question: 'Does the `request` ask to leave the layers ungrouped?', value: false },
    ],
    args: (s) => pick(s, { naming: 'naming_scheme', auto_group: 'auto_group' }),
  },
  {
    id: 'passport_photo',
    describe: 'Make a passport, visa, ID or biometric photo (vesikalık) from the portrait and export it.',
    label: 'Passport photo',
    tool: 'photoshop_recipe_passport_photo',
    slots: [
      { kind: 'choice', key: 'spec', question: 'Which photo size or country does the `request` ask for?', options: PASSPORT_SPECS },
      { kind: 'flag', key: 'make_sheet', question: 'Does the `request` ask for a print sheet with several copies?', value: true },
    ],
    args: (s) => pick(s, { spec: 'spec', make_sheet: 'make_sheet' }),
    describeCall: (s) => (s.spec ? `Passport photo (${String(s.spec).replace(/_/g, ' ')})` : 'Passport photo'),
  },
  {
    id: 'prepare_for_web',
    describe: 'Export one web-ready copy of the document (resized, sRGB, sharpened JPEG or PNG).',
    label: 'Export for web',
    tool: 'photoshop_recipe_prepare_for_web',
    slots: [
      {
        kind: 'number',
        key: 'max_px',
        question: 'Which of these numbers is the maximum size (longest edge) in pixels the `request` asks for?',
        min: 64,
        max: 8192,
        integer: true,
      },
      {
        kind: 'choice',
        key: 'format',
        question: 'Which file format does the `request` ask for?',
        options: { jpeg: 'JPEG / JPG.', png: 'PNG.' },
      },
    ],
    args: (s) => pick(s, { max_px: 'max_dimension_px', format: 'format' }),
    describeCall: (s) =>
      ['Export for web', s.max_px !== undefined ? `${s.max_px}px` : '', s.format ? String(s.format).toUpperCase() : '']
        .filter(Boolean)
        .join(' · '),
  },
  {
    id: 'export_social_variants',
    describe: 'Export sized copies of the document for several social media platforms at once.',
    label: 'Social exports',
    tool: 'photoshop_recipe_export_social_variants',
    slots: [{ kind: 'multi', key: 'platforms', question: 'Does the `request` ask for an export for this platform:', options: SOCIAL_PLATFORMS }],
    args: (s) => pick(s, { platforms: 'platforms' }),
    describeCall: (s) =>
      Array.isArray(s.platforms) ? `Social exports (${s.platforms.length})` : 'Social exports',
  },
  {
    id: 'split_carousel',
    describe: 'Split a wide image into a swipeable carousel of N slides and export them.',
    label: 'Split carousel',
    tool: 'photoshop_recipe_split_carousel',
    slots: [
      {
        kind: 'number',
        key: 'slides',
        question: 'Which of these numbers is how many slides the `request` wants?',
        min: 2,
        max: 10,
        integer: true,
      },
    ],
    requires: ['slides'],
    args: (s) => ({ slides: s.slides }),
    describeCall: (s) => `Split into ${s.slides} slides`,
  },
];

export const OTHER_INTENT = 'other';
export const OTHER_DESCRIPTION =
  'Anything else: more than one change, a change that is not listed here, a question, or unclear.';

export function findIntent(id: string): InstantIntent | undefined {
  return INSTANT_INTENTS.find((intent) => intent.id === id);
}
