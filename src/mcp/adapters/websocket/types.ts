/**
 * WebSocket Adapter Types
 * @module mcp/adapters/websocket/types
 * @description Shared types and interfaces for WebSocket adapter
 */

import type { WebSocket } from 'ws';
import type { MCPResponse, AuthParams } from '../adapter.interface.js';

// Re-export MCPResponse for convenience
export type { MCPResponse };
import type {
  WSMessage,
  WSRequestMessage,
  WSResponseMessage,
  WSEventMessage,
  WSSubscriptionMessage,
  WSAuthMessage,
} from '../../../types/websocket.js';

/**
 * WebSocket operation parameters
 */
export interface WebSocketOperation {
  type: 'subscribe' | 'unsubscribe' | 'send' | 'broadcast';
  topic?: string;
  event?: string;
  data?: unknown;
  filters?: Record<string, unknown>;
  duration?: number;
  timeout: number;
}

/**
 * Pending request handler
 */
export interface PendingRequest {
  resolve: (response: MCPResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Subscription information
 */
export interface SubscriptionInfo {
  topic: string;
  filters?: Record<string, unknown>;
  handler: (data: unknown) => void;
}

/**
 * WebSocket connection wrapper for MCP
 */
export interface MCPWebSocketConnection {
  ws: WebSocket;
  connectionId: string;
  authenticated: boolean;
  pendingRequests: Map<string, PendingRequest>;
  subscriptions: Map<string, SubscriptionInfo>;
}

/**
 * Message handlers interface
 */
export interface MessageHandlers {
  handleResponseMessage: (connection: MCPWebSocketConnection, message: WSResponseMessage) => void;
  handleEventMessage: (connection: MCPWebSocketConnection, message: WSEventMessage) => void;
  handleErrorMessage: (connection: MCPWebSocketConnection, message: WSMessage) => void;
  handleSubscriptionUpdate: (connection: MCPWebSocketConnection, message: WSMessage) => void;
}

/**
 * Connection manager interface
 */
export interface ConnectionManagerInterface {
  ensureConnection(auth?: AuthParams, sessionId?: string): Promise<MCPWebSocketConnection>;
  cleanupConnection(connectionId: string): void;
  getConnection(connectionId: string): MCPWebSocketConnection | undefined;
}

/**
 * Session manager interface
 */
export interface SessionManagerInterface {
  createSession(connectionId: string): void;
  removeSession(connectionId: string): void;
  addSubscription(connectionId: string, subscriptionId: string, info: SubscriptionInfo): void;
  removeSubscription(connectionId: string, subscriptionId: string): void;
  getSubscriptions(connectionId: string): Map<string, SubscriptionInfo> | undefined;
}

/**
 * Protocol handler interface
 */
export interface ProtocolHandlerInterface {
  sendMessage(connection: MCPWebSocketConnection, message: WSMessage): Promise<void>;
  sendRequestAndWaitForResponse(
    connection: MCPWebSocketConnection,
    message: WSMessage,
    timeout: number,
  ): Promise<MCPResponse>;
  authenticateConnection(connection: MCPWebSocketConnection, auth: AuthParams): Promise<void>;
}

/**
 * WebSocket adapter configuration
 */
export interface WebSocketAdapterConfig {
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  defaultTimeout?: number;
}

/**
 * Export message types for convenience
 */
export type {
  WSMessage,
  WSRequestMessage,
  WSResponseMessage,
  WSEventMessage,
  WSSubscriptionMessage,
  WSAuthMessage,
};