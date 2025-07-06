/**
 * MCP Server Transport Handler
 * @module mcp/server-transport
 * @description Handles transport setup for MCP server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { logger } from '../utils/logger.js';
import {
  TransportType,
  getTransportType,
  createStdioTransport,
  createHttpTransport,
} from './transport/index.js';

/**
 * Handle transport setup for MCP server
 */
export async function setupTransport(server: Server): Promise<void> {
  const transportType = getTransportType();

  logger.info({
    msg: 'Starting MCP server',
    transportType,
    timestamp: new Date().toISOString(),
  });

  switch (transportType) {
    case TransportType.STDIO: {
      const stdioTransport = createStdioTransport();
      await server.connect(stdioTransport.getTransport());
      // Await any async connection setup
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      logger.info({
        msg: 'MCP server started with stdio transport',
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case TransportType.HTTP: {
      // HTTP transport requires a different approach
      // The MCP SDK doesn't directly support HTTP transport yet
      // We'll need to implement a custom bridge
      const httpTransport = createHttpTransport();
      await httpTransport.start();

      logger.info({
        msg: 'MCP HTTP transport started',
        note: 'HTTP transport bridge implementation pending',
        timestamp: new Date().toISOString(),
      });
      break;
    }

    default:
      throw new Error(`Unsupported transport type: ${String(transportType)}`);
  }
}
