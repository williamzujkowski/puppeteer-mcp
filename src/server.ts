/**
 * Main server entry point for the MCP API platform
 * @module server
 * @nist cm-7 "Least functionality"
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist si-10 "Information input validation"
 */

/* eslint-disable max-lines */

import express, { Application } from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import { createServer as createHttpsServer, Server as HttpsServer } from 'https';
import * as https from 'https';
import { readFileSync } from 'fs';
import { pino } from 'pino';
import { config, validateProductionConfig } from './core/config.js';
import { errorHandler } from './core/middleware/error-handler.js';
import { requestLogger } from './core/middleware/request-logger.js';
import { requestIdMiddleware } from './core/middleware/request-id.js';
import { securityHeaders } from './core/middleware/security-headers.js';
import { requestContextMiddleware, logSecurityEvent, SecurityEventType } from './utils/logger.js';
import { healthRouter } from './routes/health.js';
import { createSessionRoutes } from './routes/sessions.js';
import { createContextRoutes } from './routes/contexts.js';
import { createApiKeyRoutes } from './routes/api-keys.js';
import { InMemorySessionStore } from './store/in-memory-session-store.js';
import { createGrpcServer, GrpcServer } from './grpc/server.js';
import { createWebSocketServer, WSServer } from './ws/server.js';
import { BrowserPool } from './puppeteer/pool/browser-pool.js';
import { puppeteerConfig } from './puppeteer/config.js';

// Initialize logger
const logger = pino({
  name: 'app',
  level: config.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      ...bindings,
      environment: config.NODE_ENV,
      service: 'puppeteer-mcp',
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    config.NODE_ENV === 'development' && config.LOG_FORMAT === 'pretty'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

// Initialize session store
const sessionStore = new InMemorySessionStore(logger.child({ module: 'session-store' }));

// Initialize browser pool
const browserPool = new BrowserPool({
  maxBrowsers: puppeteerConfig.poolMaxSize,
  maxPagesPerBrowser: 10, // Default reasonable limit
  idleTimeout: puppeteerConfig.idleTimeout,
  healthCheckInterval: 60000, // 1 minute
  launchOptions: {
    headless: puppeteerConfig.headless,
    executablePath: puppeteerConfig.executablePath,
    args: puppeteerConfig.args,
  },
});

// Initialize browser pool asynchronously only in non-test environments
if (config.NODE_ENV !== 'test') {
  browserPool.initialize().catch((error) => {
    logger.error({ error }, 'Failed to initialize browser pool');
  });
}

/**
 * Creates and configures the Express application
 * @nist cm-7 "Least functionality"
 * @nist si-10 "Information input validation"
 */
export function createApp(): Application {
  const app = express();

  // Trust proxy configuration
  // Set to specific proxy count or false in production to prevent IP spoofing
  // See: https://expressjs.com/en/guide/behind-proxies.html
  if (config.NODE_ENV === 'development') {
    app.set('trust proxy', 'loopback'); // Trust localhost only in development
  } else if (config.TRUST_PROXY !== undefined) {
    app.set('trust proxy', config.TRUST_PROXY); // Use configured value in production
  }

  // Security middleware from security-headers module
  app.use(securityHeaders());

  // CORS configuration
  app.use(
    cors({
      origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN,
      credentials: config.CORS_CREDENTIALS,
      maxAge: config.CORS_MAX_AGE,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
    }),
  );

  // Compression
  app.use(compression());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS,
    skipFailedRequests: config.RATE_LIMIT_SKIP_FAILED_REQUESTS,
    // Validate Express trust proxy setting
    validate: {
      trustProxy: false, // Disable the validation since we handle it properly above
    },
    handler: (req, res) => {
      void logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, {
        resource: req.path,
        action: req.method,
        result: 'failure',
        metadata: {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      });
    },
  });

  app.use(limiter);

  // Body parsing middleware with size limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request ID middleware
  app.use(requestIdMiddleware());

  // Request context middleware (for audit logging)
  app.use(requestContextMiddleware);

  // Request logging
  app.use(requestLogger(logger));

  // Root route
  app.get('/', (_req, res) => {
    res.json({
      name: 'puppeteer-mcp',
      version: '1.0.9',
      description: 'Production-ready AI-enabled browser automation platform',
      endpoints: {
        health: '/health',
        ready: '/health/ready',
        api: `${config.API_PREFIX}/${config.API_VERSION}`,
        websocket: config.WS_PATH,
        documentation: 'https://williamzujkowski.github.io/puppeteer-mcp/',
      },
    });
  });

  // Health check routes (no auth required)
  app.use('/health', healthRouter);
  app.use('/ready', (_req, res) => res.redirect('/health/ready'));

  // API routes with versioning
  const apiRouter = express.Router();

  // Mount versioned routes
  apiRouter.use('/sessions', createSessionRoutes(sessionStore));
  apiRouter.use('/contexts', createContextRoutes(sessionStore, browserPool));
  apiRouter.use('/api-keys', createApiKeyRoutes(sessionStore));

  // Mount API router
  app.use(`${config.API_PREFIX}/${config.API_VERSION}`, apiRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
      },
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler(logger));

  return app;
}

