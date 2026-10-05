import { AsyncLocalStorage } from 'node:async_hooks';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolHandler } from './tool-registry.js';

const targetDocumentId = new AsyncLocalStorage<number | undefined>();

/** Tools that already manage documents themselves, or never target a document. */
export const DOCUMENT_ID_SCHEMA_EXCLUDES = new Set([
  'photoshop_ping',
  'photoshop_get_version',
  'photoshop_get_capabilities',
  'photoshop_list_documents',
  'photoshop_set_active_document',
  'photoshop_submit_feedback',
]);

/**
 * These tools create a new document. A passed id must not be resolved first:
 * with nothing open, that check rejects 0 and invented ids before the file exists.
 */
export const DOCUMENT_ID_GUARD_EXCLUDES = new Set([
  'photoshop_create_document',
  'photoshop_open_image',
]);

export const DOCUMENT_ID_PROPERTY = {
  type: ['number', 'null'],
  description:
    'Photoshop document id from photoshop_get_state / photoshop_list_documents. ' +
    'Send null or 0 to use the active document. A positive number activates that document before the tool runs. ' +
    'When no document is open, a stale id does not block the call.',
} as const;

const DOCUMENT_ID_IGNORED_PROPERTY = {
  type: ['number', 'null'],
  description:
    'Ignored. photoshop_create_document and photoshop_open_image do not target an existing tab. Omit this, or send null or 0.',
} as const;

export function runWithDocumentId<T>(documentId: number | undefined, fn: () => T): T {
  return targetDocumentId.run(documentId, fn);
}

export function getTargetDocumentId(): number | undefined {
  return targetDocumentId.getStore();
}

export function parseDocumentIdArg(args: Record<string, unknown> | undefined): number | undefined {
  const raw = args?.document_id;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  const id = Math.trunc(raw);
  if (id === 0) return undefined;
  return id;
}

export function wrapDocumentIdHandler(toolName: string, handler: ToolHandler): ToolHandler {
  return async (args) => {
    const documentId = DOCUMENT_ID_GUARD_EXCLUDES.has(toolName)
      ? undefined
      : parseDocumentIdArg(args);
    return runWithDocumentId(documentId, () => handler(args));
  };
}

type ObjectSchema = {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

/** Inject optional `document_id` on tools that operate against the active document. */
export function withOptionalDocumentId(tool: Tool): Tool {
  if (DOCUMENT_ID_SCHEMA_EXCLUDES.has(tool.name)) return tool;
  const schema = tool.inputSchema as ObjectSchema | undefined;
  if (!schema || schema.type !== 'object') return tool;
  const properties = schema.properties ?? {};
  if (properties.document_id) return tool;
  const ignoresTarget = DOCUMENT_ID_GUARD_EXCLUDES.has(tool.name);
  const required = Array.isArray(schema.required) ? [...schema.required] : [];
  if (!ignoresTarget && !required.includes('document_id')) required.push('document_id');
  return {
    ...tool,
    inputSchema: {
      ...schema,
      type: 'object',
      additionalProperties: false,
      required,
      properties: {
        ...properties,
        document_id: ignoresTarget
          ? { ...DOCUMENT_ID_IGNORED_PROPERTY }
          : { ...DOCUMENT_ID_PROPERTY },
      },
    },
  };
}

/** ExtendScript prepended inside the execute wrapper when a target id is set. */
export function documentGuardScript(documentId: number): string {
  const id = Math.trunc(documentId);
  return `
    (function() {
      var __mcp_targetDocId = ${id};
      if (app.documents.length === 0) return;
      var __mcp_found = false;
      for (var __mcp_di = 0; __mcp_di < app.documents.length; __mcp_di++) {
        if (app.documents[__mcp_di].id === __mcp_targetDocId) {
          app.activeDocument = app.documents[__mcp_di];
          __mcp_found = true;
          break;
        }
      }
      if (!__mcp_found) {
        throw new Error('document_not_found: no open document with id ' + __mcp_targetDocId);
      }
    })();
  `;
}
