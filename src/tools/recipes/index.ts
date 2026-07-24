import type { ToolDefinition } from '../../core/tool-registry.js';
import type { PhotoshopConnection } from '../../platform/connection.js';
import { bindRemoveBackground } from './remove-background.js';
import { bindEnhancePortrait } from './enhance-portrait.js';
import { bindPrepareForWeb } from './prepare-for-web.js';
import { bindExportSocialVariants } from './export-social-variants.js';
import { bindApplyColorGrade } from './apply-color-grade.js';
import { bindFrequencySeparation } from './frequency-separation.js';
import { bindBatchMockupReplace } from './batch-mockup-replace.js';
import { bindOrganizeLayers } from './organize-layers.js';
import { bindGradientFade } from './gradient-fade.js';
import { bindSkyBlend } from './sky-blend.js';
import { bindDodgeBurn } from './dodge-burn.js';
import { bindRemoveDistraction } from './remove-distraction.js';
import { bindSplitCarousel } from './split-carousel.js';
import { bindBatchWatermark } from './batch-watermark.js';
import { bindPassportPhoto } from './passport-photo.js';

export function createRecipeTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    bindRemoveBackground(connection),
    bindEnhancePortrait(connection),
    bindPrepareForWeb(connection),
    bindExportSocialVariants(connection),
    bindApplyColorGrade(connection),
    bindFrequencySeparation(connection),
    bindBatchMockupReplace(connection),
    bindOrganizeLayers(connection),
    bindGradientFade(connection),
    bindSkyBlend(connection),
    bindDodgeBurn(connection),
    bindRemoveDistraction(connection),
    bindSplitCarousel(connection),
    bindBatchWatermark(connection),
    bindPassportPhoto(connection),
  ];
}

export const PHOTOSHOP_RECIPE_TOOL_NAMES = [
  'photoshop_recipe_remove_background',
  'photoshop_recipe_enhance_portrait',
  'photoshop_recipe_prepare_for_web',
  'photoshop_recipe_export_social_variants',
  'photoshop_recipe_apply_color_grade',
  'photoshop_recipe_frequency_separation',
  'photoshop_recipe_batch_mockup_replace',
  'photoshop_recipe_organize_layers',
  'photoshop_recipe_gradient_fade',
  'photoshop_recipe_sky_blend',
  'photoshop_recipe_dodge_burn',
  'photoshop_recipe_remove_distraction',
  'photoshop_recipe_split_carousel',
  'photoshop_recipe_batch_watermark',
  'photoshop_recipe_passport_photo',
] as const;
