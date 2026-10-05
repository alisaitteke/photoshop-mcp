/**
 * Live check: create/open ignore document_id, and a stale id does not block
 * when nothing is open. Run: npx tsx scripts/test-empty-document-id.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PNG = '/tmp/psmcp-open-test.png';

function textOf(result: { content?: Array<{ type: string; text?: string }>; isError?: boolean }): string {
  return (result.content ?? [])
    .filter((part) => part.type === 'text' && part.text)
    .map((part) => part.text!)
    .join('\n');
}

function parseJson(text: string): Record<string, unknown> | undefined {
  const start = text.indexOf('{');
  if (start < 0) return undefined;
  try {
    return JSON.parse(text.slice(start)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', join(ROOT, 'src/index.ts')],
    env: { ...process.env, LOG_LEVEL: '2' },
    stderr: 'pipe',
    cwd: ROOT,
  });
  const client = new Client({ name: 'empty-document-id-test', version: '1.0.0' });
  await client.connect(transport);

  const created: number[] = [];
  const failures: string[] = [];

  function check(label: string, ok: boolean, detail: string): void {
    console.log(`${ok ? 'OK ' : 'FAIL'} ${label}: ${detail}`);
    if (!ok) failures.push(label);
  }

  async function call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const text = textOf(result);
    return { isError: Boolean(result.isError), text, json: parseJson(text) };
  }

  const listed = await call('photoshop_list_documents', {});
  const before = listed.json?.details as { count?: number } | undefined;
  const startingCount = before?.count ?? -1;
  console.log(`open at start: ${startingCount}`);
  if (startingCount !== 0) {
    check('start empty', false, `expected 0 open documents, found ${startingCount}`);
  }

  const tools = await client.listTools();
  const createTool = tools.tools.find((tool) => tool.name === 'photoshop_create_document');
  const required = (createTool?.inputSchema as { required?: string[] } | undefined)?.required ?? [];
  check('create schema omits document_id', !required.includes('document_id'), JSON.stringify(required));

  async function closeIds(ids: number[]): Promise<void> {
    for (const id of ids) {
      const closed = await call('photoshop_close_document', { document_id: id, save: false });
      check(`close ${id}`, !closed.isError, closed.text.slice(0, 180));
    }
  }

  for (const documentId of [0, 999999, null] as const) {
    const createdDoc = await call('photoshop_create_document', {
      width: 16,
      height: 16,
      document_id: documentId,
    });
    const id = (createdDoc.json?.document as { id?: number } | undefined)?.id;
    check(
      `create document_id=${String(documentId)} with nothing open`,
      !createdDoc.isError && typeof id === 'number',
      createdDoc.text.slice(0, 220)
    );
    if (typeof id === 'number') created.push(id);
    if (typeof id === 'number') await closeIds([id]);
  }

  const omitted = await call('photoshop_create_document', { width: 16, height: 16 });
  const omittedId = (omitted.json?.document as { id?: number } | undefined)?.id;
  check(
    'create without document_id',
    !omitted.isError && typeof omittedId === 'number',
    omitted.text.slice(0, 220)
  );
  if (typeof omittedId === 'number') await closeIds([omittedId]);

  for (const documentId of [0, 999999, null] as const) {
    const opened = await call('photoshop_open_image', {
      filePath: PNG,
      document_id: documentId,
    });
    const openedJson = parseJson(opened.text);
    const id = typeof openedJson?.id === 'number' ? openedJson.id : undefined;
    check(
      `open document_id=${String(documentId)} with nothing open`,
      !opened.isError && typeof id === 'number',
      opened.text.slice(0, 220)
    );
    if (typeof id === 'number') await closeIds([id]);
  }

  const openedOmitted = await call('photoshop_open_image', { filePath: PNG });
  const openedOmittedId = parseJson(openedOmitted.text)?.id;
  check(
    'open without document_id',
    !openedOmitted.isError && typeof openedOmittedId === 'number',
    openedOmitted.text.slice(0, 220)
  );
  if (typeof openedOmittedId === 'number') await closeIds([openedOmittedId]);

  for (const documentId of [0, 999999, null] as const) {
    const ran = await call('photoshop_execute_script', {
      code: 'return { count: app.documents.length };',
      document_id: documentId,
    });
    check(
      `execute document_id=${String(documentId)} with nothing open`,
      !ran.isError && ran.text.includes('"count"'),
      ran.text.slice(0, 220)
    );
  }

  const kept = await call('photoshop_create_document', { width: 24, height: 24, document_id: 0 });
  const keptId = (kept.json?.document as { id?: number } | undefined)?.id;
  check('create a document to pin against', typeof keptId === 'number', kept.text.slice(0, 180));
  if (typeof keptId !== 'number') {
    console.log(`FAILS ${failures.length}`);
    await client.close();
    process.exit(1);
  }

  const staleWhileOpen = await call('photoshop_execute_script', {
    code: 'return { count: app.documents.length };',
    document_id: 999999,
  });
  check(
    'execute stale id while a document is open',
    staleWhileOpen.isError && staleWhileOpen.text.includes('document_not_found'),
    staleWhileOpen.text.slice(0, 220)
  );

  const zeroWhileOpen = await call('photoshop_execute_script', {
    code: 'return { id: app.activeDocument.id };',
    document_id: 0,
  });
  check(
    'execute 0 uses the active document',
    !zeroWhileOpen.isError && zeroWhileOpen.text.includes(String(keptId)),
    zeroWhileOpen.text.slice(0, 220)
  );

  const infoStale = await call('photoshop_get_document_info', { document_id: 999999 });
  check(
    'get_document_info stale id',
    infoStale.isError && infoStale.text.includes('document_not_found'),
    infoStale.text.slice(0, 220)
  );

  const createdAnyway = await call('photoshop_create_document', {
    width: 20,
    height: 20,
    document_id: 999999,
  });
  const extraId = (createdAnyway.json?.document as { id?: number } | undefined)?.id;
  check(
    'create ignores a stale id while another document is open',
    !createdAnyway.isError && typeof extraId === 'number' && extraId !== keptId,
    createdAnyway.text.slice(0, 220)
  );

  await closeIds([keptId, ...(typeof extraId === 'number' ? [extraId] : [])]);

  const closedFirst = await call('photoshop_create_document', { width: 18, height: 18, document_id: null });
  const closedId = (closedFirst.json?.document as { id?: number } | undefined)?.id;
  check('create the document that will be closed', typeof closedId === 'number', closedFirst.text.slice(0, 160));
  if (typeof closedId !== 'number') {
    console.log(`FAILS ${failures.join(', ')}`);
    await client.close();
    process.exit(1);
  }
  await closeIds([closedId]);

  const reopen = await call('photoshop_open_image', { filePath: PNG, document_id: closedId });
  const reopenedId = parseJson(reopen.text)?.id;
  check(
    'open with the id of a document that was just closed',
    !reopen.isError && typeof reopenedId === 'number',
    reopen.text.slice(0, 220)
  );
  if (typeof reopenedId === 'number') await closeIds([reopenedId]);

  const recreate = await call('photoshop_create_document', {
    width: 18,
    height: 18,
    document_id: closedId,
  });
  const recreatedId = (recreate.json?.document as { id?: number } | undefined)?.id;
  check(
    'create with the id of a closed document',
    !recreate.isError && typeof recreatedId === 'number' && recreatedId !== closedId,
    recreate.text.slice(0, 220)
  );
  if (typeof recreatedId === 'number') await closeIds([recreatedId]);

  const scriptAfterClose = await call('photoshop_execute_script', {
    code: 'return { count: app.documents.length };',
    document_id: closedId,
  });
  check(
    'execute with a closed id when nothing is open',
    !scriptAfterClose.isError && scriptAfterClose.text.includes('"count":0'),
    scriptAfterClose.text.slice(0, 220)
  );

  const stateAfterClose = await call('photoshop_get_state', { document_id: closedId });
  check(
    'get_state with a closed id when nothing is open',
    !stateAfterClose.isError && !stateAfterClose.text.includes('document_not_found'),
    stateAfterClose.text.slice(0, 220)
  );

  const missing = await call('photoshop_open_image', {
    filePath: 'C:\\missing\\not-a-file.png',
    document_id: closedId,
  });
  check(
    'missing file is file_not_found, not document_not_found',
    missing.isError && missing.text.includes('file_not_found') && !missing.text.includes('document_not_found'),
    missing.text.slice(0, 220)
  );

  const docA = await call('photoshop_create_document', { width: 12, height: 12 });
  const docB = await call('photoshop_create_document', { width: 14, height: 14 });
  const idA = (docA.json?.document as { id?: number } | undefined)?.id;
  const idB = (docB.json?.document as { id?: number } | undefined)?.id;
  check('two documents open', typeof idA === 'number' && typeof idB === 'number', `${idA} ${idB}`);
  if (typeof idA === 'number' && typeof idB === 'number') {
    await closeIds([idA]);
    const scriptStale = await call('photoshop_execute_script', {
      code: 'return { id: app.activeDocument.id };',
      document_id: idA,
    });
    check(
      'execute a closed id while another document stays open',
      scriptStale.isError && scriptStale.text.includes('document_not_found'),
      scriptStale.text.slice(0, 220)
    );
    const openStale = await call('photoshop_open_image', { filePath: PNG, document_id: idA });
    const openedBeside = parseJson(openStale.text)?.id;
    check(
      'open ignores a closed id while another document stays open',
      !openStale.isError && typeof openedBeside === 'number',
      openStale.text.slice(0, 220)
    );
    const infoStaleBeside = await call('photoshop_get_document_info', { document_id: idA });
    check(
      'get_document_info still rejects a closed id when another document is open',
      infoStaleBeside.isError && infoStaleBeside.text.includes('document_not_found'),
      infoStaleBeside.text.slice(0, 220)
    );
    await closeIds([idB, ...(typeof openedBeside === 'number' ? [openedBeside] : [])]);
  }

  const stringId = await call('photoshop_create_document', {
    width: 10,
    height: 10,
    document_id: '12',
  });
  const stringCreated = (stringId.json?.document as { id?: number } | undefined)?.id;
  check(
    'string document_id does not block create',
    !stringId.isError && typeof stringCreated === 'number',
    stringId.text.slice(0, 220)
  );
  if (typeof stringCreated === 'number') await closeIds([stringCreated]);

  const after = await call('photoshop_list_documents', {});
  const afterCount = (after.json?.details as { count?: number } | undefined)?.count;
  check('no test documents left', afterCount === 0, after.text.slice(0, 180));

  await client.close();
  if (failures.length > 0) {
    console.log(`FAILS ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('ALL PASSED');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
