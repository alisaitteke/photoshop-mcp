import { LAYER_BLEND_MODE_ENUM } from '../../tools/blend-mode.js';

/**
 * Single-step commands the standalone UI may run without a language model when
 * Jev (TypeSafe's System One model) is confident the request is exactly one of
 * them. Anything destructive is marked `risky` and never runs this way.
 */

export type IntentSlot = 'count' | 'opacity' | 'blendMode';

export interface SlotValues {
  count?: number;
  opacity?: number;
  blendMode?: string;
}

export interface InstantIntent {
  /** Choice label sent to Jev; stable snake_case. */
  id: string;
  /** Criterion description sent to Jev. */
  describe: string;
  /** Short label for the UI chip, e.g. "Undo". */
  label: string;
  /** MCP tool to call. */
  tool: string;
  /** Slots that must be resolved before the intent can run instantly. */
  requires?: IntentSlot[];
  /** Slots used when present. */
  optional?: IntentSlot[];
  /** Destructive or hard to undo: route to a reviewed plan instead. */
  risky?: boolean;
  /** Pixels change, so fetch a preview afterwards. */
  preview?: boolean;
  args: (slots: SlotValues) => Record<string, unknown>;
  /** Label with slot values, e.g. "Opacity 60%". */
  describeCall?: (slots: SlotValues) => string;
}

const none = (): Record<string, unknown> => ({});

export const INSTANT_INTENTS: readonly InstantIntent[] = [
  {
    id: 'undo',
    describe: 'Undo the most recent change (optionally a number of steps).',
    label: 'Undo',
    tool: 'photoshop_undo',
    optional: ['count'],
    args: (s) => (s.count ? { steps: s.count } : {}),
    describeCall: (s) => (s.count && s.count > 1 ? `Undo ${s.count} steps` : 'Undo 1 step'),
  },
  {
    id: 'redo',
    describe: 'Redo the change that was just undone (optionally a number of steps).',
    label: 'Redo',
    tool: 'photoshop_redo',
    optional: ['count'],
    args: (s) => (s.count ? { steps: s.count } : {}),
    describeCall: (s) => (s.count && s.count > 1 ? `Redo ${s.count} steps` : 'Redo 1 step'),
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
    requires: ['blendMode'],
    preview: true,
    args: (s) => ({ blendMode: s.blendMode }),
    describeCall: (s) => `Blend mode ${s.blendMode ? humanBlendMode(s.blendMode) : ''}`.trim(),
  },
  {
    id: 'set_opacity',
    describe: 'Change the opacity of the active layer only.',
    label: 'Opacity',
    tool: 'photoshop_set_layer_opacity',
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
];

export const OTHER_INTENT = 'other';
export const OTHER_DESCRIPTION =
  'Anything else: more than one change, a change that is not listed here, a question, or unclear.';

export function findIntent(id: string): InstantIntent | undefined {
  return INSTANT_INTENTS.find((intent) => intent.id === id);
}

export function humanBlendMode(mode: string): string {
  const spaced = mode
    .toLowerCase()
    .replace(/^(color|linear|vivid|pin|hard|soft|darker|lighter)(?=[a-z])/, '$1 ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const BLEND_MODES: readonly string[] = LAYER_BLEND_MODE_ENUM;
