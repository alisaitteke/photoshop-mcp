/**
 * In-process previous-frame cache for the preview MCP App.
 * The tool result the model sees never includes the previous JPEG.
 */

export const PREVIEW_APP_URI = 'ui://photoshop/preview';
export const PREVIEW_APP_MIME = 'text/html;profile=mcp-app';

const PREVIOUS_PREFIX = 'photoshop://preview/previous/';
const MAX_DOCUMENTS = 8;

export interface StoredPreviewFrame {
  documentId: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

const latest = new Map<string, StoredPreviewFrame>();
const previous = new Map<string, StoredPreviewFrame>();
const order: string[] = [];

export function previousPreviewUri(documentId: string): string {
  return `${PREVIOUS_PREFIX}${documentId}`;
}

export function previousDocumentIdFromUri(uri: string): string | undefined {
  if (!uri.startsWith(PREVIOUS_PREFIX)) return undefined;
  const id = decodeURIComponent(uri.slice(PREVIOUS_PREFIX.length));
  if (!/^[0-9]+$/.test(id)) return undefined;
  return id;
}

export function previewDocumentKey(id: unknown): string | undefined {
  if (typeof id === 'number' && Number.isFinite(id)) return String(Math.trunc(id));
  if (typeof id === 'string' && /^[0-9]+$/.test(id)) return id;
  return undefined;
}

function touch(documentId: string): void {
  const index = order.indexOf(documentId);
  if (index >= 0) order.splice(index, 1);
  order.push(documentId);
  while (order.length > MAX_DOCUMENTS) {
    const drop = order.shift();
    if (!drop) break;
    latest.delete(drop);
    previous.delete(drop);
  }
}

/** Stores `frame` as the latest capture. Returns the URI of the frame it replaced. */
export function rememberPreviewFrame(frame: StoredPreviewFrame): string | undefined {
  const prior = latest.get(frame.documentId);
  latest.set(frame.documentId, frame);
  if (prior) previous.set(frame.documentId, prior);
  else previous.delete(frame.documentId);
  touch(frame.documentId);
  return prior ? previousPreviewUri(frame.documentId) : undefined;
}

export function readPreviousPreview(documentId: string): StoredPreviewFrame | undefined {
  return previous.get(documentId);
}

export function clearPreviewFrames(): void {
  latest.clear();
  previous.clear();
  order.length = 0;
}
