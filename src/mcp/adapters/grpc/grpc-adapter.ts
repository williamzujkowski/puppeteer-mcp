/**
 * Main gRPC adapter class
 * @module mcp/adapters/grpc/grpc-adapter
 * @description Translates MCP API calls to gRPC service calls and handles authentication
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @nist ia-2 "Identification and authentication"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import * as grpc from '@grpc/grpc-js';
import { logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';
import type { ProtocolAdapter, MCPResponse, AuthParams } from '../adapter.interface.js';
import type { GrpcServer } from '../../../grpc/server.js';
import type { 
  ExecuteRequestParams,
  GrpcCapabilities,
  GrpcResponse,
} from './types.js';
import { GrpcOperationSchema } from './types.js';
import { GrpcConnectionManager } from './connection-manager.js';
import { GrpcServiceMethodHandler } from './service-handler.js';
import { GrpcMetadataManager } from './metadata-manager.js';
import { GrpcProtocolHandler } from './protocol-handler.js';
import { GrpcErrorHandler } from './error-handler.js';
import { GrpcMiddlewarePipeline } from './middleware-pipeline.js';
import { GrpcAuthHandler } from './auth-handler.js';

/**
 * gRPC adapter for MCP protocol
 * @nist ac-3 "Access enforcement"
 * @nist ia-2 "Identification and authentication"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export class GrpcAdapter implements ProtocolAdapter {
  private readonly connectionManager: GrpcConnectionManager;
  private readonly serviceHandler: GrpcServiceMethodHandler;
  private readonly metadataManager: GrpcMetadataManager;
  private readonly protocolHandler: GrpcProtocolHandler;
  private readonly errorHandler: GrpcErrorHandler;
  private readonly middlewarePipeline: GrpcMiddlewarePipeline;
  private readonly authHandler: GrpcAuthHandler;

  constructor(
    server: GrpcServer,
    protoPath?: string,
  ) {
    this.connectionManager = new GrpcConnectionManager(server, protoPath);
    this.serviceHandler = new GrpcServiceMethodHandler(this.connectionManager);
    this.metadataManager = new GrpcMetadataManager();
    this.protocolHandler = new GrpcProtocolHandler();
    this.errorHandler = new GrpcErrorHandler();
    this.middlewarePipeline = new GrpcMiddlewarePipeline();
    this.authHandler = new GrpcAuthHandler();

    this.initializeMiddleware();
  }

  /**
   * Initialize middleware pipeline
   */
  private initializeMiddleware(): void {
    this.middlewarePipeline.use(GrpcMiddlewarePipeline.createValidationMiddleware());
    this.middlewarePipeline.use(GrpcMiddlewarePipeline.createAuthMiddleware());
    this.middlewarePipeline.use(GrpcMiddlewarePipeline.createRateLimitMiddleware(100));
    this.middlewarePipeline.use(GrpcMiddlewarePipeline.createLoggingMiddleware());
  }

  /**
   * Execute a gRPC request through MCP
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  async executeRequest(params: ExecuteRequestParams): Promise<MCPResponse> {
    const startTime = Date.now();
    const requestId = this.protocolHandler.generateRequestId();

    try {
      // Validate operation parameters
      const operationResult = GrpcOperationSchema.safeParse(params.operation);
      if (!operationResult.success) {
        throw new Error(`Invalid operation: ${operationResult.error.message}`);
      }
      const operation = operationResult.data;

      // Validate auth if provided
      let auth: AuthParams | undefined;
      if (params.auth !== null && params.auth !== undefined) {
        const authResult = this.authHandler.validateAuthParams(params.auth);
        if (!authResult.success) {
          throw new Error(authResult.error);
        }
        auth = authResult.data;
      }

      // Create gRPC metadata
      const metadata = this.metadataManager.createMetadata({
        auth,
        sessionId: params.sessionId,
        requestId,
      });

      // Execute through middleware pipeline
      const response = await this.middlewarePipeline.execute(
        operation,
        metadata,
        params,
        () => this.executeAuthenticatedCall(operation, metadata, params, auth),
      );

      // Log successful execution
      await logSecurityEvent(SecurityEventType.API_ACCESS, {
        userId: params.sessionId,
        resource: `${operation.service}.${operation.method}`,
        action: 'execute',
        result: 'success',
        metadata: {
          protocol: 'mcp-grpc',
          requestId,
          duration: Date.now() - startTime,
        },
      });

      // Transform to MCP response
      return this.protocolHandler.transformToMCPResponse(response as GrpcResponse, operation, requestId);
    } catch (error) {
      // Log failed execution
      await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
        userId: params.sessionId,
        resource:
          params.operation !== null && params.operation !== undefined
            ? JSON.stringify(params.operation)
            : 'unknown',
        action: 'execute',
        result: 'failure',
        reason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          protocol: 'mcp-grpc',
          requestId,
          duration: Date.now() - startTime,
        },
      });

      // Transform error to MCP response
      return this.errorHandler.transformErrorToMCPResponse(error, requestId);
    }
  }

  /**
   * List available gRPC endpoints
   * @nist cm-7 "Least functionality"
   */
  listEndpoints(): Promise<MCPResponse> {
    return Promise.resolve(this.protocolHandler.createEndpointsResponse());
  }

  /**
   * Get gRPC capabilities
   * @nist cm-7 "Least functionality"
   */
  getCapabilities(): Promise<GrpcCapabilities> {
    return Promise.resolve(this.protocolHandler.getCapabilities());
  }

  /**
   * Get connection health status
   */
  getHealthStatus(): {
    healthy: boolean;
    stats: {
      isConnected: boolean;
      protoLoaded: boolean;
      serverActive: boolean;
    };
  } {
    return {
      healthy: this.connectionManager.isHealthy(),
      stats: this.connectionManager.getStats(),
    };
  }

  /**
   * Validate service and method
   */
  validateServiceMethod(serviceName: string, methodName: string): boolean {
    return this.serviceHandler.validateServiceMethod(serviceName, methodName);
  }

  /**
   * Get available methods for a service
   */
  getServiceMethods(serviceName: string): string[] {
    return this.serviceHandler.getServiceMethods(serviceName);
  }

  /**
   * Execute an authenticated gRPC call
   */
  private async executeAuthenticatedCall(
    operation: { service: string; method: string },
    metadata: grpc.Metadata,
    params: ExecuteRequestParams,
    auth?: AuthParams,
  ): Promise<unknown> {
    // Handle authentication if required
    if (this.authHandler.requiresAuthentication(operation.service, operation.method)) {
      await this.handleAuthentication(operation, metadata, params, auth);
    }

    // Execute the gRPC call
    return this.serviceHandler.executeGrpcCall({ 
      ...operation, 
      streaming: false,
      service: operation.service as 'SessionService' | 'ContextService' | 'HealthService'
    }, metadata);
  }

  /**
   * Handle authentication and authorization
   */
  private async handleAuthentication(
    operation: { service: string; method: string },
    metadata: grpc.Metadata,
    params: ExecuteRequestParams,
    auth?: AuthParams,
  ): Promise<void> {
    if (auth) {
      await this.handleAuthWithCredentials(operation, metadata, params, auth);
    } else if (this.isEmptySessionId(params.sessionId)) {
      throw new Error('Authentication required');
    }
  }

  /**
   * Handle authentication with credentials
   */
  private async handleAuthWithCredentials(
    operation: { service: string; method: string },
    metadata: grpc.Metadata,
    params: ExecuteRequestParams,
    auth: AuthParams,
  ): Promise<void> {
    const authResult = await this.authHandler.authenticate(auth, metadata, params.sessionId);
    if (!authResult.success) {
      throw new Error(`Authentication failed: ${authResult.error}`);
    }

    // Check permissions
    if (authResult.userId !== undefined && authResult.userId !== null && authResult.userId !== '') {
      const hasPermission = await this.authHandler.checkPermission(
        authResult.userId,
        operation.service,
        operation.method,
        metadata,
      );
      if (!hasPermission) {
        throw new Error('Insufficient permissions');
      }
    }
  }

  /**
   * Check if session ID is empty
   */
  private isEmptySessionId(sessionId?: string): boolean {
    return sessionId === undefined || sessionId === null || sessionId === '';
  }
}