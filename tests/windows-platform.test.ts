import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WindowsExecutor } from '../src/platform/windows-executor.js';

describe('WindowsExecutor queue timeout semantics', () => {
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

  function makeExecutor(impl: (script: string, timeout: number) => Promise<unknown>) {
    const executor = new WindowsExecutor();
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
    shortPromise.catch(() => {});

    await vi.advanceTimersByTimeAsync(61_000);
    await expect(shortPromise).rejects.toThrow(/waiting in the execution queue/);

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

    await vi.advanceTimersByTimeAsync(30_000);
    expect(shortSettled).toBe(false);

    long.resolve('long-done');
    await expect(longPromise).resolves.toBe('long-done');
    await expect(shortPromise).resolves.toBe('short-done');
    expect(executed).toEqual(['long', 'short']);
  });
});
