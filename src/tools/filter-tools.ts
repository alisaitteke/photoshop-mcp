import { ToolDefinition, ToolResult } from '../core/tool-registry.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { PhotoshopAPIFactory } from '../api/photoshop-api.js';
import { ExtendScriptSnippets } from '../api/extendscript.js';
import {
  atomicFailureFromError,
  atomicSuccess,
  parseSnippetResult,
  runSnippet,
} from './atomic-shared.js';

const SMART_BLUR_MODES = ['NORMAL', 'EDGEONLY', 'OVERLAYEDGE'] as const;
const SMART_BLUR_QUALITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
type SmartBlurMode = (typeof SMART_BLUR_MODES)[number];
type SmartBlurQuality = (typeof SMART_BLUR_QUALITIES)[number];

export function createFilterTools(connection: PhotoshopConnection): ToolDefinition[] {
  return [
    {
      tool: {
        name: 'photoshop_apply_gaussian_blur',
        description: 'Apply Gaussian Blur filter to the active layer',
        inputSchema: {
          type: 'object',
          properties: {
            radius: {
              type: 'number',
              description: 'Blur radius in pixels (0.1-250)',
              minimum: 0.1,
              maximum: 250,
            },
          },
          required: ['radius'],
        },
      },
      handler: async (args) => applyGaussianBlur(connection, args),
    },
    {
      tool: {
        name: 'photoshop_apply_sharpen',
        description:
          'Apply Unsharp Mask to the active raster layer (amount, radius, threshold). This is a pixel filter on one layer, not a web-export sharpen pass.\n\n' +
          'Use when: sharpening one layer in the open document.\n' +
          'Do NOT use when: preparing a file for the web — use photoshop_recipe_prepare_for_web.\n' +
          'Do NOT use when: you want edge extraction for an overlay sharpen — use photoshop_apply_high_pass.\n\n' +
          'Returns: the amount, radius, and threshold applied.\n' +
          'Preconditions: active document and a normal raster layer. Text and Smart Objects are rasterized first, which drops live type and smart-object edits. Side effects: changes pixels in one history step. Reversible with photoshop_undo.',
        inputSchema: {
          type: 'object',
          properties: {
            amount: {
              type: 'number',
              description: 'Sharpening amount in percent (1-500)',
              minimum: 1,
              maximum: 500,
            },
            radius: {
              type: 'number',
              description: 'Radius in pixels (0.1-250)',
              minimum: 0.1,
              maximum: 250,
            },
            threshold: {
              type: 'number',
              description: 'Threshold levels (0-255)',
              minimum: 0,
              maximum: 255,
              default: 0,
            },
          },
          required: ['amount', 'radius'],
        },
      },
      handler: async (args) => applySharpen(connection, args),
    },
    {
      tool: {
        name: 'photoshop_apply_noise',
        description:
          'Apply Add Noise to the active raster layer (amount percent, UNIFORM or GAUSSIAN, optional monochromatic).\n\n' +
          'Use when: grain or noise on one raster layer.\n' +
          'Do NOT use when: the goal is blur or sharpen — use photoshop_apply_gaussian_blur or photoshop_apply_sharpen.\n\n' +
          'Returns: the amount, distribution, and monochromatic flag applied.\n' +
          'Preconditions: active document and a normal raster layer. Text and Smart Objects are rasterized first. Side effects: destructive pixels, one history step. A second call adds more noise. Reversible with photoshop_undo.',
        inputSchema: {
          type: 'object',
          properties: {
            amount: {
              type: 'number',
              description: 'Noise amount in percent (0.1-400)',
              minimum: 0.1,
              maximum: 400,
            },
            distribution: {
              type: 'string',
              description: 'Noise distribution type',
              enum: ['UNIFORM', 'GAUSSIAN'],
              default: 'UNIFORM',
            },
            monochromatic: {
              type: 'boolean',
              description: 'Apply monochromatic noise',
              default: false,
            },
          },
          required: ['amount'],
        },
      },
      handler: async (args) => applyNoise(connection, args),
    },
    {
      tool: {
        name: 'photoshop_apply_motion_blur',
        description:
          'Apply Motion Blur to the active raster layer (angle in degrees, distance in pixels).\n\n' +
          'Use when: directional streak blur on one layer.\n' +
          'Do NOT use when: a round blur is enough — use photoshop_apply_gaussian_blur.\n' +
          'Do NOT use when: blur should keep edges — use photoshop_apply_smart_blur.\n\n' +
          'Returns: the angle and radius applied.\n' +
          'Preconditions: active document and a normal raster layer. Text and Smart Objects are rasterized first. Side effects: destructive pixels, one history step. Reversible with photoshop_undo.',
        inputSchema: {
          type: 'object',
          properties: {
            angle: {
              type: 'number',
              description: 'Blur angle in degrees (-360 to 360)',
              minimum: -360,
              maximum: 360,
            },
            radius: {
              type: 'number',
              description: 'Blur distance in pixels (1-999)',
              minimum: 1,
              maximum: 999,
            },
          },
          required: ['angle', 'radius'],
        },
      },
      handler: async (args) => applyMotionBlur(connection, args),
    },
    {
      tool: {
        name: 'photoshop_apply_high_pass',
        description:
          'Apply the High Pass filter to the active raster layer — edge/detail extraction for sharpening workflows or frequency separation prep.\n\n' +
          'Users often say: high pass filter, sharpen edges, extract details, frequency separation high layer.\n\n' +
          'Use when: sharpening via overlay blend, detail extraction, or prepping a high-frequency layer.\n' +
          'Do NOT use on text, Smart Objects, or the Background layer — rasterize or convert first (photoshop_rasterize_layer).\n\n' +
          'Returns: JSON { ok, summary, details: { filter, radius, context } }.\n' +
          'Preconditions: active document; normal (raster) layer selected. Side effects: one history step.',
        inputSchema: {
          type: 'object',
          properties: {
            radius: {
              type: 'number',
              description: 'Edge retention radius in pixels (0.1-250)',
              minimum: 0.1,
              maximum: 250,
            },
          },
          required: ['radius'],
        },
      },
      handler: async (args) => applyHighPass(connection, args),
    },
    {
      tool: {
        name: 'photoshop_apply_smart_blur',
        description:
          'Apply the Smart Blur filter to the active raster layer — edge-preserving blur for smoothing skin or simplifying backgrounds.\n\n' +
          'Users often say: smart blur, edge-preserving blur, smooth skin blur, blur but keep edges.\n\n' +
          'Use when: subtle smoothing that respects edges (portraits, product cleanup).\n' +
          'Do NOT use on text, Smart Objects, or the Background layer — rasterize first (photoshop_rasterize_layer).\n' +
          'Do NOT use when: uniform blur is enough — use photoshop_apply_gaussian_blur.\n\n' +
          'Returns: JSON { ok, summary, details: { filter, radius, threshold, mode, quality, context } }.\n' +
          'Preconditions: active document; normal (raster) layer selected. Side effects: one history step.',
        inputSchema: {
          type: 'object',
          properties: {
            radius: {
              type: 'number',
              description: 'Blur radius (0.1-100)',
              minimum: 0.1,
              maximum: 100,
            },
            threshold: {
              type: 'number',
              description: 'Blur threshold — higher values restrict blur to stronger edges (0.1-100)',
              minimum: 0.1,
              maximum: 100,
            },
            mode: {
              type: 'string',
              enum: [...SMART_BLUR_MODES],
              description: 'Smart blur mode (default: NORMAL)',
              default: 'NORMAL',
            },
            quality: {
              type: 'string',
              enum: [...SMART_BLUR_QUALITIES],
              description: 'Blur quality / smoothness (default: MEDIUM)',
              default: 'MEDIUM',
            },
          },
          required: ['radius', 'threshold'],
        },
      },
      handler: async (args) => applySmartBlur(connection, args),
    },
  ];
}

