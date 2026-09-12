/**
 * Browser analytics — Rybbit script injection.
 */
import * as rybbitBrowser from './rybbit-browser';

export interface BrowserAnalyticsConfig {
  enabled: boolean;
  provider: 'rybbit';
  siteId: string;
  analyticsHost: string;
  distinctId: string;
}

export function initBrowserAnalytics(config: BrowserAnalyticsConfig): void {
  rybbitBrowser.initRybbitBrowser(config);
}

export function registerBrowserAnalyticsContext(
  properties: Record<string, string | number | boolean>
): void {
  rybbitBrowser.registerBrowserAnalyticsContext(properties);
}

export function captureBrowserEvent(
  name: string,
  properties?: Record<string, string | number | boolean>
): void {
  rybbitBrowser.captureBrowserEvent(name, properties);
}

export function optOutBrowserCapturing(): void {
  rybbitBrowser.optOutBrowserCapturing();
}

export function optInBrowserCapturing(): void {
  rybbitBrowser.optInBrowserCapturing();
}

export function isBrowserAnalyticsInitialized(): boolean {
  return rybbitBrowser.isBrowserAnalyticsInitialized();
}
