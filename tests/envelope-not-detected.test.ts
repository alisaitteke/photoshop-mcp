import { describe, expect, it } from 'vitest';
import { buildEnvelopeFromError, classifyError } from '../src/errors/envelope.js';
import { PHOTOSHOP_NOT_DETECTED_MESSAGE } from '../src/platform/connection.js';

describe('classifyError for Photoshop detection failures', () => {
  it.each([
    [PHOTOSHOP_NOT_DETECTED_MESSAGE],
    ['Photoshop info not available. Please detect Photoshop first.'],
    ['Photoshop not found on this system'],
  ])('%s → photoshop_not_detected', (message) => {
    const envelope = classifyError(message);
    expect(envelope.code).toBe('photoshop_not_detected');
    expect(envelope.message).toContain(message);
    expect(envelope.message).toMatch(/Start Photoshop/);
    expect(envelope.message).toMatch(/PHOTOSHOP_PATH/);
    expect(envelope.message).toMatch(/\.app bundle/);
    expect(envelope.message).toMatch(/Photoshop\.exe/);
    expect(envelope.message).toMatch(/restart the MCP server/);
    expect(envelope.suggested_next_tool).toBe('photoshop_ping');
  });

  it('reaches tool results that throw', () => {
    const result = buildEnvelopeFromError(new Error(PHOTOSHOP_NOT_DETECTED_MESSAGE));
    const text = result.content[0].type === 'text' ? result.content[0].text : '';
    expect(JSON.parse(text)).toMatchObject({ ok: false, code: 'photoshop_not_detected' });
  });

  it('keeps the more specific macOS osascript code when both apply', () => {
    const envelope = classifyError(
      'Photoshop not found on this system: Can’t get application "Adobe Photoshop 2026". (-1728)'
    );
    expect(envelope.code).toBe('photoshop_app_not_resolved');
  });

  it('does not claim a missing install for a missing layer or file', () => {
    expect(classifyError('Layer not found: Background').code).toBe('layer_not_found');
    expect(classifyError('File not found: /tmp/a.psd').code).toBe('file_not_found');
  });
});
