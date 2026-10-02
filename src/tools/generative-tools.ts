/**
 * Firefly generative MCP tools (ExtendScript lane).
 * See docs/plans/2026-07-03-1149-photoshop-ai-features/pai-phase-2.0-generative-core.md.
 */
import type { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import type { PhotoshopConnection } from '../platform/connection.js';
import {
  clampGenerativeScale,
  ExtendScriptSnippets,
  normalizeExpandDirection,
  parseGenerativeResult,
  requireGenerativeCapability,
  runGenerativeSnippet,
} from './generative/_shared.js';

function clampFeather(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(20, Math.round(n)));
}

export function createGenerativeTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_generative_fill',
        description:
          'Fill the current selection using Adobe Generative Fill (Firefly) with a text prompt.\n\n' +
          'Use when: adding or replacing content inside a selection with generative AI.\n' +
          'Do NOT use when: no selection exists — create one first or use photoshop_select_subject.\n' +
          'Do NOT use when: Photoshop version lacks generative_fill — check photoshop_get_capabilities.\n\n' +
          'Returns: { ok, summary, details: { action_id, prompt, wait } }.\n' +
          'Preconditions: PS 24+ with generative credits; active pixel selection.\n' +
          'Side effects: modifies pixels in selection; may consume Adobe generative credits.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Describe what to generate in the selection' },
          },
          required: ['prompt'],
        },
      },
      handler: async (args) => generativeFill(connection, args),
    },
    {
      tool: {
        name: 'photoshop_generative_remove',
        description:
          'Remove content using the AI Remove tool (or generative fill fallback) on the current selection.\n\n' +
          'Use when: erasing distractions, people, or objects with generative AI.\n' +
          'Do NOT use when: generative unavailable — fallback to photoshop_recipe_remove_distraction.\n\n' +
          'Returns: { ok, summary, details }.\n' +
          'Preconditions: selection or auto_select_subject; generative_fill capability.\n' +
          'Side effects: inpaints selected region; consumes generative credits when cloud-backed.',
        inputSchema: {
          type: 'object',
          properties: {
            feather_px: {
              type: 'number',
              description: 'Edge feather before remove (0-20, default 0)',
              minimum: 0,
              maximum: 20,
              default: 0,
            },
            auto_select_subject: {
              type: 'boolean',
              description: 'Run Select Subject when no selection exists (default false)',
              default: false,
            },
          },
        },
      },
      handler: async (args) => generativeRemove(connection, args),
    },
    {
      tool: {
        name: 'photoshop_generative_expand',
        description:
          'Extend the canvas beyond its edges using Generative Expand (Firefly).\n\n' +
          'Use when: outpainting, extending background, or expanding composition.\n\n' +
          'Returns: { ok, summary, details: { direction, prompt, wait } }.\n' +
          'Preconditions: active document; generative_fill capability.\n' +
          'Side effects: enlarges canvas with generated content.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Describe how to extend the image',
              default: 'extend the background naturally',
            },
            direction: {
              type: 'string',
              enum: ['left', 'right', 'top', 'bottom', 'all'],
              description: 'Expand direction (default all)',
              default: 'all',
            },
          },
        },
      },
      handler: async (args) => generativeExpand(connection, args),
    },
    {
      tool: {
        name: 'photoshop_generative_upscale',
        description:
          'Upscale the active document using Generative Upscale (PS 27+).\n\n' +
          'Use when: increasing resolution with AI detail recovery.\n' +
          'Do NOT use when: generative_upscale flag is false — use photoshop_resize_image.\n\n' +
          'Returns: { ok, summary, details }.\n' +
          'Preconditions: generative_upscale capability; signed-in Adobe account.',
        inputSchema: {
          type: 'object',
          properties: {
            target_scale: {
              type: 'number',
              enum: [2, 4],
              description: 'Target scale factor (2 or 4)',
              default: 2,
            },
          },
        },
      },
      handler: async (args) => generativeUpscale(connection, args),
    },
    {
      tool: {
        name: 'photoshop_sky_replacement',
        description:
          'Replace the sky using Photoshop native Sky Replacement when available.\n\n' +
          'Use when: a sky image path is provided and native AI sky replacement is supported.\n' +
          'Fallback: photoshop_recipe_sky_blend for manual composite.\n\n' +
          'Returns: { ok, summary, details }.\n' +
          'Preconditions: active document; optional sky_image_path for custom sky.',
        inputSchema: {
          type: 'object',
          properties: {
            sky_image_path: {
              type: 'string',
              description: 'Optional absolute path to a sky image file',
            },
          },
        },
      },
      handler: async (args) => skyReplacement(connection, args),
    },
    {
      tool: {
        name: 'photoshop_generate_image',
        description:
          'Photoshop Generate Image (Firefly ImageGen): create an image from a text prompt.\n\n' +
          'Use when: the user asks for ImageGen, text-to-image, or a new picture from a description.\n\n' +
          'Returns: { ok, summary, details }.\n' +
          'Preconditions: generative_fill capability; Adobe generative credits.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Image description' },
            width: { type: 'number', description: 'Width if creating new doc (default 1024)', default: 1024 },
            height: { type: 'number', description: 'Height if creating new doc (default 1024)', default: 1024 },
          },
          required: ['prompt'],
        },
      },
      handler: async (args) => generateImage(connection, args),
    },
  ];
}

