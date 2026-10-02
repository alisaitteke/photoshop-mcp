import { hasAnalyticsKey } from './config.js';
import { buildPersonIdentifyProperties, buildRuntimeProperties } from './events.js';
import { applyInstallCohortPersonOnce } from './install-cohorts.js';
import { isAnalyticsEnabled, recordUsageSurface } from './identity.js';
import { bindLogicalSessionClient, noteLogicalSessionActivity } from './logical-session.js';
import {
  clearActiveMcpClient,
  hasActiveMcpClient,
  setActiveMcpClient,
} from './mcp-client-state.js';
import {
  flushMcpPromptBatchOnClientDisconnect,
  flushMcpToolBatchOnClientDisconnect,
} from './mcp-session.js';
import { flushAnalyticsClient, getAnalytics } from './provider.js';

function captureMcpClientEvent(
  name: string,
  properties: Record<string, unknown>
): void {
  if (!isAnalyticsEnabled() || !hasAnalyticsKey()) return;
  getAnalytics().capture({
    name,
    properties: buildRuntimeProperties(properties),
  });
}

function identifyMcpClientPerson(properties: Record<string, unknown>): void {
  if (!isAnalyticsEnabled() || !hasAnalyticsKey()) return;
  const props = { ...properties };
  if (typeof props.usage_surface === 'string') {
    props.usage_surfaces = recordUsageSurface(props.usage_surface);
    delete props.usage_surface;
  }
  getAnalytics().identify(buildPersonIdentifyProperties(props));
}

/**
 * Fires when an MCP client completes the initialize handshake.
 * See docs/anonymous-usage-analytics.md — distinguishes real client usage from process-only starts.
 */
export function onMcpClientConnected(
  client: { name: string; version: string } | undefined
): void {
  setActiveMcpClient(client);
  const { emitConnected, connectCount } = bindLogicalSessionClient({
    name: client?.name,
    version: client?.version,
  });

  if (emitConnected) {
    captureMcpClientEvent('mcp_client_connected', {
      mcp_client_name: client?.name ?? 'unknown',
      mcp_client_version: client?.version ?? 'unknown',
      mcp_client_connect_count: connectCount,
      event_source: 'mcp',
    });
  }

  applyInstallCohortPersonOnce({
    usageSurface: 'mcp',
    mcpClientName: client?.name,
  });

  identifyMcpClientPerson({
    usage_surface: 'mcp',
    mcp_client_name: client?.name ?? 'unknown',
    mcp_client_version: client?.version ?? 'unknown',
    last_active_at: Date.now(),
  });
}

/** Fires when the MCP transport closes; flushes any pending tool batch first. */
export function onMcpClientDisconnected(): void {
  if (!hasActiveMcpClient()) return;

  flushMcpToolBatchOnClientDisconnect();
  flushMcpPromptBatchOnClientDisconnect();
  noteLogicalSessionActivity();
  clearActiveMcpClient();
  void flushAnalyticsClient().catch(() => {});
}
