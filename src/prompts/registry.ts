import type { PromptRegistry } from '../core/prompt-registry.js';
import { toPromptDefinition } from './_shared.js';
import { enhancePortraitTemplate } from './templates/enhance-portrait.js';
import { removeBackgroundTemplate } from './templates/remove-background.js';
import { prepareForWebTemplate } from './templates/prepare-for-web.js';
import { exportSocialVariantsTemplate } from './templates/export-social-variants.js';
import { applyColorGradeTemplate } from './templates/apply-color-grade.js';
import { frequencySeparationTemplate } from './templates/frequency-separation.js';
import { batchMockupReplaceTemplate } from './templates/batch-mockup-replace.js';
import { organizeLayersTemplate } from './templates/organize-layers.js';
import { gradientFadeTemplate } from './templates/gradient-fade.js';
import { skyBlendTemplate } from './templates/sky-blend.js';
import { dodgeBurnTemplate } from './templates/dodge-burn.js';
import { removeDistractionTemplate } from './templates/remove-distraction.js';
import { gradientBlendTemplate } from './templates/gradient-blend.js';
import { colorCorrectTemplate } from './templates/color-correct.js';
import { dodgeBurnGuideTemplate } from './templates/dodge-burn-guide.js';
import { compositeBlendTemplate } from './templates/composite-blend.js';
import { generativeFillTemplate } from './templates/generative-fill.js';
import { generativeRemoveTemplate } from './templates/generative-remove.js';
import { generativeExpandTemplate } from './templates/generative-expand.js';
import { splitCarouselTemplate } from './templates/split-carousel.js';
import { batchWatermarkTemplate } from './templates/batch-watermark.js';
import { passportPhotoTemplate } from './templates/passport-photo.js';

export const PHOTOSHOP_GUIDE_PROMPT_NAMES = [
  'ps.gradient_blend',
  'ps.color_correct',
  'ps.dodge_burn_guide',
  'ps.composite_blend',
  'ps.generative_fill',
  'ps.generative_remove',
  'ps.generative_expand',
] as const;

export const PHOTOSHOP_PROMPT_TEMPLATES = [
  enhancePortraitTemplate,
  removeBackgroundTemplate,
  prepareForWebTemplate,
  exportSocialVariantsTemplate,
  applyColorGradeTemplate,
  frequencySeparationTemplate,
  batchMockupReplaceTemplate,
  organizeLayersTemplate,
  gradientFadeTemplate,
  skyBlendTemplate,
  dodgeBurnTemplate,
  removeDistractionTemplate,
  gradientBlendTemplate,
  colorCorrectTemplate,
  compositeBlendTemplate,
  dodgeBurnGuideTemplate,
  generativeFillTemplate,
  generativeRemoveTemplate,
  generativeExpandTemplate,
  splitCarouselTemplate,
  batchWatermarkTemplate,
  passportPhotoTemplate,
] as const;

export function registerPhotoshopPrompts(registry: PromptRegistry): void {
  for (const template of PHOTOSHOP_PROMPT_TEMPLATES) {
    registry.register(template.name, toPromptDefinition(template));
  }
}
