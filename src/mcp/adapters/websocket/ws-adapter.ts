/**
 * WebSocket Adapter for MCP
 * @module mcp/adapters/websocket/ws-adapter
 * @description Main WebSocket adapter class that integrates all modules
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @nist ia-2 "Identification and authentication"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { z } from 'zod';
import type { Logger } from 'pino';
import { AppError } from '../../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';
import type { ProtocolAdapter, MCPResponse, AuthParams } from '../adapter.interface.js';
import { WSConnectionManager } from '../../../ws/connection-manager.js';
import { WSSubscriptionManager } from '../../../ws/subscription-manager.js';
import { WSMessageType } from '../../../types/websocket.js';
// import type { WebSocketOperation } from './types.js'; // Unused - operations handled via schema
import { WebSocketConnectionManager } from './connection-manager.js';
import { WebSocketEventEmitter } from './event-emitter.js';
import { WebSocketSessionManager } from './session-manager.js';
import { WebSocketProtocolHandler } from './protocol-handler.js';
import { WebSocketErrorHandler } from './error-handler.js';
import { WebSocketOperationHandlers } from './operation-handlers.js';
import {
  WEBSOCKET_ENDPOINTS,
  WEBSOCKET_FEATURES,
  WEBSOCKET_AUTH_TYPES,
  WEBSOCKET_SUBSCRIPTION_TOPICS,
  WEBSOCKET_VERSION,
  DEFAULT_TIMEOUT,
} from './constants.js';

/**
 * WebSocket operation parameters schema
 */
const WebSocketOperationSchema = z.object({
  type: z.enum(['subscribe', 'unsubscribe', 'send', 'broadcast']),
  topic: z.string().optional(),
  event: z.string().optional(),
  data: z.unknown().optional(),
  filters: z.record(z.unknown()).optional(),
  duration: z.number().positive().optional(),
  timeout: z.number().positive().default(DEFAULT_TIMEOUT),
});

/**
 * WebSocket adapter for MCP protocol
 * @nist ac-3 "Access enforcement"
 * @nist ia-2 "Identification and authentication"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export class WebSocketAdapter implements ProtocolAdapter {
  private readonly logger: Logger;
  private readonly wsConnectionManager: WSConnectionManager;
  private readonly wsSubscriptionManager: WSSubscriptionManager;
  private readonly eventEmitter: WebSocketEventEmitter;
  private readonly sessionManager: WebSocketSessionManager;
  private readonly connectionManager: WebSocketConnectionManager;
  private readonly protocolHandler: WebSocketProtocolHandler;
  private readonly errorHandler: WebSocketErrorHandler;
  private readonly operationHandlers: WebSocketOperationHandlers;

  constructor(
    logger: Logger,
    wsConnectionManager: WSConnectionManager,
    wsSubscriptionManager: WSSubscriptionManager,
  ) {
    this.logger = logger.child({ module: 'mcp-ws-adapter' });
    this.wsConnectionManager = wsConnectionManager;
    this.wsSubscriptionManager = wsSubscriptionManager;

    // Initialize components
    this.eventEmitter = new WebSocketEventEmitter(logger);
    this.sessionManager = new WebSocketSessionManager(logger, this.eventEmitter);
    this.connectionManager = new WebSocketConnectionManager(
      logger,
      this.eventEmitter,
      this.sessionManager,
    );
    this.protocolHandler = new WebSocketProtocolHandler(logger);
    this.errorHandler = new WebSocketErrorHandler(logger);
    this.operationHandlers = new WebSocketOperationHandlers({
      protocolHandler: this.protocolHandler,
      eventEmitter: this.eventEmitter,
      sessionManager: this.sessionManager,
      wsConnectionManager: this.wsConnectionManager,
      wsSubscriptionManager: this.wsSubscriptionManager,
    });
  }

  /**
   * Execute a WebSocket operation through MCP
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async executeRequest(params: {
    operation: unknown;
    auth?: AuthParams;
    sessionId?: string;
    [key: string]: unknown;
  }): Promise<MCPResponse> {
    try {
      // Validate operation parameters
      const operation = WebSocketOperationSchema.parse(params.operation);

      // Ensure connection is established and authenticated
      const connection = await this.connectionManager.ensureConnection(
        params.auth,
        params.sessionId,
      );

      // Log security event
      await logSecurityEvent(SecurityEventType.API_ACCESS, {
        userId: params.sessionId,
        action: `websocket_${operation.type}`,
        resource: operation.topic ?? 'websocket',
        result: 'success',
        metadata: { operation: operation.type },
      });

      // Execute operation based on type
      switch (operation.type) {
        case 'subscribe':
          return await this.operationHandlers.handleSubscribe(connection, operation);
        case 'unsubscribe':
          return await this.operationHandlers.handleUnsubscribe(connection, operation);
        case 'send':
          return await this.operationHandlers.handleSend(connection, operation);
        case 'broadcast':
          return await this.operationHandlers.handleBroadcast(connection, operation);
        default:
          throw new AppError('Invalid WebSocket operation', 400);
      }
    } catch (error) {
      // Handle operation error
      await this.errorHandler.handleOperationError(
        params.operation ? String((params.operation as { type?: string }).type) : 'unknown',
        error as Error,
        params.sessionId,
        { operation: params.operation },
      );

      throw error;
    }
  }


  /**
   * List available WebSocket endpoints
   */
  listEndpoints(): Promise<MCPResponse> {
    return Promise.resolve({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ endpoints: WEBSOCKET_ENDPOINTS }, null, 2),
        },
      ],
    });
  }

  /**
   * Get WebSocket capabilities
   */
  getCapabilities(): Promise<{
    protocol: string;
    version: string;
    features: string[];
    [key: string]: unknown;
  }> {
    return Promise.resolve({
      protocol: 'websocket',
      version: WEBSOCKET_VERSION,
      features: WEBSOCKET_FEATURES,
      authentication: WEBSOCKET_AUTH_TYPES,
      subscriptionTopics: WEBSOCKET_SUBSCRIPTION_TOPICS,
      messageTypes: Object.values(WSMessageType),
      stats: this.connectionManager.getConnectionStats(),
    });
  }

  /**
   * Create a streaming response helper for MCP
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  async *createStreamingResponse(subscriptionId: string): AsyncGenerator<MCPResponse> {
    const events: unknown[] = [];
    let resolveNext: ((value: unknown) => void) | null = null;

    // Set up event listener
    const handler = (data: unknown): void => {
      if (resolveNext) {
        resolveNext(data);
        resolveNext = null;
      } else {
        events.push(data);
      }
    };

    this.eventEmitter.on(`subscription:${subscriptionId}`, handler);

    try {
      while (true) {
        // Get next event
        const data =
          events.shift() ??
          (await new Promise((resolve) => {
            resolveNext = resolve;
          }));

        // Yield MCP response
        yield {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data),
            },
          ],
          metadata: {
            subscriptionId,
            timestamp: new Date().toISOString(),
          },
        };
      }
    } finally {
      // Clean up listener
      this.eventEmitter.off(`subscription:${subscriptionId}`, handler);
    }
  }

  /**
   * Clean up adapter resources
   */
  cleanup(): void {
    this.logger.info('Cleaning up WebSocket adapter');
    this.connectionManager.cleanup();
    this.sessionManager.cleanup();
    this.eventEmitter.cleanup();
  }
}