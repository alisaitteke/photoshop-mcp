/**
 * Spawn the MCP server twice over stdio and assert the logical session is reused.
 * Run: npx tsx scripts/test-logical-session-mcp.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function ok(msg: string): void {
  console.log(`  OK  ${msg}`);
}

function fail(msg: string): never {
  console.error(`  FAIL ${msg}`);
  process.exit(1);
}

async function runOnce(home: string, label: string): Promise<void> {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', join(ROOT, 'src/index.ts')],
    env: {
      ...process.env,
      LOG_LEVEL: '2',
      ANALYTICS_DISABLED: '1',
      PHOTOSHOP_MCP_HOME: home,
    },
    stderr: 'pipe',
    cwd: ROOT,
  });

  const client = new Client({ name: 'logical-session-test', version: '1.0.0' });
  await client.connect(transport);
  const ping = await client.callTool({ name: 'photoshop_ping', arguments: {} });
  if (ping.isError) fail(`${label}: photoshop_ping error`);
  ok(`${label}: initialize + photoshop_ping`);
  await transport.close();
}

function readSession(home: string): { id: string; connectCount: number } {
  const raw = JSON.parse(readFileSync(join(home, 'mcp-logical-session.json'), 'utf8')) as {
    id: string;
    connectCount: number;
  };
  return raw;
}

async function main(): Promise<void> {
  const home = mkdtempSync(join(tmpdir(), 'ph-mcp-logical-mcp-'));
  try {
    console.log('\n=== logical session across two MCP stdio processes ===');
    await runOnce(home, 'process 1');
    const first = readSession(home);
    ok(`process 1 session ${first.id} connectCount=${first.connectCount}`);

    await runOnce(home, 'process 2');
    const second = readSession(home);
    if (second.id !== first.id) fail(`session id changed: ${first.id} → ${second.id}`);
    if (second.connectCount !== first.connectCount) {
      fail(`connectCount should stay ${first.connectCount}, got ${second.connectCount}`);
    }
    ok(`process 2 reused session ${second.id}`);
    console.log('\nLogical session MCP check passed.\n');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
