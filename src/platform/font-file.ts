/**
 * Read PostScript names out of a TrueType, OpenType, or collection font.
 * Name IDs follow the OpenType `name` table; named instances follow `fvar`.
 * https://learn.microsoft.com/en-us/typography/opentype/spec/name
 * https://learn.microsoft.com/en-us/typography/opentype/spec/fvar
 */

export interface FontFaceInfo {
  /** Name ID 6, plus each named instance's PostScript name when the font defines one. */
  postScriptNames: string[];
  /** Typographic family (name ID 16) or the compatible family (name ID 1). */
  family: string | null;
  /** Full name (name ID 4), used as the Windows per-user font title. */
  fullName: string | null;
}

const SFNT_TRUE = 0x00010000;
const SFNT_OTTO = 0x4f54544f;
const SFNT_TRUE_TAG = 0x74727565;
const TTC_TAG = 0x74746366;

export function readFontFaceInfo(data: Buffer): FontFaceInfo {
  if (data.length < 12) {
    throw new Error('font file is not a TrueType, OpenType, or collection font');
  }
  const magic = data.readUInt32BE(0);
  if (magic === TTC_TAG) {
    return readCollection(data);
  }
  if (magic !== SFNT_TRUE && magic !== SFNT_OTTO && magic !== SFNT_TRUE_TAG) {
    throw new Error('font file is not a TrueType, OpenType, or collection font');
  }
  return readSfntFace(data, 0);
}

export function fontOutlineKind(data: Buffer, extension: string): 'TrueType' | 'OpenType' {
  const ext = extension.toLowerCase();
  if (ext === '.otf' || ext === '.otc') return 'OpenType';
  if (data.length >= 4 && data.readUInt32BE(0) === SFNT_OTTO) return 'OpenType';
  return 'TrueType';
}

function readCollection(data: Buffer): FontFaceInfo {
  if (data.length < 12) {
    throw new Error('font file is not a TrueType, OpenType, or collection font');
  }
  const count = data.readUInt32BE(8);
  if (count < 1 || 12 + count * 4 > data.length) {
    throw new Error('font file is not a TrueType, OpenType, or collection font');
  }
  const names = new Set<string>();
  let family: string | null = null;
  let fullName: string | null = null;
  for (let i = 0; i < count; i++) {
    const face = readSfntFace(data, data.readUInt32BE(12 + i * 4));
    for (const name of face.postScriptNames) names.add(name);
    family ??= face.family;
    fullName ??= face.fullName;
  }
  return { postScriptNames: [...names], family, fullName };
}

function readSfntFace(data: Buffer, offset: number): FontFaceInfo {
  if (offset + 12 > data.length) {
    throw new Error('font file is not a TrueType, OpenType, or collection font');
  }
  const numTables = data.readUInt16BE(offset + 4);
  const records = offset + 12;
  if (numTables < 1 || records + numTables * 16 > data.length) {
    throw new Error('font file is not a TrueType, OpenType, or collection font');
  }

  let nameTable: { offset: number; length: number } | null = null;
  let fvarTable: { offset: number; length: number } | null = null;
  for (let i = 0; i < numTables; i++) {
    const rec = records + i * 16;
    const tag = data.toString('latin1', rec, rec + 4);
    const tableOffset = data.readUInt32BE(rec + 8);
    const length = data.readUInt32BE(rec + 12);
    if (tableOffset + length > data.length) {
      throw new Error('font file is not a TrueType, OpenType, or collection font');
    }
    if (tag === 'name') nameTable = { offset: tableOffset, length };
    if (tag === 'fvar') fvarTable = { offset: tableOffset, length };
  }
  if (!nameTable) {
    throw new Error('font file is not a TrueType, OpenType, or collection font');
  }

  const names = readNameTable(data, nameTable.offset, nameTable.length);
  const postScriptNames: string[] = [];
  const seen = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    postScriptNames.push(value);
  };
  add(names.get(6));
  if (fvarTable) {
    for (const id of readInstancePostScriptNameIds(data, fvarTable.offset, fvarTable.length)) {
      add(names.get(id));
    }
  }

  return {
    postScriptNames,
    family: names.get(16) ?? names.get(1) ?? null,
    fullName: names.get(4) ?? names.get(16) ?? names.get(1) ?? null,
  };
}

function readNameTable(data: Buffer, offset: number, length: number): Map<number, string> {
  if (length < 6) return new Map();
  const count = data.readUInt16BE(offset + 2);
  const stringOffset = data.readUInt16BE(offset + 4);
  const out = new Map<number, string>();
  const preferred = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    const rec = offset + 6 + i * 12;
    if (rec + 12 > offset + length) break;
    const platform = data.readUInt16BE(rec);
    const encoding = data.readUInt16BE(rec + 2);
    const language = data.readUInt16BE(rec + 4);
    const nameId = data.readUInt16BE(rec + 6);
    const byteLength = data.readUInt16BE(rec + 8);
    const byteOffset = data.readUInt16BE(rec + 10);
    const start = offset + stringOffset + byteOffset;
    const end = start + byteLength;
    if (end > offset + length || end > data.length) continue;
    const text = decodeName(data.subarray(start, end), platform);
    if (!text) continue;
    if (!out.has(nameId)) out.set(nameId, text);
    if (platform === 3 && encoding === 1 && language === 0x0409) {
      preferred.set(nameId, text);
    }
  }
  for (const [id, text] of preferred) out.set(id, text);
  return out;
}

function decodeName(raw: Buffer, platform: number): string {
  if (platform === 0 || platform === 3) {
    const swapped = Buffer.alloc(raw.length & ~1);
    for (let i = 0; i < swapped.length; i += 2) {
      swapped[i] = raw[i + 1] ?? 0;
      swapped[i + 1] = raw[i] ?? 0;
    }
    return swapped.toString('utf16le').split('\0').join('');
  }
  return raw.toString('latin1').split('\0').join('');
}

function readInstancePostScriptNameIds(data: Buffer, offset: number, length: number): number[] {
  if (length < 16) return [];
  const axisCount = data.readUInt16BE(offset + 8);
  const axisSize = data.readUInt16BE(offset + 10);
  const instanceCount = data.readUInt16BE(offset + 12);
  const instanceSize = data.readUInt16BE(offset + 14);
  const axesOffset = data.readUInt16BE(offset + 4);
  if (axisSize < 20 || instanceSize < 4) return [];
  let cursor = offset + axesOffset + axisCount * axisSize;
  const ids: number[] = [];
  const psOffset = 4 + axisCount * 4;
  for (let i = 0; i < instanceCount; i++) {
    if (cursor + instanceSize > offset + length) break;
    if (instanceSize >= psOffset + 2) {
      const id = data.readUInt16BE(cursor + psOffset);
      if (id !== 0 && id !== 0xffff) ids.push(id);
    }
    cursor += instanceSize;
  }
  return ids;
}
