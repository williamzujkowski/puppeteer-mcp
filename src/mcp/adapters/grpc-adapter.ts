/* eslint-disable max-lines */
/**
 * gRPC Adapter for MCP
 * @module mcp/adapters/grpc-adapter
 * @description Translates MCP API calls to gRPC service calls and handles authentication
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @nist ia-2 "Identification and authentication"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join, dirname } from 'path';
import { z } from 'zod';
import { getDirnameFromSrc } from '../../utils/path-utils.js';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { ProtocolAdapter, MCPResponse, AuthParams } from './adapter.interface.js';
import type { GrpcServer } from '../../grpc/server.js';

/**
 * Generic service interface for gRPC services
 */
interface GrpcServiceHandler {
  [methodName: string]: (
    call: {
      request: Record<string, unknown>;
      metadata: grpc.Metadata;
      getPeer: () => string;
      sendMetadata: () => void;
      end?: () => void;
      write?: (chunk: unknown) => boolean;
      destroy?: (error?: Error) => void;
      on?: (event: string, listener: (...args: unknown[]) => void) => unknown;
      emit?: (event: string, ...args: unknown[]) => boolean;
    },
    callback?: (error: grpc.ServiceError | null, response?: Record<string, unknown>) => void,
  ) => void;
}

/**
 * gRPC response type for transformations
 */
type GrpcResponse = Record<string, unknown> | Record<string, unknown>[];

/**
 * gRPC operation parameters schema
 */
const GrpcOperationSchema = z.object({
  service: z.enum(['SessionService', 'ContextService', 'HealthService']),
  method: z.string(),
  request: z.unknown().optional(),
  streaming: z.boolean().optional().default(false),
});

type GrpcOperation = z.infer<typeof GrpcOperationSchema>;

/**
 * Authentication parameters schema
 */
const AuthParamsSchema = z.object({
  type: z.enum(['jwt', 'apikey', 'session']),
  credentials: z.string(),
});

