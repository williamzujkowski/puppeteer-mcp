/**
 * MCP Protocol Adapters
 * @module mcp/adapters
 * @description Export all protocol adapters for MCP
 */

export { RestAdapter, createRestAdapter } from './rest-adapter.js';
export { GrpcAdapter } from './grpc-adapter.js';
export { WebSocketAdapter } from './ws-adapter.js';
export type { ProtocolAdapter, MCPResponse, AuthParams } from './adapter.interface.js';