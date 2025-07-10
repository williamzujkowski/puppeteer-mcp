/**
 * gRPC middleware chain processing
 * @module mcp/adapters/grpc/middleware-pipeline
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import { logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';
import type { GrpcOperation, ExecuteRequestParams } from './types.js';

/**
 * Middleware function interface
 */
export interface GrpcMiddleware {
  (
    operation: GrpcOperation,
    metadata: grpc.Metadata,
    params: ExecuteRequestParams,
    next: () => Promise<unknown>,
  ): Promise<unknown>;
}

/**
 * gRPC middleware pipeline manager
 */
export class GrpcMiddlewarePipeline {
  private readonly middlewares: GrpcMiddleware[] = [];

  /**
   * Add middleware to the pipeline
   */
  use(middleware: GrpcMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Execute the middleware pipeline
   */
  async execute(
    operation: GrpcOperation,
    metadata: grpc.Metadata,
    params: ExecuteRequestParams,
    finalHandler: () => Promise<unknown>,
  ): Promise<unknown> {
    let index = 0;

    const next = async (): Promise<unknown> => {
      if (index >= this.middlewares.length) {
        return finalHandler();
      }

      const middleware = this.middlewares[index++];
      return middleware(operation, metadata, params, next);
    };

    return next();
  }

  /**
   * Get authentication type safely
   */
  private static getAuthType(auth: unknown): string {
    if (auth !== null && auth !== undefined && typeof auth === 'object' && 'type' in auth) {
      return String(auth.type);
    }
    return 'none';
  }

  /**
   * Check if session ID is empty
   */
  private static isEmptySessionId(sessionId: unknown): boolean {
    return sessionId === null || sessionId === undefined || sessionId === '';
  }

  /**
   * Create authentication middleware
   * @nist ac-3 "Access enforcement"
   * @nist ia-2 "Identification and authentication"
   */
  static createAuthMiddleware(): GrpcMiddleware {
    return async (operation, _metadata, params, next) => {
      // Log authentication attempt
      await logSecurityEvent(SecurityEventType.AUTH_ATTEMPT, {
        userId: params.sessionId,
        resource: `${operation.service}.${operation.method}`,
        action: 'authenticate',
        metadata: {
          protocol: 'grpc',
          authType: GrpcMiddlewarePipeline.getAuthType(params.auth),
        },
      });

      // Validate authentication if required
      if (operation.service !== 'HealthService' && (params.auth === null || params.auth === undefined) && GrpcMiddlewarePipeline.isEmptySessionId(params.sessionId)) {
        await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
          userId: params.sessionId,
          resource: `${operation.service}.${operation.method}`,
          action: 'authenticate',
          result: 'failure',
          reason: 'No authentication provided',
        });
        
        throw new Error('Authentication required for this service');
      }

      return next();
    };
  }

  /**
   * Create request logging middleware
   * @nist au-3 "Content of audit records"
   */
  static createLoggingMiddleware(): GrpcMiddleware {
    return async (operation, _metadata, params, next) => {
      const startTime = Date.now();
      
      try {
        const result = await next();
        
        // Log successful request
        await logSecurityEvent(SecurityEventType.API_ACCESS, {
          userId: params.sessionId,
          resource: `${operation.service}.${operation.method}`,
          action: 'execute',
          result: 'success',
          metadata: {
            protocol: 'grpc',
            duration: Date.now() - startTime,
            streaming: operation.streaming,
          },
        });

        return result;
      } catch (error) {
        // Log failed request
        await logSecurityEvent(SecurityEventType.API_ACCESS, {
          userId: params.sessionId,
          resource: `${operation.service}.${operation.method}`,
          action: 'execute',
          result: 'failure',
          reason: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            protocol: 'grpc',
            duration: Date.now() - startTime,
            streaming: operation.streaming,
          },
        });

        throw error;
      }
    };
  }

  /**
   * Create rate limiting middleware
   * @nist ac-3 "Access enforcement"
   */
  static createRateLimitMiddleware(maxRequestsPerMinute = 60): GrpcMiddleware {
    const requestCounts = new Map<string, { count: number; resetTime: number }>();

    return async (operation, _metadata, params, next) => {
      const clientId = params.sessionId ?? 'anonymous';
      const now = Date.now();
      const resetTime = now + 60000; // 1 minute from now

      let clientData = requestCounts.get(clientId);
      
      if (clientData === undefined || now > clientData.resetTime) {
        clientData = { count: 0, resetTime };
        requestCounts.set(clientId, clientData);
      }

      if (clientData.count >= maxRequestsPerMinute) {
        await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
          userId: params.sessionId,
          resource: `${operation.service}.${operation.method}`,
          action: 'rate_limit',
          result: 'failure',
          reason: 'Rate limit exceeded',
        });

        throw new Error('Rate limit exceeded');
      }

      clientData.count++;
      return next();
    };
  }

  /**
   * Create validation middleware
   * @nist si-10 "Information input validation"
   */
  static createValidationMiddleware(): GrpcMiddleware {
    return async (operation, _metadata, _params, next) => {
      // Validate operation structure
      if (!operation.service || !operation.method) {
        throw new Error('Invalid operation: service and method are required');
      }

      // Validate service name
      const validServices = ['SessionService', 'ContextService', 'HealthService'];
      if (!validServices.includes(operation.service)) {
        throw new Error(`Invalid service: ${operation.service}`);
      }

      // Validate method name
      if (typeof operation.method !== 'string' || operation.method.trim() === '') {
        throw new Error('Invalid method name');
      }

      return next();
    };
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.middlewares.length = 0;
  }

  /**
   * Get middleware count
   */
  getMiddlewareCount(): number {
    return this.middlewares.length;
  }
}