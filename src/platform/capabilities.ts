import { PhotoshopDetector } from './detector.js';
import { isUxpBridgeReachable } from './uxp-bridge-client.js';

export interface ParsedPhotoshopVersion {
  major: number;
  minor: number;
  year?: number;
  raw: string;
}

export interface PhotoshopCapabilities {
  version: string;
  features: {
    select_subject_v2: boolean;
    generative_fill: boolean;
    generative_remove: boolean;
    generative_expand: boolean;
    generative_upscale: boolean;
    sky_replacement_native: boolean;
    neural_filters: boolean;
    uxp_bridge_reachable: boolean;
    execute_as_modal_timeout: boolean;
    uxp_plugin_api: boolean;
  };
}

export function parsePhotoshopVersion(version: string): ParsedPhotoshopVersion {
  const numeric = version.match(/(\d+)\.?(\d*)/);
  if (numeric) {
    return {
      major: parseInt(numeric[1], 10),
      minor: numeric[2] ? parseInt(numeric[2], 10) : 0,
      raw: version,
    };
  }

  const yearMatch = version.match(/20(\d{2})/);
  if (yearMatch) {
    const year = parseInt(`20${yearMatch[1]}`, 10);
    return {
      major: year - 1990,
      minor: 0,
      year,
      raw: version,
    };
  }

  return { major: 0, minor: 0, raw: version };
}

export function getPhotoshopCapabilities(version: string): PhotoshopCapabilities {
  const parsed = parsePhotoshopVersion(version);
  const detector = new PhotoshopDetector();

  const major = parsed.major;
  const year = parsed.year ?? (major >= 13 ? 1990 + major : undefined);

  const selectSubjectV2 = major >= 23 || (year !== undefined && year >= 2020);
  const generativeFill = major >= 25 || (year !== undefined && year >= 2024);
  const generativeRemove = generativeFill;
  const generativeExpand = generativeFill;
  const generativeUpscale = major >= 27 || (year !== undefined && year >= 2025);
  const skyReplacementNative = generativeFill;
  const executeAsModal = generativeFill;

  return {
    version,
    features: {
      select_subject_v2: selectSubjectV2,
      generative_fill: generativeFill,
      generative_remove: generativeRemove,
      generative_expand: generativeExpand,
      generative_upscale: generativeUpscale,
      sky_replacement_native: skyReplacementNative,
      neural_filters: false,
      uxp_bridge_reachable: false,
      execute_as_modal_timeout: executeAsModal,
      uxp_plugin_api: detector.supportsUXP(version),
    },
  };
}

/**
 * Merge runtime UXP bridge reachability into version-derived capabilities.
 * `uxp_bridge_reachable` is true only when the companion plugin is actively
 * polling the bridge (not merely that the bridge HTTP server is listening),
 * so `neural_filters` reflects a plugin that can actually pick up commands.
 */
export async function resolvePhotoshopCapabilities(
  version: string
): Promise<PhotoshopCapabilities> {
  const base = getPhotoshopCapabilities(version);
  const bridgeUp = await isUxpBridgeReachable();
  return {
    ...base,
    features: {
      ...base.features,
      uxp_bridge_reachable: bridgeUp,
      neural_filters: bridgeUp && base.features.uxp_plugin_api,
    },
  };
}
