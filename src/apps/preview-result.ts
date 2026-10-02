import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import {
  previewDocumentKey,
  rememberPreviewFrame,
  type StoredPreviewFrame,
} from './preview-frames.js';

export interface PreviewScriptPayload {
  path: string;
  width: number;
  height: number;
  mimeType: string;
  documentId?: number | string | null;
  documentName: string;
  documentWidth: number;
  documentHeight: number;
  colorMode: string;
  layers: string[];
}

export function parsePreviewScriptPayload(raw: unknown): PreviewScriptPayload | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  if (typeof record.path !== 'string' || !record.path) return undefined;
  return {
    path: record.path,
    width: finiteNumber(record.width),
    height: finiteNumber(record.height),
    mimeType: typeof record.mimeType === 'string' && record.mimeType ? record.mimeType : 'image/jpeg',
    documentId:
      typeof record.documentId === 'number' || typeof record.documentId === 'string'
        ? record.documentId
        : undefined,
    documentName: typeof record.documentName === 'string' ? record.documentName : '',
    documentWidth: finiteNumber(record.documentWidth) || finiteNumber(record.width),
    documentHeight: finiteNumber(record.documentHeight) || finiteNumber(record.height),
    colorMode: typeof record.colorMode === 'string' ? record.colorMode : '',
    layers: layerNames(record.layers),
  };
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}

function layerNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const name = item.trim();
    if (!name) continue;
    names.push(name);
    if (names.length >= 40) break;
  }
  return names;
}

export function buildPreviewToolResult(
  payload: PreviewScriptPayload,
  base64: string,
  bytes: number
): CallToolResult {
  const documentId = previewDocumentKey(payload.documentId);
  const frame: StoredPreviewFrame = {
    documentId: documentId ?? '',
    base64,
    mimeType: payload.mimeType,
    width: payload.width,
    height: payload.height,
  };
  const previousUri = documentId ? rememberPreviewFrame({ ...frame, documentId }) : undefined;

  const text = {
    ok: true as const,
    documentId: documentId ? Number(documentId) : undefined,
    documentName: payload.documentName,
    documentWidth: payload.documentWidth,
    documentHeight: payload.documentHeight,
    colorMode: payload.colorMode,
    layers: payload.layers,
    width: payload.width,
    height: payload.height,
    bytes,
    previousAvailable: Boolean(previousUri),
  };

  const structuredContent: Record<string, unknown> = { ...text };
  if (previousUri) structuredContent.previousUri = previousUri;

  return {
    content: [
      {
        type: 'image',
        data: base64,
        mimeType: payload.mimeType,
      },
      {
        type: 'text',
        text: JSON.stringify(text, null, 2),
      },
    ],
    structuredContent,
  };
}
