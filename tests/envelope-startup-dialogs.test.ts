import { describe, expect, it } from 'vitest';
import { ExtendScriptSnippets } from '../src/api/extendscript.js';
import { classifyError, refineTimeoutEnvelope } from '../src/errors/envelope.js';

describe('photoshop_starting (#120)', () => {
  it('classifies the Windows COM error from $.evalFile during startup', () => {
    const envelope = classifyError('Error 52: I/O error.');
    expect(envelope.code).toBe('photoshop_starting');
    expect(envelope.suggested_next_tool).toBe('photoshop_ping');
    expect(envelope.message).toMatch(/^Error 52: I\/O error\./);
    expect(envelope.message).toMatch(/still starting/i);
  });

  it('classifies the macOS osascript form', () => {
    const envelope = classifyError(
      'Command failed: osascript /tmp/x.scpt\nexecution error: Adobe Photoshop 2026 got an error: Error 52: I/O error. (8800)'
    );
    expect(envelope.code).toBe('photoshop_starting');
  });

  it('leaves error 52 raised inside a running script alone', () => {
    const envelope = classifyError('I/O error (number: 52)');
    expect(envelope.code).not.toBe('photoshop_starting');
  });
});

describe('dialogs (#117)', () => {
  it('ping timeout mentions an open dialog the user has to dismiss', () => {
    const refined = refineTimeoutEnvelope('photoshop_ping', classifyError('Script execution timeout'));
    expect(refined.suggested_next_tool).toBe('photoshop_ping');
    expect(refined.message).toMatch(/dialog/i);
  });

  it('close with save=true refuses a document that has no file', () => {
    const script = ExtendScriptSnippets.closeDocument(true);
    expect(script).toContain('doc.fullName');
    expect(script).toContain('document_not_saved');
    expect(script.indexOf('document_not_saved')).toBeLessThan(
      script.indexOf('SaveOptions.SAVECHANGES')
    );
  });

  it('close with save=false does not need a file', () => {
    const script = ExtendScriptSnippets.closeDocument(false);
    expect(script).not.toContain('document_not_saved');
    expect(script).toContain('SaveOptions.DONOTSAVECHANGES');
  });

  it('classifies the never-saved refusal with a pointer to save_document', () => {
    const envelope = classifyError(
      'document_not_saved: this document has never been saved, so save=true would open the Save As dialog and block Photoshop. Call photoshop_save_document with a path first, or close with save=false.'
    );
    expect(envelope.code).toBe('invalid_arguments');
    expect(envelope.suggested_next_tool).toBe('photoshop_save_document');
  });
});
