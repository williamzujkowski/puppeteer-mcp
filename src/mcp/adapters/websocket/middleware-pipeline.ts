/**
 * WebSocket Middleware Pipeline
 * @module mcp/adapters/websocket/middleware-pipeline
 * @description Middleware chain processing for WebSocket messages
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import type { Logger } from 'pino';
import type { WSMessage } from './types.js';
import type { MCPWebSocketConnection } from './types.js';

/**
 * Middleware function type
 */
export type MiddlewareFunction = (
  message: WSMessage,
  connection: MCPWebSocketConnection,
  next: () => Promise<void>,
) => Promise<void>;

/**
 * Middleware context
 */
export interface MiddlewareContext {
  message: WSMessage;
  connection: MCPWebSocketConnection;
  metadata: Map<string, unknown>;
}

/**
 * WebSocket middleware pipeline
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */
export class WebSocketMiddlewarePipeline {
  private readonly logger: Logger;
  private readonly middlewares: MiddlewareFunction[] = [];

  constructor(logger: Logger) {
    this.logger = logger.child({ module: 'ws-middleware-pipeline' });
  }

  /**
   * Add middleware to pipeline
   */
  use(middleware: MiddlewareFunction): void {
    this.middlewares.push(middleware);
    this.logger.debug('Added middleware to pipeline', {
      count: this.middlewares.length,
    });
  }

  /**
   * Process message through middleware pipeline
   */
  async process(message: WSMessage, connection: MCPWebSocketConnection): Promise<void> {
    const startTime = Date.now();

    try {
      await this.runMiddlewares(message, connection, 0);

      this.logger.debug('Middleware pipeline completed', {
        messageId: message.id,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error('Middleware pipeline error', {
        messageId: message.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Run middlewares recursively
   */
  private async runMiddlewares(
    message: WSMessage,
    connection: MCPWebSocketConnection,
    index: number,
  ): Promise<void> {
    if (index >= this.middlewares.length) {
      return;
    }

    // eslint-disable-next-line security/detect-object-injection
    const middleware = this.middlewares[index];
    if (!middleware) {
      return;
    }
    
    const next = async (): Promise<void> => {
      await this.runMiddlewares(message, connection, index + 1);
    };

    await middleware(message, connection, next);
  }

  /**
   * Create validation middleware
   */
  static createValidationMiddleware(logger: Logger): MiddlewareFunction {
    return async (message, _connection, next): Promise<void> => {
      // Validate message structure
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      if (typeof message.type !== 'string' || message.type === '' || (message.id !== undefined && (typeof message.id !== 'string' || message.id === '')) || typeof message.timestamp !== 'string') {
        logger.error('Invalid message structure', { message });
        throw new Error('Invalid message structure');
      }

      await next();
    };
  }

  /**
   * Create authentication middleware
   */
  static createAuthMiddleware(logger: Logger): MiddlewareFunction {
    return async (message, connection, next): Promise<void> => {
      // Skip auth check for auth messages
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      if (message.type === 'auth') {
        await next();
        return;
      }

      // Check if connection is authenticated
      if (!connection.authenticated) {
        logger.error('Unauthenticated message', {
          connectionId: connection.connectionId,
          messageType: message.type,
        });
        throw new Error('Connection not authenticated');
      }

      await next();
    };
  }

  /**
   * Create logging middleware
   */
  static createLoggingMiddleware(logger: Logger): MiddlewareFunction {
    return async (message, connection, next): Promise<void> => {
      logger.debug('Processing message', {
        connectionId: connection.connectionId,
        messageId: message.id,
        messageType: message.type,
      });

      const startTime = Date.now();

      try {
        await next();
        logger.debug('Message processed successfully', {
          messageId: message.id,
          duration: Date.now() - startTime,
        });
      } catch (error) {
        logger.error('Message processing failed', {
          messageId: message.id,
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    };
  }

  /**
   * Create rate limiting middleware
   */
  static createRateLimitMiddleware(
    logger: Logger,
    maxRequestsPerMinute: number = 60,
  ): MiddlewareFunction {
    const requestCounts = new Map<string, { count: number; resetTime: number }>();

    return async (_message, connection, next): Promise<void> => {
      const now = Date.now();
      const connectionId = connection.connectionId;

      let requestData = requestCounts.get(connectionId);
      if (!requestData || now > requestData.resetTime) {
        requestData = {
          count: 0,
          resetTime: now + 60000, // 1 minute
        };
        requestCounts.set(connectionId, requestData);
      }

      requestData.count++;

      if (requestData.count > maxRequestsPerMinute) {
        logger.warn('Rate limit exceeded', {
          connectionId,
          count: requestData.count,
          limit: maxRequestsPerMinute,
        });
        throw new Error('Rate limit exceeded');
      }

      await next();
    };
  }

  /**
   * Clear all middlewares
   */
  clear(): void {
    this.middlewares.length = 0;
    this.logger.debug('Cleared all middlewares');
  }
}