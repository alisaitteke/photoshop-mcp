#!/usr/bin/env node

import getPort from 'get-port';
import open from 'open';
import {
  capture,
  ensureAnalyticsIdentity,
  getAppVersion,
  identifyAnalyticsPerson,
  shutdownAnalytics,
} from '../analytics/index.js';
import { Logger } from '../utils/logger.js';
import { getSessionFilePath } from './security/session-token.js';
import { startUIServer } from './server.js';

interface CliFlags {
  port?: number;
  host: string;
  noOpen: boolean;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { host: '127.0.0.1', noOpen: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' || arg === '-p') {
      const val = Number(argv[++i]);
      if (Number.isFinite(val) && val > 0) flags.port = val;
    } else if (arg === '--host') {
      flags.host = argv[++i] ?? flags.host;
    } else if (arg === '--no-open') {
      flags.noOpen = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--version' || arg === '-v') {
      printVersion();
      process.exit(0);
    }
  }
  return flags;
}

function printHelp(): void {
  process.stdout.write(
    [
      'photoshop-mcp-ui — Browser UI for the Photoshop MCP server',
      '',
      'Usage: photoshop-mcp-ui [options]',
      '',
      'Options:',
      '  -p, --port <number>   Port to listen on (default: random free port)',
      '      --host <host>     Host to bind to (default: 127.0.0.1)',
      '      --no-open         Do not auto-open the browser',
      '  -h, --help            Show this help',
      '  -v, --version         Show version',
      '',
      'Configuration is stored at ~/.photoshop-mcp/config.json (chmod 600).',
      'The /api/* endpoints require the session token from',
      '~/.photoshop-mcp/ui-session.json (chmod 600), sent as an',
      'x-psmcp-token or Authorization: Bearer header.',
      '',
    ].join('\n')
  );
}

function printVersion(): void {
  process.stdout.write(`photoshop-mcp-ui ${getAppVersion()}\n`);
}

async function main(): Promise<void> {
  const logger = new Logger('UI');
  const flags = parseFlags(process.argv.slice(2));
  const startedAt = Date.now();

  ensureAnalyticsIdentity();
  identifyAnalyticsPerson({
    usage_surface: 'server',
    event_source: 'server',
  });

  const port = flags.port ?? (await getPort({ port: [5174, 5175, 5176, 5180] }));

  const server = await startUIServer({
    host: flags.host,
    port,
  });

  capture('ui_server_started', {
    port,
    host: flags.host,
    no_open: flags.noOpen,
    event_source: 'server',
  });

  const url = server.url;
  process.stdout.write(
    `\nPhotoshop MCP UI ready at:\n  ${url}\n\n` +
      `The /api/* endpoints require this session's token.\n` +
      `  ${getSessionFilePath()}\n\n`
  );

  if (!flags.noOpen) {
    try {
      await open(url);
    } catch (err) {
      logger.warn('Failed to auto-open browser', err);
    }
  }

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down`);
    capture('ui_server_ended', {
      duration_ms: Date.now() - startedAt,
      shutdown_reason: signal.toLowerCase(),
      event_source: 'server',
    });
    await server.close();
    await shutdownAnalytics();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  process.stderr.write(`Failed to start Photoshop MCP UI: ${(err as Error).message}\n`);
  process.exit(1);
});