/**
 * Check if TLS should be enabled
 */
function shouldEnableTLS(): boolean {
  return (
    config.TLS_ENABLED === true &&
    config.TLS_CERT_PATH !== null &&
    config.TLS_CERT_PATH !== undefined &&
    config.TLS_CERT_PATH !== '' &&
    config.TLS_KEY_PATH !== null &&
    config.TLS_KEY_PATH !== undefined &&
    config.TLS_KEY_PATH !== ''
  );
}

/**
 * Create HTTPS options
 */
function createHttpsOptions(): https.ServerOptions {
  const certPath = config.TLS_CERT_PATH as string;
  const keyPath = config.TLS_KEY_PATH as string;

  if (certPath.includes('..') || keyPath.includes('..')) {
    throw new Error('Invalid TLS file paths');
  }

  return {
    cert: readFileSync(certPath),

    key: readFileSync(keyPath),
    ca:
      config.TLS_CA_PATH !== null && config.TLS_CA_PATH !== undefined && config.TLS_CA_PATH !== ''
        ? (() => {
            const caPath = config.TLS_CA_PATH;
            if (caPath.includes('..')) {
              throw new Error('Invalid CA file path');
            }

            return readFileSync(caPath);
          })()
        : undefined,
    minVersion: config.TLS_MIN_VERSION,
    ciphers: 'TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256:ECDHE-RSA-AES256-GCM-SHA384',
  };
}

/**
 * Create HTTP/HTTPS server based on configuration
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist sc-13 "Cryptographic protection"
 */
function createServer(app: Application): HttpServer | HttpsServer {
  if (shouldEnableTLS()) {
    // HTTPS server with TLS
    const httpsOptions = createHttpsOptions();
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return createHttpsServer(httpsOptions, app);
  }

  // HTTP server (development only)
  if (config.NODE_ENV === 'production') {
    throw new Error('TLS must be enabled in production');
  }

  logger.warn('Running without TLS - development only!');
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return createHttpServer(app);
}

/**
 * Initialize WebSocket server
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
function initializeWebSocketServer(server: HttpServer | HttpsServer): WSServer {
  return createWebSocketServer(logger, sessionStore, server);
}

// Graceful shutdown tracking
let isShuttingDown = false;

/**
 * Graceful shutdown handler
 * @nist cm-7 "Least functionality"
 */
async function gracefulShutdown(
  signal: string,
  server: HttpServer | HttpsServer,
  wss?: WSServer,
  grpcServer?: GrpcServer,
): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Log system shutdown
  await logSecurityEvent(SecurityEventType.SERVICE_STOP, {
    reason: signal,
    result: 'success',
  });

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Shutdown WebSocket server
  if (wss) {
    await wss.shutdown();
  }

  // Shutdown gRPC server
  if (grpcServer) {
    await grpcServer.shutdown();
  }

  // Clean up session store
  if ('clear' in sessionStore && typeof sessionStore.clear === 'function') {
    await sessionStore.clear();
  }

  // Shutdown browser pool
  try {
    logger.info('Shutting down browser pool...');
    await browserPool.shutdown();
    logger.info('Browser pool shut down successfully');
  } catch (error) {
    logger.error({ error }, 'Error shutting down browser pool');
  }

  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);

  // Exit cleanly
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

