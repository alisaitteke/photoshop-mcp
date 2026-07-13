import { describe, expect, it } from 'vitest';
import { jsString } from '../src/utils/js-string.js';

// Characters built via fromCharCode so no raw control/line-terminator bytes
// end up in this source file.
const NUL = String.fromCharCode(0x00);
const TAB = String.fromCharCode(0x09);
const US = String.fromCharCode(0x1f); // unit separator, top of the C0 range
const LS = String.fromCharCode(0x2028); // LINE SEPARATOR
const PS = String.fromCharCode(0x2029); // PARAGRAPH SEPARATOR

describe('jsString', () => {
  it('leaves normal strings untouched', () => {
    expect(jsString('Layer 1')).toBe('Layer 1');
    expect(jsString('/Users/me/Design Files/final (v2).psd')).toBe(
      '/Users/me/Design Files/final (v2).psd'
    );
  });

  it('keeps existing escapes: backslash, quote, newline, carriage return', () => {
    expect(jsString('a\\b')).toBe('a\\\\b');
    expect(jsString('say "hi"')).toBe('say \\"hi\\"');
    expect(jsString('line1\nline2')).toBe('line1\\nline2');
    expect(jsString('line1\rline2')).toBe('line1\\rline2');
  });

  it('escapes U+2028/U+2029 — ES3/ExtendScript line terminators', () => {
    expect(jsString(`a${LS}b`)).toBe('a\\u2028b');
    expect(jsString(`a${PS}b`)).toBe('a\\u2029b');
  });

  it('escapes remaining C0 controls in \\uXXXX form', () => {
    expect(jsString(`a${NUL}b`)).toBe('a\\u0000b');
    expect(jsString(`a${TAB}b`)).toBe('a\\u0009b');
    expect(jsString(`a${US}b`)).toBe('a\\u001fb');
  });

  it('round-trips through a double-quoted string literal', () => {
    const nasty = `Layer "1"\\path\n\r${LS}${PS}${NUL}${TAB}${US} end`;
    const literal = jsString(nasty);

    // The emitted literal must contain no raw parse-breaking characters...
    // eslint-disable-next-line no-control-regex
    expect(literal).not.toMatch(/[\u0000-\u001f\u2028\u2029]/);

    // ...and must evaluate back to the exact original string.
    // eslint-disable-next-line no-eval
    expect(eval(`"${literal}"`)).toBe(nasty);
  });
});
