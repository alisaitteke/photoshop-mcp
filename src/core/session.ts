import { Logger } from '../utils/logger.js';
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

    if (this.config.autoConnect) {
      await this.connect();
    }
  }

  async connect(): Promise<boolean> {
    try {
      this.logger.info('Connecting to Photoshop...');
      const connected = await this.connection.ping();
      
      if (connected) {
        this.isConnected = true;
        this.updateActivity();
        this.logger.info('Successfully connected to Photoshop');
        return true;
      } else {
        this.isConnected = false;
        this.logger.warn('Failed to connect to Photoshop');
        return false;
      }
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
