/**
 * Recipe gallery data. Prompts mirror README "Recipes"; images live in /images.
 * Every recipe runs as one Photoshop history state (one Undo reverts it).
 */
export type RecipeGroup = 'retouch' | 'compose' | 'export' | 'batch';

export interface RecipeDef {
  id: string;
  tool: string;
  template: string;
  title: string;
  group: RecipeGroup;
  summary: string;
  prompt: string;
  image: string;
  params?: string;
}

export const RECIPE_GROUPS: Array<{ id: RecipeGroup; label: string }> = [
  { id: 'retouch', label: 'Retouch' },
  { id: 'compose', label: 'Compose' },
  { id: 'export', label: 'Export' },
  { id: 'batch', label: 'Batch' },
];

export const RECIPES: RecipeDef[] = [
  {
    id: 'remove-background',
    tool: 'photoshop_recipe_remove_background',
    template: 'ps.remove_background',
    title: 'Remove background',
    group: 'retouch',
    summary: 'Select Subject plus a layer mask. Original pixels stay behind the mask.',
    prompt:
      'Remove the background from the active portrait layer. Use Select Subject + a layer mask with a 2px feather. Keep the original pixels behind the mask.',
    image: '/images/recipe-remove-bg.svg',
    params: '{ feather_px: "2", keep_shadow: "false" }',
  },
  {
    id: 'remove-distraction',
    tool: 'photoshop_recipe_remove_distraction',
    template: 'ps.remove_distraction',
    title: 'Remove a distraction',
    group: 'retouch',
    summary: 'Content-aware fill on your rough selection. Nothing outside it is touched.',
    prompt:
      "There's a tourist photobombing my landscape on the active layer. I'll rough-select him with the lasso — then run the remove-distraction recipe with a 1px feather. Content-aware fill only; don't touch anything outside the selection.",
    image: '/images/recipe-remove-distraction.svg',
    params: '{ feather_px: "1" }',
  },
  {
    id: 'enhance-portrait',
    tool: 'photoshop_recipe_enhance_portrait',
    template: 'ps.enhance_portrait',
    title: 'Enhance a portrait',
    group: 'retouch',
    summary: 'Skin smoothing and auto tone in one undoable step.',
    prompt:
      'Enhance the portrait on the active layer at medium intensity with skin smoothing. Use the enhance-portrait recipe — I want frequency separation + auto-tone in one undoable step. Show me a preview when done.',
    image: '/images/recipe-enhance-portrait.svg',
    params: '{ intensity: "medium", skin_smoothing: "true" }',
  },
  {
    id: 'dodge-burn',
    tool: 'photoshop_recipe_dodge_burn',
    template: 'ps.dodge_burn',
    title: 'Dodge & burn setup',
    group: 'retouch',
    summary: 'A 50% gray overlay layer, ready for you to paint light and shadow.',
    prompt:
      "Set up dodge & burn on the active portrait layer: a 50% gray layer in overlay blend mode. I'll paint with a white/black brush myself — just prepare the non-destructive setup.",
    image: '/images/recipe-dodge-burn.svg',
    params: '{ blend_mode: "overlay" }',
  },
  {
    id: 'frequency-separation',
    tool: 'photoshop_recipe_frequency_separation',
    template: 'ps.frequency_separation',
    title: 'Frequency separation',
    group: 'retouch',
    summary: 'Splits texture from color into Low and High layers you can paint on.',
    prompt:
      'Set up frequency separation on the active raster layer with a 6px blur radius. I will paint on the Low and High layers myself — do not apply extra smoothing. Tell me which layers to edit when the stack is ready.',
    image: '/images/recipe-frequency-separation.svg',
    params: '{ radius_px: "6" }',
  },
  {
    id: 'color-grade',
    tool: 'photoshop_recipe_apply_color_grade',
    template: 'ps.apply_color_grade',
    title: 'Color grade',
    group: 'retouch',
    summary: 'Teal-orange, warm film and other looks as non-destructive adjustment layers.',
    prompt:
      'Apply a warm film color grade to the open document as non-destructive adjustment layers. Use the apply-color-grade recipe with preset warm_film. Preview the result when finished.',
    image: '/images/recipe-color-grade.svg',
    params: '{ preset: "warm_film" }',
  },
  {
    id: 'gradient-fade',
    tool: 'photoshop_recipe_gradient_fade',
    template: 'ps.gradient_fade',
    title: 'Gradient fade',
    group: 'compose',
    summary: 'Melts the subject into the background with an editable mask gradient.',
    prompt:
      'Fade the isolated subject into the background from the bottom up. Apply a bottom_to_top gradient on the layer mask, 0 to 100%. Keep the mask editable.',
    image: '/images/recipe-gradient-fade.svg',
    params: '{ direction: "bottom_to_top" }',
  },
  {
    id: 'sky-blend',
    tool: 'photoshop_recipe_sky_blend',
    template: 'ps.sky_blend',
    title: 'Sky blend',
    group: 'compose',
    summary: 'Replaces a blown-out sky with your own sky image, feathered at the horizon.',
    prompt:
      'The sky in my landscape is blown out. Blend ~/skies/sunset.jpg in as the new sky, horizon at 45% of the frame height, feathered so the treeline stays natural.',
    image: '/images/recipe-sky-blend.svg',
    params: '{ sky_image_path: "~/skies/sunset.jpg", horizon_pct: "45" }',
  },
  {
    id: 'organize-layers',
    tool: 'photoshop_recipe_organize_layers',
    template: 'ps.organize_layers',
    title: 'Organize layers',
    group: 'compose',
    summary: 'Renames layers by kind and groups related ones. Originals preserved.',
    prompt:
      'Organize the layer stack: rename by kind, auto-group related layers, preserve originals. Run the organize-layers recipe, then list layers so I can review the new structure.',
    image: '/images/recipe-organize-layers.svg',
  },
  {
    id: 'passport-photo',
    tool: 'photoshop_recipe_passport_photo',
    template: 'ps.passport_photo',
    title: 'Passport photo',
    group: 'compose',
    summary: 'White background, proper headroom, exact size and DPI, optional print sheet.',
    prompt:
      'Turn the open portrait into a US passport photo: white background, proper headroom, exact 600x600 px at 300 DPI. Also give me a 10x15 cm print sheet with copies.',
    image: '/images/recipe-passport.svg',
    params: '{ spec: "us_2x2", make_sheet: "true" }',
  },
  {
    id: 'prepare-for-web',
    tool: 'photoshop_recipe_prepare_for_web',
    template: 'ps.prepare_for_web',
    title: 'Prepare for web',
    group: 'export',
    summary: 'sRGB, downscale, sharpen, optimized JPEG — in that order.',
    prompt:
      'Prepare the active document for web: sRGB, downscale, sharpen, export one optimized JPEG to ~/.photoshop-mcp/exports.',
    image: '/images/recipe-prepare-web.svg',
  },
  {
    id: 'social-variants',
    tool: 'photoshop_recipe_export_social_variants',
    template: 'ps.export_social_variants',
    title: 'Social variants',
    group: 'export',
    summary: 'One JPEG per platform at spec dimensions from the same document.',
    prompt:
      'Export Instagram post and X post variants as separate JPEGs from the open document. List the output paths in a table.',
    image: '/images/recipe-social-variants.svg',
  },
  {
    id: 'split-carousel',
    tool: 'photoshop_recipe_split_carousel',
    template: 'ps.split_carousel',
    title: 'Seamless carousel',
    group: 'export',
    summary: 'Slices one wide document into numbered slides in swipe order.',
    prompt:
      'Split the active document into a 5-slide seamless Instagram carousel. Each slide should be 1080x1350 — crop the slices, don\'t letterbox them. Give me the exported file paths in swipe order.',
    image: '/images/recipe-carousel.svg',
    params: '{ slides: "5", size: "1080x1350" }',
  },
  {
    id: 'batch-mockup',
    tool: 'photoshop_recipe_batch_mockup_replace',
    template: 'ps.batch_mockup_replace',
    title: 'Batch mockup replace',
    group: 'batch',
    summary: 'Swaps a Smart Object per asset so perspective is preserved; one render each.',
    prompt:
      'I have a mockup PSD open with a Smart Object layer named "Screen". Replace it with every PNG/JPG in ~/assets/mockups/ and export one JPEG per asset. Swap the Smart Object so perspective is preserved.',
    image: '/images/recipe-mockup.svg',
  },
  {
    id: 'batch-watermark',
    tool: 'photoshop_recipe_batch_watermark',
    template: 'ps.batch_watermark',
    title: 'Batch watermark',
    group: 'batch',
    summary: 'Watermarks every image in a folder; originals are never touched.',
    prompt:
      'Watermark every photo in ~/photos/portfolio with the text "© Jane Doe 2026". Bottom-right corner, 40% opacity, small margin from the edges. Export watermarked JPEGs — never touch the originals.',
    image: '/images/recipe-watermark.svg',
    params: '{ assets_dir: "~/photos/portfolio", text: "© Jane Doe 2026", position: "bottom_right", opacity: "40" }',
  },
  {
    id: 'csv-to-cards',
    tool: 'photoshop_recipe_csv_to_cards',
    template: 'ps.csv_to_cards',
    title: 'CSV to cards',
    group: 'batch',
    summary: 'Mail merge for images: one personalized export per CSV row from a template PSD.',
    prompt:
      'Generate a name card for every row in ~/cards/speakers.csv using the open template PSD. PNG output to ~/cards/out — one file per row, named after the row.',
    image: '/images/recipe-csv-cards.svg',
    params: '{ csv_path: "~/cards/speakers.csv", output_dir: "~/cards/out", format: "PNG" }',
  },
];
