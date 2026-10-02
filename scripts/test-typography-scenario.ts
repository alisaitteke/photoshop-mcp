/**
 * Live Photoshop check for CN typography feedback:
 * tracking, leading, paragraph box, alignment, mixed font/color ranges.
 *
 * Run: npx tsx scripts/test-typography-scenario.ts
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
  throw new Error(`FAIL  ${label} — ${detail}`);
}

function ok(label: string, detail?: string): void {
  console.log(`OK    ${label}${detail ? ` — ${detail}` : ''}`);
}

function detailsOf(body: string): Json {
  const json = parseJson(body);
  return ((json.details as Json) ?? json) as Json;
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', join(ROOT, 'src/index.ts')],
    env: { ...process.env, LOG_LEVEL: '1', PSMCP_FEEDBACK: '0' },
    stderr: 'pipe',
    cwd: ROOT,
  });
  const client = new Client({ name: 'typography-scenario-test', version: '1.0.0' });
  await client.connect(transport);

  let documentId: number | undefined;
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const started = Date.now();
    const result = await client.callTool({ name, arguments: args });
    return { result, body: textFrom(result), ms: Date.now() - started };
  };

  try {
    console.log('\n=== 0. Local server tools ===');
    const { tools } = await client.listTools();
    const names = new Set(tools.map((t) => t.name));
    for (const required of ['photoshop_set_text_style', 'photoshop_set_text_ranges', 'photoshop_create_text_layer']) {
      if (!names.has(required)) fail('tools/list', `missing ${required}`);
    }
    ok('local server exposes typography tools', `${tools.length} tools`);

    console.log('\n=== 1. Ping + document ===');
    const ping = await call('photoshop_ping');
    if (ping.result.isError) fail('ping', ping.body);
    ok('ping', `${ping.ms}ms`);

    const created = await call('photoshop_create_document', { width: 1200, height: 800 });
    if (created.result.isError) fail('create_document', created.body);
    const state = await call('photoshop_get_state');
    if (state.result.isError) fail('get_state', state.body);
    const stateJson = parseJson(state.body);
    const doc = stateJson.document as Json | undefined;
    documentId = typeof doc?.id === 'number' ? doc.id : undefined;
    if (documentId === undefined) fail('document.id', state.body.slice(0, 200));
    ok('created document', String(documentId));

    console.log('\n=== 2. create_text_layer tracking/leading/box ===');
    const title = await call('photoshop_create_text_layer', {
      document_id: documentId,
      text: 'TRACKING LEADING',
      x: 80,
      y: 80,
      fontSize: 36,
      fontName: 'Arial',
      tracking: 160,
      leading: 52,
      kind: 'paragraph',
      box_width: 520,
      box_height: 160,
      alignment: 'CENTER',
      red: 20,
      green: 20,
      blue: 20,
    });
    if (title.result.isError) fail('create_text_layer styled', title.body);
    const titleDetails = detailsOf(title.body);
    const titleStyle = (titleDetails.style as Json) ?? titleDetails;
    if (Number(titleStyle.tracking) !== 160) {
      fail('create tracking', JSON.stringify(titleStyle));
    }
    if (titleStyle.kind !== 'paragraph') fail('create kind', JSON.stringify(titleStyle));
    if (Number(titleStyle.leading) < 48 || Number(titleStyle.leading) > 56) {
      fail('create leading', JSON.stringify(titleStyle));
    }
    if (Number(titleStyle.box_width) < 500) fail('create box_width', JSON.stringify(titleStyle));
    if (titleStyle.alignment !== 'CENTER') fail('create alignment', JSON.stringify(titleStyle));
    ok('create_text_layer style', `tracking=${titleStyle.tracking} kind=${titleStyle.kind} box=${titleStyle.box_width}`);

    console.log('\n=== 3. set_text_style on the same layer ===');
    const styled = await call('photoshop_set_text_style', {
      document_id: documentId,
      tracking: 40,
      leading: 44,
      alignment: 'LEFT',
    });
    if (styled.result.isError) fail('set_text_style', styled.body);
    const styledDetails = detailsOf(styled.body);
    const nextStyle = (styledDetails.style as Json) ?? styledDetails;
    if (Number(nextStyle.tracking) !== 40) fail('set tracking', JSON.stringify(nextStyle));
    if (nextStyle.alignment !== 'LEFT') fail('set alignment', JSON.stringify(nextStyle));
    if (Number(nextStyle.leading) < 40 || Number(nextStyle.leading) > 48) {
      fail('set leading', JSON.stringify(nextStyle));
    }
    ok('set_text_style', `tracking=${nextStyle.tracking} leading=${nextStyle.leading} align=${nextStyle.alignment}`);

    console.log('\n=== 4. Mixed color/font ranges ===');
    const mixed = await call('photoshop_create_text_layer', {
      document_id: documentId,
      text: 'Hello World',
      x: 80,
      y: 320,
      fontSize: 48,
      fontName: 'Arial',
    });
    if (mixed.result.isError) fail('create mixed layer', mixed.body);

    const ranges = await call('photoshop_set_text_ranges', {
      document_id: documentId,
      ranges: [
        { from: 0, to: 5, red: 220, green: 40, blue: 40, fontName: 'Arial' },
        { from: 6, to: 11, red: 30, green: 90, blue: 210, fontName: 'Times New Roman' },
      ],
    });
    if (ranges.result.isError) {
      const timesFallback = await call('photoshop_set_text_ranges', {
        document_id: documentId,
        ranges: [
          { from: 0, to: 5, red: 220, green: 40, blue: 40 },
          { from: 6, to: 11, red: 30, green: 90, blue: 210 },
        ],
      });
      if (timesFallback.result.isError) fail('set_text_ranges', `${ranges.body}\nfallback: ${timesFallback.body}`);
      ok('set_text_ranges', 'color spans (Times missing, Arial-only fallback)');
      const fallbackDetails = detailsOf(timesFallback.body);
      const fallbackRanges = (fallbackDetails.ranges as Json[]) ?? [];
      if (fallbackRanges.length < 2) fail('range count fallback', JSON.stringify(fallbackDetails));
    } else {
      const rangeDetails = detailsOf(ranges.body);
      const applied = (rangeDetails.ranges as Json[]) ?? [];
      if (applied.length < 2) fail('range count', JSON.stringify(rangeDetails));
      const hello = applied.find((r) => Number(r.from) === 0);
      const world = applied.find((r) => Number(r.from) === 6 || Number(r.to) === 11);
      if (Number(hello?.red) < 150) fail('hello color', JSON.stringify(hello));
      if (world && Number(world.blue) < 100) fail('world color', JSON.stringify(world));
      ok('set_text_ranges', `${applied.length} span(s)`);
    }

    console.log('\n=== 5. Preview + close ===');
    const preview = await call('photoshop_get_preview', { document_id: documentId, max_dimension_px: 256 });
    if (preview.result.isError) fail('preview', preview.body);
    ok('preview', `${preview.ms}ms`);

    const closed = await call('photoshop_close_document', { save: false, document_id: documentId });
    if (closed.result.isError) fail('close', closed.body);
    documentId = undefined;
    ok('closed test document');

    console.log('\nPASS  typography tracking/leading/box + mixed ranges');
  } finally {
    if (documentId !== undefined) {
      try {
        await call('photoshop_close_document', { save: false, document_id: documentId });
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
