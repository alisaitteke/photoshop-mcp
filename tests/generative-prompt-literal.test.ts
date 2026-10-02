import { describe, expect, it } from 'vitest';
import { ExtendScriptSnippets } from '../src/api/extendscript.js';

const MULTI_WORD = 'Photorealistic, highly detailed São Paulo city skyline';
const QUOTED_PROMPT = '"Photorealistic, highly detailed S\\u00e3o Paulo city skyline"';

describe('generative prompt string literals', () => {
  it('wraps generativeFill prompt in a real JS string (issue #31)', () => {
    const jsx = ExtendScriptSnippets.generativeFill(MULTI_WORD);
    expect(jsx).toContain(`desc.putString(sTID('prompt'), ${QUOTED_PROMPT})`);
    expect(jsx).not.toMatch(/putString\(sTID\('prompt'\), Photorealistic/);
  });

  it('escapes caller-supplied quotes instead of treating them as delimiters', () => {
    const jsx = ExtendScriptSnippets.generativeFill('say "hi"');
    expect(jsx).toContain(`desc.putString(sTID('prompt'), "say \\"hi\\"")`);
  });

  it('wraps generativeExpand prompt and direction', () => {
    const jsx = ExtendScriptSnippets.generativeExpand('all', MULTI_WORD);
    expect(jsx).toContain(`desc.putString(sTID('prompt'), ${QUOTED_PROMPT})`);
    expect(jsx).toContain(`desc.putString(sTID('direction'), "all")`);
  });

  it('wraps generateImage prompt', () => {
    const jsx = ExtendScriptSnippets.generateImage(MULTI_WORD, 1024, 1024);
    expect(jsx).toContain(`__mcp_syntheticFill(doc, ${QUOTED_PROMPT}, 'text_to_image')`);
  });

  it('wraps skyReplacement path for File()', () => {
    const jsx = ExtendScriptSnippets.skyReplacement('C:\\Skies\\blue sky.psd');
    expect(jsx).toContain('var skyFile = new File("C:\\\\Skies\\\\blue sky.psd")');
  });
});
