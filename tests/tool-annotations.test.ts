import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TOOL_ANNOTATIONS, withToolAnnotations } from '../src/core/tool-annotations.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../src');

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTs(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

function descriptionsIn(source: string): Map<string, string> {
  const found = new Map<string, string>();
  const constants = [...source.matchAll(/const TOOL_NAME = '(photoshop_[a-z0-9_]+)'/g)].map(
    (match) => match[1],
  );
  let constantIndex = 0;
  const named = /name:\s*(?:'(photoshop_[a-z0-9_]+)'|TOOL_NAME)\s*,\s*description:\s*/g;
  for (const match of source.matchAll(named)) {
    const name = match[1] ?? constants[constantIndex++];
    if (!name || match.index === undefined) continue;
    const start = match.index + match[0].length;
    const end = source.indexOf('inputSchema', start);
    const slice = source.slice(start, end === -1 ? start + 2000 : end);
    const parts = [...slice.matchAll(/'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)"/g)].map((part) =>
      (part[1] ?? part[2]).replace(/\\n/g, '\n').replace(/\\'/g, "'"),
    );
    if (parts.length === 0) continue;
    found.set(name, parts.join(''));
  }
  return found;
}

function toolDescriptions(): Map<string, string> {
  const found = new Map<string, string>();
  for (const file of walkTs(join(SRC, 'tools')).concat(join(SRC, 'core/server.ts'))) {
    for (const [name, description] of descriptionsIn(readFileSync(file, 'utf8'))) {
      found.set(name, description);
    }
  }
  return found;
}

describe('tool annotations', () => {
  const descriptions = toolDescriptions();

  it('covers every registered tool and nothing else', () => {
    const names = [...descriptions.keys()].sort();
    const annotated = Object.keys(TOOL_ANNOTATIONS).sort();
    expect(annotated).toEqual(names);
    expect(names).toHaveLength(128);
  });

  it('keeps read-only tools non-destructive', () => {
    for (const [name, flags] of Object.entries(TOOL_ANNOTATIONS)) {
      if (flags.readOnlyHint) {
        expect(flags.destructiveHint, name).toBe(false);
        expect(flags.openWorldHint, name).toBe(false);
      }
    }
  });

  it('does not contradict side-effect sentences', () => {
    for (const [name, description] of descriptions) {
      const flags = TOOL_ANNOTATIONS[name];
      if (description.includes('Side effects: none')) {
        expect(flags.readOnlyHint, name).toBe(true);
        expect(flags.destructiveHint, name).toBe(false);
      }
      if (
        /no pixels destroyed|source document is unchanged|source unchanged|source files are never modified|without changing the open document|Does not change pixels|original layer untouched/i.test(
          description,
        )
      ) {
        expect(flags.destructiveHint, name).toBe(false);
      }
      if (/not idempotent|a second call/i.test(description)) {
        expect(flags.idempotentHint, name).toBe(false);
      }
      if (/\bidempotent\b/i.test(description) && !/not idempotent/i.test(description)) {
        expect(flags.idempotentHint, name).toBe(true);
      }
    }
  });

  it('gives the weak tools an explicit alternative', () => {
    const weak = [
      'photoshop_undo',
      'photoshop_get_history',
      'photoshop_get_document_info',
      'photoshop_flatten_image',
      'photoshop_play_action',
      'photoshop_apply_sharpen',
      'photoshop_adjust_hue_saturation',
      'photoshop_set_layer_locked',
      'photoshop_set_text_alignment',
      'photoshop_move_layer_to_position',
      'photoshop_adjust_brightness_contrast',
      'photoshop_apply_layer_mask',
      'photoshop_apply_motion_blur',
      'photoshop_apply_noise',
      'photoshop_auto_contrast',
      'photoshop_auto_levels',
      'photoshop_crop_document',
      'photoshop_delete_layer',
      'photoshop_deselect',
      'photoshop_fill_layer',
      'photoshop_fit_layer_to_document',
      'photoshop_invert_selection',
      'photoshop_merge_visible_layers',
      'photoshop_rename_layer',
      'photoshop_resize_image',
      'photoshop_rotate_layer',
      'photoshop_scale_layer',
      'photoshop_select_all',
      'photoshop_set_layer_opacity',
      'photoshop_set_text_color',
      'photoshop_update_text_content',
    ];
    expect(weak).toHaveLength(31);
    for (const name of weak) {
      const description = descriptions.get(name);
      expect(description, name).toBeTruthy();
      expect(description, name).toContain('Use when:');
      expect(description, name).toMatch(/Do NOT use when:/);
    }
  });

  it('attaches annotations onto the tool object', () => {
    const tool = withToolAnnotations({
      name: 'photoshop_get_history',
      description: 'x',
      inputSchema: { type: 'object', properties: {} },
    });
    expect(tool.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });
});
