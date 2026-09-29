import { Logger } from '../utils/logger.js';
import { PhotoshopConnection } from '../platform/connection.js';
import { documentGuardScript, getTargetDocumentId } from '../core/document-target.js';
import { isUxpBridgeReachable } from '../platform/uxp-bridge-client.js';

export type APIType = 'UXP' | 'ExtendScript';

/**
 * Force the execution path regardless of detection.
 * - `uxp`: route through the UXP bridge plugin (fails fast with a clear
 *   error until the plugin supports script execution — see UXPPhotoshopAPI).
 * - `extendscript`: always use the AppleScript/COM path.
 * - `auto` (default, or any other value): use ExtendScript for script
 *   execution, and report UXP bridge status truthfully in logs.
 */
export const API_OVERRIDE_ENV = 'PHOTOSHOP_MCP_API';

export interface PhotoshopAPI {
  /**
   * Execute a script using the appropriate API
   */
  executeScript(script: string, timeoutMs?: number): Promise<unknown>;

  /**
   * Get the API type being used
   */
  getAPIType(): APIType;
}

/**
 * createAPI() runs per tool call, and in auto mode the bridge probe exists
 * only to pick truthful log wording (the outcome is always ExtendScript).
 * Cache it briefly so the hot path does not pay a self-HTTP roundtrip on
 * every call.
 */
const PROBE_CACHE_TTL_MS = 5000;
let cachedPluginProbe: { at: number; value: boolean } | null = null;

async function probePluginOnce(): Promise<boolean> {
  if (cachedPluginProbe && Date.now() - cachedPluginProbe.at < PROBE_CACHE_TTL_MS) {
    return cachedPluginProbe.value;
  }
  const value = await isUxpBridgeReachable();
  cachedPluginProbe = { at: Date.now(), value };
  return value;
}

export class PhotoshopAPIFactory {
  private logger: Logger;
  private connection: PhotoshopConnection;

  constructor(connection: PhotoshopConnection) {
    this.logger = new Logger('PhotoshopAPIFactory');
    this.connection = connection;
  }

  async createAPI(): Promise<PhotoshopAPI> {
    const info = this.connection.getPhotoshopInfo();

    if (!info) {
      throw new Error('Photoshop info not available. Please detect Photoshop first.');
    }

    // Determine which API to use based on version
    const apiType = await this.determineAPIType(info.version);

    this.logger.info(`Creating ${apiType} API for Photoshop version ${info.version}`);

    if (apiType === 'UXP') {
      return new UXPPhotoshopAPI();
    } else {
      return new ExtendScriptPhotoshopAPI(this.connection);
    }
  }

  private async determineAPIType(version: string): Promise<APIType> {
    // IMPORTANT: script execution via AppleScript/COM can only use ExtendScript.
    // UXP is a plugin runtime: the companion plugin can run batchPlay commands
    // (neural filters), but it cannot execute arbitrary ExtendScript, so tool
    // scripts still need the ExtendScript path even when the plugin is loaded.
    //
    // PHOTOSHOP_MCP_API=uxp forces the UXP path so the bridge can be tested
    // end-to-end instead of silently falling through to ExtendScript.
    const override = (process.env[API_OVERRIDE_ENV] ?? 'auto').toLowerCase();
    if (override === 'uxp' || override === 'extendscript') {
      this.logger.debug(
        `Using ${override} API for version ${version} (${API_OVERRIDE_ENV}=${override})`
      );
      return override === 'uxp' ? 'UXP' : 'ExtendScript';
    }
    if (override !== 'auto') {
      this.logger.warn(
        `Unrecognized ${API_OVERRIDE_ENV}="${override}"; expected uxp, extendscript or auto. Falling back to auto.`
      );
    }

    const pluginPolling = await probePluginOnce();
    if (pluginPolling) {
      this.logger.debug(
        `Using ExtendScript for version ${version}; UXP bridge plugin detected and polling — neural filters available, but tool scripts still require ExtendScript`
      );
    } else {
      this.logger.debug(
        `Using ExtendScript for version ${version} (UXP plugin not polling the bridge)`
      );
    }
    return 'ExtendScript';
  }
}

/**
 * UXP-based API for modern Photoshop (23.5+)
 * The companion UXP plugin polls the bridge but cannot execute arbitrary
 * ExtendScript, so script calls fail fast with an actionable error rather
 * than silently degrading to the ExtendScript path (which on UXP-only
 * Photoshop builds hangs until the tool timeout and surfaces as an
 * unexplained extendscript_timeout).
 */
