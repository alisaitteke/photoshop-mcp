import { describe, expect, it } from 'vitest';
import { classifyError, refineTimeoutEnvelope } from '../src/errors/envelope.js';
import { EXECUTE_SCRIPT_RETRY_TIMEOUT_MS } from '../src/platform/script-timeout.js';

describe('classifyError timeouts and artboards', () => {
  it('classifies script timeouts as extendscript_timeout, not generative_timeout', () => {
    const envelope = classifyError('Script execution timeout');
    expect(envelope.code).toBe('extendscript_timeout');
    expect(envelope.suggested_next_tool).toBe('photoshop_ping');
  });

  it('classifies queue wait timeouts the same way', () => {
    const envelope = classifyError(
      'Script timed out after 61000ms waiting in the execution queue'
    );
    expect(envelope.code).toBe('extendscript_timeout');
  });

  it('still classifies generative timeouts specifically', () => {
    expect(classifyError('generative fill timed out').code).toBe('generative_timeout');
    expect(classifyError('Error 8: Syntax error').code).toBe('extendscript_runtime_error');
  });

  it('classifies missing artboards', () => {
    const envelope = classifyError('artboard_not_found: no artboard with id 12');
    expect(envelope.code).toBe('artboard_not_found');
    expect(envelope.suggested_next_tool).toBe('photoshop_list_artboards');
  });

  it('classifies plain "Artboard not found" messages', () => {
    expect(classifyError('Artboard not found').code).toBe('artboard_not_found');
  });

  it('classifies a non-text active layer', () => {
    const envelope = classifyError('Active layer is not a text layer');
    expect(envelope.code).toBe('not_text_layer');
    expect(envelope.suggested_next_tool).toBe('photoshop_create_text_layer');
  });

  it('after a generic tool timeout, points the agent at ping instead of another 30s script', () => {
    const refined = refineTimeoutEnvelope(
      'photoshop_get_state',
      classifyError('Script execution timeout')
    );
    expect(refined.suggested_next_tool).toBe('photoshop_ping');
    expect(refined.message).toMatch(/still be running/i);
  });

  it('after ping times out, tells the agent to retry ping before reading the document', () => {
    const refined = refineTimeoutEnvelope(
      'photoshop_ping',
      classifyError('Script execution timeout')
    );
    expect(refined.suggested_next_tool).toBe('photoshop_ping');
    expect(refined.message).toMatch(/Retry photoshop_ping/i);
    expect(refined.message).toMatch(/get_state/i);
  });

  it('after execute_script timeout, suggests retrying once with a longer timeout_ms', () => {
    const refined = refineTimeoutEnvelope(
      'photoshop_execute_script',
      classifyError('Script execution timeout')
    );
    expect(refined.suggested_next_tool).toBe('photoshop_execute_script');
    expect(refined.suggested_args).toEqual({ timeout_ms: EXECUTE_SCRIPT_RETRY_TIMEOUT_MS });
  });
});
