import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { ExtendScriptSnippets } from '../src/api/extendscript.js';
import { readFontFaceInfo } from '../src/platform/font-file.js';
import { installUserFont, windowsFontRegistryValueName } from '../src/platform/install-font.js';
import { classifyError } from '../src/errors/envelope.js';

function utf16be(text: string): Buffer {
  const out = Buffer.alloc(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    out.writeUInt16BE(text.charCodeAt(i), i * 2);
  }
  return out;
}

/** Minimal TrueType font with a name table. Enough for the installer to accept it. */
function buildNameOnlyFont(records: Array<{ id: number; text: string }>): Buffer {
  const strings = records.map((record) => utf16be(record.text));
  const stringBytes = Buffer.concat(strings);
  const stringOffset = 6 + records.length * 12;
  const name = Buffer.alloc(stringOffset + stringBytes.length);
  name.writeUInt16BE(0, 0);
  name.writeUInt16BE(records.length, 2);
  name.writeUInt16BE(stringOffset, 4);
  let cursor = 0;
  records.forEach((record, index) => {
    const rec = 6 + index * 12;
    name.writeUInt16BE(3, rec);
    name.writeUInt16BE(1, rec + 2);
    name.writeUInt16BE(0x0409, rec + 4);
    name.writeUInt16BE(record.id, rec + 6);
    name.writeUInt16BE(strings[index].length, rec + 8);
    name.writeUInt16BE(cursor, rec + 10);
    cursor += strings[index].length;
  });
  stringBytes.copy(name, stringOffset);

  const sfnt = Buffer.alloc(28 + name.length);
  sfnt.writeUInt32BE(0x00010000, 0);
  sfnt.writeUInt16BE(1, 4);
  sfnt.write('name', 12, 'latin1');
  sfnt.writeUInt32BE(28, 20);
  sfnt.writeUInt32BE(name.length, 24);
  name.copy(sfnt, 28);
  return sfnt;
}

describe('install user font', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('reads the PostScript name and copies the file into the given user font folder', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'psmcp-font-'));
    dirs.push(dir);
    const source = join(dir, 'Fredoka[wdth,wght].ttf');
    const destDir = join(dir, 'Fonts');
    await writeFile(source, buildNameOnlyFont([
      { id: 6, text: 'Fredoka-Light' },
      { id: 16, text: 'Fredoka' },
      { id: 4, text: 'Fredoka Light' },
    ]));

    const installed = await installUserFont(source, { destDir });
    expect(installed.postScriptNames).toEqual(['Fredoka-Light']);
    expect(installed.family).toBe('Fredoka');
    expect(installed.alreadyInstalled).toBe(false);
    expect(readFileSync(installed.installedPath).equals(readFileSync(source))).toBe(true);

    const again = await installUserFont(source, { destDir });
    expect(again.alreadyInstalled).toBe(true);
  });

  it('rejects a path that is not a font file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'psmcp-font-'));
    dirs.push(dir);
    const source = join(dir, 'notes.txt');
    await writeFile(source, 'hello');
    await expect(installUserFont(source, { destDir: dir })).rejects.toThrow(/\.ttf/);
    await expect(installUserFont('Fredoka.ttf')).rejects.toThrow(/absolute path/);
  });

  it('names the Windows per-user registry value the way Fonts settings does', () => {
    expect(windowsFontRegistryValueName('Fredoka', 'TrueType')).toBe('Fredoka (TrueType)');
  });

  it('asks Photoshop to refresh its font list for the installed PostScript names', () => {
    const script = ExtendScriptSnippets.refreshFonts(['Figtree-Bold', 'Figtree-Regular']);
    expect(script).toContain('app.refreshFonts()');
    expect(script).toContain('"Figtree-Bold"');
    expect(script).toContain('"Figtree-Regular"');
    expect(script).toContain('app.fonts.getByName');
  });

  it('tells the agent to install a missing font instead of retrying the same name', () => {
    const envelope = classifyError('font_not_found: Fredoka Bold');
    expect(envelope.code).toBe('font_not_found');
    expect(envelope.suggested_next_tool).toBe('photoshop_list_fonts');
    expect(envelope.message).toMatch(/photoshop_install_font/);
    expect(envelope.message).toMatch(/reloads the font list/);
    expect(envelope.message).not.toMatch(/quit Photoshop/i);
  });

  it.skipIf(!existsSync('/tmp/Fredoka-variable.ttf'))(
    'reads Fredoka Bold from the official variable font',
    () => {
      const info = readFontFaceInfo(readFileSync('/tmp/Fredoka-variable.ttf'));
      expect(info.family).toBe('Fredoka');
      expect(info.postScriptNames).toContain('Fredoka-Bold');
    }
  );
});
