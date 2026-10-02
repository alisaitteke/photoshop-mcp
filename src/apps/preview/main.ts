import { App, PostMessageTransport } from '@modelcontextprotocol/ext-apps';

interface PreviewView {
  documentId?: number;
  documentName?: string;
  documentWidth?: number;
  documentHeight?: number;
  colorMode?: string;
  layers?: string[];
  width?: number;
  height?: number;
  previousUri?: string;
  imageData?: string;
  imageMime?: string;
  errorText?: string;
}

const WEB_EDGES = [2048, 1080, 512] as const;

const root = document.getElementById('root');
if (!root) throw new Error('preview root missing');

root.innerHTML = `
  <style>
    :root { color-scheme: light dark; }
    body { margin: 0; }
    #root {
      font: 13px/1.4 ui-sans-serif, system-ui, sans-serif;
      color: CanvasText;
      background: Canvas;
      padding: 8px;
    }
    .meta { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .name { font-weight: 600; }
    .stack { position: relative; background: color-mix(in srgb, CanvasText 8%, transparent); }
    .stack img { display: block; width: 100%; height: auto; }
    #before {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: fill; clip-path: inset(0 50% 0 0);
    }
    .slider { width: 100%; margin: 6px 0; }
    ul { margin: 4px 0 8px; padding-left: 18px; }
    .row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    button {
      font: inherit; border: 1px solid color-mix(in srgb, CanvasText 30%, transparent);
      background: transparent; color: inherit; border-radius: 6px; padding: 4px 8px; cursor: pointer;
    }
    button:disabled { opacity: 0.5; cursor: default; }
    .status { margin-top: 6px; white-space: pre-wrap; }
    .hidden { display: none; }
  </style>
  <div class="meta">
    <div class="name" id="name">Photoshop</div>
    <div id="size"></div>
  </div>
  <div class="stack">
    <img id="after" alt="Current preview" />
    <img id="before" alt="Previous preview" class="hidden" />
  </div>
  <input id="slider" class="slider hidden" type="range" min="0" max="100" value="50" aria-label="Before and after" />
  <div id="layers"></div>
  <div class="row">
    <span>Long edge</span>
    <button type="button" data-edge="2048">2048</button>
    <button type="button" data-edge="1080">1080</button>
    <button type="button" data-edge="512">512</button>
  </div>
  <div class="status" id="status"></div>
`;

const nameEl = document.getElementById('name') as HTMLElement;
const sizeEl = document.getElementById('size') as HTMLElement;
const afterEl = document.getElementById('after') as HTMLImageElement;
const beforeEl = document.getElementById('before') as HTMLImageElement;
const sliderEl = document.getElementById('slider') as HTMLInputElement;
const layersEl = document.getElementById('layers') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const buttons = [...root.querySelectorAll('button')] as HTMLButtonElement[];

let currentDocumentId: number | undefined;

const app = new App({ name: 'Photoshop Preview', version: '1.0.0' }, {}, { autoResize: true });

app.ontoolresult = (params) => {
  render(readView(params));
};

sliderEl.addEventListener('input', () => {
  const keep = 100 - Number(sliderEl.value);
  beforeEl.style.clipPath = `inset(0 ${keep}% 0 0)`;
});

for (const button of buttons) {
  button.addEventListener('click', () => {
    const edge = Number(button.dataset.edge);
    if (!WEB_EDGES.includes(edge as (typeof WEB_EDGES)[number])) return;
    void exportWeb(edge);
  });
}

void app.connect(new PostMessageTransport(window.parent, window.parent)).catch((error: unknown) => {
  statusEl.textContent = error instanceof Error ? error.message : String(error);
});

