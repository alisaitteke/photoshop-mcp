/**
 * Cursor-config smoke: spawn the same dist entry as .cursor/mcp.json.
 * Run: npx tsx scripts/test-cursor-mcp-smoke.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const home = mkdtempSync(join(tmpdir(), 'ph-mcp-cursor-smoke-'));

function textFrom(result: {
  content?: Array<{ type: string; text?: string }>;
}): string {
  return (result.content ?? [])
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!)
    .join('\n');
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(ROOT, 'dist/index.js')],
    env: {
      ...process.env,
      PATH: process.env.PATH ?? '',
      LOG_LEVEL: '1',
      PHOTOSHOP_MCP_HOME: home,
    },
    stderr: 'pipe',
    cwd: ROOT,
  });

  const client = new Client({ name: 'cursor-mcp-smoke', version: '1.0.0' });
  await client.connect(transport);

  const version = client.getServerVersion();
  console.log(`server: ${version?.name} v${version?.version}`);

  const instructions = client.getInstructions() ?? '';
  if (!instructions.includes('FEEDBACK_NUDGE')) {
    throw new Error('instructions missing FEEDBACK_NUDGE');
  }
  if (!instructions.includes('photoshop_submit_feedback')) {
    throw new Error('instructions missing photoshop_submit_feedback');
  }
  console.log(`instructions: ${instructions.length} chars, feedback contract present`);

  const { tools } = await client.listTools();
  const names = new Set(tools.map((t) => t.name));
  for (const required of ['photoshop_ping', 'photoshop_submit_feedback', 'photoshop_get_state']) {
    if (!names.has(required)) throw new Error(`missing tool ${required}`);
  }
  console.log(`tools: ${tools.length} registered (ping + submit_feedback present)`);

  const ping = await client.callTool({ name: 'photoshop_ping', arguments: {} });
  const pingText = textFrom(ping);
  console.log(`ping:\n${pingText}`);
  if (!pingText.includes('Photoshop')) {
    throw new Error('ping did not mention Photoshop');
  }
  if (pingText.includes('FEEDBACK_NUDGE')) {
    throw new Error('first ping must not include FEEDBACK_NUDGE (15-minute delay)');
  }

  const submit = await client.callTool({
    name: 'photoshop_submit_feedback',
    arguments: { choice: 'not_now', suggestion: 'cursor mcp smoke' },
  });
  if (submit.isError) {
    throw new Error(`submit_feedback failed: ${textFrom(submit)}`);
  }
  const payload = JSON.parse(textFrom(submit)) as { ok?: boolean; choice?: string };
  if (payload.ok !== true || payload.choice !== 'not_now') {
    throw new Error(`unexpected submit payload: ${textFrom(submit)}`);
  }
  console.log(`submit_feedback: ${textFrom(submit)}`);

  await client.close();
  rmSync(home, { recursive: true, force: true });
  console.log('OK cursor MCP smoke');
}

main().catch((err) => {
  rmSync(home, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
