import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  hasAnalyticsKey,
  isAnalyticsDisabledByEnv,
  resolveMixpanelToken,
  resolvePostHogKey,
} from '../src/analytics/config.js';

const ENV_KEYS = [
  'ANALYTICS_ENABLED',
  'ANALYTICS_DISABLED',
  'POSTHOG_DISABLED',
  'MIXPANEL_TOKEN',
  'POSTHOG_KEY',
  'ANALYTICS_PROVIDER',
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('analytics opt-in model', () => {
  it('is disabled by default with no env vars set', () => {
    expect(isAnalyticsDisabledByEnv()).toBe(true);
  });

  it('enables only when ANALYTICS_ENABLED is truthy', () => {
    process.env.ANALYTICS_ENABLED = '1';
    expect(isAnalyticsDisabledByEnv()).toBe(false);
  });

  it('legacy disable flags win even when ANALYTICS_ENABLED is set', () => {
    process.env.ANALYTICS_ENABLED = '1';
    process.env.ANALYTICS_DISABLED = '1';
    expect(isAnalyticsDisabledByEnv()).toBe(true);
  });

  it('ships no default telemetry tokens', () => {
    expect(resolveMixpanelToken()).toBe('');
    expect(resolvePostHogKey()).toBe('');
    expect(hasAnalyticsKey()).toBe(false);
  });

  it('operator-supplied keys are still honored', () => {
    process.env.MIXPANEL_TOKEN = 'my-own-token';
    expect(resolveMixpanelToken()).toBe('my-own-token');
    expect(hasAnalyticsKey()).toBe(true);
  });
});
