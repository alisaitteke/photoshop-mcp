/**
 * Smoke test for MCP client analytics (mcp_client_connected / disconnected).
 * Verifies lifecycle events against Rybbit (embedded site ID by default).
 * Run: npx tsx scripts/test-analytics-smoke.ts
 * Verify delivery separately in the Rybbit live events stream (https://hey.sideguard.io).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_NAME = 'analytics-smoke-test';
const CLIENT_VERSION = '9.9.9';

function ok(msg: string): void {
  console.log(`  OK  ${msg}`);
}

function fail(msg: string): never {
  console.error(`  FAIL ${msg}`);
  process.exit(1);
}

async function testUsageSurfaceMerge(): Promise<void> {
  console.log('\n=== usage_surfaces merge (unit) ===');
  const home = mkdtempSync(join(tmpdir(), 'ph-mcp-analytics-'));
  process.env.PHOTOSHOP_MCP_HOME = home;
  const { recordUsageSurface } = await import('../src/analytics/identity.js');
  try {
    const first = recordUsageSurface('mcp');
    if (first !== 'mcp') fail(`expected mcp, got ${first}`);
    const merged = recordUsageSurface('server');
    if (merged !== 'mcp,server') fail(`expected mcp,server got ${merged}`);
    ok(`recordUsageSurface → ${merged}`);
  } finally {
    delete process.env.PHOTOSHOP_MCP_HOME;
    rmSync(home, { recursive: true, force: true });
  }
}

async function testMcpClientLifecycle(): Promise<void> {
  console.log('\n=== MCP client lifecycle (integration) ===');

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', join(ROOT, 'src/index.ts')],
    env: {
      ...process.env,
      LOG_LEVEL: '0',
      ANALYTICS_DISABLED: '0',
      POSTHOG_DISABLED: '0',
    },
    stderr: 'pipe',
    cwd: ROOT,
  });

  const client = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION });

  await client.connect(transport);
  ok('client connected');

  await client.callTool({ name: 'photoshop_ping', arguments: {} });
  ok('photoshop_ping called');

  await new Promise((r) => setTimeout(r, 3500));

  await transport.close();
  ok('transport closed');

  await new Promise((r) => setTimeout(r, 6000));
}

async function main(): Promise<void> {
  await testUsageSurfaceMerge();
  await testMcpClientLifecycle();
  console.log('\nAnalytics smoke checks passed (verify Rybbit live events separately).\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
