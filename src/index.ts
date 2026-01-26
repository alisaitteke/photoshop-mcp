#!/usr/bin/env node

import { PhotoshopMCPServer } from './core/server.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('Main');

async function main() {
  try {
    logger.info('Starting Photoshop MCP Server...');
    
    const server = new PhotoshopMCPServer();
    await server.start();
    
    logger.info('Photoshop MCP Server is running');
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