/**
 * gRPC adapter for MCP protocol
 * @nist ac-3 "Access enforcement"
 * @nist ia-2 "Identification and authentication"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export class GrpcAdapter implements ProtocolAdapter {
  constructor(
    private readonly server: GrpcServer,
    // Use getDirnameFromSrc to work in both production and test environments
    private readonly protoPath: string = join(
      getDirnameFromSrc('mcp/adapters'),
      '..',
      '..',
      '..',
      'proto',
      'control.proto',
    ),
  ) {
    this.initializeProto();
  }

  /**
   * Initialize proto definitions
   * @nist cm-7 "Least functionality"
   */
  private initializeProto(): void {
    // Load proto definitions
    const packageDefinition = protoLoader.loadSync(this.protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [dirname(this.protoPath)],
    });

    // Proto is loaded but not stored as it's not directly used
    grpc.loadPackageDefinition(packageDefinition);
  }

  /**
   * Execute a gRPC request through MCP
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  async executeRequest(params: {
    operation: unknown;
    auth?: unknown;
    sessionId?: string;
  }): Promise<MCPResponse> {
    const startTime = Date.now();
    const requestId = `mcp-grpc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validate operation parameters
      const operation = GrpcOperationSchema.parse(params.operation);

      // Validate auth if provided
      let auth: AuthParams | undefined;
      if (params.auth !== null && params.auth !== undefined) {
        auth = AuthParamsSchema.parse(params.auth) as AuthParams;
      }

      // Create gRPC metadata
      const metadata = this.createMetadata(auth, params.sessionId, requestId);

      // Execute the gRPC call
      const response = await this.executeGrpcCall(operation, metadata);

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
      return this.transformToMCPResponse(response, operation, requestId);
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
      return this.transformErrorToMCPResponse(error, requestId);
    }
  }

  /**
   * Create gRPC metadata from authentication parameters
   * @nist ia-2 "Identification and authentication"
   * @nist ac-3 "Access enforcement"
   */
  private createMetadata(auth?: AuthParams, sessionId?: string, requestId?: string): grpc.Metadata {
    const metadata = new grpc.Metadata();

    // Add authentication
    this.addAuthenticationToMetadata(metadata, auth);

    // Add session ID if provided separately
    this.addSessionIdToMetadata(metadata, sessionId, auth);

    // Add request ID for tracing
    this.addRequestIdToMetadata(metadata, requestId);

    return metadata;
  }

  /**
   * Add authentication headers to metadata
   * @nist ia-2 "Identification and authentication"
   */
  private addAuthenticationToMetadata(metadata: grpc.Metadata, auth?: AuthParams): void {
    if (auth === null || auth === undefined) {
      return;
    }

    switch (auth.type) {
      case 'jwt':
        metadata.add('authorization', `Bearer ${auth.credentials}`);
        break;
      case 'apikey':
        metadata.add('x-api-key', auth.credentials);
        break;
      case 'session':
        metadata.add('x-session-id', auth.credentials);
        break;
    }
  }

  /**
   * Add session ID to metadata if valid
   * @nist ac-3 "Access enforcement"
   */
  private addSessionIdToMetadata(
    metadata: grpc.Metadata,
    sessionId?: string,
    auth?: AuthParams,
  ): void {
    if (this.isValidSessionId(sessionId) && (!auth || auth.type !== 'session')) {
      metadata.add('x-session-id', sessionId);
    }
  }

  /**
   * Add request ID to metadata if valid
   * @nist au-3 "Content of audit records"
   */
  private addRequestIdToMetadata(metadata: grpc.Metadata, requestId?: string): void {
    if (this.isValidString(requestId)) {
      metadata.add('x-request-id', requestId);
    }
  }

  /**
   * Check if session ID is valid
   */
  private isValidSessionId(sessionId?: string): sessionId is string {
    return sessionId !== null && sessionId !== undefined && sessionId !== '';
  }

  /**
   * Check if string is valid and non-empty
   */
  private isValidString(str?: string): str is string {
    return str !== null && str !== undefined && str !== '';
  }

  /**
   * Execute a gRPC call with proper error handling
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  private executeGrpcCall(
    operation: GrpcOperation,
    metadata: grpc.Metadata,
  ): Promise<GrpcResponse> {
    // Get the service implementation from the server
    const service = this.getServiceFromServer(operation.service);

    if (service === null || service === undefined) {
      throw new AppError(`Service ${operation.service} not found`, 404);
    }

    const method = service[operation.method];
    if (method === null || method === undefined || typeof method !== 'function') {
      throw new AppError(`Method ${operation.method} not found in ${operation.service}`, 404);
    }

    // Handle streaming vs unary calls
    if (operation.streaming) {
      return this.handleStreamingCall(
        service,
        operation.method,
        operation.request as Record<string, unknown>,
        metadata,
      );
    } else {
      return this.handleUnaryCall(
        service,
        operation.method,
        operation.request as Record<string, unknown>,
        metadata,
      );
    }
  }

  /**
   * Handle unary gRPC calls
   * @nist ac-3 "Access enforcement"
   */
  private handleUnaryCall(
    service: GrpcServiceHandler,
    methodName: string,
    request: Record<string, unknown>,
    metadata: grpc.Metadata,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      // Create a mock call object that matches gRPC's ServerUnaryCall interface
      const call = {
        request: request ?? {},
        metadata,
        getPeer: () => 'mcp-internal',
        sendMetadata: () => {},
        end: () => {},
      };

      // Create callback
      const callback = (
        error: grpc.ServiceError | null,
        response?: Record<string, unknown>,
      ): void => {
        if (error !== null) {
          reject(error);
        } else {
          resolve(response ?? {});
        }
      };

      // Execute the method
      // eslint-disable-next-line security/detect-object-injection
      const method = service[methodName];
      if (typeof method === 'function') {
        method(call, callback);
      } else {
        reject(new AppError(`Method ${methodName} is not a function`, 500));
      }
    });
  }

  /**
   * Handle streaming gRPC calls
   * @nist ac-3 "Access enforcement"
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  private handleStreamingCall(
    service: GrpcServiceHandler,
    methodName: string,
    request: Record<string, unknown>,
    metadata: grpc.Metadata,
  ): Promise<Record<string, unknown>[]> {
    return new Promise((resolve, reject) => {
      const responses: Record<string, unknown>[] = [];

      // Create a mock call object that matches gRPC's ServerWritableStream interface
      interface MockStreamCall {
        request: Record<string, unknown>;
        metadata: grpc.Metadata;
        getPeer: () => string;
        sendMetadata: () => void;
        write: (chunk: unknown) => boolean;
        end: () => void;
        destroy: (error?: Error) => void;
        on: () => MockStreamCall;
        emit: () => boolean;
      }

      const call: MockStreamCall = {
        request: request ?? {},
        metadata,
        getPeer: () => 'mcp-internal',
        sendMetadata: () => {},
        write: (chunk: unknown) => {
          responses.push(chunk as Record<string, unknown>);
          return true;
        },
        end: () => {
          resolve(responses);
        },
        destroy: (error?: Error) => {
          if (error !== null && error !== undefined) {
            reject(error);
          }
        },
        on: () => call,
        emit: (): boolean => true,
      };

      try {
        // Execute the streaming method
        // eslint-disable-next-line security/detect-object-injection
        const method = service[methodName];
        if (typeof method === 'function') {
          method(call);
        } else {
          reject(new AppError(`Method ${methodName} is not a function`, 500));
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Get service implementation from the server
   * @nist cm-7 "Least functionality"
   */
  private getServiceFromServer(serviceName: string): GrpcServiceHandler | null {
    // Access the service implementations through the server's internal structure
    // This is a simplified approach - in production, you might want to expose
    // a proper API for accessing services

    // The services are stored in the server's handlers
    // This is implementation-specific and may need adjustment
    const server = this.server.getServer() as unknown as {
      handlers: Map<string, unknown>;
    };
    const handlers = server.handlers;

    if (handlers instanceof Map) {
      // Build service object by collecting all methods for this service
      const serviceObj: GrpcServiceHandler = {};

      for (const [key, handler] of handlers) {
        if (key.includes(serviceName)) {
          // Extract method name from the key (e.g., "/mcp.control.v1.SessionService/CreateSession" -> "CreateSession")
          const methodName = key.split('/').pop();
          if (
            methodName !== null &&
            methodName !== undefined &&
            methodName !== '' &&
            typeof handler === 'function'
          ) {
            // Use Object.defineProperty to avoid object injection vulnerability
            Object.defineProperty(serviceObj, methodName, {
              value: handler as GrpcServiceHandler[string],
              writable: true,
              enumerable: true,
              configurable: true,
            });
          }
        }
      }

      // Return the service object if it has methods, otherwise null
      return Object.keys(serviceObj).length > 0 ? serviceObj : null;
    }

    return null;
  }

  /**
   * Transform gRPC response to MCP format
   * @nist au-3 "Content of audit records"
   */
  private transformToMCPResponse(
    response: GrpcResponse,
    operation: GrpcOperation,
    requestId: string,
  ): MCPResponse {
    // Handle streaming responses
    if (Array.isArray(response)) {
      return {
        content: response.map((item: Record<string, unknown>) => ({
          type: 'text' as const,
          text: JSON.stringify(item, null, 2),
          data: item,
        })),
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          protocol: 'grpc',
          service: operation.service,
          method: operation.method,
          streaming: true,
          itemCount: response.length,
        },
      };
    }

    // Handle unary responses
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(response, null, 2),
          data: response,
        },
      ],
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        protocol: 'grpc',
        service: operation.service,
        method: operation.method,
        streaming: false,
      },
    };
  }

  /**
   * Check if error is a gRPC error
   */
  private isGrpcError(error: unknown): error is { code: grpc.status; message: string } {
    return (
      error !== null &&
      error !== undefined &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error
    );
  }

  /**
   * Extract error details from various error types
   */
  private extractErrorDetails(error: unknown): {
    errorMessage: string;
    errorCode: string;
    statusCode: number;
  } {
    if (this.isGrpcError(error)) {
      return {
        errorMessage: error.message,
        errorCode: grpc.status[error.code] ?? 'UNKNOWN',
        statusCode: this.grpcStatusToHttp(error.code),
      };
    }

    if (error instanceof AppError) {
      return {
        errorMessage: error.message,
        errorCode: (error.details?.type as string) || error.name || 'APP_ERROR',
        statusCode: error.statusCode,
      };
    }

    if (error instanceof Error) {
      return {
        errorMessage: error.message,
        errorCode: 'UNKNOWN',
        statusCode: 500,
      };
    }

    return {
      errorMessage: 'Unknown error occurred',
      errorCode: 'UNKNOWN',
      statusCode: 500,
    };
  }

  /**
   * Transform error to MCP response format
   * @nist au-3 "Content of audit records"
   * @nist si-11 "Error handling"
   */
  private transformErrorToMCPResponse(error: unknown, requestId: string): MCPResponse {
    const { errorMessage, errorCode, statusCode } = this.extractErrorDetails(error);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: {
                code: errorCode,
                message: errorMessage,
              },
            },
            null,
            2,
          ),
        },
      ],
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        protocol: 'grpc',
        status: statusCode,
        error: true,
      },
    };
  }

  /**
   * gRPC to HTTP status code mapping
   */
  private readonly grpcToHttpStatus = new Map<grpc.status, number>([
    [grpc.status.OK, 200],
    [grpc.status.CANCELLED, 499],
    [grpc.status.INVALID_ARGUMENT, 400],
    [grpc.status.NOT_FOUND, 404],
    [grpc.status.ALREADY_EXISTS, 409],
    [grpc.status.PERMISSION_DENIED, 403],
    [grpc.status.UNAUTHENTICATED, 401],
    [grpc.status.RESOURCE_EXHAUSTED, 429],
    [grpc.status.FAILED_PRECONDITION, 412],
    [grpc.status.ABORTED, 409],
    [grpc.status.OUT_OF_RANGE, 400],
    [grpc.status.UNIMPLEMENTED, 501],
    [grpc.status.INTERNAL, 500],
    [grpc.status.UNAVAILABLE, 503],
    [grpc.status.DATA_LOSS, 500],
  ]);

  /**
   * Convert gRPC status code to HTTP status code
   * @nist si-11 "Error handling"
   */
  private grpcStatusToHttp(grpcCode: grpc.status): number {
    return this.grpcToHttpStatus.get(grpcCode) ?? 500;
  }

  /**
   * List available gRPC endpoints
   * @nist cm-7 "Least functionality"
   */
  listEndpoints(): Promise<MCPResponse> {
    const services = [
      {
        name: 'SessionService',
        methods: [
          { name: 'CreateSession', type: 'unary' },
          { name: 'GetSession', type: 'unary' },
          { name: 'UpdateSession', type: 'unary' },
          { name: 'DeleteSession', type: 'unary' },
          { name: 'ListSessions', type: 'unary' },
          { name: 'BatchGetSessions', type: 'unary' },
          { name: 'StreamSessionEvents', type: 'server-streaming' },
          { name: 'RefreshSession', type: 'unary' },
          { name: 'ValidateSession', type: 'unary' },
        ],
      },
      {
        name: 'ContextService',
        methods: [
          { name: 'CreateContext', type: 'unary' },
          { name: 'GetContext', type: 'unary' },
          { name: 'UpdateContext', type: 'unary' },
          { name: 'DeleteContext', type: 'unary' },
          { name: 'ListContexts', type: 'unary' },
          { name: 'StreamContextEvents', type: 'server-streaming' },
          { name: 'ExecuteCommand', type: 'unary' },
          { name: 'StreamCommand', type: 'server-streaming' },
        ],
      },
      {
        name: 'HealthService',
        methods: [
          { name: 'Check', type: 'unary' },
          { name: 'Watch', type: 'server-streaming' },
        ],
      },
    ];

    return Promise.resolve({
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(services, null, 2),
          data: services,
        },
      ],
      metadata: {
        protocol: 'grpc',
        version: '1.0.14',
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Get gRPC capabilities
   * @nist cm-7 "Least functionality"
   */
  getCapabilities(): Promise<{
    protocol: string;
    version: string;
    features: string[];
  }> {
    return Promise.resolve({
      protocol: 'grpc',
      version: '1.0.14',
      features: [
        'unary-calls',
        'server-streaming',
        'jwt-authentication',
        'api-key-authentication',
        'session-authentication',
        'metadata-headers',
        'error-details',
        'tls-support',
        'interceptors',
      ],
    });
  }
}
