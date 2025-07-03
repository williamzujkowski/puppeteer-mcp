#!/usr/bin/env node
/**
 * MCP Server Startup Script
 * @module mcp/start-mcp
 * @description Standalone script to start the MCP server with all protocol adapters
 */

import { createMCPServer } from './server.js';
import { createApp } from '../server.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'mcp-startup' });

/**
 * Start the MCP server with all protocol integrations
 */
async function startMCPServer(): Promise<void> {
  try {
    log.info('Starting MCP server with all protocol adapters...');
    
    // Create the Express app with all REST routes
    const app = createApp();
    
    // Create MCP server with REST adapter
    // Note: gRPC and WebSocket adapters require additional integration work
    // with the actual server instances, not just the factory functions
    const mcpServer = createMCPServer({
      app,
      // grpcServer and wsServer can be added later when properly integrated
    });
    
    // Start the MCP server
    await mcpServer.start();
    
    log.info('MCP server started successfully');
    log.info('Transport type:', process.env.MCP_TRANSPORT ?? 'stdio');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      void (async () => {
        log.info('Shutting down MCP server...');
        await mcpServer.stop();
        process.exit(0);
      })();
    });
    
    process.on('SIGTERM', () => {
      void (async () => {
        log.info('Shutting down MCP server...');
        await mcpServer.stop();
        process.exit(0);
      })();
    });
    
  } catch (error) {
    log.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void startMCPServer();
}

export { startMCPServer };