import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildPhotoshopInstructions } from '../src/prompts/instructions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('plugin skills vs server instructions', () => {
  const instructions = buildPhotoshopInstructions();
  const recipes = readFileSync(join(root, 'skills/photoshop-recipes/SKILL.md'), 'utf8');
  const removeBackground = readFileSync(
    join(root, 'skills/photoshop-remove-background/SKILL.md'),
    'utf8'
  );

  it('keeps the session contract in instructions', () => {
    expect(instructions).toContain('FEEDBACK_NUDGE');
    expect(instructions).toContain('UPDATE_AVAILABLE');
    expect(instructions).toContain('photoshop_rasterize_layer');
    expect(instructions).toContain('photoshop_recipe_remove_background');
  });

  it('does not keep the glossary dump in instructions', () => {
    expect(instructions).not.toContain('User intent glossary');
    expect(instructions).not.toContain('Degrade paths');
    expect(instructions).not.toContain('ps.gradient_blend');
    expect(instructions).not.toContain('photoshop_recipe_gradient_fade');
  });

  it('puts routing detail in the recipes skill', () => {
    expect(recipes).toContain('User intent glossary');
    expect(recipes).toContain('Degrade paths');
    expect(recipes).toContain('Instagram');
    expect(recipes).toContain('vesikalık');
    expect(recipes).toContain('ps.generative_fill');
  });

  it('repeats the remove-background stop rule in its skill', () => {
    expect(removeBackground).toContain('Then STOP');
    expect(removeBackground).toContain('photoshop_rasterize_layer');
    expect(removeBackground).toContain('arka planı sil');
  });
});
