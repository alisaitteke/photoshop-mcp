import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MacOSExecutor, escapeForPgrep } from '../src/platform/macos-executor.js';
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
  const wrapperFor = (executor: MacOSExecutor) =>
    (executor as unknown as { createAppleScriptWrapper(p: string): string }).createAppleScriptWrapper(
      '/tmp/test.jsx'
    );

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
