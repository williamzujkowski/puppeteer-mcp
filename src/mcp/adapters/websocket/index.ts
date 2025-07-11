/**
 * WebSocket Adapter Module
 * @module mcp/adapters/websocket
 * @description Re-export the main WebSocket adapter class
 */

export { WebSocketAdapter } from './ws-adapter.js';
export type {
  WebSocketOperation,
  MCPWebSocketConnection,
  SubscriptionInfo,
  PendingRequest,
} from './types.js';
export { WebSocketEventType } from './event-emitter.js';
