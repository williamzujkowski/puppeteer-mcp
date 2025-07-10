/**
 * WebSocket middleware processing pipeline
 * @module ws/websocket/middleware-pipeline
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import type { pino } from 'pino';
import type { WSMessage } from '../../types/websocket.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { ConnectionManager } from './connection-manager.js';
import type { SecurityManager } from './security-manager.js';
import type { 
  WSComponentDependencies, 
  MiddlewareContext, 
  MiddlewareFunction 
} from './types.js';

/**
 * Middleware execution result
 */
interface MiddlewareResult {
  success: boolean;
  error?: string;
  shouldContinue: boolean;
}

/**
 * Built-in middleware types
 */
enum BuiltInMiddleware {
  AUTHENTICATION = 'authentication',
  RATE_LIMITING = 'rate_limiting',
  PAYLOAD_VALIDATION = 'payload_validation',
  SECURITY_VALIDATION = 'security_validation',
  LOGGING = 'logging',
  METRICS = 'metrics',
}

/**
 * WebSocket middleware processing pipeline
 * Processes messages through a configurable middleware stack
 * @nist ac-3 "Access enforcement"
 */
export class MiddlewarePipeline {
  private logger: pino.Logger;
  private middlewares: Array<{
    name: string;
    middleware: MiddlewareFunction;
    enabled: boolean;
  }> = [];

  constructor({ logger }: WSComponentDependencies) {
    this.logger = logger.child({ module: 'ws-middleware-pipeline' });
    this.setupBuiltInMiddleware();
  }

  /**
   * Add custom middleware to the pipeline
   */
  use(name: string, middleware: MiddlewareFunction): void {
    this.middlewares.push({
      name,
      middleware,
      enabled: true,
    });

    this.logger.debug('Middleware added to pipeline', { name });
  }

  /**
   * Enable or disable a middleware
   */
  setMiddlewareEnabled(name: string, enabled: boolean): boolean {
    const middleware = this.middlewares.find((m) => m.name === name);
    if (middleware) {
      middleware.enabled = enabled;
      this.logger.debug('Middleware state changed', { name, enabled });
      return true;
    }
    return false;
  }

  /**
   * Remove middleware from pipeline
   */
  remove(name: string): boolean {
    const index = this.middlewares.findIndex((m) => m.name === name);
    if (index >= 0) {
      this.middlewares.splice(index, 1);
      this.logger.debug('Middleware removed from pipeline', { name });
      return true;
    }
    return false;
  }

  /**
   * Execute middleware pipeline for incoming message
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async executeInbound(
    ws: WebSocket,
    connectionId: string,
    message: WSMessage,
    connectionManager: ConnectionManager,
    securityManager: SecurityManager,
  ): Promise<MiddlewareResult> {
    const state = connectionManager.getConnectionState(connectionId);
    if (!state) {
      return {
        success: false,
        error: 'Connection state not found',
        shouldContinue: false,
      };
    }

    const context: MiddlewareContext = {
      connectionId,
      ws,
      state,
      message,
      logger: this.logger,
    };

    return this.executeMiddlewareStack(context, 'inbound');
  }

  /**
   * Execute middleware pipeline for outbound message
   */
  async executeOutbound(
    ws: WebSocket,
    connectionId: string,
    message: WSMessage,
    connectionManager: ConnectionManager,
  ): Promise<MiddlewareResult> {
    const state = connectionManager.getConnectionState(connectionId);
    if (!state) {
      return {
        success: false,
        error: 'Connection state not found',
        shouldContinue: false,
      };
    }

    const context: MiddlewareContext = {
      connectionId,
      ws,
      state,
      message,
      logger: this.logger,
    };

    return this.executeMiddlewareStack(context, 'outbound');
  }

  /**
   * Get middleware pipeline status
   */
  getStatus(): Array<{ name: string; enabled: boolean }> {
    return this.middlewares.map(({ name, enabled }) => ({ name, enabled }));
  }

  /**
   * Execute the middleware stack
   */
  private async executeMiddlewareStack(
    context: MiddlewareContext,
    direction: 'inbound' | 'outbound',
  ): Promise<MiddlewareResult> {
    const enabledMiddlewares = this.middlewares.filter((m) => m.enabled);
    let currentIndex = 0;

    const next = async (): Promise<void> => {
      if (currentIndex < enabledMiddlewares.length) {
        const current = enabledMiddlewares[currentIndex++];
        if (!current) return;
        
        const { name, middleware } = current;
        
        try {
          await middleware(context, next);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown middleware error';
          
          this.logger.error('Middleware execution error', {
            middleware: name,
            direction,
            connectionId: context.connectionId,
            error: errorMessage,
          });

          // Log middleware error
          void logSecurityEvent(SecurityEventType.ERROR, {
            resource: 'websocket',
            action: 'middleware_execution',
            result: 'failure',
            metadata: {
              middleware: name,
              direction,
              connectionId: context.connectionId,
              error: errorMessage,
            },
          });

          throw error;
        }
      }
    };

    try {
      await next();
      return {
        success: true,
        shouldContinue: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Middleware execution failed',
        shouldContinue: false,
      };
    }
  }

  /**
   * Setup built-in middleware
   */
  private setupBuiltInMiddleware(): void {
    // Logging middleware
    this.use(BuiltInMiddleware.LOGGING, async (context, next) => {
      const start = Date.now();
      
      context.logger.debug('Processing message', {
        connectionId: context.connectionId,
        messageType: context.message?.type,
        messageId: context.message?.id,
      });

      await next();

      const duration = Date.now() - start;
      context.logger.debug('Message processed', {
        connectionId: context.connectionId,
        messageType: context.message?.type,
        messageId: context.message?.id,
        duration,
      });
    });

    // Payload validation middleware
    this.use(BuiltInMiddleware.PAYLOAD_VALIDATION, async (context, next) => {
      if (!context.message) {
        await next();
        return;
      }

      // Validate message structure
      if (!context.message.type) {
        throw new Error('Message type is required');
      }

      if (!context.message.timestamp) {
        context.message.timestamp = new Date().toISOString();
      }

      await next();
    });

    // Authentication middleware
    this.use(BuiltInMiddleware.AUTHENTICATION, async (context, next) => {
      if (!context.message) {
        await next();
        return;
      }

      // Skip authentication check for auth and ping/pong messages
      const skipAuthTypes = ['auth', 'ping', 'pong'];
      if (skipAuthTypes.includes(context.message.type)) {
        await next();
        return;
      }

      // Check if connection is authenticated
      if (!context.state.authenticated) {
        throw new Error('Authentication required');
      }

      await next();
    });

    // Metrics middleware
    this.use(BuiltInMiddleware.METRICS, async (context, next) => {
      const start = Date.now();
      
      try {
        await next();
        
        // Record successful processing
        const duration = Date.now() - start;
        void logSecurityEvent(SecurityEventType.API_ACCESS, {
          resource: 'websocket',
          action: 'process_message',
          result: 'success',
          metadata: {
            connectionId: context.connectionId,
            messageType: context.message?.type,
            messageId: context.message?.id,
            duration,
          },
        });
      } catch (error) {
        // Record processing error
        const duration = Date.now() - start;
        void logSecurityEvent(SecurityEventType.ERROR, {
          resource: 'websocket',
          action: 'process_message',
          result: 'failure',
          metadata: {
            connectionId: context.connectionId,
            messageType: context.message?.type,
            messageId: context.message?.id,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        
        throw error;
      }
    });

    this.logger.info('Built-in middleware initialized', {
      count: this.middlewares.length,
    });
  }
}