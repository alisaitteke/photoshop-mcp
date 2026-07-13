import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MacOSExecutor,
  appleScriptTimeoutSeconds,
  escapeForPgrep,
  killTimeoutMs,
} from '../src/platform/macos-executor.js';
import { MacOSDetector } from '../src/platform/macos-detector.js';

let savedActivate: string | undefined;

beforeEach(() => {
  savedActivate = process.env.PHOTOSHOP_ACTIVATE;
  delete process.env.PHOTOSHOP_ACTIVATE;
});

afterEach(() => {
  if (savedActivate === undefined) delete process.env.PHOTOSHOP_ACTIVATE;
  else process.env.PHOTOSHOP_ACTIVATE = savedActivate;
});

describe('escapeForPgrep', () => {
  it('escapes regex metacharacters so Beta app names match literally', () => {
    expect(escapeForPgrep('Adobe Photoshop (Beta)')).toBe('Adobe Photoshop \\(Beta\\)');
  });

  it('leaves plain names untouched', () => {
    expect(escapeForPgrep('Adobe Photoshop 2026')).toBe('Adobe Photoshop 2026');
  });
});

describe('AppleScript wrapper focus behavior', () => {
  // createAppleScriptWrapper is private; reach in deliberately — the wrapper
  // text is the contract that decides whether every tool call steals focus.
  const wrapperFor = (executor: MacOSExecutor, timeoutMs?: number) =>
    (
      executor as unknown as { createAppleScriptWrapper(p: string, t?: number): string }
    ).createAppleScriptWrapper('/tmp/test.jsx', timeoutMs);

  it('does not activate (steal focus) by default', () => {
    const executor = new MacOSExecutor();
    executor.setAppName('Adobe Photoshop 2026');
    const script = wrapperFor(executor);
    expect(script).not.toContain('activate');
    expect(script).toContain('tell application "Adobe Photoshop 2026"');
    expect(script).toContain('do javascript');
  });

  it('activates when PHOTOSHOP_ACTIVATE is truthy', () => {
    process.env.PHOTOSHOP_ACTIVATE = '1';
    const executor = new MacOSExecutor();
    executor.setAppName('Adobe Photoshop 2026');
    expect(wrapperFor(executor)).toContain('activate');
  });
});

describe('AppleScript wrapper timeout block', () => {
  // Without `with timeout of N seconds`, AppleScript's default ~120s
  // Apple-event reply timeout silently caps every `do javascript` call —
  // batch tools advertising 600s would die at ~120s.
  const wrapperFor = (timeoutMs?: number) => {
    const executor = new MacOSExecutor();
    return (
      executor as unknown as { createAppleScriptWrapper(p: string, t?: number): string }
    ).createAppleScriptWrapper('/tmp/test.jsx', timeoutMs);
  };

  it('scales the timeout block to the per-call timeout (600s batch case)', () => {
    const script = wrapperFor(600_000);
    expect(script).toContain(`with timeout of ${appleScriptTimeoutSeconds(600_000)} seconds`);
    expect(script).toContain('end timeout');
    expect(appleScriptTimeoutSeconds(600_000)).toBeGreaterThan(600);
  });

  it('places the timeout block inside the tell block, around do javascript', () => {
    const script = wrapperFor(30_000);
    const tell = script.indexOf('tell application');
    const withTimeout = script.indexOf('with timeout of');
    const doJs = script.indexOf('do javascript');
    const endTimeout = script.indexOf('end timeout');
    const endTell = script.indexOf('end tell');
    expect(tell).toBeGreaterThanOrEqual(0);
    expect(withTimeout).toBeGreaterThan(tell);
    expect(doJs).toBeGreaterThan(withTimeout);
    expect(endTimeout).toBeGreaterThan(doJs);
    expect(endTell).toBeGreaterThan(endTimeout);
  });

  it('defaults to the 30s tool timeout when none is passed', () => {
    expect(wrapperFor()).toContain(`with timeout of ${appleScriptTimeoutSeconds(30_000)} seconds`);
  });

  it('keeps the AppleScript timeout strictly below the Node SIGKILL bound', () => {
    for (const timeoutMs of [1_000, 30_000, 120_000, 600_000]) {
      expect(killTimeoutMs(timeoutMs)).toBeGreaterThan(appleScriptTimeoutSeconds(timeoutMs) * 1000);
      // and the AppleScript timeout covers at least the advertised tool timeout
      expect(appleScriptTimeoutSeconds(timeoutMs) * 1000).toBeGreaterThanOrEqual(timeoutMs);
    }
  });
});

