/**
 * Photoshop MCP UXP Bridge — polls MCP HTTP server and runs batchPlay commands.
 * Load via Adobe UXP Developer Tools (Load Plugin → uxp-plugin folder).
 */
const { entrypoints } = require('uxp');
const photoshop = require('photoshop');
const { action } = photoshop;

const BRIDGE_PORT = 38452;
const BRIDGE_BASE = `http://127.0.0.1:${BRIDGE_PORT}`;

let polling = false;

async function postResult(payload) {
  await fetch(`${BRIDGE_BASE}/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function neuralDescriptors(filter, params) {
  const smoothness = params.smoothness ?? 50;
  const blur = params.blur ?? 50;

  switch (filter) {
    case 'skin_smoothing':
      return [
        {
          _obj: 'neuralGalleryFilters',
          neuralGalleryFilters: {
            _obj: 'skinSmoothing',
            smoothness,
            blur,
          },
        },
      ];
    case 'harmonize':
      return [
        {
          _obj: 'neuralGalleryFilters',
          neuralGalleryFilters: {
            _obj: 'harmonization',
          },
        },
      ];
    case 'depth_blur':
      return [
        {
          _obj: 'neuralGalleryFilters',
          neuralGalleryFilters: {
            _obj: 'depthBlur',
          },
        },
      ];
    case 'super_zoom':
      return [
        {
          _obj: 'neuralGalleryFilters',
          neuralGalleryFilters: {
            _obj: 'superZoom',
          },
        },
      ];
    case 'colorize':
      return [
        {
          _obj: 'neuralGalleryFilters',
          neuralGalleryFilters: {
            _obj: 'colorize',
          },
        },
      ];
    default:
      throw new Error(`Unknown neural filter: ${filter}`);
  }
}

async function handleCommand(cmd) {
  const { id, action: cmdAction, params = {} } = cmd;

  try {
    if (cmdAction === 'neural_filter') {
      const descriptors = neuralDescriptors(params.filter, params);
      const result = await action.batchPlay(descriptors, {
        synchronousExecution: true,
        modalBehavior: 'execute',
      });
      await postResult({ id, ok: true, data: result });
      return;
    }

    await postResult({ id, ok: false, error: `unknown_action:${cmdAction}` });
  } catch (error) {
    await postResult({
      id,
      ok: false,
      error: error?.message || String(error),
    });
  }
}

async function pollOnce() {
  try {
    const res = await fetch(`${BRIDGE_BASE}/poll`);
    if (res.status === 204) return;
    if (!res.ok) return;
    const cmd = await res.json();
    if (cmd?.id) {
      await handleCommand(cmd);
    }
  } catch {
    // MCP server may not be running yet
  }
}

async function pollLoop() {
  if (polling) return;
  polling = true;
  while (polling) {
    await pollOnce();
    await new Promise((r) => setTimeout(r, 400));
  }
}

entrypoints.setup({
  panels: {
    bridgePanel: {
      show() {
        pollLoop();
      },
      hide() {
        polling = false;
      },
    },
  },
});

pollLoop();
