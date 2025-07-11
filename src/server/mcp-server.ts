/**
 * MCP protocol server setup
 * @module server/mcp-server
 * @nist cm-7 "Least functionality"
 */

import { Logger } from 'pino';

/**
 * Initialize MCP server (placeholder for future MCP server implementation)
 * The MCP server is currently handled separately via the CLI
 */
export function createMcpServerInstance(logger: Logger): void {
  // MCP server is started via separate process when MCP_TRANSPORT is set
  // This is a placeholder for potential in-process MCP server integration
  logger.debug(
    'MCP server functionality available via CLI with MCP_TRANSPORT environment variable',
  );
}

/**
 * Check if MCP mode is enabled
 */
export function isMcpModeEnabled(): boolean {
  return process.env.MCP_TRANSPORT !== undefined;
}

/**
 * Start MCP server (currently handled externally)
 */
export function startMcpServer(logger: Logger): void {
  if (isMcpModeEnabled()) {
    logger.info('MCP mode detected - server will run in MCP protocol mode');
    // MCP server startup is handled by the CLI when MCP_TRANSPORT is set
  }
}

/**
 * Stop MCP server (currently handled externally)
 */
export function stopMcpServer(logger: Logger): void {
  if (isMcpModeEnabled()) {
    logger.info('MCP server shutdown handled externally');
  }
}
