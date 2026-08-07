import { argEnum, userPrompt, type PhotoshopPromptTemplate } from '../_shared.js';

const FORMATS = ['JPEG', 'PNG'] as const;

export const csvToCardsTemplate: PhotoshopPromptTemplate = {
  name: 'ps.csv_to_cards',
  description:
    'Generate one image per CSV row from the active template PSD (data-driven graphics / "mail merge for images"): name cards, badges, certificates, personalized banners. Users often say: csv to images, batch cards, sertifika bas.',
  arguments: [
    {
      name: 'csv_path',
      description: 'Absolute path to the CSV file (first row = variable names matching the template variables).',
      required: true,
    },
    {
      name: 'output_dir',
      description: 'Directory where generated files are written.',
      required: true,
    },
    {
      name: 'format',
      description: 'JPEG or PNG. Default JPEG.',
      required: false,
    },
  ],
  handler: (args) => {
    const csvPath = typeof args.csv_path === 'string' ? args.csv_path : '';
    const outputDir = typeof args.output_dir === 'string' ? args.output_dir : '';
    const format = argEnum(args, 'format', FORMATS, 'JPEG');

    const toolArgs = { csv_path: csvPath, output_dir: outputDir, format };

    const text = [
      `Goal: Generate one ${format} per CSV row from the active template document (data-driven graphics).`,
      ``,
      `Plan:`,
      `1. Call \`photoshop_get_state\` to confirm an active document (the template PSD).`,
      `2. Call \`photoshop_recipe_csv_to_cards\` with ${JSON.stringify(toolArgs)}.`,
      `   - The recipe converts the CSV into a Photoshop variables/data-sets XML, imports it, applies each row and saves a copy per row.`,
      `3. If the recipe reports no data sets, remind the user that the template needs variable-bound layers first (Photoshop menu: Image > Variables > Define) whose names match the CSV header.`,
      `4. Present the generated file paths.`,
      ``,
      `End state: template document is unchanged; one ${format} per CSV row exists under the output directory.`,
    ].join('\n');

    return userPrompt(`Generate ${format} cards from ${csvPath}.`, text);
  },
};
