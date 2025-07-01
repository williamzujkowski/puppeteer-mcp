/**
 * Main server entry point for the MCP API platform
 * @module server
 * @nist cm-7 "Least functionality"
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist si-10 "Information input validation"
 */

import express, { Application } from 'express';
import helmet from 'helmet';
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
import { InMemorySessionStore } from './store/in-memory-session-store.js';
import { createGrpcServer, GrpcServer } from './grpc/server.js';
import { createWebSocketServer, WSServer } from './ws/server.js';

// Initialize logger
const logger = pino({
  level: config.LOG_LEVEL || 'info',
  transport:
    config.NODE_ENV === 'development' && config.LOG_FORMAT === 'pretty'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        }
      : undefined,
});

// Initialize session store
const sessionStore = new InMemorySessionStore(logger.child({ module: 'session-store' }));

/**
 * Creates and configures the Express application
 * @nist cm-7 "Least functionality"
 * @nist si-10 "Information input validation"
 */
export function createApp(): Application {
  const app = express();

  // Trust proxy for accurate IP addresses
  app.set('trust proxy', true);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'https:'],
      },
    },
    hsts: {
      maxAge: config.HSTS_MAX_AGE,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' },
  }));

  // Additional security headers
  app.use(securityHeaders);

  // CORS configuration
  app.use(cors({
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN,
    credentials: config.CORS_CREDENTIALS,
    maxAge: config.CORS_MAX_AGE,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
  }));

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
  app.use(requestIdMiddleware);

  // Request context middleware (for audit logging)
  app.use(requestContextMiddleware);

  // Request logging
  app.use(requestLogger(logger));

  // Health check routes (no auth required)
  app.use('/health', healthRouter);
  app.use('/ready', (_req, res) => res.redirect('/health/ready'));

  // API routes with versioning
  const apiRouter = express.Router();

  // Mount versioned routes
  apiRouter.use('/sessions', createSessionRoutes(sessionStore));
  apiRouter.use('/contexts', createContextRoutes(sessionStore));

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
  return config.TLS_ENABLED === true && 
         config.TLS_CERT_PATH !== null && 
         config.TLS_CERT_PATH !== undefined && 
         config.TLS_CERT_PATH !== '' && 
         config.TLS_KEY_PATH !== null && 
         config.TLS_KEY_PATH !== undefined && 
         config.TLS_KEY_PATH !== '';
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
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    cert: readFileSync(certPath),
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    key: readFileSync(keyPath),
    ca: config.TLS_CA_PATH !== null && config.TLS_CA_PATH !== undefined && config.TLS_CA_PATH !== '' ? (() => {
      const caPath = config.TLS_CA_PATH;
      if (caPath.includes('..')) {
        throw new Error('Invalid CA file path');
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      return readFileSync(caPath);
    })() : undefined,
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
    return createHttpsServer(httpsOptions, app);
  }

  // HTTP server (development only)
  if (config.NODE_ENV === 'production') {
    throw new Error('TLS must be enabled in production');
  }

  logger.warn('Running without TLS - development only!');
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
  grpcServer?: GrpcServer
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

// Start server if not in test environment
if (config.NODE_ENV !== 'test') {
  void (async () => {
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
      const wss = initializeWebSocketServer(server);
      
      // Initialize gRPC server
      const grpcServer = createGrpcServer(logger, sessionStore);

      // Register shutdown handlers
      process.on('SIGTERM', () => void gracefulShutdown('SIGTERM', server, wss, grpcServer));
      process.on('SIGINT', () => void gracefulShutdown('SIGINT', server, wss, grpcServer));
      process.on('SIGHUP', () => void gracefulShutdown('SIGHUP', server, wss, grpcServer));

      // Handle uncaught errors
      process.on('uncaughtException', (error) => void (async () => {
        logger.fatal('Uncaught exception:', error);
        await logSecurityEvent(SecurityEventType.ERROR, {
          reason: 'Uncaught exception',
          result: 'failure',
          metadata: {
            error: error.message,
            stack: error.stack,
          },
        });
        process.exit(1);
      })());

      process.on('unhandledRejection', (reason, promise) => void (async () => {
        logger.fatal('Unhandled rejection at:', promise, 'reason:', reason);
        await logSecurityEvent(SecurityEventType.ERROR, {
          reason: 'Unhandled promise rejection',
          result: 'failure',
          metadata: {
            reason: String(reason),
          },
        });
        process.exit(1);
      })());

      // Start HTTP/WebSocket server
      const PORT = config.PORT || 8443;
      const HOST = config.HOST || '0.0.0.0';

      server.listen(PORT, HOST, () => {
        logger.info(`Server started on ${config.TLS_ENABLED ? 'https' : 'http'}://${HOST}:${PORT}`);
        logger.info(`Environment: ${config.NODE_ENV}`);
        logger.info(`API version: ${config.API_VERSION}`);
        logger.info(`WebSocket endpoint: ${config.WS_PATH}`);
      });

      // Start gRPC server
      const GRPC_PORT = config.GRPC_PORT || 50051;
      const GRPC_HOST = config.GRPC_HOST || '0.0.0.0';
      
      await grpcServer.start(GRPC_PORT, GRPC_HOST);
      logger.info(`gRPC server started on ${GRPC_HOST}:${GRPC_PORT}`);
    } catch (error) {
      logger.error('Failed to start server:', error);
      await logSecurityEvent(SecurityEventType.SERVICE_START, {
        result: 'failure',
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }
  })();
}

// Export for testing
export { sessionStore };
