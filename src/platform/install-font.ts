import { execFile } from 'node:child_process';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import { fontOutlineKind, readFontFaceInfo } from './font-file.js';

const execFileAsync = promisify(execFile);

/** Apple and Microsoft document .ttf, .otf, and collections. Suitcase/Type 1 are not. */
const FONT_EXTENSIONS = new Set(['.ttf', '.otf', '.ttc', '.otc']);

/** Large enough for a variable family, small enough to reject an accidental binary. */
export const MAX_FONT_BYTES = 30 * 1024 * 1024;

const WINDOWS_USER_FONT_KEY = 'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts';

export interface InstalledFont {
  installedPath: string;
  postScriptNames: string[];
  family: string | null;
  alreadyInstalled: boolean;
}

/**
 * Font Book's Current User location. Fonts here are available only to this user.
 * https://support.apple.com/guide/font-book/change-font-book-settings-fntbk1004/mac
 */
export function userFontDirectory(): string {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    return join(base, 'Microsoft', 'Windows', 'Fonts');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Fonts');
  }
  throw new Error('Font install is supported on macOS and Windows, where Photoshop runs.');
}

/** Value name Windows stores for a per-user font, for example "Fredoka (TrueType)". */
export function windowsFontRegistryValueName(
  title: string,
  outline: 'TrueType' | 'OpenType'
): string {
  return `${title} (${outline})`;
}

/**
 * Install a font for the current user. This only writes the OS font folder.
 * An open Photoshop session keeps its own list until Application.refreshFonts().
 */
export async function installUserFont(
  filePath: string,
  options?: { destDir?: string }
): Promise<InstalledFont> {
  if (!filePath || !isAbsolute(filePath)) {
    throw new Error('file_path must be an absolute path.');
  }
  const extension = extname(filePath).toLowerCase();
  if (!FONT_EXTENSIONS.has(extension)) {
    throw new Error('font file must be a .ttf, .otf, .ttc, or .otc');
  }

  let source: string;
  try {
    source = await realpath(filePath);
  } catch {
    throw new Error('font file not found');
  }
  const info = await stat(source);
  if (!info.isFile()) throw new Error('font file not found');
  if (info.size > MAX_FONT_BYTES) throw new Error('font file is too large');

  const data = await readFile(source);
  const face = readFontFaceInfo(data);
  const destDir = options?.destDir ?? userFontDirectory();
  await mkdir(destDir, { recursive: true });
  const destName = basename(source);
  const dest = join(destDir, destName);

  let alreadyInstalled = false;
  try {
    alreadyInstalled = (await readFile(dest)).equals(data);
  } catch {
    alreadyInstalled = false;
  }
  if (!alreadyInstalled) {
    await writeFile(dest, data, { mode: 0o644 });
  }

  if (process.platform === 'win32' && !options?.destDir) {
    const title = face.family || face.fullName || destName;
    await registerWindowsUserFont(dest, title, fontOutlineKind(data, extension));
  }

  return {
    installedPath: dest,
    postScriptNames: face.postScriptNames,
    family: face.family,
    alreadyInstalled,
  };
}

async function registerWindowsUserFont(
  dest: string,
  title: string,
  outline: 'TrueType' | 'OpenType'
): Promise<void> {
  await execFileAsync('reg', [
    'add',
    WINDOWS_USER_FONT_KEY,
    '/v',
    windowsFontRegistryValueName(title, outline),
    '/t',
    'REG_SZ',
    '/d',
    dest,
    '/f',
  ]);
}
