import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import {
  buildPingFailureResult,
  buildPingToolResult,
  PING_NOT_FOUND_REASON,
  PING_NOT_RUNNING_REASON,
} from '../feedback/nudge.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { DEFAULT_SCRIPT_TIMEOUT_MS } from '../platform/script-timeout.js';

/**
 * Tiny read. Success means Photoshop accepted and finished a script on the
 * same queue as every other tool. `app.documents.length` does not walk layers,
 * so a busy engine fails here instead of inside get_state / get_layers.
 */
export const PING_PROBE_SCRIPT = 'return app.documents.length;';

const NOT_RUNNING = /photoshop is not running/i;
const NOT_FOUND = /photoshop not found|photoshop not detected|photoshop info not available/i;

export async function probePhotoshopEngine(
  connection: PhotoshopConnection
): Promise<CallToolResult> {
  const installed = await connection.ping();
  if (!installed) return buildPingFailureResult(PING_NOT_FOUND_REASON);

  try {
    const api = await new PhotoshopAPIFactory(connection).createAPI();
    await api.executeScript(PING_PROBE_SCRIPT, DEFAULT_SCRIPT_TIMEOUT_MS, { launch: false });
    return buildPingToolResult(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (NOT_RUNNING.test(message)) return buildPingFailureResult(PING_NOT_RUNNING_REASON);
    if (NOT_FOUND.test(message)) return buildPingFailureResult(PING_NOT_FOUND_REASON);
    throw error;
  }
}
