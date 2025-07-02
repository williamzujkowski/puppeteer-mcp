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
import { join } from 'path';
import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { ProtocolAdapter, MCPResponse, AuthParams } from './adapter.interface.js';
import type { GrpcServer } from '../../grpc/server.js';

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
    private readonly protoPath: string = join(process.cwd(), 'proto', 'control.proto')
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
      includeDirs: [join(process.cwd(), 'proto')],
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
      if (params.auth) {
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
        resource: params.operation ? JSON.stringify(params.operation) : 'unknown',
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
  private createMetadata(
    auth?: AuthParams,
    sessionId?: string,
    requestId?: string
  ): grpc.Metadata {
    const metadata = new grpc.Metadata();

    // Add authentication
    if (auth) {
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

    // Add session ID if provided separately
    if (sessionId && (!auth || auth.type !== 'session')) {
      metadata.add('x-session-id', sessionId);
    }

    // Add request ID for tracing
    if (requestId) {
      metadata.add('x-request-id', requestId);
    }

    return metadata;
  }

  /**
   * Execute a gRPC call with proper error handling
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  private executeGrpcCall(
    operation: GrpcOperation,
    metadata: grpc.Metadata
  ): Promise<any> {
    // Get the service implementation from the server
    const service = this.getServiceFromServer(operation.service);

    if (!service) {
      throw new AppError(`Service ${operation.service} not found`, 404);
    }

    const method = service[operation.method];
    if (!method || typeof method !== 'function') {
      throw new AppError(`Method ${operation.method} not found in ${operation.service}`, 404);
    }

    // Handle streaming vs unary calls
    if (operation.streaming) {
      return this.handleStreamingCall(service, operation.method, operation.request, metadata);
    } else {
      return this.handleUnaryCall(service, operation.method, operation.request, metadata);
    }
  }

  /**
   * Handle unary gRPC calls
   * @nist ac-3 "Access enforcement"
   */
  private handleUnaryCall(
    service: any,
    methodName: string,
    request: any,
    metadata: grpc.Metadata
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Create a mock call object that matches gRPC's ServerUnaryCall interface
      const call = {
        request: request || {},
        metadata,
        getPeer: () => 'mcp-internal',
        sendMetadata: () => {},
        end: () => {},
      };

      // Create callback
      const callback = (error: grpc.ServiceError | null, response?: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      };

      // Execute the method
      // eslint-disable-next-line security/detect-object-injection
      service[methodName](call, callback);
    });
  }

  /**
   * Handle streaming gRPC calls
   * @nist ac-3 "Access enforcement"
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  private handleStreamingCall(
    service: any,
    methodName: string,
    request: any,
    metadata: grpc.Metadata
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const responses: any[] = [];
      
      // Create a mock call object that matches gRPC's ServerWritableStream interface
      const call = {
        request: request || {},
        metadata,
        getPeer: () => 'mcp-internal',
        sendMetadata: () => {},
        write: (chunk: any) => {
          responses.push(chunk);
          return true;
        },
        end: () => {
          resolve(responses);
        },
        destroy: (error?: Error) => {
          if (error) {
            reject(error);
          }
        },
        on: () => call,
        emit: () => true,
      };

      try {
        // Execute the streaming method
        // eslint-disable-next-line security/detect-object-injection
        service[methodName](call);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get service implementation from the server
   * @nist cm-7 "Least functionality"
   */
  private getServiceFromServer(serviceName: string): any {
    // Access the service implementations through the server's internal structure
    // This is a simplified approach - in production, you might want to expose
    // a proper API for accessing services
    
    // The services are stored in the server's handlers
    // This is implementation-specific and may need adjustment
    const handlers = (this.server.getServer() as any).handlers;
    
    for (const [key, handler] of handlers) {
      if (key.includes(serviceName)) {
        return handler;
      }
    }
    
    return null;
  }

  /**
   * Transform gRPC response to MCP format
   * @nist au-3 "Content of audit records"
   */
  private transformToMCPResponse(
    response: any,
    operation: GrpcOperation,
    requestId: string
  ): MCPResponse {
    // Handle streaming responses
    if (Array.isArray(response)) {
      return {
        content: response.map((item) => ({
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
      content: [{
        type: 'text' as const,
        text: JSON.stringify(response, null, 2),
        data: response,
      }],
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
   * Transform error to MCP response format
   * @nist au-3 "Content of audit records"
   * @nist si-11 "Error handling"
   */
  private transformErrorToMCPResponse(error: unknown, requestId: string): MCPResponse {
    let errorMessage = 'Unknown error occurred';
    let errorCode = 'UNKNOWN';
    let statusCode = 500;

    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      errorMessage = (error as any).message;
      errorCode = grpc.status[(error as any).code] ?? 'UNKNOWN';
      statusCode = this.grpcStatusToHttp((error as any).code);
    } else if (error instanceof AppError) {
      errorMessage = error.message;
      errorCode = 'APP_ERROR';
      statusCode = error.statusCode;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          error: {
            code: errorCode,
            message: errorMessage,
          },
        }, null, 2),
      }],
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
  listEndpoints(): MCPResponse {
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

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(services, null, 2),
        data: services,
      }],
      metadata: {
        protocol: 'grpc',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get gRPC capabilities
   * @nist cm-7 "Least functionality"
   */
  getCapabilities(): {
    protocol: string;
    version: string;
    features: string[];
  } {
    return {
      protocol: 'grpc',
      version: '1.0.0',
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
    };
  }
}