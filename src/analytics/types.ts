export type AnalyticsEventSource = 'ui' | 'server' | 'mcp';

export type AnalyticsPropertyValue = string | number | boolean | string[] | null | undefined;

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, AnalyticsPropertyValue>;
  /** Local milestone id (not sent to Rybbit). */
  insertId?: string;
}

export interface BetaTelemetryState {
  betaTelemetryOptIn: boolean;
  betaTelemetryPromptAnswered: boolean;
}

export interface AnalyticsRuntimeConfig {
  enabled: boolean;
  provider: 'rybbit';
  siteId: string;
  analyticsHost: string;
  distinctId: string;
  betaTelemetryOptIn: boolean;
  betaTelemetryPromptAnswered: boolean;
}

export type UsageSurface = 'mcp' | 'server' | 'ui';

export interface AnalyticsProvider {
  capture(event: AnalyticsEvent): void;
  identify(properties?: Record<string, unknown>): void;
  /** Set person properties only when not already set (install cohorts). */
  setPersonOnce(properties: Record<string, unknown>): void;
  /** Push queued events without shutting down the client. */
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}
