/**
 * MCP Server Protocol Handlers
 * @module mcp/server-protocol-handlers
 * @description Core protocol handlers for MCP server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  InitializeRequestSchema,
  InitializedNotificationSchema,
  PingRequestSchema,
  CancelledNotificationSchema,
  LATEST_PROTOCOL_VERSION,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';

/**
 * Set up core MCP protocol handlers
 */
export function setupProtocolHandlers(server: Server): void {
  // Initialize request handler - Required by MCP 2025-06-18
  server.setRequestHandler(InitializeRequestSchema, (request) => {
    logger.info({
      msg: 'MCP initialization request received',
      clientProtocolVersion: request.params.protocolVersion,
      timestamp: new Date().toISOString(),
    });

    return {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {
        logging: {},
        resources: {
          subscribe: false,
          listChanged: false,
        },
        tools: {
          listChanged: false,
        },
        prompts: {
          listChanged: false,
        },
        experimental: {
          browserAutomation: {},
          multiProtocolAdapter: {},
        },
      },
      serverInfo: {
        name: 'puppeteer-mcp',
        version: '1.0.10',
        title: 'Puppeteer MCP Server',
      },
      instructions:
        'Multi-protocol browser automation platform with REST/gRPC/WebSocket/MCP interfaces. Use tools for browser automation, session management, and API execution.',
    };
  });

  // Initialized notification handler - Required by MCP 2025-06-18
  server.setNotificationHandler(InitializedNotificationSchema, () => {
    logger.info({
      msg: 'MCP server initialized successfully',
      protocolVersion: LATEST_PROTOCOL_VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  // Ping request handler - Required by MCP 2025-06-18
  server.setRequestHandler(PingRequestSchema, () => {
    logger.debug({
      msg: 'MCP ping received',
      timestamp: new Date().toISOString(),
    });
    return {};
  });

  // Cancellation notification handler - Required by MCP 2025-06-18
  server.setNotificationHandler(CancelledNotificationSchema, (notification) => {
    logger.info({
      msg: 'MCP request cancellation received',
      requestId: notification.params.requestId,
      reason: notification.params.reason,
      timestamp: new Date().toISOString(),
    });
    // TODO: Implement actual request cancellation logic
  });
}