async function runFilterSnippet(
  connection: PhotoshopConnection,
  script: string,
  successSummary: string,
  detailsKeys: string[]
): Promise<ToolResult> {
  try {
    const raw = await runSnippet(connection, script);
    const parsed = parseSnippetResult(raw);
    if (!parsed) {
      return atomicFailureFromError(new Error(`Unparseable filter result: ${String(raw)}`));
    }
    if (parsed.ok === false) {
      return atomicFailureFromError(
        new Error(String(parsed.message || 'Filter operation failed')),
        parsed.suggested_next_tool
          ? { suggested_next_tool: String(parsed.suggested_next_tool) }
          : undefined
      );
    }
    const details: Record<string, unknown> = {};
    for (const key of detailsKeys) {
      if (parsed[key] !== undefined) details[key] = parsed[key];
    }
    if (parsed.context !== undefined) details.context = parsed.context;
    return atomicSuccess(successSummary, details);
  } catch (error) {
    return atomicFailureFromError(error);
  }
}

function validateHighPassRadius(radius: unknown): number | ToolResult {
  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0.1 || radius > 250) {
    return atomicFailureFromError(new Error('radius must be a number between 0.1 and 250'));
  }
  return radius;
}

function validateSmartBlurRadius(radius: unknown): number | ToolResult {
  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0.1 || radius > 100) {
    return atomicFailureFromError(new Error('radius must be a number between 0.1 and 100'));
  }
  return radius;
}

