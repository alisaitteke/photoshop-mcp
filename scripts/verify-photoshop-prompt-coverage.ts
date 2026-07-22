/**
 * Lints recipe ↔ prompt template parity for photoshop-mcp:
 *   - Every photoshop_recipe_* tool must have a matching ps.* prompt template.
 *   - Every ps.* recipe prompt template must have a matching photoshop_recipe_* tool.
 *   - Guide prompts (ps.gradient_blend, etc.) are registered separately.
 *
 * Run: npm run verify:photoshop-prompts
 */
import assert from 'node:assert/strict';
import { ToolRegistry } from '../src/core/tool-registry.js';
import { PromptRegistry } from '../src/core/prompt-registry.js';
import { registerPhotoshopPrompts } from '../src/prompts/registry.js';
import { PHOTOSHOP_PROMPT_TEMPLATES, PHOTOSHOP_GUIDE_PROMPT_NAMES } from '../src/prompts/registry.js';
import { buildPhotoshopInstructions } from '../src/prompts/instructions.js';
import { createRecipeTools } from '../src/tools/recipes/index.js';
import { PHOTOSHOP_RECIPE_TOOL_NAMES } from '../src/tools/recipes/index.js';
import { createStateTools } from '../src/tools/state-tools.js';
import { Session } from '../src/core/session.js';
import { wrapToolHandler } from '../src/errors/envelope.js';

const session = new Session();
const connection = session.getConnection();

const toolRegistry = new ToolRegistry();
const promptRegistry = new PromptRegistry();

registerPhotoshopPrompts(promptRegistry);

for (const def of createRecipeTools(connection)) {
  toolRegistry.register(def.tool.name, {
    tool: def.tool,
    handler: wrapToolHandler(def.tool.name, def.handler),
  });
}

for (const def of createStateTools(connection)) {
  toolRegistry.register(def.tool.name, {
    tool: def.tool,
    handler: wrapToolHandler(def.tool.name, def.handler),
  });
}

console.log(`Registered ${toolRegistry.count()} tools and ${promptRegistry.count()} prompts.`);

const RECIPE_TO_PROMPT: Record<string, string> = {
  photoshop_recipe_remove_background: 'ps.remove_background',
  photoshop_recipe_enhance_portrait: 'ps.enhance_portrait',
  photoshop_recipe_prepare_for_web: 'ps.prepare_for_web',
  photoshop_recipe_export_social_variants: 'ps.export_social_variants',
  photoshop_recipe_apply_color_grade: 'ps.apply_color_grade',
  photoshop_recipe_frequency_separation: 'ps.frequency_separation',
  photoshop_recipe_batch_mockup_replace: 'ps.batch_mockup_replace',
  photoshop_recipe_organize_layers: 'ps.organize_layers',
  photoshop_recipe_gradient_fade: 'ps.gradient_fade',
  photoshop_recipe_sky_blend: 'ps.sky_blend',
  photoshop_recipe_dodge_burn: 'ps.dodge_burn',
  photoshop_recipe_remove_distraction: 'ps.remove_distraction',
  photoshop_recipe_split_carousel: 'ps.split_carousel',
  photoshop_recipe_batch_watermark: 'ps.batch_watermark',
  photoshop_recipe_passport_photo: 'ps.passport_photo',
};

const promptNames = new Set(PHOTOSHOP_PROMPT_TEMPLATES.map((p) => p.name));
const guidePromptNames = new Set<string>(PHOTOSHOP_GUIDE_PROMPT_NAMES);

assert.equal(PHOTOSHOP_RECIPE_TOOL_NAMES.length, 15);
assert.equal(Object.keys(RECIPE_TO_PROMPT).length, 15);
assert.equal(PHOTOSHOP_GUIDE_PROMPT_NAMES.length, 7);
assert.equal(PHOTOSHOP_PROMPT_TEMPLATES.length, 22);

for (const recipeName of PHOTOSHOP_RECIPE_TOOL_NAMES) {
  const promptName = RECIPE_TO_PROMPT[recipeName];
  assert.ok(promptName, `Recipe ${recipeName} is missing from RECIPE_TO_PROMPT mapping.`);
  assert.ok(
    promptNames.has(promptName),
    `Recipe ${recipeName} expects prompt ${promptName} but it was not registered.`
  );
  assert.ok(
    toolRegistry.has(recipeName),
    `Recipe tool ${recipeName} is not registered with the tool registry.`
  );
}

const mappedPromptNames = new Set(Object.values(RECIPE_TO_PROMPT));
for (const template of PHOTOSHOP_PROMPT_TEMPLATES) {
  if (guidePromptNames.has(template.name)) {
    assert.ok(
      promptRegistry.has(template.name),
      `Guide prompt template ${template.name} is missing from the registry.`
    );
    continue;
  }
  assert.ok(
    mappedPromptNames.has(template.name),
    `Prompt ${template.name} has no matching recipe in RECIPE_TO_PROMPT.`
  );
  assert.ok(
    promptRegistry.has(template.name),
    `Prompt template ${template.name} is missing from the registry.`
  );
}

for (const guideName of PHOTOSHOP_GUIDE_PROMPT_NAMES) {
  assert.ok(promptNames.has(guideName), `Guide prompt ${guideName} must be registered.`);
}

for (const required of [
  'photoshop_get_state',
  'photoshop_get_preview',
  'photoshop_get_capabilities',
]) {
  assert.ok(toolRegistry.has(required), `${required} must be registered.`);
}

const instructions = buildPhotoshopInstructions();
assert.ok(instructions.length > 200, 'Photoshop instructions should be substantial.');
for (const marker of [
  'photoshop_ping',
  'photoshop_get_state',
  'photoshop_get_capabilities',
  'photoshop_recipe_',
  'suggested_next_tool',
  'User intent glossary',
  'ps.gradient_blend',
  'Degrade paths',
  'photoshop_recipe_gradient_fade',
  'photoshop_recipe_sky_blend',
  'photoshop_recipe_remove_distraction',
  'photoshop_recipe_dodge_burn',
  'photoshop_adjust_curves',
  'photoshop_generative_remove',
  'photoshop_sky_replacement',
  'photoshop_neural_filter',
  'ps.generative_fill',
]) {
  assert.ok(
    instructions.includes(marker),
    `Photoshop instructions should mention "${marker}".`
  );
}

console.log(
  `OK: ${PHOTOSHOP_RECIPE_TOOL_NAMES.length} recipes ↔ ${Object.keys(RECIPE_TO_PROMPT).length} recipe prompts in parity, ` +
    `${PHOTOSHOP_GUIDE_PROMPT_NAMES.length} guide prompts registered, ` +
    `${PHOTOSHOP_PROMPT_TEMPLATES.length} total prompts, ` +
    `state/preview/capabilities tools registered, instructions reference the new contract.`
);
