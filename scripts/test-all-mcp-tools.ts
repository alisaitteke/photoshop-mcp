/**
 * Sequential local integration test for every photoshop-mcp tool.
 * Run: npx tsx scripts/test-all-mcp-tools.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEST_CHAT_ID = 'local-mcp-test-all';
const EXPORT_DIR = join(homedir(), '.photoshop-mcp', 'exports', TEST_CHAT_ID);

type ToolOutcome = 'pass' | 'fail' | 'skip';

interface ToolRunResult {
  name: string;
  outcome: ToolOutcome;
  detail: string;
  ms: number;
}

function textFrom(result: {
  content?: Array<{ type: string; text?: string }>;
}): string {
  return (result.content ?? [])
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n');
}

function short(text: string, max = 140): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}

class ToolTestRunner {
  private results: ToolRunResult[] = [];
  private layerName = 'MCP_Paint';
  private textLayerName = 'MCP_Text';

  constructor(private client: Client) {}

  async run(
    name: string,
    args: Record<string, unknown> = {},
    opts: { required?: boolean; skip?: string } = {}
  ): Promise<boolean> {
    if (opts.skip) {
      this.record(name, 'skip', opts.skip, 0);
      console.log(`  SKIP ${name} — ${opts.skip}`);
      return false;
    }

    const started = Date.now();
    try {
      const result = await this.client.callTool({ name, arguments: args });
      const ms = Date.now() - started;
      const body = textFrom(result);

      if (result.isError) {
        this.record(name, 'fail', short(body), ms);
        console.log(`  FAIL ${name} (${ms}ms) — ${short(body)}`);
        if (opts.required) throw new Error(`Required tool failed: ${name}`);
        return false;
      }

      this.record(name, 'pass', short(body), ms);
      console.log(`  OK   ${name} (${ms}ms) — ${short(body)}`);
      return true;
    } catch (error) {
      const ms = Date.now() - started;
      const msg = error instanceof Error ? error.message : String(error);
      this.record(name, 'fail', short(msg), ms);
      console.log(`  FAIL ${name} (${ms}ms) — ${short(msg)}`);
      if (opts.required) throw error;
      return false;
    }
  }

  private record(name: string, outcome: ToolOutcome, detail: string, ms: number): void {
    this.results.push({ name, outcome, detail, ms });
  }

  summary(): void {
    const pass = this.results.filter((r) => r.outcome === 'pass').length;
    const fail = this.results.filter((r) => r.outcome === 'fail').length;
    const skip = this.results.filter((r) => r.outcome === 'skip').length;

    console.log('\n========================================');
    console.log(`SUMMARY: ${pass} pass, ${fail} fail, ${skip} skip (${this.results.length} total)`);
    console.log('========================================');

    if (fail > 0) {
      console.log('\nFailures:');
      for (const r of this.results.filter((x) => x.outcome === 'fail')) {
        console.log(`  - ${r.name}: ${r.detail}`);
      }
    }
    if (skip > 0) {
      console.log('\nSkipped:');
      for (const r of this.results.filter((x) => x.outcome === 'skip')) {
        console.log(`  - ${r.name}: ${r.detail}`);
      }
    }
  }

  recordPrompt(name: string, outcome: ToolOutcome, detail: string, ms: number): void {
    this.record(name, outcome, detail, ms);
  }

  getResults(): ToolRunResult[] {
    return this.results;
  }
}

function writeTestPng(path: string): void {
  execSync(
    `python3 -c "import struct,zlib,binascii; w=h=64; rows=b''.join(b'\\x00'+b'\\xff\\x00\\x00'*w for _ in range(h)); comp=zlib.compress(rows,9); crc=lambda t,d: struct.pack('>I',binascii.crc32(t+d)&0xffffffff); ch=lambda t,d: struct.pack('>I',len(d))+t+d+crc(t,d); png=b'\\x89PNG\\r\\n\\x1a\\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+ch(b'IDAT',comp)+ch(b'IEND',b''); open('${path}','wb').write(png)"`,
    { stdio: 'ignore' }
  );
}

async function main(): Promise<void> {
  mkdirSync(EXPORT_DIR, { recursive: true });
  const testPng = join(tmpdir(), 'photoshop-mcp-test.png');
  const assetsDir = join(tmpdir(), 'photoshop-mcp-test-assets');
  mkdirSync(assetsDir, { recursive: true });
  writeTestPng(testPng);
  writeTestPng(join(assetsDir, 'asset-a.png'));
  writeTestPng(join(assetsDir, 'asset-b.png'));

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

  const client = new Client({ name: 'test-all-tools', version: '1.0.0' });
  await client.connect(transport);
  const t = new ToolTestRunner(client);

  console.log('\n=== Phase 0: Session bootstrap ===');
  await t.run('photoshop_ping', {}, { required: true });
  await t.run('photoshop_get_version', {}, { required: true });
  await t.run('photoshop_get_capabilities', {}, { required: true });
  await t.run('photoshop_get_state');

  await t.run('photoshop_execute_script', {
    code: `while (app.documents.length > 0) { app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } return { documentsClosed: true };`,
  });

  console.log('\n=== Phase 1: Document ===');
  await t.run('photoshop_create_document', { width: 800, height: 600 }, { required: true });
  await t.run('photoshop_get_document_info', {}, { required: true });
  await t.run('photoshop_get_state', {}, { required: true });

  console.log('\n=== Phase 2: Layers ===');
  await t.run('photoshop_create_layer', { name: 'MCP_Paint' });
  await t.run('photoshop_fill_layer', { red: 220, green: 40, blue: 40 });
  await t.run('photoshop_create_text_layer', {
    text: 'MCP Test',
    x: 120,
    y: 120,
    fontSize: 36,
  });
  await t.run('photoshop_get_layers', {}, { required: true });

  console.log('\n=== Phase 3: Layer properties ===');
  await t.run('photoshop_execute_script', {
    code: `app.activeDocument.activeLayer = app.activeDocument.artLayers.getByName("MCP_Paint"); return { selected: app.activeDocument.activeLayer.name };`,
  });
  await t.run('photoshop_set_layer_opacity', { opacity: 85 });
  await t.run('photoshop_set_layer_blend_mode', { blendMode: 'MULTIPLY' });
  await t.run('photoshop_set_layer_visibility', { visible: true });
  await t.run('photoshop_rename_layer', { name: 'MCP_Paint_Renamed' });
  await t.run('photoshop_duplicate_layer');
  await t.run('photoshop_set_layer_locked', { locked: false });
  await t.run('photoshop_execute_script', {
    code: `app.activeDocument.activeLayer = app.activeDocument.artLayers.getByName("MCP_Paint_Renamed"); return { active: app.activeDocument.activeLayer.name };`,
  });

  console.log('\n=== Phase 4: Layer transforms ===');
  await t.run('photoshop_move_layer', { deltaX: 10, deltaY: 5 });
  await t.run('photoshop_scale_layer', { scalePercent: 95 });
  await t.run('photoshop_rotate_layer', { degrees: 2 });
  await t.run('photoshop_fit_layer_to_document', { fillDocument: false });

  console.log('\n=== Phase 5: Layer ordering ===');
  await t.run('photoshop_move_layer_up');
  await t.run('photoshop_move_layer_down');
  await t.run('photoshop_move_layer_to_top');
  await t.run('photoshop_move_layer_to_position', {
    targetLayerName: 'MCP_Paint_Renamed',
    position: 'ABOVE',
  });
  await t.run('photoshop_move_layer_to_bottom');

  console.log('\n=== Phase 6: Selection & masks ===');
  await t.run('photoshop_execute_script', {
    code: `app.activeDocument.activeLayer = app.activeDocument.artLayers.getByName("MCP_Paint_Renamed"); return { active: app.activeDocument.activeLayer.name };`,
  });
  await t.run('photoshop_select_rectangle', { left: 50, top: 50, right: 300, bottom: 300 });
  await t.run('photoshop_select_all');
  await t.run('photoshop_invert_selection');
  await t.run('photoshop_create_layer_mask');
  await t.run('photoshop_apply_layer_mask');
  await t.run('photoshop_select_rectangle', { left: 60, top: 60, right: 280, bottom: 280 });
  await t.run('photoshop_create_layer_mask');
  await t.run('photoshop_delete_layer_mask');
  await t.run('photoshop_deselect');

  console.log('\n=== Phase 7: Adjustments ===');
  await t.run('photoshop_execute_script', {
    code: `var doc=app.activeDocument; var L=doc.artLayers.getByName("MCP_Paint_Renamed copy"); doc.activeLayer=L; L.blendMode=BlendMode.NORMAL; return { selected: L.name };`,
  });
  await t.run('photoshop_adjust_brightness_contrast', { brightness: 5, contrast: 5 });
  await t.run('photoshop_adjust_hue_saturation', { hue: 5, saturation: 5, lightness: 0 });
  await t.run('photoshop_auto_levels');
  await t.run('photoshop_auto_contrast');
  await t.run('photoshop_desaturate');
  await t.run('photoshop_invert');

  console.log('\n=== Phase 8: Filters ===');
  await t.run('photoshop_apply_gaussian_blur', { radius: 1.5 });
  await t.run('photoshop_apply_sharpen', { amount: 50, radius: 1, threshold: 0 });
  await t.run('photoshop_apply_noise', { amount: 2, distribution: 'UNIFORM', monochromatic: true });
  await t.run('photoshop_apply_motion_blur', { angle: 0, radius: 5 });

  console.log('\n=== Phase 9: Text ===');
  await t.run('photoshop_execute_script', {
    code: `for (var i = 0; i < app.activeDocument.artLayers.length; i++) { var L = app.activeDocument.artLayers[i]; if (L.kind == LayerKind.TEXT) { app.activeDocument.activeLayer = L; break; } } return { active: app.activeDocument.activeLayer.name };`,
  });
  await t.run('photoshop_set_text_font', { fontName: 'Arial', fontSize: 32 });
  await t.run('photoshop_set_text_color', { red: 10, green: 10, blue: 200 });
  await t.run('photoshop_set_text_alignment', { alignment: 'CENTER' });
  await t.run('photoshop_update_text_content', { text: 'MCP Updated' });

  console.log('\n=== Phase 10: Image placement ===');
  await t.run('photoshop_place_image', { filePath: testPng, x: 400, y: 200 });
  await t.run('photoshop_open_image', { filePath: testPng });
  await t.run('photoshop_execute_script', {
    code: `for (var i=0;i<app.documents.length;i++){var d=app.documents[i]; if(d.width.as('px')===800&&d.height.as('px')===600){app.activeDocument=d;break;}} return {active:app.activeDocument.name,width:app.activeDocument.width.as('px')};`,
  }, { required: true });

  console.log('\n=== Phase 11: Image document ops ===');
  await t.run('photoshop_resize_image', { width: 640, height: 480 });
  await t.run('photoshop_crop_document', { left: 0, top: 0, right: 600, bottom: 450 });

  console.log('\n=== Phase 12: History ===');
  await t.run('photoshop_get_history');
  await t.run('photoshop_undo', { steps: 1 });
  await t.run('photoshop_redo', { steps: 1 });

  console.log('\n=== Phase 13: Actions ===');
  await t.run('photoshop_execute_script', {
    code: 'return { documents: app.documents.length, active: app.activeDocument.name };',
  });
  await t.run('photoshop_play_action', undefined, {
    skip: 'requires a real Actions palette entry — environment-specific',
  });

  console.log('\n=== Phase 14: Recipes ===');
  await t.run('photoshop_execute_script', {
    code: `var doc=app.activeDocument; for (var i=0;i<doc.artLayers.length;i++){var L=doc.artLayers[i]; if(String(L.kind)=='LayerKind.NORMAL'&&L.name.indexOf('Renamed')>=0){doc.activeLayer=L;break;}} return {active:doc.activeLayer.name,kind:String(doc.activeLayer.kind)};`,
  });
  await t.run('photoshop_recipe_frequency_separation', { radius_px: 6 });
  await t.run('photoshop_undo', { steps: 1 });
  await t.run('photoshop_recipe_enhance_portrait', { intensity: 'low', skin_smoothing: true });
  await t.run('photoshop_undo', { steps: 1 });
  await t.run('photoshop_recipe_remove_background', { feather_px: 1, keep_shadow: false }, {
    skip: 'requires a recognizable subject in the active layer — synthetic test canvas has none',
  });
  await t.run('photoshop_undo', { steps: 1 });
  await t.run('photoshop_recipe_apply_color_grade', { preset: 'warm_film' });
  await t.run('photoshop_undo', { steps: 1 });
  await t.run('photoshop_recipe_organize_layers', { auto_group: true, preserve: true });
  await t.run('photoshop_recipe_prepare_for_web', { quality: 8 });
  await t.run('photoshop_recipe_export_social_variants', {
    platforms: ['instagram_post', 'x_post'],
  });
  await t.run('photoshop_recipe_batch_mockup_replace', undefined, {
    skip: 'requires Smart Object mockup PSD — not part of automated canvas setup',
  });

  console.log('\n=== Phase 15: State, preview, save ===');
  await t.run('photoshop_get_preview', { max_dimension_px: 512, quality: 7 });
  await t.run('photoshop_save_document', {
    path: join(EXPORT_DIR, 'mcp-test-save.psd'),
    format: 'PSD',
  });
  await t.run('photoshop_save_document', {
    path: join(EXPORT_DIR, 'mcp-test-save.jpg'),
    format: 'JPEG',
    quality: 9,
  });

  console.log('\n=== Phase 16: Delete, rasterize & destructive ===');
  await t.run('photoshop_create_layer', { name: 'MCP_DeleteMe' });
  await t.run('photoshop_delete_layer');
  await t.run('photoshop_create_text_layer', {
    text: 'Rasterize Target',
    x: 80,
    y: 80,
    fontSize: 24,
  });
  await t.run('photoshop_execute_script', {
    code: `for (var i=0;i<app.activeDocument.artLayers.length;i++){var L=app.activeDocument.artLayers[i]; if(String(L.kind)=='LayerKind.TEXT'&&L.name.indexOf('Rasterize')>=0){app.activeDocument.activeLayer=L; break;}} return {active:app.activeDocument.activeLayer.name,kind:String(app.activeDocument.activeLayer.kind)};`,
  });
  await t.run('photoshop_rasterize_layer');
  await t.run('photoshop_merge_visible_layers');
  await t.run('photoshop_flatten_image');

  console.log('\n=== Phase 17: Cleanup ===');
  await t.run('photoshop_close_document', { save: false });

  console.log('\n=== Phase 18: Prompt templates (all 8) ===');
  const prompts = [
    ['ps.remove_background', { feather_px: '1', keep_shadow: 'false' }],
    ['ps.enhance_portrait', { intensity: 'medium', skin_smoothing: 'true' }],
    ['ps.prepare_for_web', { quality: '8' }],
    ['ps.export_social_variants', { platforms: 'instagram_post,x_post' }],
    ['ps.apply_color_grade', { preset: 'warm' }],
    ['ps.frequency_separation', { radius_px: '6' }],
    ['ps.batch_mockup_replace', { smart_object_layer_name: 'Screen', assets_dir: assetsDir }],
    ['ps.organize_layers', { auto_group: 'true', preserve: 'true' }],
  ] as const;

  for (const [name, args] of prompts) {
    const started = Date.now();
    try {
      const pr = await client.getPrompt({ name, arguments: args });
      const text = pr.messages
        .map((m) => (m.content.type === 'text' ? m.content.text : ''))
        .join('\n');
      const ms = Date.now() - started;
      const ok = text.includes('photoshop_recipe_');
      t.recordPrompt(`prompt:${name}`, ok ? 'pass' : 'fail', short(text), ms);
      console.log(`  ${ok ? 'OK' : 'FAIL'}  prompt:${name} (${ms}ms)`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      t.recordPrompt(`prompt:${name}`, 'fail', msg, 0);
      console.log(`  FAIL prompt:${name} — ${msg}`);
    }
  }

  t.summary();
  await transport.close();

  const failed = t.getResults().filter((r) => r.outcome === 'fail').length;
  const requiredTools = 66;
  const passedTools = t.getResults().filter((r) => r.outcome === 'pass' && r.name.startsWith('photoshop_')).length;
  console.log(`\nTool coverage: ${passedTools}/${requiredTools} atomic+recipe tools passed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
