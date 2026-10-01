import { describe, expect, it } from 'vitest';
import {
  MAX_CHAIN_STEPS,
  THRESHOLDS,
  buildQuestions,
  buildSlotQuestions,
  buildStepQuestions,
  classifyIntent,
  decide,
  extractNumbers,
  instantTargets,
  splitSteps,
  type SystemOneClient,
} from '../src/ui/intent/router.js';
import { INSTANT_INTENTS, findIntent } from '../src/ui/intent/catalog.js';
import { instantSummary } from '../src/ui/agent/instant.js';

const meta = { latencyMs: 80, model: 'jev-1.13.0' };

function answers(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    intent: { type: 'choice', choice: 'other', confidence: 0.5, probabilities: {} },
    multi_step: { type: 'noul', noul: 0.1 },
    needs_visual: { type: 'noul', noul: 0.1 },
    actionable: { type: 'noul', noul: 0.9 },
    ...overrides,
  };
}

const pick = (choice: string, confidence = 0.95) => ({ choice, confidence });
const yes = (noul = 0.95) => ({ noul });

describe('intent router: decide (single command)', () => {
  it('runs a confident single command instantly', () => {
    const d = decide(answers({ intent: pick('photoshop_undo', 0.97) }), meta);
    expect(d.route).toBe('instant');
    expect(d.calls).toEqual([{ tool: 'photoshop_undo', args: {}, preview: true, label: 'Undo' }]);
  });

  it('fills a number slot from the pre-parsed candidates', () => {
    const d = decide(answers({ intent: pick('photoshop_set_layer_opacity', 0.93), 's0.opacity': pick('60', 0.9) }), meta);
    expect(d.route).toBe('instant');
    expect(d.calls?.[0]?.args).toEqual({ opacity: 60 });
    expect(d.label).toBe('Set layer opacity · opacity 60');
  });

  it('fills the blend mode slot', () => {
    const d = decide(answers({ intent: pick('photoshop_set_layer_blend_mode', 0.91), 's0.blendMode': pick('MULTIPLY', 0.96) }), meta);
    expect(d.calls?.[0]?.args).toEqual({ blendMode: 'MULTIPLY' });
    expect(d.label).toBe('Set layer blend mode · blendMode MULTIPLY');
  });

  it('does not run instantly when a required slot is missing or unsure', () => {
    const d = decide(
      answers({ intent: pick('photoshop_set_layer_opacity'), 's0.opacity': pick('60', THRESHOLDS.slot - 0.1) }),
      meta
    );
    expect(d.route).toBe('plan');
    expect(d.calls).toBeUndefined();
  });

  it('rejects numbers outside the slot range', () => {
    const d = decide(answers({ intent: pick('photoshop_set_layer_opacity'), 's0.opacity': pick('140') }), meta);
    expect(d.route).toBe('plan');
  });

  it('never runs risky commands instantly', () => {
    const d = decide(answers({ intent: pick('photoshop_flatten_image', 0.99) }), meta);
    expect(d.route).toBe('plan');
    expect(d.reason).toMatch(/hard to undo/);
  });

  it('falls back when confidence is below the instant threshold', () => {
    const d = decide(answers({ intent: pick('photoshop_undo', THRESHOLDS.instant - 0.01) }), meta);
    expect(d.route).not.toBe('instant');
  });

  it('does not run a single command instantly when the request looks multi-step', () => {
    const d = decide(answers({ intent: pick('photoshop_undo'), multi_step: yes(0.8) }), meta);
    expect(d.route).toBe('plan');
  });

  it('asks first when a single request is not actionable', () => {
    expect(decide(answers({ actionable: { noul: 0.2 } }), meta).route).toBe('clarify');
  });

  it('plans a known command instead of asking first when the request is unspecific', () => {
    const d = decide(answers({ intent: pick('photoshop_undo', 0.97), actionable: { noul: 0.1 } }), meta);
    expect(d.route).toBe('instant');
  });

  it('plans undo-all instead of one step or a clarifying question', () => {
    const d = decide(
      answers({ intent: pick('photoshop_undo', 0.97), actionable: { noul: 0.1 } }),
      meta,
      { prompt: 'tüm değişiklikleri geri al' }
    );
    expect(d.route).toBe('plan');
    expect(d.calls).toBeUndefined();
    expect(d.reason).toMatch(/every change/);
  });

  it('plans (does not ask first) when a multi-step request only looks a bit unspecific', () => {
    const d = decide(answers({ multi_step: yes(0.9), actionable: { noul: 0.25 } }), meta);
    expect(d.route).toBe('plan');
    expect(d.reason).toMatch(/Several operations/);
  });

  it('still asks first when a multi-step request is really vague', () => {
    const d = decide(answers({ multi_step: yes(0.9), actionable: { noul: THRESHOLDS.clarifyBelowMultiStep - 0.05 } }), meta);
    expect(d.route).toBe('clarify');
  });

  it('uses the agent loop when the image has to be inspected', () => {
    expect(decide(answers({ needs_visual: yes(0.8) }), meta).route).toBe('agent');
  });

  it('treats missing answers conservatively', () => {
    expect(decide({}, meta).route).toBe('plan');
  });
});