function readView(params: unknown): PreviewView {
  const record = asRecord(params);
  const nested = asRecord(record.result);
  const body = nested.content || nested.structuredContent ? nested : record;
  const structured = asRecord(body.structuredContent);
  const content = Array.isArray(body.content) ? body.content : [];
  let imageData: string | undefined;
  let imageMime: string | undefined;
  let errorText: string | undefined;
  for (const block of content) {
    const item = asRecord(block);
    if (item.type === 'image' && typeof item.data === 'string') {
      imageData = item.data;
      imageMime = typeof item.mimeType === 'string' ? item.mimeType : 'image/jpeg';
    }
    if (item.type === 'text' && typeof item.text === 'string' && body.isError) {
      errorText = item.text;
    }
  }
  return {
    documentId: typeof structured.documentId === 'number' ? structured.documentId : undefined,
    documentName: typeof structured.documentName === 'string' ? structured.documentName : undefined,
    documentWidth: typeof structured.documentWidth === 'number' ? structured.documentWidth : undefined,
    documentHeight: typeof structured.documentHeight === 'number' ? structured.documentHeight : undefined,
    colorMode: typeof structured.colorMode === 'string' ? structured.colorMode : undefined,
    layers: Array.isArray(structured.layers)
      ? structured.layers.filter((layer): layer is string => typeof layer === 'string')
      : undefined,
    width: typeof structured.width === 'number' ? structured.width : undefined,
    height: typeof structured.height === 'number' ? structured.height : undefined,
    previousUri: typeof structured.previousUri === 'string' ? structured.previousUri : undefined,
    imageData,
    imageMime,
    errorText,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function render(view: PreviewView): void {
  currentDocumentId = view.documentId;
  nameEl.textContent = view.documentName || 'Photoshop';
  const doc =
    view.documentWidth && view.documentHeight
      ? `${view.documentWidth}×${view.documentHeight} px`
      : '';
  const preview =
    view.width && view.height && (view.width !== view.documentWidth || view.height !== view.documentHeight)
      ? `preview ${view.width}×${view.height}`
      : '';
  sizeEl.textContent = [doc, view.colorMode, preview].filter(Boolean).join(' · ');

  if (view.imageData) {
    afterEl.src = `data:${view.imageMime || 'image/jpeg'};base64,${view.imageData}`;
  }
  layersEl.replaceChildren();
  if (view.layers && view.layers.length > 0) {
    const list = document.createElement('ul');
    for (const layer of view.layers) {
      const item = document.createElement('li');
      item.textContent = layer;
      list.appendChild(item);
    }
    layersEl.appendChild(list);
  }
  statusEl.textContent = view.errorText ?? '';
  void loadPrevious(view.previousUri);
}

function hidePrevious(): void {
  beforeEl.classList.add('hidden');
  sliderEl.classList.add('hidden');
  beforeEl.removeAttribute('src');
}

async function loadPrevious(uri: string | undefined): Promise<void> {
  hidePrevious();
  if (!uri) return;
  try {
    const result = await app.readServerResource({ uri });
    const content = result.contents[0];
    if (!content || !('blob' in content) || !content.blob) {
      throw new Error('Previous preview was empty');
    }
    const mime = content.mimeType || 'image/jpeg';
    beforeEl.onload = () => {
      beforeEl.classList.remove('hidden');
      sliderEl.classList.remove('hidden');
      sliderEl.value = '50';
      beforeEl.style.clipPath = 'inset(0 50% 0 0)';
    };
    beforeEl.onerror = () => {
      hidePrevious();
    };
    beforeEl.src = `data:${mime};base64,${content.blob}`;
  } catch {
    hidePrevious();
  }
}

async function exportWeb(maxDimension: number): Promise<void> {
  for (const button of buttons) button.disabled = true;
  statusEl.textContent = `Exporting long edge ${maxDimension}…`;
  try {
    const args: Record<string, number> = { max_dimension_px: maxDimension };
    if (typeof currentDocumentId === 'number') args.document_id = currentDocumentId;
    const result = await app.callServerTool({
      name: 'photoshop_recipe_prepare_for_web',
      arguments: args,
    });
    const text = result.content?.find((block) => block.type === 'text');
    const body = text && text.type === 'text' ? text.text : '';
    if (result.isError) {
      statusEl.textContent = body || 'Export failed';
      return;
    }
    statusEl.textContent = savedPath(body) || 'Exported';
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    for (const button of buttons) button.disabled = false;
  }
}

function savedPath(body: string): string {
  try {
    const parsed = JSON.parse(body) as { output_paths?: unknown; summary?: unknown };
    if (Array.isArray(parsed.output_paths) && typeof parsed.output_paths[0] === 'string') {
      return parsed.output_paths[0];
    }
    if (typeof parsed.summary === 'string') return parsed.summary;
  } catch {
    return body;
  }
  return body;
}
