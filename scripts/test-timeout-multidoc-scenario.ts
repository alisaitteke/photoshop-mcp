/**
 * Live Photoshop check for the JP feedback scenario:
 * long-script timeout recovery + three open documents + artboards.
 *
 * Run: npx tsx scripts/test-timeout-multidoc-scenario.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

type Json = Record<string, unknown>;

function textFrom(result: unknown): string {
  const content = ((result as { content?: unknown }).content ?? []) as Array<{
    type: string;
    text?: string;
  }>;
  return content
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n');
}

function parseJson(body: string): Json {
  const start = body.indexOf('{');
  if (start < 0) throw new Error(`No JSON in: ${body.slice(0, 180)}`);
  return JSON.parse(body.slice(start)) as Json;
}

function fail(label: string, detail: string): never {
  console.error(`FAIL  ${label} — ${detail}`);
  process.exit(1);
}

function ok(label: string, detail?: string): void {
  console.log(`OK    ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', join(ROOT, 'src/index.ts')],
    env: { ...process.env, LOG_LEVEL: '1', PSMCP_FEEDBACK: '0' },
    stderr: 'pipe',
    cwd: ROOT,
  });
  const client = new Client({ name: 'jp-scenario-test', version: '1.0.0' });
  await client.connect(transport);

  const createdIds: number[] = [];
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const started = Date.now();
    const result = await client.callTool({ name, arguments: args });
    return { result, body: textFrom(result), ms: Date.now() - started };
  };

  try {
    console.log('\n=== 0. Local server tools ===');
    const { tools } = await client.listTools();
    const names = new Set(tools.map((t) => t.name));
    for (const required of [
      'photoshop_list_artboards',
      'photoshop_create_artboard',
      'photoshop_execute_script',
    ]) {
      if (!names.has(required)) fail('tools/list', `missing ${required}`);
    }
    const executeTool = tools.find((t) => t.name === 'photoshop_execute_script');
    const execProps = (executeTool?.inputSchema as { properties?: Json })?.properties ?? {};
    if (!execProps.timeout_ms) fail('execute_script schema', 'timeout_ms missing on local server');
    ok('local server exposes artboards + timeout_ms', `${tools.length} tools`);

    console.log('\n=== 1. Ping + baseline ===');
    const ping = await call('photoshop_ping');
    if (ping.result.isError) fail('ping', ping.body);
    ok('ping', `${ping.ms}ms`);

    const before = await call('photoshop_list_documents');
    if (before.result.isError) fail('list_documents baseline', before.body);
    const beforeJson = parseJson(before.body);
    const beforeCount = Number(beforeJson.details && (beforeJson.details as Json).count) || 0;
    ok('open docs before', String(beforeCount));

    console.log('\n=== 2. Three documents + artboards ===');
    for (const size of [
      { width: 1400, height: 900 },
      { width: 800, height: 600 },
      { width: 1024, height: 768 },
    ]) {
      const created = await call('photoshop_create_document', size);
      if (created.result.isError) fail('create_document', created.body);
      const state = await call('photoshop_get_state');
      if (state.result.isError) fail('get_state after create', state.body);
      const stateJson = parseJson(state.body);
      const doc = stateJson.document as Json | undefined;
      const id = typeof doc?.id === 'number' ? doc.id : NaN;
      if (!Number.isFinite(id)) fail('capture document.id', state.body.slice(0, 200));
      createdIds.push(id);
      ok(`created doc ${id}`, `${size.width}x${size.height}`);
    }

    const artboardDocId = createdIds[0];
    const ab1 = await call('photoshop_create_artboard', {
      name: 'MCP_Phone',
      width: 390,
      height: 844,
      document_id: artboardDocId,
    });
    if (ab1.result.isError) fail('create_artboard Phone', ab1.body);
    ok('artboard Phone', `${ab1.ms}ms`);

    const ab2 = await call('photoshop_create_artboard', {
      name: 'MCP_Tablet',
      width: 768,
      height: 1024,
      document_id: artboardDocId,
    });
    if (ab2.result.isError) fail('create_artboard Tablet', ab2.body);
    ok('artboard Tablet', `${ab2.ms}ms`);

    const listedAbs = await call('photoshop_list_artboards', { document_id: artboardDocId });
    if (listedAbs.result.isError) fail('list_artboards', listedAbs.body);
    const absJson = parseJson(listedAbs.body);
    const absDetails = (absJson.details ?? absJson) as Json;
    const absCount = Number(absDetails.count) || 0;
    if (absCount < 2) fail('list_artboards count', JSON.stringify(absDetails));
    ok('list_artboards', `count=${absCount}`);

    console.log('\n=== 3. list_documents artboard_count + openDocumentCount ===');
    const listed = await call('photoshop_list_documents');
    if (listed.result.isError) fail('list_documents', listed.body);
    const listedJson = parseJson(listed.body);
    const details = (listedJson.details ?? listedJson) as Json;
    const docs = (details.documents as Json[]) ?? [];
    const ours = docs.filter((d) => createdIds.includes(Number(d.id)));
    if (ours.length !== 3) fail('list_documents ours', `expected 3, got ${ours.length}`);
    const artboardEntry = ours.find((d) => Number(d.id) === artboardDocId);
    const artboardCount = Number(artboardEntry?.artboard_count);
    if (artboardCount < 2) {
      fail('artboard_count', `doc ${artboardDocId} artboard_count=${artboardEntry?.artboard_count}`);
    }
    ok('list_documents artboard_count', `${artboardCount} on doc ${artboardDocId}`);
    if (!('saved' in (artboardEntry ?? {}))) fail('saved flag', JSON.stringify(artboardEntry));
    ok('list_documents saved', String(artboardEntry?.saved));

    const state3 = await call('photoshop_get_state');
    if (state3.result.isError) fail('get_state', state3.body);
    const state3Json = parseJson(state3.body);
    const openCount = Number(state3Json.openDocumentCount);
    if (openCount < 3) fail('openDocumentCount', JSON.stringify(state3Json).slice(0, 240));
    ok('openDocumentCount', String(openCount));

    console.log('\n=== 4. Short timeout (busy Photoshop) then ping recovery ===');
    const timedOut = await call('photoshop_execute_script', {
      document_id: artboardDocId,
      timeout_ms: 2500,
      code: '$.sleep(40000); return { slept: true };',
    });
    if (!timedOut.result.isError) fail('expected timeout', timedOut.body);
    const timeoutJson = parseJson(timedOut.body);
    if (timeoutJson.code !== 'extendscript_timeout') {
      fail('timeout code', JSON.stringify(timeoutJson));
    }
    if (timeoutJson.suggested_next_tool !== 'photoshop_execute_script') {
      fail('timeout suggested_next_tool', String(timeoutJson.suggested_next_tool));
    }
    const suggestedArgs = timeoutJson.suggested_args as Json | undefined;
    if (suggestedArgs?.timeout_ms !== 180000) {
      fail('timeout suggested_args', JSON.stringify(suggestedArgs));
    }
    ok('execute_script timed out', `${timedOut.ms}ms code=${timeoutJson.code}`);

    const busyState = await call('photoshop_get_state');
    if (busyState.result.isError) {
      const busyJson = parseJson(busyState.body);
      if (busyJson.code !== 'extendscript_timeout') {
        fail('busy get_state code', JSON.stringify(busyJson));
      }
      if (busyJson.suggested_next_tool !== 'photoshop_ping') {
        fail('busy get_state next tool', String(busyJson.suggested_next_tool));
      }
      ok('get_state while busy', `${busyState.ms}ms → ping (Photoshop still running JSX)`);
    } else {
      ok('get_state while busy', `${busyState.ms}ms succeeded (sleep already finished)`);
    }

    let pingOk = false;
    for (let i = 0; i < 6; i++) {
      const recover = await call('photoshop_ping');
      if (!recover.result.isError) {
        pingOk = true;
        ok(`ping recovery attempt ${i + 1}`, `${recover.ms}ms`);
        break;
      }
      console.log(`  … ping attempt ${i + 1} still busy (${recover.ms}ms)`);
    }
    if (!pingOk) fail('ping recovery', 'still failing after 6 attempts');

    console.log('\n=== 5. Long script succeeds with timeout_ms ===');
    const longOk = await call('photoshop_execute_script', {
      document_id: artboardDocId,
      timeout_ms: 15000,
      code: '$.sleep(3000); return { slept: 3000, ok: true };',
    });
    if (longOk.result.isError) fail('long script with timeout_ms', longOk.body);
    if (longOk.ms < 2500) fail('long script duration', `expected ~3s, got ${longOk.ms}ms`);
    ok('long script with timeout_ms=15000', `${longOk.ms}ms`);

    console.log('\n=== 6. Preview each tab by document_id, then close only our docs ===');
    for (const id of createdIds) {
      const preview = await call('photoshop_get_preview', {
        document_id: id,
        max_dimension_px: 256,
      });
      if (preview.result.isError) fail(`preview ${id}`, preview.body);
      ok(`preview document_id=${id}`, `${preview.ms}ms`);
    }

    for (const id of createdIds) {
      const closed = await call('photoshop_close_document', { save: false, document_id: id });
      if (closed.result.isError) fail(`close ${id}`, closed.body);
      ok(`closed document_id=${id}`, `${closed.ms}ms`);
    }

    const after = await call('photoshop_list_documents');
    if (after.result.isError) fail('list_documents after', after.body);
    const afterJson = parseJson(after.body);
    const afterDetails = (afterJson.details ?? afterJson) as Json;
    const afterDocs = (afterDetails.documents as Json[]) ?? [];
    const leftover = afterDocs.filter((d) => createdIds.includes(Number(d.id)));
    if (leftover.length !== 0) fail('cleanup', `still open: ${JSON.stringify(leftover)}`);
    ok('cleanup', `test docs gone, ${Number(afterDetails.count) || afterDocs.length} tabs remain`);

    console.log('\nPASS  JP timeout + multi-doc + artboard scenario');
  } finally {
    for (const id of createdIds) {
      try {
        await call('photoshop_close_document', { save: false, document_id: id });
      } catch {
        // already closed
      }
    }
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