class UXPPhotoshopAPI implements PhotoshopAPI {
  async executeScript(_script: string, _timeoutMs?: number): Promise<unknown> {
    const pluginPolling = await isUxpBridgeReachable();
    throw new Error(
      pluginPolling
        ? 'UXP bridge plugin is connected and polling, but the plugin cannot execute ExtendScript tool scripts. Set PHOTOSHOP_MCP_API=extendscript (or unset it) to use the scripting path.'
        : 'UXP API selected via PHOTOSHOP_MCP_API=uxp, but the UXP bridge plugin is not polling. Load uxp-plugin/manifest.json via UXP Developer Tools and open the MCP Bridge panel, or set PHOTOSHOP_MCP_API=extendscript.'
    );
  }

  getAPIType(): APIType {
    return 'UXP';
  }
}

/**
 * ExtendScript-based API for legacy Photoshop (< 23.5)
 */
class ExtendScriptPhotoshopAPI implements PhotoshopAPI {
  private connection: PhotoshopConnection;

  constructor(connection: PhotoshopConnection) {
    this.connection = connection;
  }

  async executeScript(script: string, timeoutMs?: number): Promise<unknown> {
    // Wrap script in error handling
    const wrappedScript = this.wrapInErrorHandling(script);
    return await this.connection.executeScript(wrappedScript, timeoutMs);
  }

  private wrapInErrorHandling(script: string): string {
    // ExtendScript has no JSON object, so the result is serialized via
    // toSource()/String(). Errors are surfaced with an "ERROR:" prefix
    // that platform executors translate back into thrown Errors.
    //
    // Ruler and type units are temporarily forced to pixels/points so that
    // every DOM API that accepts plain numbers (translate, textItem.size,
    // textItem.position, doc.crop bounds, etc.) behaves consistently
    // regardless of the user's Photoshop preferences. The user's original
    // preferences are restored in the finally block.
    const targetId = getTargetDocumentId();
    const documentGuard = typeof targetId === 'number' ? documentGuardScript(targetId) : '';
    return `
(function() {
  var __originalRulerUnits = null;
  var __originalTypeUnits = null;
  var __origDialogs = null;
  var __origAlert = null;
  var __origConfirm = null;
  var __origPrompt = null;
  try { __originalRulerUnits = app.preferences.rulerUnits; } catch (e) {}
  try { __originalTypeUnits = app.preferences.typeUnits; } catch (e) {}
  try { __origDialogs = app.displayDialogs; } catch (e) {}
  try { app.displayDialogs = DialogModes.NO; } catch (e) {}
  if (typeof alert !== 'undefined') {
    __origAlert = alert;
    alert = function(msg) { $.writeln('[MCP] ' + msg); };
  }
  if (typeof confirm !== 'undefined') {
    __origConfirm = confirm;
    confirm = function() { $.writeln('[MCP] confirm suppressed'); return true; };
  }
  if (typeof prompt !== 'undefined') {
    __origPrompt = prompt;
    prompt = function(msg, def) {
      $.writeln('[MCP] prompt suppressed: ' + msg);
      return def || '';
    };
  }

  try {
    try { app.preferences.rulerUnits = Units.PIXELS; } catch (e) {}
    try { app.preferences.typeUnits = TypeUnits.POINTS; } catch (e) {}

    ${documentGuard}

    var result = (function() {
      ${script}
    })();
    if (typeof result === 'object' && result !== null) {
      return result.toSource ? result.toSource() : String(result);
    }
    return String(result);
  } catch (error) {
    return 'ERROR: ' + (error.message || String(error));
  } finally {
    try { if (__originalRulerUnits !== null) app.preferences.rulerUnits = __originalRulerUnits; } catch (e) {}
    try { if (__originalTypeUnits !== null) app.preferences.typeUnits = __originalTypeUnits; } catch (e) {}
    try { if (__origDialogs !== null) app.displayDialogs = __origDialogs; } catch (e) {}
    if (__origAlert !== null) { alert = __origAlert; }
    if (__origConfirm !== null) { confirm = __origConfirm; }
    if (__origPrompt !== null) { prompt = __origPrompt; }
  }
})();
    `.trim();
  }

  getAPIType(): APIType {
    return 'ExtendScript';
  }
}
