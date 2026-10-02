import { describe, expect, it } from 'vitest';
import { ExtendScriptSnippets } from '../src/api/extendscript.js';

describe('artboard ExtendScript snippets', () => {
  it('lists artboards via Action Manager artboardEnabled / artboardRect', () => {
    const jsx = ExtendScriptSnippets.listArtboards();
    expect(jsx).toContain('artboardEnabled');
    expect(jsx).toContain('artboardRect');
    expect(jsx).toContain('__mcp_listArtboards');
  });

  it('creates an artboardSection with classFloatRect fallback', () => {
    const jsx = ExtendScriptSnippets.createArtboard('Phone', 390, 844);
    expect(jsx).toContain('artboardSection');
    expect(jsx).toContain('classFloatRect');
    expect(jsx).toContain('isBackgroundLayer');
    expect(jsx).toContain('390');
    expect(jsx).toContain('844');
  });

  it('pins exportAs to an artboard id via duplicate+crop', () => {
    const jsx = ExtendScriptSnippets.exportAs('/tmp/board.png', 'PNG', 80, 42);
    expect(jsx).toContain('__mcp_duplicateCropToArtboard');
    expect(jsx).toContain('__mcp_findArtboard(42, null)');
  });

  it('includes artboards and open-document identity on get_state', () => {
    const jsx = ExtendScriptSnippets.getState();
    expect(jsx).toContain('artboardCount');
    expect(jsx).toContain('activeArtboard');
    expect(jsx).toContain('openDocumentCount');
    expect(jsx).toContain('context.document.path = doc.fullName.fsName');
    expect(jsx).toContain('context.document.saved = doc.saved');
    expect(jsx).toContain('context.document.bitsPerChannel');
    expect(jsx).toContain('context.document.layers');
    expect(jsx).toContain('context.documents');
    expect(jsx).toContain('entry.name = String(openDoc.name)');
  });

  it('lists each open document with artboard_count and saved, then restores the active tab', () => {
    const jsx = ExtendScriptSnippets.listDocuments();
    expect(jsx).toContain('artboard_count');
    expect(jsx).toContain('d.saved');
    expect(jsx).toContain('__mcp_listArtboards');
    expect(jsx).toContain('app.activeDocument = app.documents[r]');
    expect(jsx).not.toContain('.replace(/[');
  });
});
