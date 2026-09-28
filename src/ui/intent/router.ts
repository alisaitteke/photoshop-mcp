import {
  BLEND_MODES,
  INSTANT_INTENTS,
  OTHER_DESCRIPTION,
  OTHER_INTENT,
  findIntent,
  humanBlendMode,
  type SlotValues,
} from './catalog.js';

/**
 * Jev intent router for the standalone UI.
 *
 * One TypeSafe `systemOne` call asks a handful of questions about the prompt in
 * parallel; plain code below turns the answers into a route:
 *
 *   instant  – exactly one known, safe command → run it directly, no LLM call
 *   plan     – several known operations → Action Plan (one planning LLM call)
 *   agent    – needs to look at the image → agent loop with previews
 *   clarify  – too vague → agent loop told to ask one question first
 *
 * Jev decides, code acts: thresholds live here, not in the model.
 */

export type IntentRoute = 'instant' | 'plan' | 'agent' | 'clarify';

export interface InstantCall {
  tool: string;
  args: Record<string, unknown>;
  preview: boolean;
  label: string;
}

export interface IntentDecision {
  route: IntentRoute;
  /** Choice label Jev picked (`other` when none fits). */
  intent: string;
  /** Human text for the chip, e.g. "Undo 1 step" or "Plan". */
  label: string;
  /** Jev's confidence in the intent choice, 0..1. */
  confidence: number;
  signals: { multiStep: number; needsVisual: number; actionable: number };
  call?: InstantCall;
  reason: string;
  latencyMs: number;
  model: string;
}

/** Minimal slice of the SDK client, so tests can pass a fake. */
export interface SystemOneClient {
  systemOne(
    request: { state: unknown; questions: Record<string, unknown> },
    options?: { signal?: AbortSignal; timeout?: number }
  ): PromiseLike<{ model: string; answers: Record<string, unknown> }>;
}

export const THRESHOLDS = {
  /** Intent confidence needed to skip the LLM. Docs suggest ~0.85 for acting directly. */
  instant: 0.85,
  /** A slot value (number, blend mode) must be at least this sure. */
  slot: 0.7,
  /** P(multi-step) must stay below this for instant. */
  multiStepMax: 0.3,
  /** Below this P(actionable) we ask a question first. */
  clarifyBelow: 0.35,
  /** Above this P(needs visual) the agent loop with previews is used. */
  visualMin: 0.6,
  /** Above this P(multi-step) the Action Plan is used. */
  planMin: 0.5,
} as const;

const NONE = 'none';

/** Candidate numbers for the pre-parsed value pattern: Jev picks one, code parses it. */
export function extractNumbers(prompt: string): string[] {
  const found = prompt.match(/\d{1,4}(?:[.,]\d+)?/g) ?? [];
  return [...new Set(found.map((n) => n.replace(',', '.')))].slice(0, 12);
}

type Question =
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'noul'; instructions: string; criteria?: { true?: string; false?: string } };

export function buildQuestions(prompt: string): Record<string, Question> {
  const intents: Record<string, string> = {};
  for (const intent of INSTANT_INTENTS) intents[intent.id] = intent.describe;
  intents[OTHER_INTENT] = OTHER_DESCRIPTION;

  const blendModes: Record<string, string> = {};
  for (const mode of BLEND_MODES) blendModes[mode] = humanBlendMode(mode);
  blendModes[NONE] = 'No blend mode is named.';

  const questions: Record<string, Question> = {
    intent: {
      type: 'choice',
      instructions:
        'The `request` is what a user typed to control Adobe Photoshop. Which single command is it? Pick `other` if it asks for more than one change or for anything not listed.',
      criteria: intents,
    },
    multi_step: {
      type: 'noul',
      instructions: 'Does the `request` ask for more than one separate edit or operation?',
    },
    needs_visual: {
      type: 'noul',
      instructions:
        'To carry out the `request`, would someone have to look at the image first to decide what to change (for example "make it look better" or "fix what looks off")?',
    },
    actionable: {
      type: 'noul',
      instructions:
        'Is the `request` specific enough to carry out without asking the user a follow-up question?',
    },
    blend_mode: {
      type: 'choice',
      instructions: 'Which layer blend mode does the `request` name, if any?',
      criteria: blendModes,
    },
  };

  const numbers = extractNumbers(prompt);
  if (numbers.length > 0) {
    const criteria = (instructions: string): Question => {
      const options: Record<string, string | null> = {};
      for (const n of numbers) options[n] = null;
      options[NONE] = 'None of these numbers is that value.';
      return { type: 'choice', instructions, criteria: options };
    };
    questions.opacity_value = criteria('Which of these numbers is the layer opacity the `request` asks for?');
    questions.count_value = criteria('Which of these numbers is how many steps the `request` wants to undo or redo?');
  }
  return questions;
}

