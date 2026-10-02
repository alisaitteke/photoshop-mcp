import { describe, expect, it } from 'vitest';
import {
  captureMcpPageleave,
  captureMcpPageview,
  startLogicalMcpAnalyticsSession,
} from '../src/analytics/mcp-session.js';

describe('MCP session virtual page events', () => {
  it('exports pageview helpers from mcp-session (no standalone pageview module)', () => {
    expect(typeof captureMcpPageview).toBe('function');
    expect(typeof captureMcpPageleave).toBe('function');
    expect(typeof startLogicalMcpAnalyticsSession).toBe('function');
  });

  it('is a no-op when analytics are disabled', () => {
    const previous = process.env.ANALYTICS_DISABLED;
    process.env.ANALYTICS_DISABLED = '1';
    try {
      expect(() => captureMcpPageview()).not.toThrow();
      expect(() => captureMcpPageleave(12, 'sigint')).not.toThrow();
    } finally {
      if (previous === undefined) delete process.env.ANALYTICS_DISABLED;
      else process.env.ANALYTICS_DISABLED = previous;
    }
  });
});
