import type { ModelMessage } from 'ai';
import { z } from 'zod';
import type { PlanStepStatus, PlanView } from './shared.js';

export const MAX_PLAN_STEPS = 20;

const rationaleField = z
  .string()
  .describe('One short sentence on why this step. Use "" if none.');
const dependsOnField = z
  .array(z.string())
  .describe('Step ids this step depends on. Use [] if none.');

export const planStepSchema = z.object({
  id: z.string().describe('Unique short id for this step, e.g. "s1".'),
  tool: z.string().describe('Exact tool name from the catalog.'),
  argsJson: z
    .string()
    .describe(
      'JSON-encoded object of arguments for the tool. Use "{}" if none. ' +
        'A value may reference a prior step result with the placeholder ' +
        '"$steps.<stepId>.<dot.path>" (e.g. "$steps.s1.document.id").'
    ),
  rationale: rationaleField,
  dependsOn: dependsOnField,
});

export const planSchema = z.object({
  summary: z.string().describe('One short sentence summarizing the overall plan.'),
  steps: z.array(planStepSchema).max(MAX_PLAN_STEPS),
});

/** Accepts omitted or null step fields from tool-call plans. Not sent to the model. */
const planParseSchema = z.object({
  summary: z.string(),
  steps: z
    .array(
      planStepSchema.extend({
        rationale: rationaleField
          .nullable()
          .optional()
          .transform((value) => value ?? ''),
        dependsOn: dependsOnField
          .nullable()
          .optional()
          .transform((value) => value ?? []),
      })
    )
    .max(MAX_PLAN_STEPS),
});

export type PlanStep = z.infer<typeof planStepSchema>;
export type Plan = z.infer<typeof planSchema>;

export interface CatalogTool {
  description?: string;
  inputSchema?: unknown;
}

export function parsePlan(input: unknown): Plan {
  return planParseSchema.parse(input);
}

export function toStepView(step: PlanStep, status: PlanStepStatus) {
  return {
    id: step.id,
    tool: step.tool,
    rationale: step.rationale ? step.rationale : undefined,
    status,
  };
}

export function toPartialPlanView(partial: Partial<Plan>): PlanView {
  const rawSteps = partial.steps ?? [];
  const steps: PlanView['steps'] = [];
  for (const s of rawSteps) {
    if (!s) continue;
    steps.push({
      id: s.id ?? '',
      tool: s.tool ?? '',
      rationale: s.rationale ? s.rationale : undefined,
      status: 'pending',
    });
  }
  return {
    summary: partial.summary ?? '',
    steps: steps.filter((s) => s.id || s.tool),
  };
}

export function buildToolCatalog(tools: Record<string, CatalogTool>): string {
  const lines: string[] = [];
  for (const [name, tool] of Object.entries(tools)) {
    const desc = (tool.description ?? '').replace(/\s+/g, ' ').trim();
    let params = '';
    try {
      const schema = tool.inputSchema as { jsonSchema?: unknown } | undefined;
      const json = schema?.jsonSchema ?? schema;
      if (json) params = JSON.stringify(json);
    } catch {
      params = '';
    }
    lines.push(`- ${name}: ${desc}${params ? `\n  params: ${params}` : ''}`);
  }
  return lines.join('\n');
}

export function buildPlannerPrompt(
  catalog: string,
  history: ModelMessage[],
  prompt: string
): string {
  return [
    'Produce a COMPLETE ordered execution plan of Photoshop MCP tool calls that fully delivers the user request.',
    'Rules:',
    '- Use ONLY tools from the catalog below; copy tool names exactly.',
    "- Each step's argsJson must be a valid JSON object string matching the tool params.",
    '- When a step needs a value produced by an earlier step, reference it with',
    '  "$steps.<stepId>.<dot.path>" as a JSON string inside argsJson, quotes included,',
    '  e.g. {"document_id":"$steps.s1.document.id"}. Never leave $steps unquoted.',
    '- The plan must accomplish the full request end-to-end. Do not stop at partial progress.',
    '- After meaningful visual edits, include photoshop_get_preview when the user expects to see the result.',
    '- Prefer photoshop_recipe_* tools over composing many atomic calls when the request matches a recipe.',
    '- Read each tool description: if a recipe already performs a sub-task, do not duplicate with atomic tools.',
    '- Include photoshop_get_state when document/layer state is uncertain before dependent tools.',
    '- Include export/save steps when the user asks to export or save a file.',
    '- A newly created layer has no pixels. Call photoshop_fill_layer or photoshop_fill_gradient before photoshop_scale_layer. Scaling an empty layer fails because its bounding rectangle is empty.',
    '- After photoshop_create_document, take document_id from that step\'s document.id or from a photoshop_get_state that runs after the create. An id from an earlier get_state is a different open file.',
    '- Obey explicit limits. If the user says not to create a document, not to add a layer, not to paint, or not to preview, omit those tools even if a default workflow would include them.',
    '- For a two-color gradient painted on layer pixels, use photoshop_fill_gradient. Do not use photoshop_execute_script: Document.gradients does not exist and throws "undefined is not an object".',
    '',
    'Tool catalog:',
    catalog,
    '',
    formatHistory(history),
    `User request: ${prompt}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildRepairPrompt(
  catalog: string,
  originalPrompt: string,
  remaining: PlanStep[],
  results: Record<string, unknown>,
  errorMessage: string
): string {
  return [
    'A step in the execution plan failed. Re-plan ONLY the remaining work.',
    `Original user request: ${originalPrompt}`,
    '',
    'Error from the failed step:',
    errorMessage,
    '',
    'Results already produced by completed steps (JSON):',
    safeJson(results),
    '',
    'Remaining steps that still need to run (the first one failed):',
    safeJson(remaining),
    '',
    'Return a corrected, ordered plan for the remaining work only. Reuse prior results',
    'via "$steps.<stepId>.<dot.path>" placeholders. Use ONLY tools from the catalog.',
    'Do not repeat the failed tool with the same arguments.',
    'If the failure is an empty bounding rectangle, fill the layer before scaling it.',
    'If the failure is from photoshop_execute_script, do not retry that script. Use photoshop_fill_gradient for a two-color pixel gradient.',
    'If Fill is not available on a smart object, call photoshop_rasterize_layer on that layer and then photoshop_fill_layer. Do not create an extra layer.',
    'Keep the user\'s explicit limits: do not add a document, layer, fill, or preview they asked you not to.',
    '',
    'Tool catalog:',
    catalog,
  ].join('\n');
}

function formatHistory(history: ModelMessage[]): string {
  if (!history.length) return '';
  const lines = history
    .map((m) => {
      const text =
        typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .map((p) => ('text' in p ? p.text : ''))
                .filter(Boolean)
                .join(' ')
            : '';
      const trimmed = text.trim();
      return trimmed ? `${m.role === 'user' ? 'User' : 'Assistant'}: ${trimmed}` : '';
    })
    .filter(Boolean);
  return lines.length ? `Conversation so far:\n${lines.join('\n')}\n` : '';
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
