/**
 * Server module main exports
 * @module server
 */

// Main server coordination
export { PuppeteerMcpServer, startServer } from './server.js';

// Server components
export { createApp, createServer } from './http-server.js';
export { createGrpcServerInstance } from './grpc-server.js';
export { createWebSocketServerInstance } from './websocket-server.js';

// Configuration and setup
export {
  createServerConfig,
  validateServerConfig,
  shouldEnableTLS,
  createHttpsOptions,
  ServerError,
} from './server-config.js';

// Service management
export {
  createServerDependencies,
  createLogger,
  createSessionStore,
  createBrowserPool,
  shutdownAllServices,
} from './service-registry.js';

// Health monitoring
export {
  performHealthCheck,
  startHealthMonitoring,
  stopHealthMonitoring,
} from './health-monitor.js';

// Graceful shutdown
export { gracefulShutdown, setupAllProcessHandlers } from './graceful-shutdown.js';

// Types
export type {
  ServerInstance,
  ServerConfig,
  ServerDependencies,
  ServerComponents,
  ServerLifecycleHooks,
  HealthCheckStatus,
  ShutdownSignal,
  ServerStartupResult,
  MiddlewareConfig,
  RouteConfig,
  ExtendedServerError,
} from './types.js';

// Legacy exports for backward compatibility
export { createServerDependencies as createServerDependencies2 } from './service-registry.js';
