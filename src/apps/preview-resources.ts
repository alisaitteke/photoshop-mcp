import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { PREVIEW_APP_HTML } from './preview-html.js';
import {
  PREVIEW_APP_MIME,
  PREVIEW_APP_URI,
  previousDocumentIdFromUri,
  readPreviousPreview,
} from './preview-frames.js';

export function listPreviewResources(): {
  resources: Array<{
    uri: string;
    name: string;
    title: string;
    description: string;
    mimeType: string;
  }>;
} {
  return {
    resources: [
      {
        uri: PREVIEW_APP_URI,
        name: 'photoshop-preview',
        title: 'Photoshop preview',
        description: 'Interactive preview of the active Photoshop document.',
        mimeType: PREVIEW_APP_MIME,
      },
    ],
  };
}

export function readPreviewResource(uri: string): ReadResourceResult {
  if (uri === PREVIEW_APP_URI) {
    return {
      contents: [
        {
          uri,
          mimeType: PREVIEW_APP_MIME,
          text: PREVIEW_APP_HTML,
        },
      ],
    };
  }

  const documentId = previousDocumentIdFromUri(uri);
  if (documentId) {
    const frame = readPreviousPreview(documentId);
    if (!frame) {
      throw new Error(`No previous preview for document ${documentId}`);
    }
    return {
      contents: [
        {
          uri,
          mimeType: frame.mimeType,
          blob: frame.base64,
        },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
}
