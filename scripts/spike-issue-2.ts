/**
 * Targeted regression script for GitHub issue #2 fixes.
 * Run: npm run spike:issue-2
 *
 * Requires a live Photoshop instance (macOS or Windows).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEST_CHAT_ID = 'local-mcp-spike-issue-2';
const ALERT_TIMEOUT_MS = 10_000;
const CJK_LAYER_NAME = '测试レイヤー';

let failures = 0;

function textFrom(result: {
  content?: Array<{ type: string; text?: string }>;
}): string {
  return (result.content ?? [])
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n');
}

function parseJsonFromText(body: string): unknown {
  const jsonStart = body.indexOf('{');
  const jsonArrayStart = body.indexOf('[');
  const start =
    jsonStart >= 0 && (jsonArrayStart < 0 || jsonStart <= jsonArrayStart)
      ? jsonStart
      : jsonArrayStart;
  if (start < 0) throw new Error('No JSON payload in tool response');
  return JSON.parse(body.slice(start));
}

function pass(label: string, detail?: string): void {
  console.log(`  PASS ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label: string, detail?: string): void {
  failures += 1;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) pass(label, detail);
  else fail(label, detail);
}

function writeTestPng(path: string): void {
  execSync(
    `python3 -c "import struct,zlib,binascii; w=h=64; rows=b''.join(b'\\x00'+b'\\xff\\x00\\x00'*w for _ in range(h)); comp=zlib.compress(rows,9); crc=lambda t,d: struct.pack('>I',binascii.crc32(t+d)&0xffffffff); ch=lambda t,d: struct.pack('>I',len(d))+t+d+crc(t,d); png=b'\\x89PNG\\r\\n\\x1a\\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+ch(b'IDAT',comp)+ch(b'IEND',b''); open('${path}','wb').write(png)"`,
    { stdio: 'ignore' }
  );
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
  timeoutMs?: number
): Promise<{ isError?: boolean; content?: Array<{ type: string; text?: string }> }> {
  const call = client.callTool({ name, arguments: args });
  if (timeoutMs === undefined) return call;
  return Promise.race([
    call,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function main(): Promise<void> {
  const testPng = join(tmpdir(), 'photoshop-mcp-spike-issue-2.png');
  writeTestPng(testPng);

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

  const client = new Client({ name: 'spike-issue-2', version: '1.0.0' });

  console.log('\n=== Issue #2 regression spike ===\n');

  try {
    await client.connect(transport);
  } catch (error) {
    console.error(
      'Could not connect to MCP server. Is Node available and the project built?'
    );
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const ping = await callTool(client, 'photoshop_ping');
  if (ping.isError) {
    fail(
      'photoshop_ping',
      'Photoshop is not reachable — launch Photoshop and retry'
    );
    await transport.close();
    process.exit(1);
  }
  pass('photoshop_ping');

  await callTool(client, 'photoshop_execute_script', {
    code: `while (app.documents.length > 0) { app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); } return { documentsClosed: true };`,
  });

  // Step 1
  console.log('\n--- Step 1: create document ---');
  const createDoc = await callTool(client, 'photoshop_create_document', {
    width: 800,
    height: 600,
  });
  assert(!createDoc.isError, 'photoshop_create_document');

  // Step 2
  console.log('\n--- Step 2: get_document_info ---');
  const docInfo = await callTool(client, 'photoshop_get_document_info');
  assert(!docInfo.isError, 'photoshop_get_document_info (tool level)');
  try {
    const payload = parseJsonFromText(textFrom(docInfo)) as {
      document?: { width?: number; height?: number; error?: string };
    };
    assert(payload.document?.width === 800, 'document.width === 800', String(payload.document?.width));
    assert(payload.document?.height === 600, 'document.height === 600', String(payload.document?.height));
    assert(!payload.document?.error, 'no document.error', payload.document?.error);
  } catch (error) {
    fail('photoshop_get_document_info (parse)', error instanceof Error ? error.message : String(error));
  }

  // Step 3
  console.log('\n--- Step 3: get_state ---');
  const state = await callTool(client, 'photoshop_get_state');
  assert(!state.isError, 'photoshop_get_state (tool level)');
  try {
    const payload = parseJsonFromText(textFrom(state)) as {
      document?: { width?: number; height?: number; error?: string };
    };
    assert(payload.document?.width === 800, 'context.document.width === 800', String(payload.document?.width));
    assert(payload.document?.height === 600, 'context.document.height === 600', String(payload.document?.height));
    assert(!payload.document?.error, 'no context.document.error', payload.document?.error);
  } catch (error) {
    fail('photoshop_get_state (parse)', error instanceof Error ? error.message : String(error));
  }

  // Step 4
  console.log('\n--- Step 4: create layer + adjust curves ---');
  const createLayer = await callTool(client, 'photoshop_create_layer', { name: 'MCP_Spike_Paint' });
  assert(!createLayer.isError, 'photoshop_create_layer');
  await callTool(client, 'photoshop_fill_layer', { red: 100, green: 150, blue: 200 });
  const curves = await callTool(client, 'photoshop_adjust_curves', { preset: 'auto_tone' });
  assert(!curves.isError, 'photoshop_adjust_curves');

  // Step 5
  console.log('\n--- Step 5: get_layers ---');
  const layers = await callTool(client, 'photoshop_get_layers');
  assert(!layers.isError, 'photoshop_get_layers (tool level)');
  try {
    const payload = parseJsonFromText(textFrom(layers)) as { layers?: unknown[] };
    assert((payload.layers?.length ?? 0) >= 2, 'layers.length >= 2', String(payload.layers?.length));
  } catch (error) {
    fail('photoshop_get_layers (parse)', error instanceof Error ? error.message : String(error));
  }

  // Step 6
  console.log('\n--- Step 6: place_image ---');
  const place = await callTool(client, 'photoshop_place_image', {
    filePath: testPng,
    x: 100,
    y: 100,
  });
  assert(!place.isError, 'photoshop_place_image (tool level)');
  try {
    const body = textFrom(place);
    const payload = parseJsonFromText(body) as { placed?: boolean };
    const placedFromResult = payload.placed === true;
    const placedFromText = body.includes('"placed": true') || body.includes('"placed":true');
    assert(placedFromResult || placedFromText, 'placed === true');
  } catch (error) {
    fail('photoshop_place_image (parse)', error instanceof Error ? error.message : String(error));
  }

  // Step 6b: Smart Object transform after place (DialogModes.NO must not block)
  console.log('\n--- Step 6b: Smart Object scale + move after place_image ---');
  try {
    const placePayload = parseJsonFromText(textFrom(place)) as { layerName?: string };
    if (placePayload.layerName) {
      const selectPlaced = await callTool(client, 'photoshop_select_layer_by_name', {
        name: placePayload.layerName,
      });
      assert(!selectPlaced.isError, 'photoshop_select_layer_by_name (placed layer)');
    }
    const scale = await callTool(
      client,
      'photoshop_scale_layer',
      { scalePercent: 95 },
      ALERT_TIMEOUT_MS
    );
    assert(!scale.isError, 'photoshop_scale_layer on placed Smart Object');
    const move = await callTool(
      client,
      'photoshop_move_layer',
      { deltaX: 5, deltaY: 5 },
      ALERT_TIMEOUT_MS
    );
    assert(!move.isError, 'photoshop_move_layer on placed Smart Object');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    fail('Smart Object transform after place', msg.includes('Timed out') ? 'dialog blocked — timed out' : msg);
  }

  // Step 6c: jsString edge case (backslash, quote, newline in layer name)
  console.log('\n--- Step 6c: jsString escape round-trip ---');
  const ESCAPE_LAYER_NAME = 'MCP\\"Test\\nName';
  const escapeCreate = await callTool(client, 'photoshop_create_layer', { name: ESCAPE_LAYER_NAME });
  assert(!escapeCreate.isError, 'photoshop_create_layer (escaped name)');
  const escapeSelect = await callTool(client, 'photoshop_select_layer_by_name', {
    name: ESCAPE_LAYER_NAME,
  });
  assert(!escapeSelect.isError, 'photoshop_select_layer_by_name (escaped name)');
  try {
    const payload = parseJsonFromText(textFrom(escapeSelect)) as { layerName?: string };
    assert(payload.layerName === ESCAPE_LAYER_NAME, 'escaped layer name round-trip', payload.layerName);
  } catch (error) {
    fail('jsString round-trip (parse)', error instanceof Error ? error.message : String(error));
  }

  // Step 7
  console.log('\n--- Step 7: execute_script alert (dialog suppression) ---');
  try {
    const alertResult = await callTool(
      client,
      'photoshop_execute_script',
      { code: `alert('mcp'); return { alerted: true };` },
      ALERT_TIMEOUT_MS
    );
    assert(!alertResult.isError, 'alert script (tool level)');
    const payload = parseJsonFromText(textFrom(alertResult)) as { alerted?: boolean };
    assert(payload.alerted === true, 'alerted === true');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    fail('alert script', msg.includes('Timed out') ? 'dialog blocked — timed out' : msg);
  }

  // Step 8
  console.log('\n--- Step 8: execute_script return value ---');
  const docCount = await callTool(client, 'photoshop_execute_script', {
    code: 'return { n: app.documents.length };',
  });
  assert(!docCount.isError, 'execute_script return (tool level)');
  try {
    const payload = parseJsonFromText(textFrom(docCount)) as { n?: unknown };
    assert(typeof payload.n === 'number', 'parsed n is number', String(typeof payload.n));
  } catch (error) {
    fail('execute_script return (parse)', error instanceof Error ? error.message : String(error));
  }

  // Step 9
  console.log('\n--- Step 9: font discovery + create_text_layer fontName ---');
  const listFonts = await callTool(client, 'photoshop_list_fonts', { query: 'Arial', limit: 20 });
  assert(!listFonts.isError, 'photoshop_list_fonts (query: Arial)');
  try {
    const fontPayload = parseJsonFromText(textFrom(listFonts)) as {
      fonts?: Array<{ name?: string; postScriptName?: string }>;
    };
    assert((fontPayload.fonts?.length ?? 0) > 0, 'list_fonts returns Arial matches');
  } catch (error) {
    fail('photoshop_list_fonts (parse)', error instanceof Error ? error.message : String(error));
  }
  const fontText = await callTool(client, 'photoshop_create_text_layer', {
    text: 'Font Test',
    x: 200,
    y: 200,
    fontSize: 18,
    fontName: 'Arial',
  });
  assert(!fontText.isError, 'photoshop_create_text_layer with fontName');
  try {
    const fontVerify = await callTool(client, 'photoshop_execute_script', {
      code: `for (var i=0;i<app.activeDocument.artLayers.length;i++){var L=app.activeDocument.artLayers[i]; if(L.kind==LayerKind.TEXT&&L.textItem.contents=="Font Test"){return{font:L.textItem.font,contents:L.textItem.contents};}} throw new Error("text layer not found");`,
    });
    const verifyPayload = parseJsonFromText(textFrom(fontVerify)) as { font?: string };
    assert(typeof verifyPayload.font === 'string' && verifyPayload.font.length > 0, 'font applied on text layer', verifyPayload.font);
  } catch (error) {
    fail('fontName verify (parse)', error instanceof Error ? error.message : String(error));
  }

  // Step 10
  console.log('\n--- Step 10: CJK layer name round-trip ---');
  const cjkCreate = await callTool(client, 'photoshop_create_layer', { name: CJK_LAYER_NAME });
  assert(!cjkCreate.isError, 'photoshop_create_layer (CJK name)');
  const cjkSelect = await callTool(client, 'photoshop_select_layer_by_name', {
    name: CJK_LAYER_NAME,
  });
  assert(!cjkSelect.isError, 'photoshop_select_layer_by_name (CJK)');
  try {
    const payload = parseJsonFromText(textFrom(cjkSelect)) as { layerName?: string; selected?: boolean };
    assert(payload.selected === true, 'CJK layer selected');
    assert(payload.layerName === CJK_LAYER_NAME, 'CJK name round-trip', payload.layerName);
  } catch (error) {
    fail('CJK round-trip (parse)', error instanceof Error ? error.message : String(error));
  }

  // Step 11
  console.log('\n--- Step 11: select_layer_by_name missing ---');
  const missing = await callTool(client, 'photoshop_select_layer_by_name', {
    name: '__MCP_MISSING_LAYER__',
  });
  assert(
    missing.isError === true || textFrom(missing).toLowerCase().includes('error'),
    'missing layer returns error',
    missing.isError ? 'isError' : textFrom(missing).slice(0, 80)
  );

  await callTool(client, 'photoshop_close_document', { save: false });
  await transport.close();

  console.log('\n========================================');
  if (failures === 0) {
    console.log('SUMMARY: all checks PASS');
    console.log('========================================\n');
    process.exit(0);
  }

  console.log(`SUMMARY: ${failures} check(s) FAIL`);
  console.log('========================================\n');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
