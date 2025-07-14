/**
 * Route registration and API setup
 * @module server/route-setup
 * @nist cm-7 "Least functionality"
 */

import { Application, Router } from 'express';
import express from 'express';
import { Logger } from 'pino';
import { config } from '../core/config.js';
import { createCSRFTokenEndpoint } from '../core/middleware/security-headers.js';
import { RateLimitPresets } from '../core/middleware/rate-limiter.js';
import { telemetryHealthHandler } from '../telemetry-stub.js';
import { createHealthRouter } from '../routes/health.js';
import { createSessionRoutes } from '../routes/sessions.js';
import { createContextRoutes } from '../routes/contexts.js';
import { createApiKeyRoutes } from '../routes/api-keys.js';
import { createMetricsRoutes } from '../routes/metrics.js';
import { errorHandler } from '../core/middleware/error-handler.js';
import { SessionStore } from '../store/session-store.interface.js';
import { BrowserPool } from '../puppeteer/pool/browser-pool.js';
import { RouteConfig } from './types.js';
import { setupWebSocketBypass } from './websocket-fix.js';

/**
 * Create default route configuration
 */
export function createRouteConfig(): RouteConfig {
  return {
    apiPrefix: config.API_PREFIX ?? '/api',
    apiVersion: 'v1',
    enableHealthRoutes: true,
    enableApiRoutes: true,
  };
}

/**
 * Setup root route
 */
export function setupRootRoute(app: Application, routeConfig: RouteConfig): void {
  app.get('/', (_req, res) => {
    res.json({
      name: 'puppeteer-mcp',
      version: '1.0.14',
      description: 'Production-ready AI-enabled browser automation platform',
      endpoints: {
        health: '/health',
        ready: '/health/ready',
        api: `${routeConfig.apiPrefix}/${routeConfig.apiVersion}`,
        websocket: config.WS_PATH,
        documentation: 'https://williamzujkowski.github.io/puppeteer-mcp/',
      },
    });
  });
}

/**
 * Setup health check routes
 */
export function setupHealthRoutes(
  app: Application,
  routeConfig: RouteConfig,
  browserPool: BrowserPool,
): void {
  if (!routeConfig.enableHealthRoutes) {
    return;
  }

  // Health check routes (no auth required)
  app.use('/health', createHealthRouter(browserPool));
  app.use('/ready', (_req, res) => res.redirect('/health/ready'));

  // Telemetry health endpoint
  if (config.TELEMETRY_ENABLED === true) {
    app.get('/health/telemetry', telemetryHealthHandler);
  }
}

/**
 * Create API router with versioned routes
 */
export function createApiRouter(sessionStore: SessionStore, browserPool: BrowserPool): Router {
  const apiRouter = express.Router();

  // CSRF token endpoint (requires session but not CSRF protection)
  apiRouter.get('/csrf-token', createCSRFTokenEndpoint());

  // Mount versioned routes with appropriate rate limiting
  apiRouter.use('/sessions', RateLimitPresets.auth, createSessionRoutes(sessionStore));
  apiRouter.use(
    '/contexts',
    RateLimitPresets.browser,
    createContextRoutes(sessionStore, browserPool),
  );
  apiRouter.use('/api-keys', RateLimitPresets.api, createApiKeyRoutes(sessionStore));
  apiRouter.use('/metrics', RateLimitPresets.api, createMetricsRoutes(sessionStore, browserPool));

  return apiRouter;
}

/**
 * Setup API routes
 */
export function setupApiRoutes(
  app: Application,
  routeConfig: RouteConfig,
  sessionStore: SessionStore,
  browserPool: BrowserPool,
): void {
  if (!routeConfig.enableApiRoutes) {
    return;
  }

  const apiRouter = createApiRouter(sessionStore, browserPool);
  app.use(`${routeConfig.apiPrefix}/${routeConfig.apiVersion}`, apiRouter);
}

/**
 * Setup 404 handler
 */
export function setup404Handler(app: Application): void {
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
      },
    });
  });
}

/**
 * Setup error handling middleware
 */
export function setupErrorHandler(app: Application, logger: Logger): void {
  // Error handling middleware (must be last)
  app.use(errorHandler(logger));
}

/**
 * Setup all routes
 */
export function setupAllRoutes(
  app: Application,
  logger: Logger,
  sessionStore: SessionStore,
  browserPool: BrowserPool,
): void {
  const routeConfig = createRouteConfig();

  // IMPORTANT: Setup WebSocket bypass FIRST to prevent Express from handling WebSocket upgrades
  setupWebSocketBypass(app, config.WS_PATH || '/ws');

  // Setup routes in order
  setupRootRoute(app, routeConfig);
  setupHealthRoutes(app, routeConfig, browserPool);
  setupApiRoutes(app, routeConfig, sessionStore, browserPool);
  setup404Handler(app);
  setupErrorHandler(app, logger);
}