describe('intent router: recipes', () => {
  it('runs a color grade with the look Jev picked', () => {
    const d = decide(answers({ intent: pick('photoshop_recipe_apply_color_grade'), 's0.preset': pick('vintage', 0.9) }), meta);
    expect(d.route).toBe('instant');
    expect(d.calls?.[0]).toMatchObject({
      tool: 'photoshop_recipe_apply_color_grade',
      args: { preset: 'vintage' },
      preview: true,
      label: 'Apply color grade · preset vintage',
    });
  });

  it("leaves optional values to the recipe's defaults when none is stated", () => {
    const d = decide(answers({ intent: pick('photoshop_recipe_apply_color_grade'), 's0.preset': pick('none', 0.9) }), meta);
    expect(d.route).toBe('instant');
    expect(d.calls?.[0]?.args).toEqual({});
  });

  it('needs the slide count before splitting a carousel', () => {
    expect(decide(answers({ intent: pick('photoshop_recipe_split_carousel') }), meta).route).toBe('plan');
    const d = decide(answers({ intent: pick('photoshop_recipe_split_carousel'), 's0.slides': pick('5') }), meta);
    expect(d.calls?.[0]).toMatchObject({ tool: 'photoshop_recipe_split_carousel', args: { slides: 5 } });
  });

  it('turns per-platform yes/no answers into a platform list', () => {
    const d = decide(
      answers({
        intent: pick('photoshop_recipe_export_social_variants'),
        's0.platforms.instagram_story': yes(0.92),
        's0.platforms.youtube_thumbnail': yes(0.88),
        's0.platforms.x_post': yes(0.3),
      }),
      meta
    );
    expect(d.calls?.[0]?.args).toEqual({ platforms: ['instagram_story', 'youtube_thumbnail'] });
    expect(d.label).toBe('Export social variants · platforms (2)');
  });

  it('only changes a default on a confident yes', () => {
    const base = { intent: pick('photoshop_recipe_passport_photo'), 's0.spec': pick('tr_50x60', 0.9) };
    expect(decide(answers({ ...base, 's0.make_sheet': yes(0.6) }), meta).calls?.[0]?.args).toEqual({ spec: 'tr_50x60' });
    expect(decide(answers({ ...base, 's0.make_sheet': yes(0.9) }), meta).calls?.[0]?.args).toEqual({
      spec: 'tr_50x60',
      make_sheet: true,
    });
  });

  it('maps slot keys to the recipe argument names', () => {
    const d = decide(answers({ intent: pick('photoshop_recipe_organize_layers'), 's0.naming_scheme': pick('content_summary'), 's0.auto_group': yes(0.9) }), meta);
    expect(d.calls?.[0]?.args).toEqual({ naming_scheme: 'content_summary', auto_group: true });
  });

  it('never runs a command with values instantly when the value call failed', () => {
    const slotted = decide(answers({ intent: pick('photoshop_recipe_apply_color_grade') }), meta, { slotsAnswered: false });
    expect(slotted.route).toBe('plan');
    const plain = decide(answers({ intent: pick('photoshop_deselect') }), meta, { slotsAnswered: false });
    expect(plain.route).toBe('instant');
  });

  it('lists every recipe tool, and leaves free-text recipes to the planner', () => {
    const recipes = INSTANT_INTENTS.filter((i) => i.tool.startsWith('photoshop_recipe_'));
    const names = recipes.map((i) => i.tool);
    expect(names).toEqual(
      expect.arrayContaining([
        'photoshop_recipe_remove_background',
        'photoshop_recipe_apply_color_grade',
        'photoshop_recipe_enhance_portrait',
        'photoshop_recipe_split_carousel',
        'photoshop_recipe_sky_blend',
        'photoshop_recipe_csv_to_cards',
      ])
    );
    expect(recipes.find((i) => i.tool === 'photoshop_recipe_sky_blend')?.unfillable).toBe(true);
    expect(recipes.find((i) => i.tool === 'photoshop_recipe_csv_to_cards')?.unfillable).toBe(true);
    expect(recipes.find((i) => i.tool === 'photoshop_recipe_remove_background')?.unfillable).toBeUndefined();
  });
});

