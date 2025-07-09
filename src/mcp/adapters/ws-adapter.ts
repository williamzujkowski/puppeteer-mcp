/**
 * WebSocket Adapter for MCP
 * @module mcp/adapters/ws-adapter
 * @description Re-export WebSocket adapter from modular structure
 */

export { WebSocketAdapter } from './websocket/index.js';
export type {
  WebSocketOperation,
  MCPWebSocketConnection,
  SubscriptionInfo,
  PendingRequest,
} from './websocket/index.js';
export { WebSocketEventType } from './websocket/index.js';
