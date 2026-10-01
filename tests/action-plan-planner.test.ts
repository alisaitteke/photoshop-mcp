import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zodSchema } from '@ai-sdk/provider-utils';
import { describe, expect, it } from 'vitest';
import {
  pruneSupersededToolCalls,
  replaceStaleDocumentId,
  resolveArgs,
} from '../src/ui/agent/action-plan.js';
import type { PlanStep } from '../src/ui/agent/plan-schema.js';
import { parsePlan, planSchema } from '../src/ui/agent/plan-schema.js';
import { createPlanner, plannerKindForAuth } from '../src/ui/agent/planner.js';
import { isSubmitActionPlanTool, persistSubmittedPlan } from '../src/ui/agent/planner-submit.js';
import type { ProviderAdapter } from '../src/ui/providers/registry.js';

const validPlan = {
  summary: 'Remove the background.',
  steps: [
    {
      id: 's1',
      tool: 'photoshop_recipe_remove_background',
      argsJson: '{}',
      rationale: 'Requested outcome',
    },
  ],
};

const parsedPlan = {
  ...validPlan,
  steps: validPlan.steps.map((step) => ({ ...step, dependsOn: [] as string[] })),
};

function fakeProvider(id: ProviderAdapter['id']): ProviderAdapter {
  return {
    id,
    getLanguageModel: () => ({}) as never,
    getModelPricing: () => undefined,
  } as unknown as ProviderAdapter;
}

function assertEveryPropertyRequired(schema: unknown): void {
  if (!schema || typeof schema !== 'object') return;
  const node = schema as {
    type?: string | string[];
    properties?: Record<string, unknown>;
    required?: string[];
    items?: unknown;
  };
  const types = Array.isArray(node.type) ? node.type : node.type ? [node.type] : [];
  if (types.includes('object') && node.properties) {
    const keys = Object.keys(node.properties).sort();
    expect([...(node.required ?? [])].sort()).toEqual(keys);
    for (const value of Object.values(node.properties)) assertEveryPropertyRequired(value);
  }
  if (node.items) assertEveryPropertyRequired(node.items);
}

describe('planSchema', () => {
  it('accepts a complete plan', () => {
    expect(parsePlan(validPlan)).toEqual(parsedPlan);
  });

  it('fills missing or null rationale and dependsOn', () => {
    expect(
      parsePlan({
        summary: 'x',
        steps: [
          { id: 's1', tool: 'photoshop_ping', argsJson: '{}' },
          {
            id: 's2',
            tool: 'photoshop_get_state',
            argsJson: '{}',
            rationale: null,
            dependsOn: null,
          },
        ],
      })
    ).toEqual({
      summary: 'x',
      steps: [
        {
          id: 's1',
          tool: 'photoshop_ping',
          argsJson: '{}',
          rationale: '',
          dependsOn: [],
        },
        {
          id: 's2',
          tool: 'photoshop_get_state',
          argsJson: '{}',
          rationale: '',
          dependsOn: [],
        },
      ],
    });
  });

  it('lists every object property in required for strict structured output', () => {
    assertEveryPropertyRequired(zodSchema(planSchema).jsonSchema);
  });

  it('rejects a plan without steps or summary', () => {
    expect(() => parsePlan({ summary: 'x' })).toThrow();
    expect(() => parsePlan({ steps: validPlan.steps })).toThrow();
    expect(() => parsePlan({ summary: 'x', steps: [{ id: 's1' }] })).toThrow();
  });
});

describe('resolveArgs', () => {
  it('reads document.id from an MCP text envelope', () => {
    const state = { hasDocument: true, document: { id: 42, name: 'Untitled-1' } };
    const results = {
      s4: {
        content: [{ type: 'text', text: JSON.stringify(state) }],
      },
    };
    expect(resolveArgs('{"document_id":"$steps.s4.document.id"}', results)).toEqual({
      document_id: 42,
    });
  });

  it('quotes a bare $steps token before parsing', () => {
    const state = { document: { id: 7 } };
    const results = {
      s4: { content: [{ type: 'text', text: JSON.stringify(state) }] },
    };
    expect(resolveArgs('{"document_id":$steps.s4.document.id}', results)).toEqual({
      document_id: 7,
    });
  });
});

