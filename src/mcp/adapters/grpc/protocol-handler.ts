/**
 * MCP protocol-specific message handling for gRPC
 * @module mcp/adapters/grpc/protocol-handler
 * @nist au-3 "Content of audit records"
 * @nist si-10 "Information input validation"
 */

import type { MCPResponse } from '../adapter.interface.js';
import type { GrpcResponse, GrpcOperation, ServiceMetadata, GrpcCapabilities } from './types.js';

/**
 * MCP protocol handler for gRPC responses
 */
export class GrpcProtocolHandler {
  /**
   * Transform gRPC response to MCP format
   * @nist au-3 "Content of audit records"
   */
  transformToMCPResponse(
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
   * Get service metadata for endpoint discovery
   * @nist cm-7 "Least functionality"
   */
  getServiceMetadata(): ServiceMetadata[] {
    return [
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
  }

  /**
   * Create MCP response for endpoint listing
   */
  createEndpointsResponse(): MCPResponse {
    const services = this.getServiceMetadata();

    return {
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
    };
  }

  /**
   * Get gRPC capabilities
   * @nist cm-7 "Least functionality"
   */
  getCapabilities(): GrpcCapabilities {
    return {
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
    };
  }

  /**
   * Validate MCP request format for gRPC operations
   */
  validateMCPRequest(operation: unknown): boolean {
    if (operation === null || operation === undefined || typeof operation !== 'object') {
      return false;
    }

    const op = operation as Record<string, unknown>;
    
    // Check required fields
    if (typeof op.service !== 'string' || typeof op.method !== 'string') {
      return false;
    }

    // Validate service names
    const validServices = ['SessionService', 'ContextService', 'HealthService'];
    if (!validServices.includes(op.service)) {
      return false;
    }

    return true;
  }

  /**
   * Generate request ID for tracing
   */
  generateRequestId(): string {
    return `mcp-grpc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}