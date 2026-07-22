/**
 * Client for the MCP-hosted UXP bridge (health check + neural filter invoke).
 */
import { ensureUxpBridgeServer, invokeUxpBridge } from './uxp-bridge-server.js';

const HEALTH_TIMEOUT_MS = 800;

export async function isUxpBridgeReachable(): Promise<boolean> {
  try {
    const port = await ensureUxpBridgeServer();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

export type NeuralFilterKind =
  'skin_smoothing' | 'harmonize' | 'depth_blur' | 'super_zoom' | 'colorize';

export interface NeuralFilterParams {
  smoothness?: number;
  blur?: number;
  reference_layer_id?: number;
}

export async function invokeNeuralFilter(
  filter: NeuralFilterKind,
  params: NeuralFilterParams = {}
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const result = await invokeUxpBridge('neural_filter', { filter, ...params }, 90_000);
  if (!result.ok) {
    return { ok: false, error: result.error ?? 'neural_filter_failed' };
  }
  return { ok: true, data: result.data };
}
