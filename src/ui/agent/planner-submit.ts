import { writeFile } from 'node:fs/promises';
import { MAX_PLAN_STEPS, parsePlan, type Plan } from './plan-schema.js';

export const SUBMIT_ACTION_PLAN_TOOL = 'submit_action_plan';
export const PLAN_OUT_PATH_ENV = 'PSMCP_PLAN_OUT_PATH';
export const PLANNER_MCP_SERVER_NAME = 'planner';
export const SUBMIT_ACTION_PLAN_ALLOWED_TOOLS = [
  `mcp__${PLANNER_MCP_SERVER_NAME}__${SUBMIT_ACTION_PLAN_TOOL}`,
  SUBMIT_ACTION_PLAN_TOOL,
] as const;

export const SUBMIT_ACTION_PLAN_INPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'steps'],
  properties: {
    summary: {
      type: 'string',
      description: 'One short sentence summarizing the overall plan.',
    },
    steps: {
      type: 'array',
      maxItems: MAX_PLAN_STEPS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'tool', 'argsJson', 'rationale', 'dependsOn'],
        properties: {
          id: { type: 'string', description: 'Unique short id for this step, e.g. "s1".' },
          tool: { type: 'string', description: 'Exact tool name from the catalog.' },
          argsJson: {
            type: 'string',
            description:
              'JSON-encoded object of arguments for the tool. Use "{}" if none. ' +
              'A value may reference a prior step result with "$steps.<stepId>.<dot.path>".',
          },
          rationale: {
            type: 'string',
            description: 'One short sentence on why this step. Use "" if none.',
          },
          dependsOn: {
            type: 'array',
            items: { type: 'string' },
            description: 'Step ids this step depends on. Use [] if none.',
          },
        },
      },
    },
  },
} as const;

export async function persistSubmittedPlan(
  args: unknown,
  outPath: string
): Promise<{ ok: true; plan: Plan } | { ok: false; error: string }> {
  try {
    const plan = parsePlan(args);
    await writeFile(outPath, JSON.stringify(plan), 'utf8');
    return { ok: true, plan };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function isSubmitActionPlanTool(name: string | undefined): boolean {
  if (!name) return false;
  return name === SUBMIT_ACTION_PLAN_TOOL || name.endsWith(`__${SUBMIT_ACTION_PLAN_TOOL}`);
}
