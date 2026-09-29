import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../src/utils/logger.js';

describe('Logger argument formatting', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Ambient LOG_LEVEL (e.g. LOG_LEVEL=3) must not suppress the writes
    // these assertions inspect.
    delete process.env.LOG_LEVEL;
    writeSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  function lastLine(): string {
    const calls = writeSpy.mock.calls as unknown as Array<[string]>;
    return calls[calls.length - 1][0];
  }

  it('renders Error arguments as their message, not {}', () => {
    // Regression test for issue #57's empty log lines:
    // "Script execution failed: {}"
    const logger = new Logger('TestContext');
    logger.error('Script execution failed:', new Error('cscript exited with code 1'));
    const line = lastLine();
    expect(line).toContain('Script execution failed: cscript exited with code 1');
    expect(line).not.toContain('{}');
  });

  it('still renders plain objects as JSON', () => {
    const logger = new Logger('TestContext');
    logger.info('state:', { pending: 2 });
    expect(lastLine()).toContain('{"pending":2}');
  });

  it('renders strings and numbers unchanged', () => {
    const logger = new Logger('TestContext');
    logger.warn('port', 38452, 'refused');
    expect(lastLine()).toContain('port 38452 refused');
  });
});