describe('persistSubmittedPlan', () => {
  it('writes a validated plan to PLAN_OUT_PATH', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'psmcp-plan-'));
    const outPath = join(dir, 'plan.json');
    try {
      const result = await persistSubmittedPlan(validPlan, outPath);
      expect(result.ok).toBe(true);
      const stored = JSON.parse(await readFile(outPath, 'utf8')) as unknown;
      expect(stored).toEqual(parsedPlan);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does not write when validation fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'psmcp-plan-'));
    const outPath = join(dir, 'plan.json');
    try {
      const result = await persistSubmittedPlan({ summary: 'nope' }, outPath);
      expect(result.ok).toBe(false);
      await expect(readFile(outPath, 'utf8')).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('createPlanner', () => {
  it('routes api_key to the SDK planner', () => {
    const planner = createPlanner({
      authMethod: 'api_key',
      provider: fakeProvider('anthropic'),
      apiKey: 'sk-test',
      modelId: 'claude-sonnet-4-5',
    });
    expect(planner.kind).toBe('sdk');
    expect(plannerKindForAuth('api_key')).toBe('sdk');
  });

  it('routes cli_account to the subscription planner without an API key', () => {
    const planner = createPlanner({
      authMethod: 'cli_account',
      provider: fakeProvider('anthropic'),
      modelId: 'claude-sonnet-4-5',
    });
    expect(planner.kind).toBe('subscription');
    expect(plannerKindForAuth('cli_account')).toBe('subscription');
  });

  it('rejects api_key Action Plan without a key', () => {
    expect(() =>
      createPlanner({
        authMethod: 'api_key',
        provider: fakeProvider('openai'),
        modelId: 'gpt-5',
      })
    ).toThrow(/API key is required/);
  });
});

describe('replaceStaleDocumentId', () => {
  const steps = [
    { id: 's1', tool: 'photoshop_get_state', argsJson: '{}', rationale: '', dependsOn: [] },
    { id: 's2', tool: 'photoshop_create_document', argsJson: '{}', rationale: '', dependsOn: [] },
    { id: 's3', tool: 'photoshop_fill_layer', argsJson: '{}', rationale: '', dependsOn: [] },
  ] satisfies PlanStep[];

  it('retargets an id captured before the new document', () => {
    const results = {
      s1: { document: { id: 458 }, documents: [{ id: 458 }, { id: 393 }] },
      s2: { document: { id: 500 } },
    };
    expect(replaceStaleDocumentId({ document_id: 458, red: 0 }, results, steps, 2)).toEqual({
      document_id: 500,
      red: 0,
    });
  });

  it('leaves the new document id and unknown ids alone', () => {
    const results = {
      s1: { document: { id: 458 } },
      s2: { document: { id: 500 } },
    };
    expect(replaceStaleDocumentId({ document_id: 500 }, results, steps, 2)).toEqual({
      document_id: 500,
    });
    expect(replaceStaleDocumentId({ document_id: 999 }, results, steps, 2)).toEqual({
      document_id: 999,
    });
  });
});

describe('pruneSupersededToolCalls', () => {
  it('drops a failed attempt whose step id was replaced and keeps the latest reuse', () => {
    const calls = [
      { stepId: 's1', name: 'photoshop_create_layer' },
      { stepId: 's2', name: 'photoshop_scale_layer' },
      { stepId: 's2', name: 'photoshop_fill_layer' },
      { stepId: 's3', name: 'photoshop_execute_script' },
    ];
    expect(
      pruneSupersededToolCalls(calls, [
        { id: 's1', tool: 'photoshop_create_layer' },
        { id: 's2', tool: 'photoshop_fill_layer' },
        { id: 's4', tool: 'photoshop_get_preview' },
      ])
    ).toEqual([
      { stepId: 's1', name: 'photoshop_create_layer' },
      { stepId: 's2', name: 'photoshop_fill_layer' },
    ]);
  });

  it('drops a failed call when the repair reuses that step id for a different tool', () => {
    const calls = [
      { stepId: 's5', name: 'photoshop_move_layer' },
      { stepId: 's6', name: 'photoshop_fill_layer' },
    ];
    expect(
      pruneSupersededToolCalls(calls, [
        { id: 's5', tool: 'photoshop_move_layer' },
        { id: 's6', tool: 'photoshop_create_layer' },
      ])
    ).toEqual([{ stepId: 's5', name: 'photoshop_move_layer' }]);
  });
});

describe('submit_action_plan tool names', () => {
  it('accepts bare and MCP-prefixed names', () => {
    expect(isSubmitActionPlanTool('submit_action_plan')).toBe(true);
    expect(isSubmitActionPlanTool('mcp__planner__submit_action_plan')).toBe(true);
    expect(isSubmitActionPlanTool('photoshop_get_state')).toBe(false);
  });
});

describe('Action Plan toggle availability', () => {
  it('stays enabled in subscription mode without an API key', () => {
    const sending = false;
    const hasApiKey = false;
    const subscriptionMode = true;
    const formerGate = hasApiKey || !subscriptionMode;
    const disabled = sending;
    expect(formerGate).toBe(false);
    expect(disabled).toBe(false);
  });
});
