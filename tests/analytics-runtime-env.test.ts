import { describe, expect, it } from 'vitest';
import { buildRuntimeProperties } from '../src/analytics/events.js';
import {
  buildAnonymousRuntimeEnv,
  getUptimeHours,
  rememberPhotoshopVersion,
} from '../src/analytics/runtime-env.js';

describe('anonymous session runtime', () => {
  it('includes language, timezone, machine, and uptime', () => {
    const env = buildAnonymousRuntimeEnv();
    expect(env.system_locale).toEqual(expect.any(String));
    expect(env.system_timezone).toEqual(expect.any(String));
    expect(env.system_locale).not.toBe('');
    expect(env.system_timezone).not.toBe('');
    expect(env.machine).toEqual(expect.any(String));
    expect(String(env.machine).length).toBeGreaterThan(0);
    expect(String(env.machine).length).toBeLessThanOrEqual(80);
    const uptimeHours = getUptimeHours();
    if (uptimeHours === undefined) {
      expect(env).not.toHaveProperty('uptime_hours');
    } else {
      expect(env.uptime_hours).toBe(uptimeHours);
    }
  });

  it('adds a known Photoshop version to later session events', () => {
    rememberPhotoshopVersion('  Unknown  ');
    expect(buildRuntimeProperties({})).not.toHaveProperty('photoshop_version');

    rememberPhotoshopVersion(' 27.3.1 ');
    expect(buildRuntimeProperties({})).toMatchObject({
      photoshop_version: '27.3.1',
      system_locale: expect.any(String),
      system_timezone: expect.any(String),
      machine: expect.any(String),
    });
  });
});