describe('execute() queue timeout semantics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  /** Executor with the private executeScript stubbed: records every script
   * that actually runs, so tests can assert cancelled tasks never execute. */
  function makeExecutor(impl: (script: string, timeout: number) => Promise<unknown>) {
    const executor = new MacOSExecutor();
    const executed: string[] = [];
    (
      executor as unknown as { executeScript(s: string, t: number): Promise<unknown> }
    ).executeScript = (script: string, timeout: number) => {
      executed.push(script);
      return impl(script, timeout);
    };
    return { executor, executed };
  }

  it('a task that times out while queued is rejected AND never executes', async () => {
    const long = deferred<string>();
    const { executor, executed } = makeExecutor((script) =>
      script === 'long' ? long.promise : Promise.resolve('short-done')
    );

    const longPromise = executor.execute('long', 200_000);
    const shortPromise = executor.execute('short', 1_000);
    shortPromise.catch(() => {}); // observed below; avoid unhandled rejection

    // short's queue-wait allowance is timeout + 60s; blow past it while long
    // still occupies the serial queue.
    await vi.advanceTimersByTimeAsync(61_000);
    await expect(shortPromise).rejects.toThrow(/waiting in the execution queue/);

    // long finishes; the queue drains — the cancelled short task must be
    // skipped, not executed with dead resolve/reject.
    long.resolve('long-done');
    await expect(longPromise).resolves.toBe('long-done');
    await vi.advanceTimersByTimeAsync(0);

    expect(executed).toEqual(['long']);
  });

  it('the execution timer starts at dequeue, so queue wait does not eat run time', async () => {
    const long = deferred<string>();
    const { executor, executed } = makeExecutor((script) =>
      script === 'long' ? long.promise : Promise.resolve('short-done')
    );

    const longPromise = executor.execute('long', 200_000);
    const shortPromise = executor.execute('short', 5_000);

    let shortSettled = false;
    shortPromise.then(
      () => {
        shortSettled = true;
      },
      () => {
        shortSettled = true;
      }
    );

    // 30s in the queue: far beyond short's 5s execution timeout, within its
    // wait allowance. Under the old enqueue-time timer this already rejected.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(shortSettled).toBe(false);

    long.resolve('long-done');
    await expect(longPromise).resolves.toBe('long-done');
    await expect(shortPromise).resolves.toBe('short-done');
    expect(executed).toEqual(['long', 'short']);
  });

  it('a running script that overruns its timeout still rejects', async () => {
    const hang = deferred<string>();
    const { executor } = makeExecutor(() => hang.promise);

    const promise = executor.execute('hang', 1_000);
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(promise).rejects.toThrow('Script execution timeout');

    hang.resolve('too-late');
    await vi.advanceTimersByTimeAsync(0);
  });

  it('resolves normally well past 120s, proving long batch timeouts are honored', async () => {
    const batch = deferred<string>();
    const { executor } = makeExecutor(() => batch.promise);

    const promise = executor.execute('batch', 600_000);

    // 500s of execution — over 4x AppleScript's old default cap.
    await vi.advanceTimersByTimeAsync(500_000);
    batch.resolve('batch-done');
    await expect(promise).resolves.toBe('batch-done');
  });
});

describe('detector fallback paths', () => {
  const pathsFor = () =>
    (new MacOSDetector() as unknown as { getCommonPaths(): string[] }).getCommonPaths();

  it('covers the current-year+1 release (2026 installs today) without a code change', () => {
    const nextYear = new Date().getFullYear() + 1;
    const paths = pathsFor();
    expect(paths).toContain(`/Applications/Adobe Photoshop ${nextYear}/Adobe Photoshop ${nextYear}.app`);
    expect(paths).toContain('/Applications/Adobe Photoshop 2026/Adobe Photoshop 2026.app');
  });

  it('includes the Beta install location', () => {
    expect(pathsFor()).toContain('/Applications/Adobe Photoshop (Beta)/Adobe Photoshop (Beta).app');
  });

  it('still covers the oldest supported year', () => {
    expect(pathsFor()).toContain('/Applications/Adobe Photoshop CC 2012/Adobe Photoshop CC 2012.app');
  });
});
