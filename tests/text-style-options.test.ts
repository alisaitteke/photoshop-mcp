import { describe, expect, it } from 'vitest';
import {
  emitTextRangesLiteral,
  emitTextStyleLiteral,
  parseTextRangesArg,
  parseTextStyleArgs,
} from '../src/tools/text-style-options.js';

describe('text style argument parsing', () => {
  it('parses tracking, leading, paragraph box, and alignment', () => {
    const parsed = parseTextStyleArgs(
      {
        tracking: 80.4,
        leading: 42,
        kind: 'paragraph',
        box_width: 500,
        box_height: 180,
        alignment: 'CENTER',
      },
      { requireSome: true }
    );
    expect(parsed.error).toBeUndefined();
    expect(parsed.style.tracking).toBe(80);
    expect(parsed.style.leading).toBe(42);
    expect(parsed.style.kind).toBe('paragraph');
    expect(parsed.style.box_width).toBe(500);
    expect(parsed.style.alignment).toBe('CENTER');
  });

  it('implies paragraph kind from box_width', () => {
    const parsed = parseTextStyleArgs({ box_width: 400 }, { requireSome: true });
    expect(parsed.error).toBeUndefined();
    expect(parsed.style.kind).toBe('paragraph');
  });

  it('rejects empty set_text_style payloads', () => {
    const parsed = parseTextStyleArgs({}, { requireSome: true });
    expect(parsed.error?.code).toBe('invalid_arguments');
  });

  it('emits an ExtendScript object literal without regex character classes', () => {
    const jsx = emitTextStyleLiteral({
      tracking: 120,
      kind: 'paragraph',
      fontName: 'Arial',
      red: 10,
      green: 20,
      blue: 30,
    });
    expect(jsx).toContain('tracking:120');
    expect(jsx).toContain('kind:"paragraph"');
    expect(jsx).toContain('font:"Arial"');
    expect(jsx).toContain('red:10');
    expect(jsx).not.toContain('.replace(/[');
  });

  it('rejects overlapping text ranges and emits slice indexes', () => {
    expect(
      parseTextRangesArg({
        ranges: [
          { from: 0, to: 5, red: 255, green: 0, blue: 0 },
          { from: 4, to: 8, red: 0, green: 0, blue: 255 },
        ],
      }).error?.code
    ).toBe('invalid_arguments');

    const parsed = parseTextRangesArg({
      ranges: [
        { from: 6, to: 11, fontName: 'Times' },
        { from: 0, to: 5, red: 220, green: 40, blue: 40 },
      ],
    });
    expect(parsed.error).toBeUndefined();
    expect(parsed.ranges.map((r) => r.from)).toEqual([0, 6]);
    expect(emitTextRangesLiteral(parsed.ranges)).toContain('from:0,to:5');
    expect(emitTextRangesLiteral(parsed.ranges)).toContain('font:"Times"');
  });
});
