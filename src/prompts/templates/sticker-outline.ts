import { argEnum, userPrompt, type PhotoshopPromptTemplate } from '../_shared.js';

const STROKE_POSITIONS = ['outside', 'inside', 'center'] as const;
const OUTLINE_STYLES = ['single', 'die_cut'] as const;

export const stickerOutlineTemplate: PhotoshopPromptTemplate = {
  name: 'ps.sticker_outline',
  description:
    'One-shot sticker / white-border outline. single: a solid stroke plus an optional soft drop shadow. die_cut: the classic double outline — a white border with a thin dark outer line — via two stroked layer copies. Both are a single undoable step. Users often say: sticker, white border, white outline, die-cut sticker, double outline, 贴画, 白边描边, çift çizgi.',
  arguments: [
    {
      name: 'outline_style',
      description:
        'single (default: white border + shadow) or die_cut (white border + thin dark outer line).',
      required: false,
    },
    {
      name: 'stroke_position',
      description:
        'single only — where the stroke sits: outside (default sticker look), inside, or center.',
      required: false,
    },
  ],
  handler: (args) => {
    const outlineStyle = argEnum(args, 'outline_style', OUTLINE_STYLES, 'single');
    const position = argEnum(args, 'stroke_position', STROKE_POSITIONS, 'outside');

    const text = [
      `Goal: Give the active layer a one-click sticker look in a single undoable step — either a plain white border, or a die-cut double outline (white border + thin dark outer line).`,
      ``,
      `Plan:`,
      `1. Call \`photoshop_get_state\` to confirm there is an active document and a non-group active layer (pixel, text, or smart object).`,
      `2. If the layer still has a background behind it, call \`photoshop_recipe_remove_background\` first so the outline traces the subject, not the canvas.`,
      `3. Call \`photoshop_recipe_sticker_outline\` with { outline_style: "${outlineStyle}", stroke_position: "${position}" }.`,
      `   - single (default): a white stroke (width 12) plus a soft drop shadow on the active layer. Tune with stroke_width, stroke_opacity, red/green/blue.`,
      `   - die_cut: adds two stroked copies — "<layer> - white border" (stroke_width) over "<layer> - dark line" (stroke_width + line_width). Tune line_width and line_red/green/blue. The original layer stays on top.`,
      `4. Call \`photoshop_get_preview\` once to show the result.`,
      `5. For a single plain effect instead, use \`photoshop_apply_layer_style\` — but note it applies one effect at a time, so stroke and shadow cannot be combined with it.`,
      ``,
      `End state: single sets a stroke effect on the active layer; die_cut adds two stroked copies. One undo reverts everything.`,
    ].join('\n');

    return userPrompt(
      `Sticker outline recipe (${outlineStyle}${outlineStyle === 'single' ? `, ${position} stroke` : ''}).`,
      text
    );
  },
};
