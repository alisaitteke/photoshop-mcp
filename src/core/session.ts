import { Logger } from '../utils/logger.js';
import { capture, captureAnalyticsMilestoneOnce, identifyPhotoshopVersion } from '../analytics/index.js';
import { PhotoshopConnection } from '../platform/connection.js';

export interface SessionConfig {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export class Session {
  private logger: Logger;
  private connection: PhotoshopConnection;
  private config: SessionConfig;
  private isConnected: boolean = false;
  private lastActivity: Date;

  constructor(config: SessionConfig = {}) {
    this.logger = new Logger('Session');
    this.connection = new PhotoshopConnection();
    this.config = {
      autoConnect: true,
      reconnectAttempts: 3,
      reconnectDelay: 1000,
      ...config,
    };
    this.lastActivity = new Date();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing session...');
    this.connection.setOnFreshDetect((ok) => {
      this.isConnected = ok;
      if (ok) {
        this.updateActivity();
        void this.refreshPhotoshopVersionOnPerson();
      }
      this.captureConnectionEvent(ok);
    });

    if (!this.config.autoConnect) return;

    if (this.connection.hydrateFromCache()) {
      this.isConnected = true;
      this.updateActivity();
      this.logger.info('Using cached Photoshop detection');
      void this.refreshPhotoshopVersionOnPerson();
      return;
    }

    this.logger.debug('Photoshop detection deferred until first tool');
  }

  async connect(): Promise<boolean> {
    try {
      this.logger.info('Connecting to Photoshop...');
      const connected = await this.connection.ping();
      this.isConnected = connected;
      if (connected) {
        this.updateActivity();
        this.logger.info('Successfully connected to Photoshop');
        void this.refreshPhotoshopVersionOnPerson();
        return true;
      }
      this.logger.warn('Failed to connect to Photoshop');
      return false;
    } catch (error) {
      this.logger.error('Connection error:', error);
      this.isConnected = false;
      return false;
    }
  }

  async reconnect(): Promise<boolean> {
    this.logger.info('Attempting to reconnect...');
    
    for (let attempt = 1; attempt <= (this.config.reconnectAttempts || 3); attempt++) {
      this.logger.debug(`Reconnect attempt ${attempt}/${this.config.reconnectAttempts}`);
      
      const connected = await this.connect();
      if (connected) {
        return true;
      }

      if (attempt < (this.config.reconnectAttempts || 3)) {
        await this.delay(this.config.reconnectDelay || 1000);
      }
    }

    this.logger.error('Failed to reconnect after all attempts');
    this.captureConnectionEvent(false);
    return false;
  }

  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting session...');
    this.isConnected = false;
  }

  getConnection(): PhotoshopConnection {
    return this.connection;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getLastActivity(): Date {
    return this.lastActivity;
  }

  updateActivity(): void {
    this.lastActivity = new Date();
  }

  private captureConnectionEvent(connected: boolean): void {
    capture('mcp_photoshop_connection', {
      ok: connected,
      photoshop_connected: connected,
      ...(connected ? {} : { error_code: 'photoshop_unreachable' }),
      event_source: 'mcp',
    });

    if (connected) {
      captureAnalyticsMilestoneOnce('mcp_photoshop_first_connected', {
        event_source: 'mcp',
      });
    }
  }

  private async refreshPhotoshopVersionOnPerson(): Promise<void> {
    try {
      const version = await this.connection.getVersion();
      identifyPhotoshopVersion(version);
    } catch {
      // Best-effort person enrichment only.
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
