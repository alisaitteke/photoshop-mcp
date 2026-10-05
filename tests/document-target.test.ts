import { describe, expect, it } from 'vitest';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  DOCUMENT_ID_GUARD_EXCLUDES,
  DOCUMENT_ID_SCHEMA_EXCLUDES,
  documentGuardScript,
  getTargetDocumentId,
  parseDocumentIdArg,
  withOptionalDocumentId,
  wrapDocumentIdHandler,
} from '../src/core/document-target.js';

function fakeTool(name: string, properties: Record<string, unknown> = {}): Tool {
  return {
    name,
    description: 'test',
    inputSchema: { type: 'object', properties },
  };
}

describe('withOptionalDocumentId', () => {
  it('injects a nullable required document_id on mutating tools', () => {
    const next = withOptionalDocumentId(fakeTool('photoshop_get_state'));
    const schema = next.inputSchema as {
      properties: Record<string, { type: string | string[] }>;
      required?: string[];
      additionalProperties?: boolean;
    };
    expect(schema.properties.document_id.type).toEqual(['number', 'null']);
    expect(schema.required).toEqual(['document_id']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('appends document_id to an existing required list', () => {
    const tool = fakeTool('photoshop_fill_layer');
    (tool.inputSchema as { required?: string[] }).required = ['color'];
    const next = withOptionalDocumentId(tool);
    const schema = next.inputSchema as { required?: string[] };
    expect(schema.required).toEqual(['color', 'document_id']);
  });

  it('does not inject on excluded tools', () => {
    for (const name of DOCUMENT_ID_SCHEMA_EXCLUDES) {
      const next = withOptionalDocumentId(fakeTool(name));
      const schema = next.inputSchema as { properties: Record<string, unknown> };
      expect(schema.properties.document_id).toBeUndefined();
    }
  });

  it('does not require document_id on tools that create a document', () => {
    for (const name of DOCUMENT_ID_GUARD_EXCLUDES) {
      const next = withOptionalDocumentId(fakeTool(name));
      const schema = next.inputSchema as {
        properties: Record<string, { description: string }>;
        required?: string[];
      };
      expect(schema.required ?? []).not.toContain('document_id');
      expect(schema.properties.document_id.description).toMatch(/Ignored/);
    }
  });

  it('does not overwrite an existing document_id property', () => {
    const next = withOptionalDocumentId(
      fakeTool('photoshop_export_layers', {
        document_id: { type: 'string', description: 'already there' },
      })
    );
    const schema = next.inputSchema as { properties: Record<string, { type: string }> };
    expect(schema.properties.document_id.type).toBe('string');
  });
});

describe('parseDocumentIdArg', () => {
  it('truncates finite numbers', () => {
    expect(parseDocumentIdArg({ document_id: 12.9 })).toBe(12);
  });

  it('rejects non-numbers and zero', () => {
    expect(parseDocumentIdArg({})).toBeUndefined();
    expect(parseDocumentIdArg({ document_id: null })).toBeUndefined();
    expect(parseDocumentIdArg({ document_id: '1' })).toBeUndefined();
    expect(parseDocumentIdArg({ document_id: 0 })).toBeUndefined();
    expect(parseDocumentIdArg({ document_id: 0.4 })).toBeUndefined();
  });
});

describe('wrapDocumentIdHandler', () => {
  it('does not pin an id for create and open', async () => {
    for (const name of DOCUMENT_ID_GUARD_EXCLUDES) {
      let seen: number | undefined = 1;
      const handler = wrapDocumentIdHandler(name, async () => {
        seen = getTargetDocumentId();
        return { content: [] };
      });
      await handler({ document_id: 999999 });
      expect(seen).toBeUndefined();
    }
  });

  it('pins a positive id and treats 0 as the active document', async () => {
    const seen: Array<number | undefined> = [];
    const handler = wrapDocumentIdHandler('photoshop_get_state', async () => {
      seen.push(getTargetDocumentId());
      return { content: [] };
    });
    await handler({ document_id: 42 });
    await handler({ document_id: 0 });
    await handler({ document_id: null });
    expect(seen).toEqual([42, undefined, undefined]);
  });
});

describe('documentGuardScript', () => {
  it('embeds the numeric id and document_not_found error', () => {
    const script = documentGuardScript(42);
    expect(script).toContain('var __mcp_targetDocId = 42;');
    expect(script).toContain('if (app.documents.length === 0) return;');
    expect(script).toContain('document_not_found');
  });
});
