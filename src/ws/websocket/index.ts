/**
 * WebSocket server modular implementation
 * @module ws/websocket
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

// Main WebSocket server
export { WSServer } from './ws-server.js';

// Core components
export { ConnectionManager } from './connection-manager.js';
export { AuthenticationHandler } from './authentication-handler.js';
export { MessageRouter } from './message-router.js';
export { EventHandler } from './event-handler.js';
export { SecurityManager } from './security-manager.js';
export { HealthMonitor } from './health-monitor.js';
export { SessionManager } from './session-manager.js';
export { MiddlewarePipeline } from './middleware-pipeline.js';
export { ErrorHandler } from './error-handler.js';

// Types and interfaces
export type {
  WSServerOptions,
  ConnectionEntry,
  AuthenticationParams,
  ConnectionStats,
  WSServerStats,
  RateLimitConfig,
  SecurityValidationOptions,
  HealthMonitorOptions,
  EventHandlerOptions,
  MiddlewareContext,
  MiddlewareFunction,
  ErrorRecoveryStrategy,
  WSComponentDependencies,
  ConnectionVerificationInfo,
  ConnectionVerificationCallback,
  MessageFilter,
  SessionManagementOptions,
} from './types.js';

// Factory function for backward compatibility
export function createWebSocketServer(
  logger: import('pino').Logger,
  sessionStore: import('../../store/session-store.interface.js').SessionStore,
  server: import('http').Server,
): WSServer {
  return new WSServer(logger, sessionStore, { server });
}