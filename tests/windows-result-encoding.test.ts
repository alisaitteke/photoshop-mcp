import { exec } from 'child_process';
import { writeFileSync } from 'fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WINDOWS_JSX_ENV,
  WINDOWS_RESULT_ENV,
  buildWindowsBridgeScript,
  decodeWindowsResultFile,
} from '../src/platform/windows-script-bridge.js';
import { WindowsExecutor } from '../src/platform/windows-executor.js';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, exec: vi.fn() };
});

type ExecCallback = (
  error: (Error & { killed?: boolean; signal?: string }) | null,
  result?: { stdout: string; stderr: string }
) => void;

type ExecMock = (
  command: string,
  options: { env: NodeJS.ProcessEnv },
  callback: ExecCallback
) => void;

const execMock = exec as unknown as ReturnType<typeof vi.fn> & ExecMock;

function utf16File(text: string): Buffer {
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
}

type ScriptRunner = {
  executeScript(script: string, timeout: number): Promise<unknown>;
};

describe('Windows cscript bridge encoding', () => {
  it('keeps the VBS wrapper ASCII and off stdout', () => {
    const script = buildWindowsBridgeScript();

    expect(script).toMatch(/^[\r\n\t\x20-\x7e]*$/);
    expect(script).toContain(`Environment("PROCESS")("${WINDOWS_JSX_ENV}")`);
    expect(script).toContain(`Environment("PROCESS")("${WINDOWS_RESULT_ENV}")`);
    expect(script).toContain('CreateTextFile(outFile, True, True)');
    expect(script).toContain('Err.Clear');
    expect(script).toContain('Replace(jsxPath, "\\", "\\\\")');
    expect(script).toContain('Replace(jsxForJs, "\'", "\\\'")');
    expect(script).not.toContain('WScript.Echo result');
  });

  it('round-trips characters that GBK mis-decodes as plausible UTF-8', () => {
    const text = '测试预.psd 😀';
    expect(decodeWindowsResultFile(utf16File(text))).toBe(text);
  });

  it('rejects a result that is not UTF-16', () => {
    const gbkMojibake = Buffer.from([0xb2, 0xe2, 0xca, 0xd4]);
    expect(() => decodeWindowsResultFile(gbkMojibake)).toThrow(/UTF-16/);
  });
});

describe('WindowsExecutor reads the UTF-16 result file', () => {
  afterEach(() => {
    execMock.mockReset();
  });

  function runner(): ScriptRunner['executeScript'] {
    const executor = new WindowsExecutor();
    return (executor as unknown as ScriptRunner).executeScript.bind(executor);
  }

  it('returns CJK text from the result file instead of stdout', async () => {
    execMock.mockImplementation((_command, options, callback) => {
      expect(options.env[WINDOWS_JSX_ENV]).toMatch(/\.jsx$/);
      expect(options.env[WINDOWS_RESULT_ENV]).toMatch(/\.txt$/);
      const payload = '{"document":{"name":"测试预.psd"}}';
      writeFileSync(options.env[WINDOWS_RESULT_ENV] as string, utf16File(payload));
      callback(null, { stdout: '���Ԥ��.psd', stderr: '' });
    });

    await expect(runner()('app.activeDocument.name', 5_000)).resolves.toEqual({
      document: { name: '测试预.psd' },
    });
  });

  it('reads a localized Photoshop error after cscript exits non-zero', async () => {
    execMock.mockImplementation((_command, options, callback) => {
      writeFileSync(
        options.env[WINDOWS_RESULT_ENV] as string,
        utf16File('ERROR: 图层不存在')
      );
      const error = Object.assign(new Error('Command failed: cscript'), { code: 1 });
      callback(error);
    });

    await expect(runner()('bad()', 5_000)).rejects.toThrow('图层不存在');
  });

  it('does not treat a killed cscript as a successful result', async () => {
    execMock.mockImplementation((_command, options, callback) => {
      writeFileSync(
        options.env[WINDOWS_RESULT_ENV] as string,
        utf16File('{"ok":true}')
      );
      const error = Object.assign(new Error('Command failed: cscript'), {
        killed: true,
        signal: 'SIGKILL',
      });
      callback(error);
    });

    await expect(runner()('slow()', 5_000)).rejects.toThrow('Script execution timeout');
  });

  it('fails when cscript exits without writing a result file', async () => {
    execMock.mockImplementation((_command, _options, callback) => {
      callback(null, { stdout: '', stderr: '' });
    });

    await expect(runner()('app.version', 5_000)).rejects.toThrow(
      'Photoshop script produced no result'
    );
  });
});
