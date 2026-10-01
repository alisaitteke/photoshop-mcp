#!/usr/bin/env node

import {
  capture,
  endMcpAnalyticsSession,
  ensureAnalyticsIdentity,
  getAppVersion,
  identifyAnalyticsPerson,
  onMcpClientDisconnected,
  shutdownAnalytics,
  startLogicalMcpAnalyticsSession,
} from './analytics/index.js';
import type { McpShutdownReason } from './analytics/mcp-session.js';
import { PhotoshopMCPServer } from './core/server.js';
import { refreshUpdateCheck } from './update/check.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('Main');

let mcpServer: PhotoshopMCPServer | null = null;
let shuttingDown = false;

async function main() {
  try {
    logger.info('Starting Photoshop MCP Server...');

    ensureAnalyticsIdentity();

    // Background npm lookup (cached 24h, 3s timeout). photoshop_ping reads the cache only.
    void refreshUpdateCheck();

    mcpServer = new PhotoshopMCPServer({ serverVersion: getAppVersion() });
    await mcpServer.start();

    const photoshopVersion = await mcpServer.getPhotoshopVersion();
    identifyAnalyticsPerson({
      usage_surface: 'mcp',
      event_source: 'mcp',
      ...(photoshopVersion ? { photoshop_version: photoshopVersion } : {}),
    });

    startLogicalMcpAnalyticsSession({
      photoshop_detected: mcpServer.isPhotoshopConnected(),
      tools_registered_count: mcpServer.getToolCount(),
    });

    logger.info('Photoshop MCP Server is running');
  } catch (error) {
    logger.error('Failed to start server:', error);
    capture('mcp_session_startup_failed', {
      ok: false,
      error_code: 'startup_failed',
      event_source: 'mcp',
    });
    await shutdownAnalytics();
    process.exit(1);
  }
}

async function handleShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Received ${signal}, shutting down`);

  const reason: McpShutdownReason =
    signal === 'SIGTERM'
      ? 'sigterm'
      : signal === 'stdio_closed'
        ? 'stdio_closed'
        : signal === 'SIGINT'
          ? 'sigint'
          : 'error';

  if (mcpServer) {
    await mcpServer.stop();
    mcpServer = null;
  }

  onMcpClientDisconnected();
  endMcpAnalyticsSession(reason);
  await shutdownAnalytics();
  process.exit(0);
}

process.on('SIGINT', () => {
  void handleShutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void handleShutdown('SIGTERM');
});

process.stdin.on('end', () => {
  void handleShutdown('stdio_closed');
});

main();
