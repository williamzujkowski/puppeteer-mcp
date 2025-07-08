/**
 * Server Startup Utilities
 * @module cli/server
 * @description Utilities for starting MCP and HTTP servers
 */

import { createMCPServer } from '../mcp/server.js';
import { startHTTPServer } from '../server.js';

/**
 * Check if running in MCP mode (stdio transport)
 */
function isMCPMode(): boolean {
  return process.stdout.isTTY === false || process.env.MCP_TRANSPORT === 'stdio';
}

/**
 * Start MCP server with stdio transport
 */
async function startMCPServerStdio(): Promise<void> {
  const mcpServer = createMCPServer();
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
  process.stdin.on('end', () => void shutdown());
}

/**
 * Start the appropriate server based on mode
 */
export async function startServer(): Promise<void> {
  try {
    if (isMCPMode()) {
      await startMCPServerStdio();
    } else {
      await startHTTPServer();
    }
  } catch (error) {
    // Write error to stderr to avoid corrupting stdio protocol
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
