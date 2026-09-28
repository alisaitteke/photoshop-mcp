import { describe, expect, it } from 'vitest';
import { applyInstantSetting, computeStatus, resolveApiKey } from '../src/ui/intent/service.js';
import { decide } from '../src/ui/intent/router.js';

describe('intent router settings', () => {
  it('prefers the key saved in Settings over the environment', () => {
    expect(resolveApiKey({ apiKey: 'ts-settings-key' }, { TYPESAFE_API_KEY: 'ts-env-key' })).toEqual({
      key: 'ts-settings-key',
      source: 'settings',
    });
    expect(resolveApiKey({}, { TYPESAFE_API_KEY: ' ts-env-key ' })).toEqual({ key: 'ts-env-key', source: 'env' });
    expect(resolveApiKey({ apiKey: '  ' }, {})).toEqual({ source: null });
  });

  it('is active only with a key, enabled, and not switched off by env', () => {
    expect(computeStatus({}, {}).active).toBe(false);
    expect(computeStatus({ apiKey: 'ts-1234567890abcd' }, {})).toMatchObject({
      active: true,
      enabled: true,
      instant: true,
      hasApiKey: true,
      source: 'settings',
      apiKeyMasked: 'ts-1234...abcd',
    });
    expect(computeStatus({ apiKey: 'k', enabled: false }, {}).active).toBe(false);
    expect(computeStatus({ apiKey: 'k' }, { PSMCP_INTENT_ROUTER: 'off' })).toMatchObject({
      active: false,
      disabledByEnv: true,
    });
  });

  it('turns an instant decision into a plan when instant commands are off', () => {
    const instant = decide(
      {
        intent: { choice: 'undo', confidence: 0.97 },
        multi_step: { noul: 0.02 },
        needs_visual: { noul: 0.02 },
        actionable: { noul: 0.95 },
      },
      { latencyMs: 80, model: 'jev-1.13.0' }
    );
    expect(instant.route).toBe('instant');
    expect(applyInstantSetting(instant, true)).toBe(instant);
    const planned = applyInstantSetting(instant, false);
    expect(planned.route).toBe('plan');
    expect(planned.call).toBeUndefined();
    expect(planned.reason).toMatch(/Instant commands are off/);
  });
});
