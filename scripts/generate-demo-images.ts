/**
 * Generate real demo outputs for the README's new recipes (split_carousel,
 * batch_watermark, passport_photo) and smoke-test the neural `colorize` filter.
 *
 * Requires: Photoshop running (PS 23+; UXP bridge plugin loaded for colorize).
 * Sample assets are painted synthetically inside Photoshop — no external files.
 *
 * Run: npx tsx scripts/generate-demo-images.ts
 * Outputs: copied from ~/.photoshop-mcp/exports into images/demo-*.jpg
 */
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Session } from '../src/core/session.js';
import { PhotoshopAPIFactory } from '../src/api/photoshop-api.js';
import { createRecipeTools } from '../src/tools/recipes/index.js';
import { invokeNeuralFilter } from '../src/platform/uxp-bridge-client.js';
import type { ToolResult } from '../src/core/tool-registry.js';

const IMAGES_DIR = join(process.cwd(), 'images');

function resultPayload(result: ToolResult): {
  ok: boolean;
  output_paths?: string[];
  message?: string;
} {
  try {
    const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
    return JSON.parse(text);
  } catch {
    return { ok: false, message: 'unparseable tool result' };
  }
}

function copyOutputs(paths: string[] | undefined, prefix: string, max: number): string[] {
  if (!paths) return [];
  const copied: string[] = [];
  for (const p of paths.slice(0, max)) {
    if (!existsSync(p)) continue;
    const name = `${prefix}${copied.length > 0 ? `-${copied.length + 1}` : ''}.jpg`;
    const dest = join(IMAGES_DIR, name);
    copyFileSync(p, dest);
    copied.push(dest);
  }
  return copied;
}