function validateSmartBlurThreshold(threshold: unknown): number | ToolResult {
  if (
    typeof threshold !== 'number' ||
    !Number.isFinite(threshold) ||
    threshold < 0.1 ||
    threshold > 100
  ) {
    return atomicFailureFromError(new Error('threshold must be a number between 0.1 and 100'));
  }
  return threshold;
}

async function applyGaussianBlur(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const radius = args.radius as number;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.applyGaussianBlur(radius);
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Gaussian Blur applied with radius ${radius}px`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error applying Gaussian Blur: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function applySharpen(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const amount = args.amount as number;
  const radius = args.radius as number;
  const threshold = (args.threshold as number) || 0;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.applyUnsharpMask(amount, radius, threshold);
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Unsharp Mask applied: amount ${amount}%, radius ${radius}px, threshold ${threshold}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error applying sharpen: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function applyNoise(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const amount = args.amount as number;
  const distribution = (args.distribution as string) || 'UNIFORM';
  const monochromatic = (args.monochromatic as boolean) || false;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.applyAddNoise(amount, distribution, monochromatic);
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Add Noise applied: ${amount}% (${distribution}${monochromatic ? ', monochromatic' : ''})`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error applying noise: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function applyMotionBlur(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const angle = args.angle as number;
  const radius = args.radius as number;

  try {
    const apiFactory = new PhotoshopAPIFactory(connection);
    const api = await apiFactory.createAPI();

    const script = ExtendScriptSnippets.applyMotionBlur(angle, radius);
    await api.executeScript(script);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Motion Blur applied: angle ${angle}°, radius ${radius}px`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error applying motion blur: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function applyHighPass(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const radiusResult = validateHighPassRadius(args.radius);
  if (typeof radiusResult !== 'number') return radiusResult;

  return runFilterSnippet(
    connection,
    ExtendScriptSnippets.applyHighPass(radiusResult),
    `High Pass filter applied (radius ${radiusResult}px)`,
    ['filter', 'radius']
  );
}

async function applySmartBlur(
  connection: PhotoshopConnection,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const radiusResult = validateSmartBlurRadius(args.radius);
  if (typeof radiusResult !== 'number') return radiusResult;

  const thresholdResult = validateSmartBlurThreshold(args.threshold);
  if (typeof thresholdResult !== 'number') return thresholdResult;

  const mode: SmartBlurMode =
    typeof args.mode === 'string' && (SMART_BLUR_MODES as readonly string[]).includes(args.mode)
      ? (args.mode as SmartBlurMode)
      : 'NORMAL';
  const quality: SmartBlurQuality =
    typeof args.quality === 'string' &&
    (SMART_BLUR_QUALITIES as readonly string[]).includes(args.quality)
      ? (args.quality as SmartBlurQuality)
      : 'MEDIUM';

  return runFilterSnippet(
    connection,
    ExtendScriptSnippets.applySmartBlur(radiusResult, thresholdResult, mode, quality),
    `Smart Blur applied (radius ${radiusResult}px, threshold ${thresholdResult})`,
    ['filter', 'radius', 'threshold', 'mode', 'quality']
  );
}
