/**
 * Standard I/O Transport for MCP Server
 * @module mcp/transport/stdio
 * @description Handles MCP communication via standard input/output
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from '@utils/logger.js';

/**
 * Create and configure stdio transport for MCP
 * @nist au-3 "Content of audit records"
 */
export class StdioTransport {
  private transport: StdioServerTransport;

  constructor() {
    this.transport = new StdioServerTransport();
    this.setupEventHandlers();
  }

  /**
   * Set up event handlers for transport lifecycle
   */
  private setupEventHandlers(): void {
    // Log transport events for debugging and audit
    process.stdin.on('error', (error) => {
      logger.error({
        msg: 'MCP stdio input error',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    });

    process.stdout.on('error', (error) => {
      logger.error({
        msg: 'MCP stdio output error',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    });

    process.on('SIGINT', () => {
      logger.info({
        msg: 'MCP stdio transport received SIGINT',
        timestamp: new Date().toISOString(),
      });
      this.close();
    });

    process.on('SIGTERM', () => {
      logger.info({
        msg: 'MCP stdio transport received SIGTERM',
        timestamp: new Date().toISOString(),
      });
      this.close();
    });
  }

  /**
   * Get the transport instance
   */
  getTransport(): StdioServerTransport {
    return this.transport;
  }

  /**
   * Close the transport gracefully
   */
  close(): void {
    try {
      logger.info({
        msg: 'Closing MCP stdio transport',
        timestamp: new Date().toISOString(),
      });
      
      // The SDK transport handles cleanup internally
      // We just need to ensure our process handlers are cleaned up
      process.stdin.removeAllListeners();
      process.stdout.removeAllListeners();
      
    } catch (error) {
      logger.error({
        msg: 'Error closing MCP stdio transport',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

/**
 * Factory function to create stdio transport
 */
export function createStdioTransport(): StdioTransport {
  return new StdioTransport();
}