interface ChoiceAnswer {
  choice: string;
  confidence: number;
}
interface NoulAnswer {
  noul: number;
}

function choiceOf(answers: Record<string, unknown>, key: string): ChoiceAnswer | null {
  const a = answers[key] as Partial<ChoiceAnswer> | undefined;
  return a && typeof a.choice === 'string' && typeof a.confidence === 'number'
    ? { choice: a.choice, confidence: a.confidence }
    : null;
}

function noulOf(answers: Record<string, unknown>, key: string, fallback: number): number {
  const a = answers[key] as Partial<NoulAnswer> | undefined;
  return a && typeof a.noul === 'number' ? a.noul : fallback;
}

function resolveSlots(answers: Record<string, unknown>): SlotValues {
  const slots: SlotValues = {};
  const blend = choiceOf(answers, 'blend_mode');
  if (blend && blend.choice !== NONE && blend.confidence >= THRESHOLDS.slot) slots.blendMode = blend.choice;
  const opacity = choiceOf(answers, 'opacity_value');
  if (opacity && opacity.choice !== NONE && opacity.confidence >= THRESHOLDS.slot) {
    const n = Number(opacity.choice);
    if (Number.isFinite(n) && n >= 0 && n <= 100) slots.opacity = Math.round(n);
  }
  const count = choiceOf(answers, 'count_value');
  if (count && count.choice !== NONE && count.confidence >= THRESHOLDS.slot) {
    const n = Number(count.choice);
    if (Number.isInteger(n) && n >= 1 && n <= 50) slots.count = n;
  }
  return slots;
}

/** Pure decision logic: Jev answers in, route out. */
export function decide(
  answers: Record<string, unknown>,
  meta: { latencyMs: number; model: string }
): IntentDecision {
  const intentAnswer = choiceOf(answers, 'intent') ?? { choice: OTHER_INTENT, confidence: 0 };
  const signals = {
    multiStep: noulOf(answers, 'multi_step', 0.5),
    needsVisual: noulOf(answers, 'needs_visual', 0),
    actionable: noulOf(answers, 'actionable', 1),
  };
  const base = { intent: intentAnswer.choice, confidence: intentAnswer.confidence, signals, ...meta };
  const intent = findIntent(intentAnswer.choice);

  if (intent && !intent.risky && intentAnswer.confidence >= THRESHOLDS.instant && signals.multiStep < THRESHOLDS.multiStepMax) {
    const slots = resolveSlots(answers);
    const missing = (intent.requires ?? []).filter((slot) => slots[slot] === undefined);
    if (missing.length === 0) {
      const label = intent.describeCall?.(slots) ?? intent.label;
      return {
        ...base,
        route: 'instant',
        label,
        call: { tool: intent.tool, args: intent.args(slots), preview: Boolean(intent.preview), label },
        reason: 'One known command; runs directly without a language model call.',
      };
    }
  }

  if (signals.actionable < THRESHOLDS.clarifyBelow) {
    return { ...base, route: 'clarify', label: 'Ask first', reason: 'Too vague to act on safely; the model asks one question first.' };
  }
  if (signals.needsVisual >= THRESHOLDS.visualMin) {
    return { ...base, route: 'agent', label: 'Look & iterate', reason: 'Needs to look at the image; the model gets previews as it works.' };
  }
  if (intent?.risky) {
    return { ...base, route: 'plan', label: 'Plan', reason: `${intent.label} is hard to undo, so it goes through a plan.` };
  }
  return {
    ...base,
    route: 'plan',
    label: 'Plan',
    reason:
      signals.multiStep >= THRESHOLDS.planMin
        ? 'Several operations; one planning call, then the steps run directly.'
        : 'Not a single known command; the model plans it.',
  };
}

export async function classifyIntent(
  prompt: string,
  client: SystemOneClient,
  options: { signal?: AbortSignal; timeoutMs?: number; now?: () => number } = {}
): Promise<IntentDecision> {
  const now = options.now ?? Date.now;
  const started = now();
  const result = await client.systemOne(
    { state: { request: prompt.slice(0, 2000) }, questions: buildQuestions(prompt) },
    { signal: options.signal, timeout: options.timeoutMs }
  );
  return decide(result.answers, { latencyMs: Math.max(0, now() - started), model: result.model });
}
