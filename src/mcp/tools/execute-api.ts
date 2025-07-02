/**
 * Execute API Tool Implementation
 * @module mcp/tools/execute-api
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';
import type { RestAdapter } from '../adapters/rest-adapter.js';
import type { GrpcAdapter } from '../adapters/grpc-adapter.js';
import type { WebSocketAdapter } from '../adapters/ws-adapter.js';
import type { ExecuteApiArgs, ToolResponse } from '../types/tool-types.js';
import type { MCPResponse } from '../adapters/adapter.interface.js';

/**
 * Execute API tool handler
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class ExecuteApiTool {
  constructor(
    private restAdapter?: RestAdapter,
    private grpcAdapter?: GrpcAdapter,
    private wsAdapter?: WebSocketAdapter
  ) {}

  /**
   * Execute the API tool with reduced complexity
   */
  async execute(args: ExecuteApiArgs): Promise<ToolResponse> {
    const { protocol } = args;
    
    try {
      // Validate and normalize authentication
      const normalizedAuth = this.normalizeAuth(args);
      
      // Execute based on protocol
      const result = await this.executeForProtocol(protocol, {
        operation: args.operation,
        auth: normalizedAuth,
        sessionId: args.sessionId,
      });
      
      return result;
    } catch (error) {
      // If it's already an McpError, re-throw it
      if (error instanceof McpError) {
        throw error;
      }
      
      // Otherwise, wrap it
      logger.error({
        msg: 'MCP API execution failed',
        protocol,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error ? error.message : 'API execution failed'
      );
    }
  }

  /**
   * Normalize authentication credentials
   */
  private normalizeAuth(args: ExecuteApiArgs): ExecuteApiArgs['auth'] {
    const { auth } = args;
    
    // If session type but no credentials, try to use sessionId from args
    if (auth && auth.type === 'session' && !auth.credentials) {
      if (args.sessionId) {
        return {
          ...auth,
          credentials: args.sessionId,
        };
      }
    }
    
    return auth;
  }

  /**
   * Execute request for specific protocol
   */
  private async executeForProtocol(
    protocol: string, 
    request: any
  ): Promise<ToolResponse> {
    switch (protocol) {
      case 'rest': {
        const result = await this.executeRestRequest(request);
        return result;
      }
      case 'grpc': {
        const result = await this.executeGrpcRequest(request);
        return result;
      }
      case 'websocket': {
        const result = await this.executeWebSocketRequest(request);
        return result;
      }
      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unsupported protocol: ${protocol}`
        );
    }
  }

  /**
   * Execute REST request
   */
  private async executeRestRequest(request: any): Promise<ToolResponse> {
    if (!this.restAdapter) {
      throw new McpError(
        ErrorCode.InvalidRequest, 
        'REST adapter not initialized. Express app required.'
      );
    }
    
    const response = await this.restAdapter.executeRequest(request);
    return this.convertToToolResponse(response);
  }

  /**
   * Execute gRPC request
   */
  private async executeGrpcRequest(request: any): Promise<ToolResponse> {
    if (!this.grpcAdapter) {
      throw new McpError(
        ErrorCode.InvalidRequest, 
        'gRPC adapter not initialized. gRPC server required.'
      );
    }
    
    const response = await this.grpcAdapter.executeRequest(request);
    return this.convertToToolResponse(response);
  }

  /**
   * Execute WebSocket request
   */
  private async executeWebSocketRequest(request: any): Promise<ToolResponse> {
    if (!this.wsAdapter) {
      throw new McpError(
        ErrorCode.InvalidRequest, 
        'WebSocket adapter not initialized. WebSocket server required.'
      );
    }
    
    const response = await this.wsAdapter.executeRequest(request);
    return this.convertToToolResponse(response);
  }

  /**
   * Convert MCPResponse to ToolResponse
   */
  private convertToToolResponse(response: MCPResponse): ToolResponse {
    return {
      content: response.content,
      _meta: response.metadata,
    };
  }
}