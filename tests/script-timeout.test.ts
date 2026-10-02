import { afterEach, describe, expect, it } from 'vitest';
import {
  BATCH_SCRIPT_TIMEOUT_MS,
  DEFAULT_SCRIPT_TIMEOUT_MS,
  MAX_SCRIPT_TIMEOUT_MS,
  MIN_SCRIPT_TIMEOUT_MS,
  isScriptTimeoutError,
  resolveScriptTimeoutMs,
} from '../src/platform/script-timeout.js';

describe('resolveScriptTimeoutMs', () => {
  const previous = process.env.PHOTOSHOP_SCRIPT_TIMEOUT;

  afterEach(() => {
    if (previous === undefined) delete process.env.PHOTOSHOP_SCRIPT_TIMEOUT;
    else process.env.PHOTOSHOP_SCRIPT_TIMEOUT = previous;
  });

  it('defaults to 30s when nothing is set', () => {
    delete process.env.PHOTOSHOP_SCRIPT_TIMEOUT;
    expect(resolveScriptTimeoutMs()).toBe(DEFAULT_SCRIPT_TIMEOUT_MS);
  });

  it('clamps explicit values to 1s–600s', () => {
    expect(resolveScriptTimeoutMs(1)).toBe(MIN_SCRIPT_TIMEOUT_MS);
    expect(resolveScriptTimeoutMs(5_000_000)).toBe(MAX_SCRIPT_TIMEOUT_MS);
    expect(resolveScriptTimeoutMs(120_000)).toBe(120_000);
  });

  it('honors PHOTOSHOP_SCRIPT_TIMEOUT when no explicit timeout is passed', () => {
    process.env.PHOTOSHOP_SCRIPT_TIMEOUT = '120000';
    expect(resolveScriptTimeoutMs()).toBe(120_000);
  });

  it('lets an explicit timeout win over the env default', () => {
    process.env.PHOTOSHOP_SCRIPT_TIMEOUT = '120000';
    expect(resolveScriptTimeoutMs(45_000)).toBe(45_000);
  });

  it('uses the batch ceiling of 600s', () => {
    expect(BATCH_SCRIPT_TIMEOUT_MS).toBe(MAX_SCRIPT_TIMEOUT_MS);
  });
});

describe('isScriptTimeoutError', () => {
  it('matches platform timeout messages', () => {
    expect(isScriptTimeoutError('Script execution timeout')).toBe(true);
    expect(isScriptTimeoutError('Script timed out after 61000ms waiting in the execution queue')).toBe(
      true
    );
    expect(isScriptTimeoutError('AppleEvent timed out')).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isScriptTimeoutError('No active document')).toBe(false);
  });
});