describe('intent router: splitting into steps', () => {
  it('cuts Turkish and English prompts at connecting words and punctuation', () => {
    expect(splitSteps('siyah beyaz yap ve opaklığı 50 yap')).toEqual(['siyah beyaz yap', 'opaklığı 50 yap']);
    expect(splitSteps('arka planı kaldır, sonra sinematik renk ver')).toEqual(['arka planı kaldır', 'sinematik renk ver']);
    expect(splitSteps('Katmanı çoğalt. Ardından opaklığı 40 yap')).toEqual(['Katmanı çoğalt', 'opaklığı 40 yap']);
    expect(splitSteps('remove the background and then add a new layer')).toEqual([
      'remove the background',
      'add a new layer',
    ]);
  });

  it('cuts after a Turkish -ıp/-ip converb', () => {
    expect(splitSteps('katmanı çoğaltıp opaklığını 50 yap')).toEqual(['katmanı çoğaltıp', 'opaklığını 50 yap']);
    expect(splitSteps('arka planı kaldırıp siyah beyaz yap')).toEqual(['arka planı kaldırıp', 'siyah beyaz yap']);
  });

  it('keeps words that only look like converbs, and decimal commas', () => {
    expect(splitSteps('grup oluştur')).toEqual([]);
    expect(splitSteps('flip it horizontally')).toEqual([]);
    expect(splitSteps('radius 3,5 px frequency separation')).toEqual([]);
  });

  it('returns nothing for one part or for more parts than a chain allows', () => {
    expect(splitSteps('undo')).toEqual([]);
    const many = Array.from({ length: MAX_CHAIN_STEPS + 1 }, (_, i) => `step ${i}`).join(', ');
    expect(splitSteps(many)).toEqual([]);
  });

  it('keeps names that contain a connector together and drops filler parts', () => {
    expect(splitSteps('make it black and white')).toEqual([]);
    expect(splitSteps('siyah ve beyaz yap')).toEqual([]);
    expect(splitSteps('set up dodge and burn')).toEqual([]);
    expect(splitSteps('geri al, lütfen')).toEqual([]);
    expect(splitSteps('make it black and white, then duplicate the layer')).toEqual([
      'make it black and white',
      'duplicate the layer',
    ]);
  });

  it('does not treat letters inside words as connectors', () => {
    expect(splitSteps('devam')).toEqual([]);
    expect(splitSteps('brand new layer')).toEqual([]);
  });
});

