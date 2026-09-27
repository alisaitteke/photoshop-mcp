import { describe, expect, it } from 'vitest';
import { sanitizeAnalyticsProperties } from '../src/analytics/events.js';
import { summarizePromptBatch } from '../src/analytics/mcp-session.js';

const CATALOG_SIZE = 23;

function catalogCounts(extraOfFirst = 0): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < CATALOG_SIZE; i += 1) {
    counts.set(`ps.prompt_${i}`, 1);
  }
  if (extraOfFirst > 0) {
    counts.set('ps.prompt_0', 1 + extraOfFirst);
  }
  return counts;
}

describe('summarizePromptBatch', () => {
  it('marks a full catalog of 23 distinct gets', () => {
    const summary = summarizePromptBatch(catalogCounts(), CATALOG_SIZE);
    expect(summary.full_catalog).toBe(true);
    expect(summary.prompts_requested_count).toBe(23);
    expect(summary.unique_prompts_count).toBe(23);
    expect(summary.catalog_size).toBe(23);
    expect(summary.repeat).toBe(1);
    expect(summary.prompts_used).toHaveLength(23);
  });

  it('keeps full_catalog when one name is fetched again in the same burst', () => {
    const summary = summarizePromptBatch(catalogCounts(1), CATALOG_SIZE);
    expect(summary.prompts_requested_count).toBe(24);
    expect(summary.unique_prompts_count).toBe(23);
    expect(summary.full_catalog).toBe(true);
    expect(summary.repeat).toBe(24 / 23);
    expect(summary.prompt_usage_summary.startsWith('ps.prompt_0:2')).toBe(true);
  });

  it('does not mark a partial burst as the full catalog', () => {
    const counts = new Map<string, number>([['ps.remove_background', 1]]);
    const summary = summarizePromptBatch(counts, CATALOG_SIZE);
    expect(summary.full_catalog).toBe(false);
    expect(summary.repeat).toBe(1);
  });
});

describe('prompt batch analytics allowlist', () => {
  it('keeps batch keys and drops prompt body text', () => {
    expect(
      sanitizeAnalyticsProperties({
        prompts_requested_count: 24,
        unique_prompts_count: 23,
        prompt_usage_summary: 'ps.remove_background:2',
        prompts_used: ['ps.remove_background'],
        full_catalog: true,
        catalog_size: 23,
        repeat: 24 / 23,
        batch_flush_reason: 'debounce',
        event_source: 'mcp',
        prompt: 'secret chat',
        prompt_name: 'ps.remove_background',
      })
    ).toEqual({
      prompts_requested_count: 24,
      unique_prompts_count: 23,
      prompt_usage_summary: 'ps.remove_background:2',
      prompts_used: ['ps.remove_background'],
      full_catalog: true,
      catalog_size: 23,
      repeat: 24 / 23,
      batch_flush_reason: 'debounce',
      event_source: 'mcp',
      prompt_name: 'ps.remove_background',
    });
  });
});
