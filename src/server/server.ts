/**
 * Main server coordination class
 * @module server/server
 * @nist cm-7 "Least functionality"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { config } from '../core/config.js';
import { createApp, createServer, startHttpServer } from './http-server.js';
import { createGrpcServerInstance, startGrpcServer } from './grpc-server.js';
import { startWebSocketServer } from './websocket-server.js';
import { startMcpServer, isMcpModeEnabled } from './mcp-server.js';
import { createServerDependencies } from './service-registry.js';
import { validateServerConfig } from './server-config.js';
import { performHealthCheck, startHealthMonitoring } from './health-monitor.js';
import { setupAllProcessHandlers } from './graceful-shutdown.js';
import { ServerComponents, ServerDependencies, ServerStartupResult } from './types.js';
import { ServerError } from './server-config.js';

/**
 * Main server coordination class
 */
export class PuppeteerMcpServer {
  private components?: ServerComponents;
  private dependencies?: ServerDependencies;
  private _healthMonitoringInterval?: NodeJS.Timeout;

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    try {
      // Create and validate dependencies
      this.dependencies = await createServerDependencies();
      validateServerConfig(this.dependencies.config);

      this.dependencies.logger.info('Server dependencies initialized successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to initialize server dependencies:', errorMsg);
      throw new ServerError(`Server initialization failed: ${errorMsg}`);
    }
  }

  /**
   * Start all server components
   */
  async start(): Promise<ServerStartupResult> {
    if (!this.dependencies) {
      throw new ServerError('Server not initialized. Call initialize() first.');
    }

    const { logger, sessionStore, browserPool, config: serverConfig } = this.dependencies;

    try {
      // Log comprehensive service start event
      await this.logServiceStartEvent();

      // Create Express application
      const app = createApp(logger, sessionStore, browserPool);

      // Create HTTP/HTTPS server
      const server = createServer(app, serverConfig);

      // Create gRPC server
      const grpcServer = createGrpcServerInstance(logger, sessionStore);

      // Start WebSocket server after HTTP server needs to be created
      const wsServer = startWebSocketServer(logger, sessionStore, server, serverConfig);

      // Store components for lifecycle management
      this.components = {
        app,
        server,
        grpcServer,
        wsServer,
      };

      // Setup process handlers for graceful shutdown
      setupAllProcessHandlers(this.components, this.dependencies);

      // Start HTTP server
      await startHttpServer(server, serverConfig.port, serverConfig.host, logger);

      // Start gRPC server
      await startGrpcServer(grpcServer, serverConfig, logger);

      // Start MCP server if enabled
      startMcpServer(logger);

      // Start health monitoring
      this._healthMonitoringInterval = startHealthMonitoring({
        components: this.components,
        browserPool,
        sessionStore,
        logger,
      });

      // Perform initial health check
      const healthStatus = await performHealthCheck(
        this.components,
        browserPool,
        sessionStore,
        logger,
      );

      logger.info({ healthStatus }, 'Initial health check completed');

      const protocol = serverConfig.tlsEnabled ? 'https' : 'http';
      const result: ServerStartupResult = {
        success: true,
        httpUrl: `${protocol}://${serverConfig.host}:${serverConfig.port}`,
        grpcUrl: `${serverConfig.grpcHost}:${serverConfig.grpcPort}`,
        wsUrl: `${protocol}://${serverConfig.host}:${serverConfig.port}${serverConfig.wsPath}`,
      };

      logger.info('All server components started successfully');
      logger.info(`Environment: ${serverConfig.nodeEnv}`);
      logger.info(`API version: ${serverConfig.apiVersion}`);
      logger.info(result, 'Server startup completed');

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error }, 'Failed to start server');

      // Log service start failure
      await this.logServiceStartEvent(error);

      return {
        success: false,
        httpUrl: '',
        grpcUrl: '',
        wsUrl: '',
        error: error instanceof Error ? error : new ServerError(errorMsg),
      };
    }
  }

  /**
   * Get current health status
   */
  async getHealthStatus(): Promise<import('./types.js').HealthCheckStatus> {
    if (!this.components || !this.dependencies) {
      throw new ServerError('Server not started');
    }

    return performHealthCheck(
      this.components,
      this.dependencies.browserPool,
      this.dependencies.sessionStore,
      this.dependencies.logger,
    );
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return Boolean(this.components?.server.listening);
  }

  /**
   * Log service start event with comprehensive metadata
   */
  private async logServiceStartEvent(error?: unknown): Promise<void> {
    try {
      if (!this.dependencies) return;

      const eventData: Record<string, unknown> = {
        result: error !== undefined ? 'failure' : 'success',
        ...(error !== undefined && {
          reason: error instanceof Error ? error.message : 'Unknown error',
        }),
        metadata: {
          environment: config.NODE_ENV,
          port: config.PORT,
          grpcPort: config.GRPC_PORT,
          tlsEnabled: config.TLS_ENABLED,
          auditEnabled: config.AUDIT_LOG_ENABLED,
          logLevel: config.LOG_LEVEL,
          corsOrigin: config.CORS_ORIGIN,
          rateLimitEnabled: true,
          rateLimitWindow: config.RATE_LIMIT_WINDOW,
          rateLimitMaxRequests: config.RATE_LIMIT_MAX_REQUESTS,
          redisEnabled: Boolean(config.REDIS_URL),
          browserPoolMaxSize: config.BROWSER_POOL_MAX_SIZE,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          processId: process.pid,
          startTime: new Date().toISOString(),
          mcpMode: isMcpModeEnabled(),
        },
      };

      await logSecurityEvent(SecurityEventType.SERVICE_START, eventData);
    } catch {
      // Ignore errors during security logging
    }
  }
}

/**
 * Create and start the server (main entry point)
 */
export async function startServer(): Promise<ServerStartupResult> {
  const server = new PuppeteerMcpServer();
  await server.initialize();
  return server.start();
}
