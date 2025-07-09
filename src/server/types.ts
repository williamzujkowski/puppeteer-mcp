/**
 * Shared types and interfaces for server modules
 * @module server/types
 * @nist cm-7 "Least functionality"
 */

import { Application } from 'express';
import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { Logger } from 'pino';
import { SessionStore } from '../store/session-store.interface.js';
import { BrowserPool } from '../puppeteer/pool/browser-pool.js';
import { GrpcServer } from '../grpc/server.js';
import { WSServer } from '../ws/server.js';

/**
 * Union type for HTTP/HTTPS servers
 */
export type ServerInstance = HttpServer | HttpsServer;

/**
 * Server configuration interface
 */
export interface ServerConfig {
  readonly port: number;
  readonly host: string;
  readonly grpcPort: number;
  readonly grpcHost: string;
  readonly nodeEnv: string;
  readonly tlsEnabled: boolean;
  readonly apiPrefix: string;
  readonly apiVersion: string;
  readonly wsPath: string;
}

/**
 * Server dependencies interface
 */
export interface ServerDependencies {
  readonly logger: Logger;
  readonly sessionStore: SessionStore;
  readonly browserPool: BrowserPool;
  readonly config: ServerConfig;
}

/**
 * Server components interface
 */
export interface ServerComponents {
  readonly app: Application;
  readonly server: ServerInstance;
  readonly grpcServer: GrpcServer;
  readonly wsServer?: WSServer;
}

/**
 * Server lifecycle hooks interface
 */
export interface ServerLifecycleHooks {
  readonly onBeforeStart?: () => Promise<void>;
  readonly onAfterStart?: () => Promise<void>;
  readonly onBeforeShutdown?: () => Promise<void>;
  readonly onAfterShutdown?: () => Promise<void>;
}

/**
 * Health check status interface
 */
export interface HealthCheckStatus {
  readonly status: 'healthy' | 'unhealthy' | 'degraded';
  readonly services: Record<string, {
    status: 'up' | 'down' | 'warning';
    message?: string;
    timestamp: string;
  }>;
  readonly uptime: number;
  readonly version: string;
}

/**
 * Shutdown signal types
 */
export type ShutdownSignal = 'SIGTERM' | 'SIGINT' | 'SIGHUP';

/**
 * Server startup result interface
 */
export interface ServerStartupResult {
  readonly success: boolean;
  readonly httpUrl: string;
  readonly grpcUrl: string;
  readonly wsUrl: string;
  readonly error?: Error;
}

/**
 * Middleware setup configuration
 */
export interface MiddlewareConfig {
  readonly enableSecurity: boolean;
  readonly enableRateLimit: boolean;
  readonly enableCsrf: boolean;
  readonly enableCors: boolean;
  readonly enableCompression: boolean;
  readonly enableTelemetry: boolean;
}

/**
 * Route setup configuration
 */
export interface RouteConfig {
  readonly apiPrefix: string;
  readonly apiVersion: string;
  readonly enableHealthRoutes: boolean;
  readonly enableApiRoutes: boolean;
}

/**
 * Error with additional context
 */
export interface ExtendedServerError extends Error {
  readonly code?: string;
  readonly statusCode?: number;
  readonly context?: Record<string, unknown>;
}