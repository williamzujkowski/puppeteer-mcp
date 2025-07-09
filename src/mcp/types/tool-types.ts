/**
 * MCP Tool Type Definitions
 * @module mcp/types/tool-types
 */

/**
 * Authentication types for MCP tools
 */
export interface MCPAuth {
  type: 'jwt' | 'apikey' | 'session';
  credentials: string;
}

/**
 * Base tool arguments
 */
export interface BaseToolArgs {
  sessionId?: string;
  auth?: MCPAuth;
}

/**
 * Execute API tool arguments
 */
export interface ExecuteApiArgs extends BaseToolArgs {
  protocol: 'rest' | 'grpc' | 'websocket';
  operation: {
    method?: string;
    endpoint?: string;
    service?: string;
    procedure?: string;
    type?: string;
    body?: unknown;
    headers?: Record<string, string>;
    metadata?: Record<string, string>;
  };
}

/**
 * Create session tool arguments
 */
export interface CreateSessionArgs {
  username: string;
  password: string;
  duration?: number;
}

/**
 * List sessions tool arguments
 */
export interface ListSessionsArgs {
  userId?: string;
}

/**
 * Delete session tool arguments
 */
export interface DeleteSessionArgs {
  sessionId: string;
}

/**
 * Create browser context arguments
 */
export interface CreateBrowserContextArgs extends BaseToolArgs {
  name?: string;
  options?: {
    headless?: boolean;
    viewport?: {
      width: number;
      height: number;
    };
    // Proxy configuration
    proxy?: {
      enabled: boolean;
      config?: {
        protocol: 'http' | 'https' | 'socks4' | 'socks5';
        host: string;
        port: number;
        auth?: {
          username: string;
          password: string;
        };
        bypass?: string[];
      };
      pool?: {
        proxies: Array<{
          protocol: 'http' | 'https' | 'socks4' | 'socks5';
          host: string;
          port: number;
          auth?: {
            username: string;
            password: string;
          };
          bypass?: string[];
        }>;
        strategy?: 'round-robin' | 'random' | 'least-used' | 'priority' | 'health-based';
      };
      rotateOnError?: boolean;
      rotateOnInterval?: boolean;
      rotationInterval?: number;
    };
  };
}

/**
 * Execute in context arguments
 */
export interface ExecuteInContextArgs extends BaseToolArgs {
  contextId: string;
  command: string;
  parameters?: Record<string, unknown>;
}

/**
 * Standard tool response format
 */
export interface ToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: unknown;
    mimeType?: string;
  }>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

/**
 * Tool error response
 */
export interface ToolErrorResponse {
  error: string;
  code: string;
}

/**
 * Tool success response
 */
export interface ToolSuccessResponse<T = unknown> {
  data?: T;
  success?: boolean;
  message?: string;
}
