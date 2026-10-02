import { displayToolName } from './tool-display';

/**
 * Turn a raw tool call into something a person can scan in a timeline row:
 * "Fill layer" + ["rgb 50,50,50"] + a swatch, instead of an icon and a JSON blob.
 */
export interface ToolSummary {
  title: string;
  params: string[];
  swatch?: string;
}

const TITLE_OVERRIDES: Record<string, string> = {
  get_preview: 'Preview',
  get_state: 'Read document state',
  get_document_info: 'Read document info',
  get_layers: 'Read layers',
  create_document: 'Create document',
  fill_layer: 'Fill layer',
  set_layer_blend_mode: 'Blend mode',
  set_layer_opacity: 'Opacity',
  merge_visible_layers: 'Merge visible layers',
  flatten_image: 'Flatten image',
  export_as: 'Export',
  undo: 'Undo',
  redo: 'Redo',
};

const HIDDEN_KEYS = new Set([
  'action',
  'document_id',
  'documentId',
  'doc_id',
  'layer_id',
  'layerId',
  'session_id',
  'red',
  'green',
  'blue',
  'width',
  'height',
]);

const MAX_PARAMS = 4;

function humanize(raw: string): string {
  const text = raw.replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function clampByte(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(255, Math.round(n))) : null;
}

/** Accepts {red,green,blue}, {r,g,b} or a #hex string. */
function readColor(value: unknown): { css: string; label: string } | null {
  if (typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value)) {
    const hex = value.startsWith('#') ? value : `#${value}`;
    return { css: hex, label: hex.toLowerCase() };
  }
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const r = clampByte(obj.red ?? obj.r);
  const g = clampByte(obj.green ?? obj.g);
  const b = clampByte(obj.blue ?? obj.b);
  if (r === null || g === null || b === null) return null;
  return { css: `rgb(${r} ${g} ${b})`, label: `rgb ${r},${g},${b}` };
}

function formatParam(key: string, value: unknown): string | null {
  const k = key.toLowerCase();
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? humanize(key).toLowerCase() : null;
  if (typeof value === 'number') {
    if (k.includes('opacity') || k.endsWith('percent') || k === 'strength') return `${k.includes('opacity') ? 'opacity ' : ''}${value}%`;
    return `${humanize(key).toLowerCase()} ${value}`;
  }
  if (typeof value === 'string') {
    if (k.includes('blend')) return humanize(value.toLowerCase());
    if (k === 'prompt' || k === 'text' || k === 'contents') return `“${truncate(value, 32)}”`;
    if (k.includes('name')) return `“${truncate(value, 24)}”`;
    if (k.includes('path') || k.includes('file')) return truncate(value.split(/[\\/]/).pop() ?? value, 28);
    if (value.length <= 20) return value;
    return null;
  }
  if (Array.isArray(value)) return value.length ? `${value.length} ${humanize(key).toLowerCase()}` : null;
  return null;
}

export function describeToolCall(name: string, input: unknown): ToolSummary {
  const bare = displayToolName(name).replace(/^photoshop_/, '');
  const args =
    input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};

  let title: string;
  if (bare.startsWith('recipe_')) {
    title = `Recipe: ${humanize(bare.slice('recipe_'.length)).toLowerCase()}`;
  } else {
    title = TITLE_OVERRIDES[bare] ?? humanize(bare);
  }
  if (typeof args.action === 'string' && args.action) {
    title = `${title} › ${humanize(args.action).toLowerCase()}`;
  }

  const params: string[] = [];
  let swatch: string | undefined;
  // Read-only tools: their arguments are plumbing, not something to show.
  if (bare === 'get_preview' || bare === 'get_state') return { title, params };

  if (typeof args.width === 'number' && typeof args.height === 'number') {
    params.push(`${args.width} × ${args.height}`);
  } else {
    if (typeof args.width === 'number') params.push(`width ${args.width}`);
    if (typeof args.height === 'number') params.push(`height ${args.height}`);
  }

  const topLevelColor = readColor(args);
  if (topLevelColor) {
    swatch = topLevelColor.css;
    params.push(topLevelColor.label);
  }

  for (const [key, value] of Object.entries(args)) {
    if (params.length >= MAX_PARAMS) break;
    if (HIDDEN_KEYS.has(key)) continue;
    const color = key.toLowerCase().includes('color') ? readColor(value) : null;
    if (color) {
      swatch ??= color.css;
      params.push(color.label);
      continue;
    }
    const formatted = formatParam(key, value);
    if (formatted) params.push(formatted);
  }

  return { title, params: params.slice(0, MAX_PARAMS), ...(swatch ? { swatch } : {}) };
}

export function formatDuration(ms: number | undefined): string | null {
  if (ms === undefined || !Number.isFinite(ms)) return null;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}
