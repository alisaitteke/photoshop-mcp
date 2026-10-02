import { jsStringLiteral } from '../utils/js-string.js';
import type { PhotoshopErrorEnvelope } from '../errors/envelope.js';

export const TEXT_ALIGNMENTS = [
  'LEFT',
  'CENTER',
  'RIGHT',
  'LEFTJUSTIFIED',
  'CENTERJUSTIFIED',
  'RIGHTJUSTIFIED',
  'FULLYJUSTIFIED',
] as const;

export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];
export type TextKind = 'point' | 'paragraph';

export interface TextStyleOptions {
  tracking?: number;
  leading?: number;
  auto_leading?: boolean;
  kind?: TextKind;
  box_width?: number;
  box_height?: number;
  alignment?: TextAlignment;
  fontName?: string;
  fontSize?: number;
  red?: number;
  green?: number;
  blue?: number;
}

export interface TextRangeStyle {
  from: number;
  to: number;
  fontName?: string;
  fontSize?: number;
  red?: number;
  green?: number;
  blue?: number;
}

const ALIGNMENT_SET = new Set<string>(TEXT_ALIGNMENTS);

function invalid(message: string, suggested_next_tool?: string): PhotoshopErrorEnvelope {
  return {
    ok: false,
    code: 'invalid_arguments',
    message,
    ...(suggested_next_tool ? { suggested_next_tool } : {}),
  };
}

function optionalNumber(
  args: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  integer: boolean
): { value?: number; error?: PhotoshopErrorEnvelope } {
  const raw = args[key];
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return { error: invalid(`${key} must be a finite number`) };
  }
  const value = integer ? Math.round(raw) : raw;
  if (value < min || value > max) {
    return { error: invalid(`${key} must be between ${min} and ${max}`) };
  }
  return { value };
}

function optionalRgb(args: Record<string, unknown>): {
  rgb?: { red: number; green: number; blue: number };
  error?: PhotoshopErrorEnvelope;
} {
  const hasAny = args.red !== undefined || args.green !== undefined || args.blue !== undefined;
  if (!hasAny) return {};
  for (const key of ['red', 'green', 'blue'] as const) {
    if (typeof args[key] !== 'number' || !Number.isFinite(args[key] as number)) {
      return { error: invalid('red, green, and blue must all be 0–255 when setting color') };
    }
  }
  const red = Math.round(args.red as number);
  const green = Math.round(args.green as number);
  const blue = Math.round(args.blue as number);
  if ([red, green, blue].some((n) => n < 0 || n > 255)) {
    return { error: invalid('red, green, and blue must be 0–255') };
  }
  return { rgb: { red, green, blue } };
}

export function parseTextStyleArgs(
  args: Record<string, unknown>,
  options: { requireSome: boolean }
): { style: TextStyleOptions; error?: PhotoshopErrorEnvelope } {
  const style: TextStyleOptions = {};

  const tracking = optionalNumber(args, 'tracking', -1000, 10000, true);
  if (tracking.error) return { style, error: tracking.error };
  if (tracking.value !== undefined) style.tracking = tracking.value;

  const leading = optionalNumber(args, 'leading', 0.1, 10000, false);
  if (leading.error) return { style, error: leading.error };
  if (leading.value !== undefined) style.leading = leading.value;

  if (args.auto_leading !== undefined && args.auto_leading !== null) {
    if (typeof args.auto_leading !== 'boolean') {
      return { style, error: invalid('auto_leading must be a boolean') };
    }
    style.auto_leading = args.auto_leading;
  }

  if (args.kind !== undefined && args.kind !== null) {
    if (args.kind !== 'point' && args.kind !== 'paragraph') {
      return { style, error: invalid('kind must be "point" or "paragraph"') };
    }
    style.kind = args.kind;
  }

  const boxWidth = optionalNumber(args, 'box_width', 1, 100000, true);
  if (boxWidth.error) return { style, error: boxWidth.error };
  if (boxWidth.value !== undefined) style.box_width = boxWidth.value;

  const boxHeight = optionalNumber(args, 'box_height', 1, 100000, true);
  if (boxHeight.error) return { style, error: boxHeight.error };
  if (boxHeight.value !== undefined) style.box_height = boxHeight.value;

  if (style.box_width !== undefined || style.box_height !== undefined) {
    style.kind = style.kind ?? 'paragraph';
  }

  if (args.alignment !== undefined && args.alignment !== null) {
    if (typeof args.alignment !== 'string' || !ALIGNMENT_SET.has(args.alignment)) {
      return { style, error: invalid(`alignment must be one of ${TEXT_ALIGNMENTS.join(', ')}`) };
    }
    style.alignment = args.alignment as TextAlignment;
  }

  if (args.fontName !== undefined && args.fontName !== null) {
    if (typeof args.fontName !== 'string' || !args.fontName.trim()) {
      return { style, error: invalid('fontName must be a non-empty string', 'photoshop_list_fonts') };
    }
    style.fontName = args.fontName.trim();
  }

  const fontSize = optionalNumber(args, 'fontSize', 1, 10000, false);
  if (fontSize.error) return { style, error: fontSize.error };
  if (fontSize.value !== undefined) style.fontSize = fontSize.value;

  const rgb = optionalRgb(args);
  if (rgb.error) return { style, error: rgb.error };
  if (rgb.rgb) {
    style.red = rgb.rgb.red;
    style.green = rgb.rgb.green;
    style.blue = rgb.rgb.blue;
  }

  if (options.requireSome && !hasTextStyle(style)) {
    return {
      style,
      error: invalid(
        'Provide at least one of tracking, leading, auto_leading, kind, box_width, box_height, alignment, fontName, fontSize, or RGB color'
      ),
    };
  }

  return { style };
}

