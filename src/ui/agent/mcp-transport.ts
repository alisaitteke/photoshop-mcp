import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHOTOSHOP_EXPORT_CHAT_ID_ENV, PHOTOSHOP_MCP_SURFACE_ENV } from '../../lib/export-paths.js';
import { PLAN_OUT_PATH_ENV } from './planner-submit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const IS_DEV_SOURCE = __filename.endsWith('.ts');
const PHOTOSHOP_MCP_ENTRY = IS_DEV_SOURCE
  ? resolve(__dirname, '..', '..', 'index.ts')
  : resolve(__dirname, '..', '..', 'index.js');
const PLANNER_SUBMIT_ENTRY = IS_DEV_SOURCE
  ? resolve(__dirname, 'planner-submit-server.ts')
  : resolve(__dirname, 'planner-submit-server.js');

export function buildSpawnArgs(): string[] {
  return IS_DEV_SOURCE ? ['--import', 'tsx', PHOTOSHOP_MCP_ENTRY] : [PHOTOSHOP_MCP_ENTRY];
}

export function buildPlannerSpawnArgs(): string[] {
  return IS_DEV_SOURCE ? ['--import', 'tsx', PLANNER_SUBMIT_ENTRY] : [PLANNER_SUBMIT_ENTRY];
}

export function sanitizedEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/** Env for the MCP child spawned by the standalone UI (skips the host-tool feedback nudge). */
export function buildUiMcpChildEnv(chatId?: string): Record<string, string> {
  return {
    ...sanitizedEnv(),
    LOG_LEVEL: process.env.LOG_LEVEL ?? '2',
    [PHOTOSHOP_MCP_SURFACE_ENV]: 'ui',
    ...(chatId ? { [PHOTOSHOP_EXPORT_CHAT_ID_ENV]: chatId } : {}),
  };
}

export function buildMcpServerConfig(chatId?: string): {
  command: string;
  args: string[];
  env: Record<string, string>;
} {
  return {
    command: process.execPath,
    args: buildSpawnArgs(),
    env: buildUiMcpChildEnv(chatId),
  };
}

export function buildPlannerMcpServerConfig(planOutPath: string): {
  command: string;
  args: string[];
  env: Record<string, string>;
} {
  return {
    command: process.execPath,
    args: buildPlannerSpawnArgs(),
    env: {
      ...buildUiMcpChildEnv(),
      [PLAN_OUT_PATH_ENV]: planOutPath,
    },
  };
}
