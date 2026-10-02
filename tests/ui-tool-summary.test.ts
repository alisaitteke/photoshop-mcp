import { describe, expect, it } from 'vitest';
import { describeToolCall, formatDuration } from '../web/src/lib/tool-summary.js';

describe('describeToolCall', () => {
  it('summarises a fill with a swatch', () => {
    expect(describeToolCall('mcp__photoshop__photoshop_fill_layer', { red: 50, green: 50, blue: 50 })).toEqual({
      title: 'Fill layer',
      params: ['rgb 50,50,50'],
      swatch: 'rgb(50 50 50)',
    });
  });

  it('shows size, blend mode and opacity', () => {
    expect(describeToolCall('photoshop_create_document', { width: 1200, height: 800, name: 'Poster' }).params).toEqual([
      '1200 × 800',
      '“Poster”',
    ]);
    expect(describeToolCall('photoshop_set_layer_blend_mode', { blendMode: 'SCREEN' }).params).toEqual(['Screen']);
    expect(describeToolCall('photoshop_set_layer_opacity', { opacity: 85 }).params).toEqual(['opacity 85%']);
  });

  it('labels recipes and grouped actions', () => {
    expect(describeToolCall('photoshop_recipe_remove_background', {}).title).toBe('Recipe: remove background');
    expect(describeToolCall('photoshop_manage_layer', { action: 'create', name: 'Sun' })).toMatchObject({
      title: 'Manage layer › create',
      params: ['“Sun”'],
    });
  });

  it('caps the number of params', () => {
    const many = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };
    expect(describeToolCall('photoshop_x', many).params).toHaveLength(4);
  });
});

describe('formatDuration', () => {
  it('formats ms and seconds', () => {
    expect(formatDuration(84)).toBe('84 ms');
    expect(formatDuration(1234)).toBe('1.2 s');
    expect(formatDuration(undefined)).toBeNull();
  });
});
