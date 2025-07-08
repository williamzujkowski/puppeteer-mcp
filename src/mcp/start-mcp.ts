#!/usr/bin/env node
/**
 * MCP Server Startup Script
 * @module mcp/start-mcp
 * @description Standalone script to start the MCP server with stdio transport
 */

import { createMCPServer } from './server.js';

/**
 * Start the MCP server for stdio communication
 */
async function startMCPServer(): Promise<void> {
  try {
    // Check if we're being invoked as an MCP server (stdio)
    const isMCPMode = process.stdout.isTTY === false || process.env.MCP_TRANSPORT === 'stdio';

    if (!isMCPMode) {
      // If running from terminal, start the full HTTP/WebSocket/gRPC server
      const { startHTTPServer } = await import('../server.js');
      await startHTTPServer();
      return;
    }

    // Create MCP server for stdio transport only
    const mcpServer = createMCPServer();

    // Start the MCP server with stdio transport
    await mcpServer.start();

    // Keep the process alive
    process.stdin.resume();

    // Handle graceful shutdown
    const shutdown = async (): Promise<void> => {
      await mcpServer.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => void shutdown());
    process.on('SIGTERM', () => void shutdown());
    process.on('SIGHUP', () => void shutdown());

    // Handle stdin close
    process.stdin.on('end', () => void shutdown());
  } catch (error) {
    // Write error to stderr to avoid corrupting stdio protocol
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Run if called directly
// Debug: log the comparison (only in non-test environments)
if (process.env.MCP_DEBUG && process.env.NODE_ENV !== 'test' && process.env.JEST_WORKER_ID === undefined) {
  try {
    const importMeta = eval('import.meta');
    console.error('import.meta.url:', importMeta.url);
    console.error('process.argv[1]:', process.argv[1]);
    console.error('file URL:', `file://${process.argv[1]}`);
  } catch {
    console.error('import.meta not available in this environment');
  }
}

// Always start if this is the main module
void startMCPServer();

export { startMCPServer };