async function main() {
  mkdirSync(IMAGES_DIR, { recursive: true });
  const session = new Session();
  const connection = session.getConnection();
  const apiFactory = new PhotoshopAPIFactory(connection);
  const api = await apiFactory.createAPI();

  const tools = createRecipeTools(connection);
  const byName = new Map(tools.map((t) => [t.tool.name, t.handler]));
  const run = (name: string, args: Record<string, unknown>) => {
    const handler = byName.get(name);
    if (!handler) throw new Error(`tool not registered: ${name}`);
    return handler(args);
  };

  // ── 1) Carousel: paint a 5400×1350 synthetic panorama, then split ──────────
  console.log('• Painting demo panorama (5400×1350, 5 bands)…');
  await api.executeScript(`
    var doc = app.documents.add(UnitValue(5400, 'px'), UnitValue(1350, 'px'), 72,
      'mcp-demo-panorama', NewDocumentMode.RGB, DocumentFill.WHITE);
    var colors = [[249,178,78],[239,138,99],[226,96,122],[156,93,184],[65,88,208]];
    for (var i = 0; i < 5; i++) {
      var l = i * 1080;
      doc.selection.select([[l, 0], [l + 1080, 0], [l + 1080, 1350], [l, 1350]]);
      var c = new SolidColor();
      c.rgb.red = colors[i][0]; c.rgb.green = colors[i][1]; c.rgb.blue = colors[i][2];
      doc.selection.fill(c);
      doc.selection.deselect();
      var t = doc.artLayers.add();
      t.kind = LayerKind.TEXT;
      t.textItem.contents = '0' + (i + 1);
      t.textItem.size = new UnitValue(420, 'px');
      var w = new SolidColor();
      w.rgb.red = 255; w.rgb.green = 255; w.rgb.blue = 255;
      t.textItem.color = w;
      t.textItem.position = [new UnitValue(l + 400, 'px'), new UnitValue(880, 'px')];
    }
    return 'ok';
  `);
  const carousel = resultPayload(
    await run('photoshop_recipe_split_carousel', {
      slides: 5,
      slide_width: 1080,
      slide_height: 1350,
      quality: 10,
    })
  );
  const carouselCopied = copyOutputs(carousel.output_paths, 'demo-carousel', 3);
  console.log(
    carousel.ok
      ? `  ✓ split_carousel → ${carouselCopied.join(', ') || '(outputs in exports dir)'}`
      : `  ✗ split_carousel failed: ${carousel.message}`
  );
  await api.executeScript(
    `try { app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {} return 'ok';`
  );

  // ── 2) Watermark: paint 4 sample photos, then batch watermark ──────────────
  console.log('• Painting 4 sample photos…');
  const assetsDir = mkdtempSync(join(tmpdir(), 'mcp-demo-watermark-'));
  await api.executeScript(`
    var hues = [[61,109,181],[184,92,56],[62,125,78],[120,90,160]];
    for (var k = 0; k < 4; k++) {
      var doc = app.documents.add(UnitValue(1600, 'px'), UnitValue(1000, 'px'), 72,
        'mcp-demo-photo-' + k, NewDocumentMode.RGB, DocumentFill.WHITE);
      var base = new SolidColor();
      base.rgb.red = hues[k][0]; base.rgb.green = hues[k][1]; base.rgb.blue = hues[k][2];
      doc.selection.selectAll();
      doc.selection.fill(base);
      doc.selection.deselect();
      doc.selection.select([[0, 1000], [800, 420], [1600, 1000]]);
      var dark = new SolidColor();
      dark.rgb.red = 35; dark.rgb.green = 43; dark.rgb.blue = 64;
      doc.selection.fill(dark);
      doc.selection.deselect();
      var f = new File(${JSON.stringify(assetsDir)} + '/photo-' + (k + 1) + '.jpg');
      var o = new JPEGSaveOptions();
      o.quality = 9;
      doc.saveAs(f, o, true);
      doc.close(SaveOptions.DONOTSAVECHANGES);
    }
    return 'ok';
  `);
  const watermark = resultPayload(
    await run('photoshop_recipe_batch_watermark', {
      assets_dir: assetsDir,
      text: '© photoshop-mcp',
      position: 'bottom_right',
      opacity: 40,
    })
  );
  const watermarkCopied = copyOutputs(watermark.output_paths, 'demo-watermark', 2);
  console.log(
    watermark.ok
      ? `  ✓ batch_watermark → ${watermarkCopied.join(', ') || '(outputs in exports dir)'}`
      : `  ✗ batch_watermark failed: ${watermark.message}`
  );

  // ── 3) Passport: synthetic portrait (Select Subject may reject silhouettes) ─
  console.log('• Painting synthetic portrait…');
  await api.executeScript(`
    var doc = app.documents.add(UnitValue(1200, 'px'), UnitValue(1600, 'px'), 72,
      'mcp-demo-portrait', NewDocumentMode.RGB, DocumentFill.WHITE);
    var bg = new SolidColor();
    bg.rgb.red = 122; bg.rgb.green = 154; bg.rgb.blue = 190;
    doc.selection.selectAll();
    doc.selection.fill(bg);
    doc.selection.deselect();
    var skin = new SolidColor();
    skin.rgb.red = 70; skin.rgb.green = 70; skin.rgb.blue = 78;
    // head
    doc.selection.select([[470, 260], [730, 260], [730, 560], [470, 560]], SelectionType.REPLACE);
    // shoulders
    var shoulder = [[330, 1300], [870, 1300], [760, 620], [440, 620]];
    doc.selection.select(shoulder, SelectionType.EXTEND);
    doc.selection.fill(skin);
    doc.selection.deselect();
    return 'ok';
  `);
  const passport = resultPayload(
    await run('photoshop_recipe_passport_photo', { spec: 'us_2x2', make_sheet: true, quality: 11 })
  );
  const passportCopied = copyOutputs(passport.output_paths, 'demo-passport', 2);
  console.log(
    passport.ok
      ? `  ✓ passport_photo → ${passportCopied.join(', ') || '(outputs in exports dir)'}`
      : `  ✗ passport_photo failed (expected if Select Subject rejects synthetic silhouettes): ${passport.message}`
  );
  await api.executeScript(
    `try { app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {} return 'ok';`
  );

  // ── 4) Neural colorize descriptor smoke test (needs UXP bridge plugin) ──────
  console.log('• Neural colorize descriptor check (UXP bridge)…');
  await api.executeScript(`
    var doc = app.documents.add(UnitValue(800, 'px'), UnitValue(600, 'px'), 72,
      'mcp-demo-bw', NewDocumentMode.RGB, DocumentFill.WHITE);
    var g = new SolidColor();
    g.rgb.red = 128; g.rgb.green = 128; g.rgb.blue = 128;
    doc.selection.selectAll();
    doc.selection.fill(g);
    doc.selection.deselect();
    return 'ok';
  `);
  const colorize = await invokeNeuralFilter('colorize', {});
  console.log(
    colorize.ok
      ? '  ✓ colorize descriptor accepted by batchPlay'
      : `  ✗ colorize failed: ${colorize.error} — capture the real descriptor name via Scripting Listener and fix uxp-plugin/main.js`
  );
  await api.executeScript(
    `try { app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {} return 'ok';`
  );

  console.log('\nDone. Embed generated images/demo-*.jpg in README example blocks as desired.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
