import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deletePreviewImages,
  extractToolImages,
  persistToolImages,
  readPreviewImage,
} from '../src/ui/store/previews.js';

const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');
let home: string;
let previousHome: string | undefined;

beforeAll(() => {
  previousHome = process.env.PHOTOSHOP_MCP_HOME;
  home = mkdtempSync(join(tmpdir(), 'psmcp-previews-'));
  process.env.PHOTOSHOP_MCP_HOME = home;
});

afterAll(() => {
  if (previousHome === undefined) delete process.env.PHOTOSHOP_MCP_HOME;
  else process.env.PHOTOSHOP_MCP_HOME = previousHome;
  rmSync(home, { recursive: true, force: true });
});

describe('tool preview images', () => {
  it('finds MCP and Anthropic image blocks', () => {
    const mcp = { content: [{ type: 'image', data: JPEG_BASE64, mimeType: 'image/jpeg' }, { type: 'text', text: '{}' }] };
    const anthropic = [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: JPEG_BASE64 } }];
    expect(extractToolImages(mcp)).toEqual([{ data: JPEG_BASE64, mimeType: 'image/jpeg' }]);
    expect(extractToolImages(anthropic)[0]?.mimeType).toBe('image/png');
    expect(extractToolImages({ content: [{ type: 'text', text: 'hi' }] })).toEqual([]);
  });

  it('stores images per chat and reads them back', () => {
    const output = { content: [{ type: 'image', data: JPEG_BASE64, mimeType: 'image/jpeg' }] };
    const refs = persistToolImages('chat_1', 'call-abc', output);
    expect(refs).toEqual([{ file: 'call-abc-0.jpg', mimeType: 'image/jpeg' }]);
    const read = readPreviewImage('chat_1', 'call-abc-0.jpg');
    expect(read?.mimeType).toBe('image/jpeg');
    expect(read?.bytes.toString('base64')).toBe(JPEG_BASE64);
  });

  it('rejects path traversal and unknown names', () => {
    expect(readPreviewImage('..', 'call-abc-0.jpg')).toBeNull();
    expect(readPreviewImage('chat_1', '../chat_1/call-abc-0.jpg')).toBeNull();
    expect(readPreviewImage('chat_1', 'passwd')).toBeNull();
    expect(persistToolImages('../x', 'id', { content: [{ type: 'image', data: JPEG_BASE64, mimeType: 'image/jpeg' }] })).toEqual([]);
  });

  it('skips unsupported types and does nothing without a chat id', () => {
    expect(persistToolImages('chat_1', 'gif', { content: [{ type: 'image', data: JPEG_BASE64, mimeType: 'image/gif' }] })).toEqual([]);
    expect(persistToolImages(undefined, 'x', { content: [{ type: 'image', data: JPEG_BASE64, mimeType: 'image/jpeg' }] })).toEqual([]);
  });

  it('deletes a chat folder', () => {
    deletePreviewImages('chat_1');
    expect(readPreviewImage('chat_1', 'call-abc-0.jpg')).toBeNull();
  });
});
