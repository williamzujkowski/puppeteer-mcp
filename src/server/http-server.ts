/**
 * HTTP/Express server setup and middleware
 * @module server/http-server
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist cm-7 "Least functionality"
 */

import express, { Application } from 'express';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import type { RequestListener } from 'http';
import { Logger } from 'pino';
import { SessionStore } from '../store/session-store.interface.js';
import { BrowserPool } from '../puppeteer/pool/browser-pool.js';
import { setupAllMiddleware } from './middleware-setup.js';
import { setupAllRoutes } from './route-setup.js';
import { shouldEnableTLS, createHttpsOptions, ServerError } from './server-config.js';
import { ServerInstance, ServerConfig } from './types.js';

/**
 * Creates and configures the Express application
 * @nist cm-7 "Least functionality"
 * @nist si-10 "Information input validation"
 */
export function createApp(
  logger: Logger,
  sessionStore: SessionStore,
  browserPool: BrowserPool
): Application {
  const app = express();

  // Setup middleware
  setupAllMiddleware(app, logger);

  // Setup routes
  setupAllRoutes(app, logger, sessionStore, browserPool);

  return app;
}

/**
 * Create HTTP/HTTPS server based on configuration
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist sc-13 "Cryptographic protection"
 */
export function createServer(app: Application, serverConfig: ServerConfig): ServerInstance {
  if (shouldEnableTLS()) {
    // HTTPS server with TLS
    const httpsOptions = createHttpsOptions();
    return createHttpsServer(httpsOptions, app as RequestListener);
  }

  // HTTP server (development only)
  if (serverConfig.nodeEnv === 'production') {
    throw new ServerError('TLS must be enabled in production');
  }

  return createHttpServer(app as RequestListener);
}

/**
 * Setup HTTP server error handlers
 */
export function setupServerErrorHandlers(
  server: ServerInstance,
  port: number,
  logger: Logger
): void {
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${port} is already in use. Please try one of the following:`);
      logger.error(`1. Kill the process using port ${port}: sudo lsof -i :${port}`);
      logger.error(`2. Use a different port: PORT=3000 puppeteer-mcp`);
      logger.error(`3. Check if another instance is running: ps aux | grep puppeteer-mcp`);
    } else if (error.code === 'EACCES') {
      logger.error(`Permission denied to bind to port ${port}. Try:`);
      logger.error(`1. Use a port number above 1024: PORT=3000 puppeteer-mcp`);
      logger.error(`2. Run with sudo (not recommended)`);
    } else {
      logger.error({ error }, 'Server error');
    }
    process.exit(1);
  });
}

/**
 * Start HTTP server and return Promise that resolves when listening
 */
export function startHttpServer(
  server: ServerInstance,
  port: number,
  host: string,
  logger: Logger
): Promise<void> {
  return new Promise((resolve, reject) => {
    setupServerErrorHandlers(server, port, logger);

    server.listen(port, host, () => {
      const protocol = shouldEnableTLS() ? 'https' : 'http';
      logger.info(`HTTP server started on ${protocol}://${host}:${port}`);
      
      if (!shouldEnableTLS() && process.env.NODE_ENV !== 'development') {
        logger.warn('Running without TLS - development only!');
      }
      
      resolve();
    });

    server.on('error', reject);
  });
}

/**
 * Stop HTTP server gracefully
 */
export function stopHttpServer(server: ServerInstance, logger: Logger): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      logger.info('HTTP server closed');
      resolve();
    });
  });
}