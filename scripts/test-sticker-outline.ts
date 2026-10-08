/**
 * Local integration test for photoshop_recipe_sticker_outline.
 * Requires a running Photoshop. Run: npx tsx scripts/test-sticker-outline.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
let fail = 0;

function ok(label: string, detail = ''): void {
  pass++;
  console.log(`  PASS ${label}${detail ? ` — ${detail}` : ''}`);
}
function bad(label: string, detail = ''): void {
  fail++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}
function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

type CallResult = { content?: Array<{ type: string; text?: string }>; isError?: boolean };

function textFrom(result: CallResult): string {
  return (result.content ?? [])
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n');
}

function jsonFrom(body: string): any {
  const start = body.indexOf('{');
  if (start < 0) throw new Error(`No JSON in: ${body.slice(0, 160)}`);
  return JSON.parse(body.slice(start));
}

async function callScript(client: Client, code: string): Promise<any> {
  const res = (await client.callTool({
    name: 'photoshop_execute_script',
    arguments: { code },
  })) as CallResult;
  const body = textFrom(res);
  if (res.isError) throw new Error(body);
  return jsonFrom(body);
}

const SETUP = `
  app.documents.add(UnitValue(600,'px'), UnitValue(600,'px'), 72, 'MCP Sticker Test', NewDocumentMode.RGB, DocumentFill.WHITE);
  var layer = app.activeDocument.artLayers.add();
  layer.name = 'Subject';
  app.activeDocument.activeLayer = layer;
  var sel = app.activeDocument.selection;
  sel.select([[170,170],[430,170],[430,430],[170,430]]);
  var c = new SolidColor();
  c.rgb.red = 233; c.rgb.green = 96; c.rgb.blue = 64;
  sel.fill(c);
  sel.deselect();
  return { doc: app.activeDocument.name, layer: layer.name };
`;

const TEXT = `
  app.documents.add(UnitValue(600,'px'), UnitValue(600,'px'), 72, 'MCP Sticker Text', NewDocumentMode.RGB, DocumentFill.WHITE);
  var tl = app.activeDocument.artLayers.add();
  tl.kind = LayerKind.TEXT;
  tl.textItem.contents = '贴画';
  tl.textItem.size = 140;
  tl.textItem.position = [170, 320];
  app.activeDocument.activeLayer = tl;
  return { kind: String(tl.kind), text: tl.textItem.contents };
`;

const INSPECT = `
  var doc = app.activeDocument;
  function cT(s){ return app.charIDToTypeID(s); }
  function sT(s){ return app.stringIDToTypeID(s); }
  var ref = new ActionReference();
  ref.putProperty(cT('Prpr'), cT('Lefx'));
  ref.putEnumerated(cT('Lyr '), cT('Ordn'), cT('Trgt'));
  var outer = executeActionGet(ref);
  var lefx = outer.hasKey(cT('Lefx')) ? outer.getObjectValue(cT('Lefx')) : outer;
  var out = {
    lefx_keys: lefx.count,
    has_stroke: lefx.hasKey(sT('frameFX')),
    has_shadow: lefx.hasKey(cT('DrSh')),
    has_glow: lefx.hasKey(cT('OrGl')),
    layer_kind: String(doc.activeLayer.kind),
    stroke_enabled: false,
    stroke_size: -1,
    stroke_frame: '',
    stroke_red: -1,
    shadow_enabled: false
  };
  if (out.has_stroke) {
    var s = lefx.getObjectValue(sT('frameFX'));
    out.stroke_enabled = s.getBoolean(cT('enab'));
    out.stroke_size = s.getUnitDoubleValue(cT('Sz  '));
    out.stroke_frame = app.typeIDToStringID(s.getEnumerationValue(sT('style')));
    var clr = s.getObjectValue(cT('Clr '));
    out.stroke_red = clr.getDouble(cT('Rd  '));
  }
  if (out.has_shadow) {
    var shd = lefx.getObjectValue(cT('DrSh'));
    out.shadow_enabled = shd.getBoolean(cT('enab'));
  }
  return out;
`;

const DC_INSPECT = `
  var doc = app.activeDocument;
  function cT(s){ return app.charIDToTypeID(s); }
  function sT(s){ return app.stringIDToTypeID(s); }
  function readLefx() {
    var ref = new ActionReference();
    ref.putProperty(cT('Prpr'), cT('Lefx'));
    ref.putEnumerated(cT('Lyr '), cT('Ordn'), cT('Trgt'));
    var outer = executeActionGet(ref);
    var lefx = outer.hasKey(cT('Lefx')) ? outer.getObjectValue(cT('Lefx')) : null;
    var o = { has_stroke: false, stroke_width: -1, stroke_red: -1, has_shadow: false };
    if (lefx) {
      if (lefx.hasKey(sT('frameFX'))) {
        var s = lefx.getObjectValue(sT('frameFX'));
        o.has_stroke = true;
        o.stroke_width = s.getUnitDoubleValue(cT('Sz  '));
        o.stroke_red = Math.round(s.getObjectValue(cT('Clr ')).getDouble(cT('Rd  ')));
      }
      o.has_shadow = lefx.hasKey(cT('DrSh'));
    }
    return o;
  }
  var out = [];
  for (var i = 0; i < doc.layers.length; i++) {
    var lyr = doc.layers[i];
    doc.activeLayer = lyr;
    var info = readLefx();
    info.name = lyr.name;
    out.push(info);
  }
  return { layers: out };
`;

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', join(ROOT, 'src/index.ts')],
    env: { ...process.env, LOG_LEVEL: '0' },
    stderr: 'pipe',
    cwd: ROOT,
  });
  const client = new Client({ name: 'sticker-outline-test', version: '1.0.0' });
  await client.connect(transport);

  section('List tools');
  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name);
  if (names.includes('photoshop_recipe_sticker_outline')) {
    ok('photoshop_recipe_sticker_outline is registered');
  } else {
    bad('photoshop_recipe_sticker_outline missing from tools/list');
  }

  section('Ping Photoshop');
  const ping = (await client.callTool({ name: 'photoshop_ping', arguments: {} })) as CallResult;
  const pingText = textFrom(ping);
  if (!ping.isError && /connect|success/i.test(pingText)) {
    ok('photoshop_ping', pingText.replace(/\s+/g, ' ').slice(0, 80));
  } else {
    bad('photoshop_ping', pingText.replace(/\s+/g, ' ').slice(0, 120));
    console.log('Cannot reach Photoshop — aborting.');
    await transport.close();
    process.exit(1);
  }

  section('Setup document + subject');
  const setup = await callScript(client, SETUP);
  ok('document created', `doc=${setup.doc} layer=${setup.layer}`);

  section('Default recipe call (white stroke + shadow)');
  const res = (await client.callTool({
    name: 'photoshop_recipe_sticker_outline',
    arguments: {},
  })) as CallResult;
  const body = textFrom(res);
  if (res.isError) {
    bad('default call errored', body.replace(/\s+/g, ' ').slice(0, 200));
  } else {
    const parsed = jsonFrom(body);
    if (parsed.ok === true) ok('default result ok', parsed.summary);
    else bad('default result not ok', JSON.stringify(parsed));

    const fx = await callScript(client, INSPECT);
    console.log('  inspect:', JSON.stringify(fx));
    if (fx.has_stroke && fx.stroke_enabled) ok('stroke effect present + enabled');
    else bad('stroke effect missing', JSON.stringify(fx));
    if (fx.stroke_size === 12) ok('default stroke width = 12px');
    else bad('default stroke width', `expected 12, got ${fx.stroke_size}`);
    if (fx.stroke_frame === 'outsetFrame') ok('default position = outside (outsetFrame)');
    else bad('default position', `expected outsetFrame, got ${fx.stroke_frame}`);
    if (fx.stroke_red === 255) ok('default stroke color = white');
    else bad('default stroke color', `expected 255, got ${fx.stroke_red}`);
    if (fx.has_shadow && fx.shadow_enabled) ok('drop shadow present + enabled');
    else bad('drop shadow missing', JSON.stringify(fx));
  }

  section('Variant: shadow=false, inside, custom color/width');
  const res2 = (await client.callTool({
    name: 'photoshop_recipe_sticker_outline',
    arguments: {
      red: 20,
      green: 120,
      blue: 220,
      stroke_width: 20,
      stroke_position: 'inside',
      shadow: false,
    },
  })) as CallResult;
  const body2 = textFrom(res2);
  if (res2.isError) {
    bad('variant call errored', body2.replace(/\s+/g, ' ').slice(0, 200));
  } else {
    const parsed2 = jsonFrom(body2);
    if (parsed2.ok === true) ok('variant result ok', parsed2.summary);
    else bad('variant result not ok', JSON.stringify(parsed2));

    const fx2 = await callScript(client, INSPECT);
    console.log('  inspect:', JSON.stringify(fx2));
    if (fx2.has_stroke && fx2.stroke_size === 20 && fx2.stroke_frame === 'insetFrame') {
      ok('variant stroke width 20px inside');
    } else {
      bad('variant stroke mismatch', JSON.stringify(fx2));
    }
    if (Math.round(fx2.stroke_red) === 20) ok('variant stroke color applied');
    else bad('variant stroke color', `expected 20, got ${fx2.stroke_red}`);
    if (!fx2.has_shadow) ok('shadow removed when shadow=false');
    else bad('shadow still present despite shadow=false', JSON.stringify(fx2));
  }

  section('Preserve existing effects (outer glow must survive)');
  await client.callTool({
    name: 'photoshop_apply_layer_style',
    arguments: { style: 'outer_glow', size: 20, opacity: 60 },
  });
  const glowBefore = await callScript(client, INSPECT);
  if (glowBefore.has_glow) ok('pre-existing outer glow present before recipe');
  else bad('pre-glow not applied (test setup issue)');

  await client.callTool({
    name: 'photoshop_recipe_sticker_outline',
    arguments: { stroke_width: 8, shadow: false },
  });
  const glowAfter = await callScript(client, INSPECT);
  console.log('  inspect:', JSON.stringify(glowAfter));
  if (glowAfter.has_glow && glowAfter.has_stroke && !glowAfter.has_shadow) {
    ok('recipe preserved the pre-existing outer glow (only stroke + shadow touched)');
  } else {
    bad('recipe did not preserve existing effects', JSON.stringify(glowAfter));
  }

  section('Preview');
  const prev = (await client.callTool({
    name: 'photoshop_get_preview',
    arguments: {},
  })) as CallResult;
  const prevHasImage = (prev.content ?? []).some((c) => c.type === 'image');
  if (!prev.isError && prevHasImage) ok('preview image returned');
  else bad('preview', prevHasImage ? 'error flag' : 'no image content');

  section('One-undo check (fresh document)');
  const setup2 = await callScript(client, SETUP);
  ok('fresh document', setup2.doc);
  await client.callTool({
    name: 'photoshop_recipe_sticker_outline',
    arguments: { stroke_width: 16 },
  });
  const withFx = await callScript(client, INSPECT);
  if (withFx.has_stroke && withFx.has_shadow) ok('recipe applied on fresh document');
  else bad('recipe failed on fresh document', JSON.stringify(withFx));
  await client.callTool({ name: 'photoshop_undo', arguments: { steps: 1 } });
  const undone = await callScript(client, INSPECT);
  if (!undone.has_stroke && !undone.has_shadow) ok('one undo cleared the whole sticker effect');
  else bad('one undo did not clear the effect', JSON.stringify(undone));

  section('Sticker on a text layer (must not rasterize the type)');
  const textSetup = await callScript(client, TEXT);
  ok('text layer created', `kind=${textSetup.kind} text=${textSetup.text}`);
  await client.callTool({
    name: 'photoshop_recipe_sticker_outline',
    arguments: { stroke_width: 10 },
  });
  const textFx = await callScript(client, INSPECT);
  console.log('  inspect:', JSON.stringify(textFx));
  if (textFx.has_stroke && textFx.has_shadow && textFx.layer_kind === 'LayerKind.TEXT') {
    ok('sticker applied on text and the layer is still an editable TEXT layer');
  } else {
    bad('text sticker failed or rasterized', JSON.stringify(textFx));
  }

  section('Die-cut sticker (white border + dark outer line)');
  const dcSetup = await callScript(client, SETUP);
  ok('fresh document for die_cut', dcSetup.doc);
  const dcRes = (await client.callTool({
    name: 'photoshop_recipe_sticker_outline',
    arguments: { outline_style: 'die_cut', stroke_width: 12, line_width: 3 },
  })) as CallResult;
  const dcBody = textFrom(dcRes);
  if (dcRes.isError) {
    bad('die_cut call errored', dcBody.replace(/\s+/g, ' ').slice(0, 240));
  } else {
    const dcParsed = jsonFrom(dcBody);
    if (dcParsed.ok === true && dcParsed.details?.outline_style === 'die_cut') {
      ok('die_cut result ok', dcParsed.summary);
    } else {
      bad('die_cut result not ok', JSON.stringify(dcParsed));
    }

    const dc = await callScript(client, DC_INSPECT);
    console.log('  layers:', JSON.stringify(dc.layers));
    const white = dc.layers[1];
    const dark = dc.layers[2];
    if (dc.layers.length === 4) ok('layer stack = original + 2 copies + background');
    else bad('unexpected layer count', `${dc.layers.length}`);

    if (dc.layers[0]?.name === 'Subject' && dc.layers[0].has_stroke === false) {
      ok('original layer stays on top and untouched');
    } else {
      bad('original layer not on top / modified', JSON.stringify(dc.layers[0]));
    }
    if (
      white?.name?.endsWith('- white border') &&
      white.has_stroke &&
      white.stroke_width === 12 &&
      white.stroke_red === 255 &&
      !white.has_shadow
    ) {
      ok('middle layer = 12px white border, no shadow');
    } else {
      bad('white border layer wrong', JSON.stringify(white));
    }
    if (
      dark?.name?.endsWith('- dark line') &&
      dark.has_stroke &&
      dark.stroke_width === 15 &&
      dark.stroke_red === 0 &&
      dark.has_shadow
    ) {
      ok('bottom layer = 15px dark line + drop shadow');
    } else {
      bad('dark line layer wrong', JSON.stringify(dark));
    }

    await client.callTool({ name: 'photoshop_undo', arguments: { steps: 1 } });
    const afterDcUndo = await callScript(client, DC_INSPECT);
    if (
      afterDcUndo.layers.length === 2 &&
      afterDcUndo.layers.every((l: { has_stroke: boolean }) => !l.has_stroke)
    ) {
      ok('one undo removed BOTH die-cut copies');
    } else {
      bad('die_cut undo did not revert in one step', JSON.stringify(afterDcUndo.layers));
    }
  }

  section('Cleanup');
  const remaining = await callScript(client, 'return { n: app.documents.length };');
  for (let i = 0; i < remaining.n; i++) {
    await client.callTool({ name: 'photoshop_close_document', arguments: { save: false } });
  }
  ok(`${remaining.n} open document(s) closed`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await transport.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
