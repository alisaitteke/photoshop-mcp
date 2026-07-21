import { argBool, argEnum, userPrompt, type PhotoshopPromptTemplate } from '../_shared.js';

const SPECS = ['us_2x2', 'eu_35x45', 'tr_50x60'] as const;

export const passportPhotoTemplate: PhotoshopPromptTemplate = {
  name: 'ps.passport_photo',
  description:
    'Turn the active portrait into a passport/ID photo: white background, ICAO-style framing, exact official pixel size at 300 DPI, optional 10×15 cm print sheet. Users often say: passport photo, visa photo, ID photo, vesikalık, biyometrik.',
  arguments: [
    {
      name: 'spec',
      description:
        'Target size: us_2x2 (US 2×2 in), eu_35x45 (EU/Schengen 35×45 mm), tr_50x60 (Türkiye 50×60 mm). Default us_2x2.',
      required: false,
    },
    {
      name: 'make_sheet',
      description:
        'true to also export a 10×15 cm print sheet with multiple copies. Default false.',
      required: false,
    },
  ],
  handler: (args) => {
    const spec = argEnum(args, 'spec', SPECS, 'us_2x2');
    const makeSheet = argBool(args, 'make_sheet', false);

    const toolArgs: Record<string, unknown> = { spec, make_sheet: makeSheet };

    const text = [
      `Goal: Produce a ${spec} passport/ID photo from the active portrait.`,
      ``,
      `Plan:`,
      `1. Call \`photoshop_get_state\` to confirm an active document with a single-person portrait.`,
      `2. Call \`photoshop_recipe_passport_photo\` with ${JSON.stringify(toolArgs)}.`,
      `   - The recipe duplicates the document, runs Select Subject, fills the background with white, crops around the subject (subject ≈ 72% of frame height, ~10% headroom), resizes to the exact spec at 300 DPI, and exports JPEG${makeSheet ? ' plus a 10×15 cm print sheet tiled with copies' : ''}.`,
      `3. Present the output path(s). Remind the user that head-size rules are approximated from subject bounds (no face detection) and official acceptance is not guaranteed — a manual crop beforehand improves results.`,
      ``,
      `End state: the source document is unchanged; the passport JPEG${makeSheet ? ' and print sheet' : ''} exist under ~/.photoshop-mcp/exports[/<chat-id>].`,
    ].join('\n');

    return userPrompt(`Make a ${spec} passport photo from the active document.`, text);
  },
};