export function hasTextStyle(style: TextStyleOptions): boolean {
  return (
    style.tracking !== undefined ||
    style.leading !== undefined ||
    style.auto_leading !== undefined ||
    style.kind !== undefined ||
    style.box_width !== undefined ||
    style.box_height !== undefined ||
    style.alignment !== undefined ||
    style.fontName !== undefined ||
    style.fontSize !== undefined ||
    style.red !== undefined
  );
}

export function emitTextStyleLiteral(style: TextStyleOptions): string {
  const parts: string[] = [];
  if (style.tracking !== undefined) parts.push(`tracking:${style.tracking}`);
  if (style.leading !== undefined) parts.push(`leading:${style.leading}`);
  if (style.auto_leading !== undefined) parts.push(`auto_leading:${style.auto_leading ? 'true' : 'false'}`);
  if (style.kind) parts.push(`kind:${jsStringLiteral(style.kind)}`);
  if (style.box_width !== undefined) parts.push(`box_width:${style.box_width}`);
  if (style.box_height !== undefined) parts.push(`box_height:${style.box_height}`);
  if (style.alignment) parts.push(`alignment:${jsStringLiteral(style.alignment)}`);
  if (style.fontName) parts.push(`font:${jsStringLiteral(style.fontName)}`);
  if (style.fontSize !== undefined) parts.push(`size:${style.fontSize}`);
  if (style.red !== undefined) {
    parts.push(`red:${style.red}`, `green:${style.green}`, `blue:${style.blue}`);
  }
  return `{${parts.join(',')}}`;
}

export function parseTextRangesArg(
  args: Record<string, unknown>
): { ranges: TextRangeStyle[]; error?: PhotoshopErrorEnvelope } {
  const raw = args.ranges;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ranges: [], error: invalid('ranges must be a non-empty array') };
  }
  if (raw.length > 64) {
    return { ranges: [], error: invalid('ranges supports at most 64 spans') };
  }

  const ranges: TextRangeStyle[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ranges: [], error: invalid(`ranges[${i}] must be an object`) };
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.from !== 'number' || !Number.isFinite(rec.from) || typeof rec.to !== 'number' || !Number.isFinite(rec.to)) {
      return { ranges: [], error: invalid(`ranges[${i}] needs numeric from/to (from inclusive, to exclusive)`) };
    }
    const from = Math.trunc(rec.from);
    const to = Math.trunc(rec.to);
    if (from < 0 || to <= from) {
      return { ranges: [], error: invalid(`ranges[${i}] from must be >= 0 and to must be > from`) };
    }

    const range: TextRangeStyle = { from, to };
    if (rec.fontName !== undefined && rec.fontName !== null) {
      if (typeof rec.fontName !== 'string' || !rec.fontName.trim()) {
        return { ranges: [], error: invalid(`ranges[${i}].fontName must be a non-empty string`, 'photoshop_list_fonts') };
      }
      range.fontName = rec.fontName.trim();
    }
    if (rec.fontSize !== undefined && rec.fontSize !== null) {
      if (typeof rec.fontSize !== 'number' || !Number.isFinite(rec.fontSize) || rec.fontSize < 1) {
        return { ranges: [], error: invalid(`ranges[${i}].fontSize must be >= 1`) };
      }
      range.fontSize = rec.fontSize;
    }
    const rgb = optionalRgb(rec);
    if (rgb.error) return { ranges: [], error: rgb.error };
    if (rgb.rgb) {
      range.red = rgb.rgb.red;
      range.green = rgb.rgb.green;
      range.blue = rgb.rgb.blue;
    }
    if (!range.fontName && range.fontSize === undefined && range.red === undefined) {
      return {
        ranges: [],
        error: invalid(`ranges[${i}] needs fontName, fontSize, and/or RGB color`),
      };
    }
    ranges.push(range);
  }

  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].from < sorted[i - 1].to) {
      return { ranges: [], error: invalid('ranges must not overlap') };
    }
  }
  return { ranges: sorted };
}

export function emitTextRangesLiteral(ranges: TextRangeStyle[]): string {
  const items = ranges.map((range) => {
    const parts = [`from:${range.from}`, `to:${range.to}`];
    if (range.fontName) parts.push(`font:${jsStringLiteral(range.fontName)}`);
    if (range.fontSize !== undefined) parts.push(`size:${range.fontSize}`);
    if (range.red !== undefined) {
      parts.push(`red:${range.red}`, `green:${range.green}`, `blue:${range.blue}`);
    }
    return `{${parts.join(',')}}`;
  });
  return `[${items.join(',')}]`;
}
