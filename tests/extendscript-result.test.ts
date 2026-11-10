import { describe, expect, it } from 'vitest';
import { parseExtendScriptPayload } from '../src/utils/extendscript-result.js';

describe('parseExtendScriptPayload', () => {
  it('passes non-string values through untouched', () => {
    expect(parseExtendScriptPayload(null)).toBeNull();
    expect(parseExtendScriptPayload(42)).toBe(42);
    const object = { ok: true };
    expect(parseExtendScriptPayload(object)).toBe(object);
  });

  it('returns trimmed strings for empty or non-literal output', () => {
    expect(parseExtendScriptPayload('')).toBe('');
    expect(parseExtendScriptPayload('   ')).toBe('');
    expect(parseExtendScriptPayload('hello world')).toBe('hello world');
    // Bare JSON scalars take the JSON.parse fast path, unchanged.
    expect(parseExtendScriptPayload('true')).toBe(true);
  });

  it('parses JSON first', () => {
    expect(parseExtendScriptPayload('{"ok":true}')).toEqual({ ok: true });
  });

  it('parses toSource() object literals', () => {
    expect(parseExtendScriptPayload('({ok:true,summary:"done"})')).toEqual({
      ok: true,
      summary: 'done',
    });
    expect(parseExtendScriptPayload('{ok:true}')).toEqual({ ok: true });
  });

  it('parses arrays, groups, nesting and every value kind', () => {
    expect(parseExtendScriptPayload('[1,2,3]')).toEqual([1, 2, 3]);
    expect(parseExtendScriptPayload('([1,[2]])')).toEqual([1, [2]]);
    expect(parseExtendScriptPayload('(({ok:true}))')).toEqual({ ok: true });
    expect(parseExtendScriptPayload('({a:true,b:false,c:null,d:undefined,e:-1.5,f:"s"})')).toEqual({
      a: true,
      b: false,
      c: null,
      d: undefined,
      e: -1.5,
      f: 's',
    });
    expect(parseExtendScriptPayload('({"quoted key":[1]})')).toEqual({ 'quoted key': [1] });
  });

  it('parses strings with toSource() escapes and single quotes', () => {
    expect(parseExtendScriptPayload('({s:"a\\"b\\\\c\\nd"})')).toEqual({ s: 'a"b\\c\nd' });
    expect(parseExtendScriptPayload('({s:"\\u00e9"})')).toEqual({ s: 'é' });
    expect(parseExtendScriptPayload("({s:'hi'})")).toEqual({ s: 'hi' });
  });

  it('tolerates whitespace between tokens', () => {
    expect(parseExtendScriptPayload('({ ok : true , n : 1 })')).toEqual({ ok: true, n: 1 });
  });

  it('falls back to the raw string on malformed literals', () => {
    expect(parseExtendScriptPayload('({ok:true}) junk')).toBe('({ok:true}) junk');
    expect(parseExtendScriptPayload('({ok:true}')).toBe('({ok:true}');
    expect(parseExtendScriptPayload('({s:"unterminated})')).toBe('({s:"unterminated})');
    expect(parseExtendScriptPayload('({s:"bad \\x escape"})')).toBe('({s:"bad \\x escape"})');
    expect(parseExtendScriptPayload('({a:1,})')).toBe('({a:1,})');
  });

  it('rejects trailing code after a valid literal instead of executing it', () => {
    const globalScope = globalThis as unknown as Record<string, unknown>;
    const hostile = '({ok:true}, globalThis.__triage_pwned = 42)';
    expect(parseExtendScriptPayload(hostile)).toBe(hostile);
    expect(globalScope.__triage_pwned).toBeUndefined();
  });

  it('rejects function, arrow and arbitrary identifier expressions', () => {
    const hostile = [
      '({x: (function(){ return process })()})',
      '({x: (() => 1)})',
      '({x: constructor})',
      '({x: require("child_process")})',
      '({x: (globalThis.__triage_pwned = 1)})',
    ];
    for (const payload of hostile) {
      expect(parseExtendScriptPayload(payload)).toBe(payload);
    }
    const globalScope = globalThis as unknown as Record<string, unknown>;
    expect(globalScope.__triage_pwned).toBeUndefined();
  });

  it('treats __proto__ as a plain key without touching Object.prototype', () => {
    const parsed = parseExtendScriptPayload('({"__proto__":{"polluted":true}})') as Record<
      string,
      unknown
    >;
    expect(parsed['__proto__']).toEqual({ polluted: true });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects nesting deeper than the depth cap without stack overflow', () => {
    // Unquoted keys keep this off the JSON.parse fast path so the literal
    // reader's recursion cap is what handles it.
    const deep = '{a:'.repeat(200) + '1' + '}'.repeat(200);
    expect(parseExtendScriptPayload(deep)).toBe(deep);
  });

  it('never throws on any input shape', () => {
    const inputs = [
      '({',
      '({a:1',
      '({a:1}}',
      '((((((((((',
      '({"a":',
      '([)]',
      '(}',
      '{]',
      '({a:1) ',
      '({:1})',
      '({1:2})',
      '({-:1})',
      '({"":1})',
      '({a:"\\"})',
      '({a:"\\q"})',
      '({a:01})',
      '({a:+1})',
      '({a:.5})',
      '({a:1e})',
      '({a:tru})',
      '({a:NULL})',
      '\t({a:1})\n',
    ];
    for (const input of inputs) {
      expect(() => parseExtendScriptPayload(input)).not.toThrow();
    }
  });
});
