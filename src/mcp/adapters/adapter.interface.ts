/**
 * MCP Protocol Adapter Interface
 * @module mcp/adapters/adapter.interface
 * @description Common interface for all protocol adapters (REST, gRPC, WebSocket)
 */

/**
 * MCP response format
 */
export interface MCPResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: unknown;
    mimeType?: string;
  }>;
  metadata?: {
    status?: number;
    headers?: Record<string, string>;
    timestamp?: string;
    requestId?: string;
    [key: string]: unknown;
  };
}

/**
 * Common authentication parameters
 */
export interface AuthParams {
  type: 'jwt' | 'apikey' | 'session';
  credentials: string;
}

/**
 * Base protocol adapter interface
 * @nist ac-3 "Access enforcement"
 */
export interface ProtocolAdapter {
  /**
   * Execute a protocol-specific request
   * @param params Request parameters specific to the protocol
   * @returns MCP formatted response
   */
  executeRequest(params: {
    operation: unknown;
    auth?: AuthParams;
    sessionId?: string;
    [key: string]: unknown;
  }): Promise<MCPResponse>;
  
  /**
   * List available endpoints/methods for this protocol
   * @returns MCP formatted response with endpoint information
   */
  listEndpoints?(): Promise<MCPResponse>;
  
  /**
   * Get protocol-specific configuration or capabilities
   * @returns Protocol configuration details
   */
  getCapabilities?(): Promise<{
    protocol: string;
    version: string;
    features: string[];
    [key: string]: unknown;
  }>;
}