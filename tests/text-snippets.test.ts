import { describe, expect, it } from 'vitest';
import { ExtendScriptSnippets } from '../src/api/extendscript.js';

describe('text typography ExtendScript snippets', () => {
  it('createTextLayer applies tracking/leading/paragraph box via helpers', () => {
    const jsx = ExtendScriptSnippets.createTextLayer(
      'Hello',
      40,
      80,
      32,
      'Arial',
      '{tracking:80,leading:40,kind:"paragraph",box_width:500,box_height:160}'
    );
    expect(jsx).toContain('__mcp_applyTextStyle');
    expect(jsx).toContain('tracking:80');
    expect(jsx).toContain('TextType.PARAGRAPHTEXT');
    expect(jsx).toContain('new UnitValue(opts.box_width, \'px\')');
    expect(jsx).not.toContain('.replace(/[');
  });

  it('setTextStyle writes TextItem.tracking and leading', () => {
    const jsx = ExtendScriptSnippets.setTextStyle('{tracking:120,leading:48,alignment:"CENTER"}');
    expect(jsx).toContain('t.tracking = opts.tracking');
    expect(jsx).toContain('t.useAutoLeading = false');
    expect(jsx).toContain('t.leading = opts.leading');
    expect(jsx).toContain('Justification[opts.alignment]');
  });

  it('setTextRanges uses AM textStyleRange and restores layer-wide style', () => {
    const jsx = ExtendScriptSnippets.setTextRanges('[{from:0,to:5,red:220,green:40,blue:40}]');
    expect(jsx).toContain('textStyleRange');
    expect(jsx).toContain('fontPostScriptName');
    expect(jsx).toContain("c2t('Txtt')");
    expect(jsx).toContain('__mcp_applyTextStyle(t,');
    expect(jsx).toContain('from:0');
  });
});
