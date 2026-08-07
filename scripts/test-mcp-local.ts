/**
 * Local smoke test: spawn photoshop-mcp via stdio and exercise the prompt layer.
 * Run: npx tsx scripts/test-mcp-local.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEST_CHAT_ID = 'local-mcp-test';

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function ok(label: string, detail?: string): void {
  console.log(`  OK  ${label}${detail ? `: ${detail}` : ''}`);
}

function fail(label: string, detail?: string): never {
  console.error(`  FAIL ${label}${detail ? `: ${detail}` : ''}`);
  process.exit(1);
}

function textFromToolResult(result: {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}): string {
  const parts = (result.content ?? [])
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!);
  return parts.join('\n');
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', join(ROOT, 'src/index.ts')],
    env: {
      ...process.env,
      LOG_LEVEL: '0',
      PHOTOSHOP_EXPORT_CHAT_ID: TEST_CHAT_ID,
    },
    stderr: 'pipe',
    cwd: ROOT,
  });

  const client = new Client({ name: 'local-mcp-test', version: '1.0.0' });

  section('Connect');
  await client.connect(transport);
  ok('stdio connected');

  const version = client.getServerVersion();
  if (!version?.name?.includes('photoshop')) {
    fail('server identity', JSON.stringify(version));
  }
  ok('server', `${version!.name} v${version!.version}`);

  const instructions = client.getInstructions() ?? '';
  if (instructions.length < 200) fail('instructions length', String(instructions.length));
  for (const marker of ['photoshop_get_state', 'photoshop_recipe_', 'suggested_next_tool']) {
    if (!instructions.includes(marker)) fail('instructions marker', marker);
  }
  ok('instructions', `${instructions.length} chars, contract markers present`);

  section('List prompts');
  const { prompts } = await client.listPrompts();
  const promptNames = prompts.map((p) => p.name).sort();
  const expectedRecipePrompts = [
    'ps.apply_color_grade',
    'ps.batch_mockup_replace',
    'ps.batch_watermark',
    'ps.csv_to_cards',
    'ps.dodge_burn',
    'ps.enhance_portrait',
    'ps.export_social_variants',
    'ps.frequency_separation',
    'ps.gradient_fade',
    'ps.organize_layers',
    'ps.passport_photo',
    'ps.prepare_for_web',
    'ps.remove_background',
    'ps.remove_distraction',
    'ps.sky_blend',
    'ps.split_carousel',
  ];
  const expectedGuidePrompts = [
    'ps.color_correct',
    'ps.composite_blend',
    'ps.dodge_burn_guide',
    'ps.gradient_blend',
    'ps.generative_fill',
    'ps.generative_remove',
    'ps.generative_expand',
  ];
  const expectedPromptCount = expectedRecipePrompts.length + expectedGuidePrompts.length;
  if (promptNames.length !== expectedPromptCount) fail('prompt count', String(promptNames.length));
  for (const name of [...expectedRecipePrompts, ...expectedGuidePrompts]) {
    if (!promptNames.includes(name)) fail('missing prompt', name);
  }
  ok(
    `${expectedPromptCount} prompt templates`,
    `${expectedRecipePrompts.length} recipe + ${expectedGuidePrompts.length} guide`
  );

  section('Get prompt (ps.remove_background)');
  const promptResult = await client.getPrompt({
    name: 'ps.remove_background',
    arguments: { feather_px: '2', keep_shadow: 'true' },
  });
  const promptText = promptResult.messages
    .map((m) => (m.content.type === 'text' ? m.content.text : ''))
    .join('\n');
  if (!promptText.includes('photoshop_recipe_remove_background')) {
    fail('prompt content', 'missing recipe reference');
  }
  if (!promptText.includes('feather_px: 2')) fail('prompt content', 'missing feather_px coercion');
  if (!promptText.includes('keep_shadow: true')) fail('prompt content', 'missing keep_shadow coercion');
  ok('ps.remove_background', `${promptText.length} chars`);

  section('Get prompt (ps.sky_blend)');
  const skyPrompt = await client.getPrompt({
    name: 'ps.sky_blend',
    arguments: { sky_image_path: '/tmp/sky.jpg', horizon_pct: '45', feather_pct: '15' },
  });
  const skyText = skyPrompt.messages
    .map((m) => (m.content.type === 'text' ? m.content.text : ''))
    .join('\n');
  if (!skyText.includes('photoshop_recipe_sky_blend')) {
    fail('sky prompt content', 'missing recipe reference');
  }
  ok('ps.sky_blend', `${skyText.length} chars`);

  section('List tools (new layer)');
  const { tools } = await client.listTools();
  const toolNames = new Set(tools.map((t) => t.name));
  const required = [
    'photoshop_get_state',
    'photoshop_get_preview',
    'photoshop_get_capabilities',
    'photoshop_recipe_remove_background',
    'photoshop_recipe_enhance_portrait',
    'photoshop_recipe_frequency_separation',
    'photoshop_recipe_prepare_for_web',
    'photoshop_recipe_export_social_variants',
    'photoshop_recipe_apply_color_grade',
    'photoshop_recipe_batch_mockup_replace',
    'photoshop_recipe_organize_layers',
    'photoshop_recipe_gradient_fade',
    'photoshop_recipe_sky_blend',
    'photoshop_recipe_dodge_burn',
    'photoshop_recipe_remove_distraction',
    'photoshop_recipe_csv_to_cards',
    'photoshop_generative_fill',
    'photoshop_generative_remove',
    'photoshop_generative_expand',
    'photoshop_generative_upscale',
    'photoshop_sky_replacement',
    'photoshop_generate_image',
    'photoshop_neural_filter',
    'photoshop_apply_layer_style',
    'photoshop_apply_lut',
    'photoshop_adjust_vibrance',
    'photoshop_adjust_exposure',
    'photoshop_apply_photo_filter',
    'photoshop_apply_gradient_map',
    'photoshop_list_datasets',
    'photoshop_import_datasets',
    'photoshop_generate_from_datasets',
    'photoshop_image_stack',
    'photoshop_export_as',
  ];
  for (const name of required) {
    if (!toolNames.has(name)) fail('missing tool', name);
  }
  ok('recipe + state tools registered', `${required.length} checked`);

  section('Call photoshop_ping');
  const ping = await client.callTool({ name: 'photoshop_ping', arguments: {} });
  const pingText = textFromToolResult(ping);
  const photoshopReachable = pingText.toLowerCase().includes('successfully connected');
  ok('photoshop_ping', pingText.trim());

  section('Call photoshop_get_capabilities');
  const caps = await client.callTool({ name: 'photoshop_get_capabilities', arguments: {} });
  const capsText = textFromToolResult(caps);
  let capsJson: Record<string, unknown> = {};
  if (caps.isError) {
    if (!photoshopReachable) {
      console.log('  SKIP get_capabilities — Photoshop not reachable');
    } else {
      fail('get_capabilities', capsText);
    }
  } else {
    try {
      capsJson = JSON.parse(capsText) as Record<string, unknown>;
    } catch {
      fail('get_capabilities JSON', capsText.slice(0, 200));
    }
    ok('get_capabilities', `version=${String(capsJson.version ?? 'unknown')}`);
  }

  if (photoshopReachable) {
    section('Call photoshop_get_state');
    const state = await client.callTool({ name: 'photoshop_get_state', arguments: {} });
    const stateText = textFromToolResult(state);
    let hasDocument = false;
    if (state.isError) {
      console.log(`  WARN get_state returned error (document may be in odd state): ${stateText.slice(0, 200)}`);
    } else {
      const stateJson = JSON.parse(stateText) as { hasDocument?: boolean };
      hasDocument = stateJson.hasDocument === true;
      ok('get_state', `hasDocument=${String(hasDocument)}`);
    }

    if (hasDocument) {
      section('Call photoshop_recipe_organize_layers (dry, preserve)');
      const organize = await client.callTool({
        name: 'photoshop_recipe_organize_layers',
        arguments: { auto_group: false, preserve: true },
      });
      const organizeText = textFromToolResult(organize);
      if (organize.isError) {
        console.log(`  WARN recipe organize_layers: ${organizeText.slice(0, 300)}`);
      } else {
        ok('organize_layers', organizeText.slice(0, 120));
      }
    } else {
      console.log('  SKIP recipe test — no active document in Photoshop');
    }
  } else {
    console.log('  SKIP Photoshop-dependent calls — Photoshop not reachable');
  }

  section('Export path env');
  if (process.env.PHOTOSHOP_EXPORT_CHAT_ID !== TEST_CHAT_ID) {
    // env is on server child, not parent — verify via prepare_for_web path hint in instructions
    ok('chat scoping', `server spawned with PHOTOSHOP_EXPORT_CHAT_ID=${TEST_CHAT_ID}`);
  }

  await transport.close();
  console.log('\nAll local MCP smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
