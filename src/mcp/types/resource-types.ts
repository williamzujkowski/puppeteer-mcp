/**
 * MCP Resource Type Definitions
 * @module mcp/types/resource-types
 */

/**
 * REST endpoint definition
 */
export interface RestEndpoint {
  path: string;
  methods: string[];
  description: string;
}

/**
 * gRPC service definition
 */
export interface GrpcService {
  name: string;
  methods: string[];
}

/**
 * WebSocket topic definition
 */
export interface WebSocketTopic {
  name: string;
  description: string;
}

/**
 * API catalog structure
 */
export interface ApiCatalog {
  rest: {
    baseUrl: string;
    endpoints: RestEndpoint[];
    authentication: {
      methods: string[];
      headers: Record<string, string>;
    };
  };
  grpc: {
    services: GrpcService[];
  };
  websocket: {
    endpoint: string;
    topics: WebSocketTopic[];
  };
}

/**
 * System health status
 */
export interface SystemHealth {
  status: string;
  uptime: number;
  services: {
    rest: string;
    grpc: string;
    websocket: string;
    mcp: string;
  };
  timestamp: string;
}

/**
 * Resource response format
 */
export interface ResourceResponse {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}