describe('intent router: chains', () => {
  const steps = ['siyah beyaz yap', 'opaklığı 50 yap'];

  it('runs every part in order when each is a confident known command', () => {
    const d = decide(
      answers({
        multi_step: yes(0.9),
        step_1: pick('photoshop_desaturate', 0.93),
        step_2: pick('photoshop_set_layer_opacity', 0.9),
        's2.opacity': pick('50', 0.92),
      }),
      meta,
      { steps }
    );
    expect(d.route).toBe('instant');
    expect(d.calls?.map((c) => c.tool)).toEqual(['photoshop_desaturate', 'photoshop_set_layer_opacity']);
    expect(d.calls?.[1]?.args).toEqual({ opacity: 50 });
    expect(d.label).toBe('Desaturate → Set layer opacity · opacity 50');
    expect(d.intent).toBe('photoshop_desaturate+photoshop_set_layer_opacity');
    expect(d.confidence).toBe(0.9);
    expect(d.steps).toEqual(steps);
  });

  it('plans when any part is not a known command', () => {
    const d = decide(
      answers({ multi_step: yes(0.9), step_1: pick('photoshop_desaturate'), step_2: pick('other', 0.9) }),
      meta,
      { steps }
    );
    expect(d.route).toBe('plan');
  });

  it('plans when a part is risky', () => {
    const d = decide(
      answers({ multi_step: yes(0.9), step_1: pick('photoshop_desaturate'), step_2: pick('photoshop_flatten_image') }),
      meta,
      { steps }
    );
    expect(d.route).toBe('plan');
    expect(d.reason).toMatch(/Flatten image is hard to undo/);
  });

  it('needs Jev to agree that the request is multi-step', () => {
    const d = decide(
      answers({ multi_step: yes(0.4), step_1: pick('photoshop_desaturate'), step_2: pick('photoshop_duplicate_layer') }),
      meta,
      { steps }
    );
    expect(d.route).toBe('plan');
  });

  it('prefers the single command when every part agrees with it', () => {
    const d = decide(
      answers({ intent: pick('photoshop_desaturate'), multi_step: yes(0.05), step_1: pick('photoshop_desaturate'), step_2: pick('photoshop_desaturate') }),
      meta,
      { steps: ['make it gray', 'no color'] }
    );
    expect(d.route).toBe('instant');
    expect(d.calls).toHaveLength(1);
  });

  it('does not run one command when a part of the request is something else', () => {
    const d = decide(
      answers({ intent: pick('photoshop_desaturate'), multi_step: yes(0.05), step_1: pick('photoshop_desaturate'), step_2: pick('other', 0.8) }),
      meta,
      { steps: ['siyah beyaz yap', 'biraz daha güzel yap'] }
    );
    expect(d.route).toBe('plan');
    expect(d.reason).toMatch(/Part of the request/);
  });

  it('plans when a chain step is missing a required value', () => {
    const d = decide(
      answers({ multi_step: yes(0.9), step_1: pick('photoshop_desaturate'), step_2: pick('photoshop_set_layer_opacity') }),
      meta,
      { steps }
    );
    expect(d.route).toBe('plan');
  });
});

describe('intent router: questions', () => {
  it('extracts unique number candidates', () => {
    expect(extractNumbers('set opacity to 60% then 60 and 3,5')).toEqual(['60', '3.5']);
    expect(extractNumbers('no numbers here')).toEqual([]);
  });

  it('keeps the intent choice under the 255-option limit and includes other', () => {
    const q = buildQuestions() as Record<string, { criteria: Record<string, unknown> }>;
    const labels = Object.keys(q.intent!.criteria);
    expect(labels.length).toBe(INSTANT_INTENTS.length + 1);
    expect(labels.length).toBeLessThanOrEqual(255);
    expect(labels).toContain('other');
  });

  it('asks each part only which command it is', () => {
    expect(Object.keys(buildStepQuestions())).toEqual(['intent']);
    expect(buildStepQuestions().intent).toEqual(buildQuestions().intent);
  });

  it('asks value questions only for the picked commands, with numbers from their own part', () => {
    const targets = instantTargets(
      answers({ multi_step: yes(0.9), step_1: pick('photoshop_set_layer_opacity'), step_2: pick('photoshop_undo') }),
      'opaklığı 50 yap ve 3 adım geri al',
      ['opaklığı 50 yap', '3 adım geri al']
    );
    expect(targets?.map((t) => t.prefix)).toEqual(['s1', 's2']);
    const opacity = buildSlotQuestions(targets![0]!) as Record<string, { criteria: Record<string, unknown> }>;
    const count = buildSlotQuestions(targets![1]!) as Record<string, { criteria: Record<string, unknown> }>;
    expect(Object.keys(opacity.opacity!.criteria)).toEqual(['50', 'none']);
    expect(Object.keys(count.steps!.criteria)).toEqual(['3', 'none']);
  });

  it('skips number questions when the text has no numbers, and splits multi-selects', () => {
    const undo = findIntent('photoshop_undo')!;
    expect(buildSlotQuestions({ intent: undo, text: 'undo', prefix: 's0', confidence: 1 })).toEqual({});
    const social = findIntent('photoshop_recipe_export_social_variants')!;
    const q = buildSlotQuestions({ intent: social, text: 'export for insta and youtube', prefix: 's0', confidence: 1 });
    expect(Object.keys(q)).toContain('platforms.instagram_story');
    expect(Object.values(q).every((question) => (question as { type: string }).type === 'noul')).toBe(true);
  });
});

