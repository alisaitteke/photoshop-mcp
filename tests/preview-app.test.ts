import { describe, expect, it, beforeEach } from 'vitest';
import { ExtendScriptSnippets } from '../src/api/extendscript.js';
import {
  clearPreviewFrames,
  PREVIEW_APP_URI,
  previousPreviewUri,
  readPreviousPreview,
} from '../src/apps/preview-frames.js';
import { listPreviewResources, readPreviewResource } from '../src/apps/preview-resources.js';
import { buildPreviewToolResult, parsePreviewScriptPayload } from '../src/apps/preview-result.js';
import { withOptionalDocumentId } from '../src/core/document-target.js';
import { withToolAnnotations } from '../src/core/tool-annotations.js';
import { createStateTools } from '../src/tools/state-tools.js';
import { Session } from '../src/core/session.js';

const payload = {
  path: '/tmp/preview.jpg',
  width: 1024,
  height: 683,
  mimeType: 'image/jpeg',
  documentId: 42,
  documentName: 'Poster.psd',
  documentWidth: 3000,
  documentHeight: 2000,
  colorMode: 'RGB',
  layers: ['Subject', 'Background'],
};

describe('preview MCP app', () => {
  beforeEach(() => {
    clearPreviewFrames();
  });

  it('advertises the preview UI resource on photoshop_get_preview', () => {
    const session = new Session();
    const tool = createStateTools(session.getConnection()).find(
      (definition) => definition.tool.name === 'photoshop_get_preview'
    );
    expect(tool).toBeDefined();
    const registered = withToolAnnotations(withOptionalDocumentId(tool!.tool));
    expect(registered._meta).toEqual({ ui: { resourceUri: PREVIEW_APP_URI } });
  });

  it('asks the preview script for document size and layer names', () => {
    const script = ExtendScriptSnippets.exportPreview();
    expect(script).toContain('layerNames');
    expect(script).toContain('documentWidth');
    expect(script).toContain('documentName');
    expect(script.indexOf('layerNames')).toBeLessThan(script.indexOf('doc.duplicate'));
  });

  it('keeps the previous JPEG out of the model-visible payload', () => {
    const first = buildPreviewToolResult(parsePreviewScriptPayload(payload)!, 'BEFORE', 6);
    const second = buildPreviewToolResult(parsePreviewScriptPayload(payload)!, 'AFTER', 5);
    const text = second.content.find((block) => block.type === 'text');
    expect(text && text.type === 'text' ? text.text : '').not.toContain('BEFORE');
    expect(JSON.stringify(second.structuredContent)).not.toContain('BEFORE');
    expect(second.structuredContent).toMatchObject({
      previousAvailable: true,
      previousUri: previousPreviewUri('42'),
      documentName: 'Poster.psd',
      layers: ['Subject', 'Background'],
      documentWidth: 3000,
    });
    const image = second.content.find((block) => block.type === 'image');
    expect(image && image.type === 'image' ? image.data : '').toBe('AFTER');
    expect(first.structuredContent).toMatchObject({ previousAvailable: false });
    expect(readPreviousPreview('42')?.base64).toBe('BEFORE');
  });

  it('serves the app HTML and the previous frame as resources', () => {
    buildPreviewToolResult(parsePreviewScriptPayload(payload)!, 'BEFORE', 6);
    buildPreviewToolResult(parsePreviewScriptPayload(payload)!, 'AFTER', 5);

    const listed = listPreviewResources();
    expect(listed.resources.map((resource) => resource.uri)).toEqual([PREVIEW_APP_URI]);
    expect(listed.resources[0].mimeType).toBe('text/html;profile=mcp-app');

    const app = readPreviewResource(PREVIEW_APP_URI);
    expect(app.contents[0]).toMatchObject({ mimeType: 'text/html;profile=mcp-app' });
    expect('text' in app.contents[0] ? app.contents[0].text : '').toContain('id="root"');

    const previous = readPreviewResource(previousPreviewUri('42'));
    expect(previous.contents[0]).toMatchObject({ mimeType: 'image/jpeg', blob: 'BEFORE' });
  });
});
