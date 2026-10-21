import { exec } from 'child_process';
import { access } from 'fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../src/utils/logger.js';
import { WindowsDetector, compareVersions } from '../src/platform/windows-detector.js';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, exec: vi.fn() };
});

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, access: vi.fn() };
});

type ExecCallback = (error: Error | null, result?: { stdout: string; stderr: string }) => void;

const execMock = exec as unknown as ReturnType<typeof vi.fn>;
const accessMock = access as unknown as ReturnType<typeof vi.fn>;

const POWERSHELL = 'Get-Process -Name Photoshop';
const HKLM = 'reg query "HKLM\\SOFTWARE\\Adobe\\Photoshop" /s';

/** `reg query /s` output: one key per version, ApplicationPath with a trailing backslash. */
function registryOutput(entries: Array<[version: string, dir: string]>): string {
  return entries
    .map(
      ([version, dir]) =>
        `HKEY_LOCAL_MACHINE\\SOFTWARE\\Adobe\\Photoshop\\${version}\r\n` +
        `    ApplicationPath    REG_SZ    ${dir}\\\r\n`
    )
    .join('\r\n');
}

/**
 * Fake the shell and the file system. `commands` maps a substring of the
 * command to its stdout (or an Error); anything else fails like a missing
 * registry key. Only `existing` paths pass access().
 */
function fakeSystem(existing: string[], commands: Record<string, string | Error> = {}) {
  execMock.mockImplementation(
    (command: string, optionsOrCallback: unknown, maybeCallback?: ExecCallback) => {
      const callback = (
        typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback
      ) as ExecCallback;
      const key = Object.keys(commands).find((k) => command.includes(k));
      const outcome = key === undefined ? new Error(`not mocked: ${command}`) : commands[key];
      if (outcome instanceof Error) callback(outcome);
      else callback(null, { stdout: outcome, stderr: '' });
    }
  );
  accessMock.mockImplementation(async (path: string) => {
    if (!existing.includes(path)) {
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
    }
  });
}

const execCommands = () => execMock.mock.calls.map(([command]) => command as string);

describe('compareVersions', () => {
  it('compares dotted versions numerically', () => {
    expect(compareVersions('270.0', '90.0')).toBeGreaterThan(0);
    expect(compareVersions('9.0', '27.0')).toBeLessThan(0);
    expect(compareVersions('26.11', '26.2')).toBeGreaterThan(0);
    expect(compareVersions('27.0', '27')).toBe(0);
  });
});

describe('WindowsDetector', () => {
  let savedPath: string | undefined;
  let savedProgramFiles: string | undefined;
  let savedProgramFilesX86: string | undefined;

  beforeEach(() => {
    savedPath = process.env.PHOTOSHOP_PATH;
    savedProgramFiles = process.env.ProgramFiles;
    savedProgramFilesX86 = process.env['ProgramFiles(x86)'];
    delete process.env.PHOTOSHOP_PATH;
    process.env.ProgramFiles = 'C:\\Program Files';
    process.env['ProgramFiles(x86)'] = 'C:\\Program Files (x86)';
  });

  afterEach(() => {
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore('PHOTOSHOP_PATH', savedPath);
    restore('ProgramFiles', savedProgramFiles);
    restore('ProgramFiles(x86)', savedProgramFilesX86);
    execMock.mockReset();
    accessMock.mockReset();
    vi.restoreAllMocks();
  });

  it('uses the running Photoshop.exe before the registry, wherever it is installed', async () => {
    const running = 'D:\\Apps\\Adobe Photoshop 2026\\Photoshop.exe';
    fakeSystem([running, 'C:\\Program Files\\Adobe\\Adobe Photoshop CS6 (64 Bit)\\Photoshop.exe'], {
      [POWERSHELL]: `${running}\r\n`,
      [HKLM]: registryOutput([['60.0', 'C:\\Program Files\\Adobe\\Adobe Photoshop CS6 (64 Bit)']]),
    });

    const info = await new WindowsDetector().detect();

    expect(info.path).toBe(running);
    expect(info.version).toBe('2026');
    expect(execCommands().some((c) => c.startsWith('reg query'))).toBe(false);
  });

  it('tries registry entries newest first by number and skips ones whose files are gone', async () => {
    const live = 'E:\\Adobe\\Adobe Photoshop 2025';
    fakeSystem(
      [`${live}\\Photoshop.exe`, 'C:\\Program Files\\Adobe\\Adobe Photoshop CS6 (64 Bit)\\Photoshop.exe'],
      {
        [POWERSHELL]: '',
        [HKLM]: registryOutput([
          ['60.0', 'C:\\Program Files\\Adobe\\Adobe Photoshop CS6 (64 Bit)'],
          ['270.0', 'C:\\Program Files\\Adobe\\Adobe Photoshop 2026'],
          ['260.0', live],
        ]),
      }
    );

    const info = await new WindowsDetector().detect();

    expect(info.path).toBe(`${live}\\Photoshop.exe`);
  });

  it('merges both registry views before picking the newest', async () => {
    const wow = 'F:\\Adobe Photoshop 2026';
    fakeSystem([`${wow}\\Photoshop.exe`, 'C:\\Old\\Photoshop.exe'], {
      [POWERSHELL]: '',
      [HKLM]: registryOutput([['250.0', 'C:\\Old']]),
      'WOW6432Node\\Adobe\\Photoshop': registryOutput([['270.0', wow]]),
    });

    expect((await new WindowsDetector().detect()).path).toBe(`${wow}\\Photoshop.exe`);
  });

  it('falls back to the registry when PowerShell fails', async () => {
    const live = 'E:\\Adobe\\Adobe Photoshop 2025';
    fakeSystem([`${live}\\Photoshop.exe`], {
      [POWERSHELL]: new Error('powershell is not recognized'),
      [HKLM]: registryOutput([['260.0', live]]),
    });

    expect((await new WindowsDetector().detect()).path).toBe(`${live}\\Photoshop.exe`);
  });

  it("finds next year's release in Program Files without a code change", async () => {
    const nextYear = new Date().getFullYear() + 1;
    const exe = `C:\\Program Files\\Adobe\\Adobe Photoshop ${nextYear}\\Photoshop.exe`;
    fakeSystem([exe], { [POWERSHELL]: '' });

    expect((await new WindowsDetector().detect()).path).toBe(exe);
  });

  it('still covers the oldest supported year', () => {
    const paths = (new WindowsDetector() as unknown as { getCommonPaths(): string[] })
      .getCommonPaths();
    expect(paths).toContain('C:\\Program Files\\Adobe\\Adobe Photoshop CC 2012\\Photoshop.exe');
  });

  it('warns when PHOTOSHOP_PATH does not point at Photoshop, then keeps looking', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    const running = 'D:\\Apps\\Adobe Photoshop 2026\\Photoshop.exe';
    process.env.PHOTOSHOP_PATH = 'Z:\\Missing\\Photoshop.exe';
    fakeSystem([running], { [POWERSHELL]: running });

    expect((await new WindowsDetector().detect()).path).toBe(running);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('PHOTOSHOP_PATH'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Z:\\Missing\\Photoshop.exe'));
  });

  it('still reports not found when nothing matches', async () => {
    fakeSystem([], { [POWERSHELL]: '' });
    await expect(new WindowsDetector().detect()).rejects.toThrow(
      'Photoshop not found on this system'
    );
  });
});