describe('intent router: classifyIntent', () => {
  type Request = { state: unknown; questions: Record<string, unknown> };

  /** Fake Jev: answers by the text in the state and whether it is a routing, step or value call. */
  function fakeClient(respond: (text: string, keys: string[]) => Record<string, unknown> | Error) {
    const seen: Request[] = [];
    const client: SystemOneClient = {
      async systemOne(request) {
        seen.push(request);
        const reply = respond((request.state as { request: string }).request, Object.keys(request.questions));
        if (reply instanceof Error) throw reply;
        return { model: 'jev-1.13.0', answers: reply };
      },
    };
    return { client, seen };
  }

  it('makes one call when the picked command has no values to fill', async () => {
    const { client, seen } = fakeClient(() => answers({ intent: pick('photoshop_deselect', 0.9) }));
    let t = 1000;
    const d = await classifyIntent('deselect everything', client, { now: () => (t += 42) });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.state).toEqual({ request: 'deselect everything' });
    expect(d.route).toBe('instant');
    expect(d.latencyMs).toBe(42);
    expect(d.model).toBe('jev-1.13.0');
  });

  it('makes a second call for the values of the picked command', async () => {
    const { client, seen } = fakeClient((_, keys) =>
      keys.includes('intent') ? answers({ intent: pick('photoshop_set_layer_opacity') }) : { opacity: pick('40') }
    );
    const d = await classifyIntent('opacity 40', client);
    expect(seen).toHaveLength(2);
    expect(Object.keys(seen[1]!.questions)).toEqual(['opacity']);
    expect(d.calls?.[0]?.args).toEqual({ opacity: 40 });
  });

  it('labels each part on its own and resolves a chain', async () => {
    const { client, seen } = fakeClient((text, keys) => {
      if (keys.includes('multi_step')) return answers({ multi_step: yes(0.9) });
      if (keys.includes('intent')) {
        return { intent: pick(text === 'arka planı kaldır' ? 'photoshop_recipe_remove_background' : 'photoshop_recipe_apply_color_grade') };
      }
      return { preset: pick('cinematic') };
    });
    const d = await classifyIntent('arka planı kaldır, sonra sinematik renk ver', client);
    expect(seen.map((r) => (r.state as { request: string }).request)).toEqual([
      'arka planı kaldır, sonra sinematik renk ver',
      'arka planı kaldır',
      'sinematik renk ver',
      'arka planı kaldır',
      'sinematik renk ver',
    ]);
    expect(d.route).toBe('instant');
    expect(d.calls?.map((c) => c.args)).toEqual([{}, { preset: 'cinematic' }]);
    expect(d.label).toBe('Remove background → Apply color grade · preset cinematic');
  });

  it('plans when a part could not be labelled', async () => {
    const { client } = fakeClient((text, keys) => {
      if (keys.includes('multi_step')) return answers({ multi_step: yes(0.9) });
      return text === 'katmanı çoğalt' ? { intent: pick('photoshop_duplicate_layer') } : new Error('timeout');
    });
    const d = await classifyIntent('katmanı çoğalt ve yeni katman ekle', client);
    expect(d.route).toBe('plan');
  });

  it('does not guess values when the value call fails', async () => {
    const { client } = fakeClient((_, keys) =>
      keys.includes('intent') ? answers({ intent: pick('photoshop_recipe_apply_color_grade') }) : new Error('timeout')
    );
    const d = await classifyIntent('vintage look', client);
    expect(d.route).toBe('plan');
  });

  it('fails the routing when the main call fails', async () => {
    const { client } = fakeClient(() => new Error('down'));
    await expect(classifyIntent('undo', client)).rejects.toThrow('down');
  });
});

describe('instant summary', () => {
  const a = { tool: 'a', args: {}, preview: false, label: 'A' };
  const b = { tool: 'b', args: {}, preview: false, label: 'B' };

  it('reports success, single failures and where a chain stopped', () => {
    expect(instantSummary([a, b], [a, b], null)).toBe('Done: A → B.');
    expect(instantSummary([a], [], { call: a, message: 'No document' })).toBe('A did not work: No document');
    expect(instantSummary([a, b], [a], { call: b, message: 'No layer.' })).toBe(
      'Step 2 of 2 (B) did not work: No layer. Applied before it: A.'
    );
  });
});
