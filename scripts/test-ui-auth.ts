/**
 * Verifies the /api/* guard on the standalone UI server: Host validation,
 * Origin validation, and the per-session token.
 * Run: npx tsx scripts/test-ui-auth.ts
 */
import getPort from 'get-port';
import { mkdtempSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.ANALYTICS_DISABLED = '1';
process.env.POSTHOG_DISABLED = '1';
const HOME = mkdtempSync(join(tmpdir(), 'ph-mcp-ui-auth-'));
process.env.PHOTOSHOP_MCP_HOME = HOME;

const { startUIServer } = await import('../src/ui/server.js');

const HOST = '127.0.0.1';
let failures = 0;

interface Reply {
  status: number;
  body: string;
}

/**
 * Raw http.request rather than fetch: the assertions need control over the
 * Host header, which fetch derives from the URL.
 */
function send(
  port: number,
  opts: {
    method?: string;
    path: string;
    headers?: Record<string, string>;
    body?: string;
  }
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: HOST,
        port,
        method: opts.method ?? 'GET',
        path: opts.path,
        headers: opts.headers ?? {},
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function expectStatus(label: string, reply: Reply, expected: number): void {
  if (reply.status === expected) {
    console.log(`  OK   ${label} -> ${reply.status}`);
    return;
  }
  failures++;
  console.error(`  FAIL ${label} -> expected ${expected}, got ${reply.status} ${reply.body}`);
}

function expect(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  OK   ${label}`);
    return;
  }
  failures++;
  console.error(`  FAIL ${label} ${detail}`);
}

async function main(): Promise<void> {
  const port = await getPort();
  const server = await startUIServer({ host: HOST, port });
  const token = server.token;
  const host = `${HOST}:${port}`;

  console.log('\n=== /api/* auth guard ===');
  try {
    expectStatus('no headers at all', await send(port, { path: '/api/status', headers: { host } }), 401);

    expectStatus(
      'forged sec-fetch-site without token',
      await send(port, {
        path: '/api/status',
        headers: { host, 'sec-fetch-site': 'same-origin' },
      }),
      401
    );

    expectStatus(
      'wrong token',
      await send(port, {
        path: '/api/status',
        headers: { host, 'x-psmcp-token': 'x'.repeat(token.length) },
      }),
      401
    );

    expectStatus(
      'cross-port origin with valid token',
      await send(port, {
        path: '/api/status',
        headers: {
          host,
          origin: `http://${HOST}:${port + 1}`,
          'x-psmcp-token': token,
        },
      }),
      403
    );

    expectStatus(
      'rebinding-style host with valid token',
      await send(port, {
        path: '/api/status',
        headers: { host: `evil.example.com:${port}`, 'x-psmcp-token': token },
      }),
      403
    );

    expectStatus(
      'valid token',
      await send(port, { path: '/api/status', headers: { host, 'x-psmcp-token': token } }),
      200
    );

    expectStatus(
      'valid token via Authorization: Bearer',
      await send(port, {
        path: '/api/status',
        headers: { host, authorization: `Bearer ${token}` },
      }),
      200
    );

    expectStatus(
      'same-origin browser request',
      await send(port, {
        path: '/api/status',
        headers: {
          host,
          origin: `http://${host}`,
          'sec-fetch-site': 'same-origin',
          'x-psmcp-token': token,
        },
      }),
      200
    );

    expectStatus(
      'credential write with valid token',
      await send(port, {
        method: 'POST',
        path: '/api/providers/openai/key',
        headers: {
          host,
          origin: `http://${host}`,
          'content-type': 'application/json',
          'x-psmcp-token': token,
        },
        body: JSON.stringify({ apiKey: 'sk-test-key-0123456789abcdef' }),
      }),
      200
    );

    const shell = await send(port, { path: '/', headers: { host } });
    if (shell.status === 200) {
      expect(
        'index.html carries the session token',
        shell.body.includes(`window.__PSMCP_TOKEN__=${JSON.stringify(token)}`),
        '(token script tag not found)'
      );
    } else {
      console.log('  SKIP index.html injection (web bundle not built)');
    }
  } finally {
    await server.close();
    rmSync(HOME, { recursive: true, force: true });
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll checks passed.');
}

await main();
