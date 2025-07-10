/**
 * WebSocket server types and interfaces
 * @module ws/websocket/types
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import type { pino } from 'pino';
import type { SessionStore } from '../../store/session-store.interface.js';
import type { WSConnectionState, WSMessage } from '../../types/websocket.js';

/**
 * WebSocket server options
 */
export interface WSServerOptions {
  server: HttpServer;
  path?: string;
  maxPayload?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

/**
 * Connection entry for internal management
 */
export interface ConnectionEntry {
  connectionId: string;
  ws: WebSocket;
  state: WSConnectionState;
}

/**
 * Authentication parameters for connection authentication
 */
export interface AuthenticationParams {
  connectionId: string;
  userId: string;
  sessionId: string;
  roles?: string[];
  permissions?: string[];
  scopes?: string[];
}

/**
 * Connection statistics
 */
export interface ConnectionStats {
  total: number;
  authenticated: number;
  unauthenticated: number;
  uniqueUsers: number;
  uniqueSessions: number;
  connectionsByUser: Array<{ userId: string; count: number }>;
}

/**
 * WebSocket server statistics
 */
export interface WSServerStats {
  totalConnections: number;
  authenticatedConnections: number;
  unauthenticatedConnections: number;
  subscriptions: number;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  maxConnections: number;
  maxMessagesPerMinute: number;
  windowMs: number;
}

/**
 * Security validation options
 */
export interface SecurityValidationOptions {
  allowedOrigins?: string[];
  maxPayloadSize?: number;
  requireSecure?: boolean;
}

/**
 * Health monitoring configuration
 */
export interface HealthMonitorOptions {
  heartbeatInterval: number;
  connectionTimeout: number;
  maxStaleAge: number;
}

/**
 * Event handler options
 */
export interface EventHandlerOptions {
  maxSubscriptionsPerConnection?: number;
  broadcastBufferSize?: number;
}

/**
 * Middleware context
 */
export interface MiddlewareContext {
  connectionId: string;
  ws: WebSocket;
  state: WSConnectionState;
  message?: WSMessage;
  logger: pino.Logger;
}

/**
 * Middleware function type
 */
export type MiddlewareFunction = (
  context: MiddlewareContext,
  next: () => Promise<void>,
) => Promise<void>;

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  shouldReconnect: boolean;
  retryDelay?: number;
  maxRetries?: number;
}

/**
 * WebSocket component dependencies
 */
export interface WSComponentDependencies {
  logger: pino.Logger;
  sessionStore: SessionStore;
}

/**
 * Connection verification info
 */
export interface ConnectionVerificationInfo {
  origin: string;
  secure: boolean;
  req: {
    headers: Record<string, string | string[] | undefined>;
    socket: { remoteAddress?: string };
  };
}

/**
 * Connection verification callback
 */
export type ConnectionVerificationCallback = (
  result: boolean,
  code?: number,
  message?: string,
) => void;

/**
 * Message filter function
 */
export type MessageFilter = (state: WSConnectionState) => boolean;

/**
 * Session management options
 */
export interface SessionManagementOptions {
  sessionTimeout?: number;
  maxSessionsPerUser?: number;
  persistSessions?: boolean;
  cleanupInterval?: number;
  batchSize?: number;
  flushInterval?: number;
}