/**
 * Start the HTTP/WebSocket/gRPC server
 */
export async function startHTTPServer(): Promise<void> {
  try {
    // Validate production configuration
    validateProductionConfig();

    // Log service start
    await logSecurityEvent(SecurityEventType.SERVICE_START, {
      result: 'success',
      metadata: {
        environment: config.NODE_ENV,
        port: config.PORT,
        tlsEnabled: config.TLS_ENABLED,
      },
    });

    const app = createApp();
    const server = createServer(app);

    // Declare WebSocket server variable - will be initialized after HTTP server starts
    let wss: WSServer | undefined;

    // Initialize gRPC server
    const grpcServer = createGrpcServer(logger, sessionStore);

    // Register shutdown handlers (before starting servers)
    process.on('SIGTERM', () => void gracefulShutdown('SIGTERM', server, wss, grpcServer));
    process.on('SIGINT', () => void gracefulShutdown('SIGINT', server, wss, grpcServer));
    process.on('SIGHUP', () => void gracefulShutdown('SIGHUP', server, wss, grpcServer));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.fatal({ error }, 'Uncaught exception');
      void (async () => {
        await logSecurityEvent(SecurityEventType.ERROR, {
          reason: 'Uncaught exception',
          result: 'failure',
          metadata: {
            error: error.message,
            stack: error.stack,
          },
        });
        process.exit(1);
      })();
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.fatal({ reason, promise }, 'Unhandled rejection');
      void (async () => {
        await logSecurityEvent(SecurityEventType.ERROR, {
          reason: 'Unhandled promise rejection',
          result: 'failure',
          metadata: {
            reason: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
          },
        });
        process.exit(1);
      })();
    });

    // Start HTTP/WebSocket server
    const PORT = config.PORT || 8443;
    const HOST = config.HOST || '0.0.0.0';

    // Add error handler for server
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Please try one of the following:`);
        logger.error(`1. Kill the process using port ${PORT}: sudo lsof -i :${PORT}`);
        logger.error(`2. Use a different port: PORT=3000 puppeteer-mcp`);
        logger.error(`3. Check if another instance is running: ps aux | grep puppeteer-mcp`);
      } else if (error.code === 'EACCES') {
        logger.error(`Permission denied to bind to port ${PORT}. Try:`);
        logger.error(`1. Use a port number above 1024: PORT=3000 puppeteer-mcp`);
        logger.error(`2. Run with sudo (not recommended)`);
      } else {
        logger.error({ error }, 'Server error');
      }
      process.exit(1);
    });

    server.listen(PORT, HOST, () => {
      const protocol = shouldEnableTLS() ? 'https' : 'http';
      logger.info(`Server started on ${protocol}://${HOST}:${PORT}`);
      logger.info(`Environment: ${config.NODE_ENV}`);
      logger.info(`API version: ${config.API_VERSION}`);

      // Initialize WebSocket server AFTER HTTP server is listening
      try {
        wss = initializeWebSocketServer(server);
        logger.info(`WebSocket endpoint: ${config.WS_PATH}`);
      } catch (wsError) {
        logger.error({ error: wsError }, 'Failed to initialize WebSocket server');
        throw wsError;
      }
    });

    // Start gRPC server
    const GRPC_PORT = config.GRPC_PORT || 50051;
    const GRPC_HOST = config.GRPC_HOST || '0.0.0.0';

    await grpcServer.start(GRPC_PORT, GRPC_HOST);
    logger.info(`gRPC server started on ${GRPC_HOST}:${GRPC_PORT}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    logger.error('Failed to start server:', error);

    // Try to log security event but don't wait for it on exit
    logSecurityEvent(SecurityEventType.SERVICE_START, {
      result: 'failure',
      reason: error instanceof Error ? error.message : 'Unknown error',
    }).catch(() => {
      // Ignore errors during shutdown
    });

    // Give logger a chance to flush before exit
    setTimeout(() => {
      process.exit(1);
    }, 100);
  }
}

// Start server if not in test environment and not in MCP mode
if (config.NODE_ENV !== 'test' && process.env.MCP_TRANSPORT === undefined) {
  void startHTTPServer();
}

// Export for testing
export { sessionStore, browserPool };
