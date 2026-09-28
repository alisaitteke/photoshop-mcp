import { describe, expect, it } from 'vitest';
import {
  THRESHOLDS,
  buildQuestions,
  classifyIntent,
  decide,
  extractNumbers,
  type SystemOneClient,
} from '../src/ui/intent/router.js';
import { INSTANT_INTENTS } from '../src/ui/intent/catalog.js';

const meta = { latencyMs: 80, model: 'jev-1.13.0' };

function answers(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    intent: { type: 'choice', choice: 'other', confidence: 0.5, probabilities: {} },
    multi_step: { type: 'noul', noul: 0.1 },
    needs_visual: { type: 'noul', noul: 0.1 },
    actionable: { type: 'noul', noul: 0.9 },
    blend_mode: { type: 'choice', choice: 'none', confidence: 0.95, probabilities: {} },
    ...overrides,
  };
}

describe('intent router: decide', () => {
  it('runs a confident single command instantly', () => {
    const d = decide(answers({ intent: { choice: 'undo', confidence: 0.97 } }), meta);
    expect(d.route).toBe('instant');
    expect(d.call).toEqual({ tool: 'photoshop_undo', args: {}, preview: false, label: 'Undo 1 step' });
  });

  it('fills a number slot from the pre-parsed candidates', () => {
    const d = decide(
      answers({
        intent: { choice: 'set_opacity', confidence: 0.93 },
        opacity_value: { choice: '60', confidence: 0.9 },
      }),
      meta
    );
    expect(d.route).toBe('instant');
    expect(d.call?.args).toEqual({ opacity: 60 });
    expect(d.label).toBe('Opacity 60%');
  });

  it('fills the blend mode slot', () => {
    const d = decide(
      answers({
        intent: { choice: 'set_blend_mode', confidence: 0.91 },
        blend_mode: { choice: 'MULTIPLY', confidence: 0.96 },
      }),
      meta
    );
    expect(d.call?.args).toEqual({ blendMode: 'MULTIPLY' });
    expect(d.label).toBe('Blend mode Multiply');
  });

  it('does not run instantly when a required slot is missing or unsure', () => {
    const d = decide(
      answers({
        intent: { choice: 'set_opacity', confidence: 0.95 },
        opacity_value: { choice: '60', confidence: THRESHOLDS.slot - 0.1 },
      }),
      meta
    );
    expect(d.route).toBe('plan');
    expect(d.call).toBeUndefined();
  });

  it('never runs risky commands instantly', () => {
    const d = decide(answers({ intent: { choice: 'flatten_image', confidence: 0.99 } }), meta);
    expect(d.route).toBe('plan');
    expect(d.reason).toMatch(/hard to undo/);
  });

  it('falls back when confidence is below the instant threshold', () => {
    const d = decide(answers({ intent: { choice: 'undo', confidence: THRESHOLDS.instant - 0.01 } }), meta);
    expect(d.route).not.toBe('instant');
  });

  it('does not run instantly when the request looks multi-step', () => {
    const d = decide(
      answers({ intent: { choice: 'undo', confidence: 0.95 }, multi_step: { noul: 0.8 } }),
      meta
    );
    expect(d.route).toBe('plan');
  });

  it('asks first when the request is not actionable', () => {
    expect(decide(answers({ actionable: { noul: 0.2 } }), meta).route).toBe('clarify');
  });

  it('uses the agent loop when the image has to be inspected', () => {
    expect(decide(answers({ needs_visual: { noul: 0.8 } }), meta).route).toBe('agent');
  });

  it('treats missing answers conservatively', () => {
    expect(decide({}, meta).route).toBe('plan');
  });
});

describe('intent router: questions', () => {
  it('extracts unique number candidates', () => {
    expect(extractNumbers('set opacity to 60% then 60 and 3,5')).toEqual(['60', '3.5']);
    expect(extractNumbers('no numbers here')).toEqual([]);
  });

  it('only asks number questions when the prompt has numbers', () => {
    expect(Object.keys(buildQuestions('undo'))).not.toContain('opacity_value');
    const q = buildQuestions('opacity 40');
    expect(Object.keys(q)).toEqual(expect.arrayContaining(['intent', 'opacity_value', 'count_value']));
  });

  it('keeps the intent choice under the 255-option limit and includes other', () => {
    const q = buildQuestions('x') as Record<string, { criteria: Record<string, unknown> }>;
    const labels = Object.keys(q.intent!.criteria);
    expect(labels.length).toBe(INSTANT_INTENTS.length + 1);
    expect(labels.length).toBeLessThanOrEqual(255);
    expect(labels).toContain('other');
  });
});

describe('intent router: classifyIntent', () => {
  it('sends the prompt as state and returns a timed decision', async () => {
    let seen: { state: unknown; questions: Record<string, unknown> } | undefined;
    const client: SystemOneClient = {
      async systemOne(request) {
        seen = request;
        return { model: 'jev-1.13.0', answers: answers({ intent: { choice: 'deselect', confidence: 0.9 } }) };
      },
    };
    let t = 1000;
    const d = await classifyIntent('deselect everything', client, { now: () => (t += 42) });
    expect(seen?.state).toEqual({ request: 'deselect everything' });
    expect(d.route).toBe('instant');
    expect(d.latencyMs).toBe(42);
    expect(d.model).toBe('jev-1.13.0');
  });
});