async function generativeFill(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const blocked = await requireGenerativeCapability(connection, 'generative_fill');
  if (blocked) return blocked;

  const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
  if (!prompt) {
    return parseGenerativeResult({
      ok: false,
      code: 'generative_unavailable',
      message: 'prompt is required',
    });
  }

  const raw = await runGenerativeSnippet(connection, ExtendScriptSnippets.generativeFill(prompt));
  return parseGenerativeResult(raw);
}

async function generativeRemove(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const blocked = await requireGenerativeCapability(connection, 'generative_fill');
  if (blocked) return blocked;

  const feather = clampFeather(args.feather_px);
  const autoSelect = args.auto_select_subject === true;

  const raw = await runGenerativeSnippet(
    connection,
    ExtendScriptSnippets.generativeRemove(feather, autoSelect)
  );
  return parseGenerativeResult(raw);
}

async function generativeExpand(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const blocked = await requireGenerativeCapability(connection, 'generative_fill');
  if (blocked) return blocked;

  const prompt =
    typeof args.prompt === 'string' && args.prompt.trim()
      ? args.prompt.trim()
      : 'extend the background naturally';
  const direction = normalizeExpandDirection(args.direction);

  const raw = await runGenerativeSnippet(
    connection,
    ExtendScriptSnippets.generativeExpand(direction, prompt)
  );
  return parseGenerativeResult(raw);
}

async function generativeUpscale(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const blocked = await requireGenerativeCapability(connection, 'generative_upscale');
  if (blocked) return blocked;

  const scale = clampGenerativeScale(args.target_scale);
  const raw = await runGenerativeSnippet(
    connection,
    ExtendScriptSnippets.generativeUpscale(scale)
  );
  return parseGenerativeResult(raw);
}

async function skyReplacement(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const blocked = await requireGenerativeCapability(connection, 'generative_fill');
  if (blocked) return blocked;

  const skyPath = typeof args.sky_image_path === 'string' ? args.sky_image_path.trim() : '';
  const raw = await runGenerativeSnippet(
    connection,
    ExtendScriptSnippets.skyReplacement(skyPath)
  );
  return parseGenerativeResult(raw);
}

async function generateImage(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const blocked = await requireGenerativeCapability(connection, 'generative_fill');
  if (blocked) return blocked;

  const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
  if (!prompt) {
    return parseGenerativeResult({
      ok: false,
      code: 'generative_unavailable',
      message: 'prompt is required',
    });
  }

  const width =
    typeof args.width === 'number' && Number.isFinite(args.width)
      ? Math.max(64, Math.min(4096, Math.round(args.width)))
      : 1024;
  const height =
    typeof args.height === 'number' && Number.isFinite(args.height)
      ? Math.max(64, Math.min(4096, Math.round(args.height)))
      : 1024;

  const raw = await runGenerativeSnippet(
    connection,
    ExtendScriptSnippets.generateImage(prompt, width, height)
  );
  return parseGenerativeResult(raw);
}
