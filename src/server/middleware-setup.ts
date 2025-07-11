/**
 * Middleware registration and configuration
 * @module server/middleware-setup
 * @nist si-10 "Information input validation"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { Application } from 'express';
import cors from 'cors';
import compression from 'compression';
import session from 'express-session';
import express from 'express';
import { Logger } from 'pino';
import { config } from '../core/config.js';
import { requestLogger } from '../core/middleware/request-logger.js';
import { requestIdMiddleware } from '../core/middleware/request-id.js';
import {
  securityHeaders,
  additionalSecurityHeaders,
  createCSRFProtection,
} from '../core/middleware/security-headers.js';
import { createRateLimiter } from '../core/middleware/rate-limiter.js';
import { requestContextMiddleware } from '../utils/logger.js';
import { contextPropagationMiddleware } from '../telemetry-stub.js';
import { MiddlewareConfig } from './types.js';
import { getTrustProxyConfig } from './server-config.js';

/**
 * Create default middleware configuration
 */
export function createMiddlewareConfig(): MiddlewareConfig {
  return {
    enableSecurity: true,
    enableRateLimit: true,
    enableCsrf: true,
    enableCors: true,
    enableCompression: true,
    enableTelemetry: config.TELEMETRY_ENABLED === true,
  };
}

/**
 * Setup trust proxy configuration
 */
export function setupTrustProxy(app: Application): void {
  const trustProxyConfig = getTrustProxyConfig();
  if (trustProxyConfig !== false) {
    app.set('trust proxy', trustProxyConfig);
  }
}

/**
 * Setup security middleware
 */
export function setupSecurityMiddleware(
  app: Application,
  middlewareConfig: MiddlewareConfig,
): void {
  if (!middlewareConfig.enableSecurity) {
    return;
  }

  // Security headers
  app.use(securityHeaders());
  app.use(additionalSecurityHeaders());
}

/**
 * Setup session middleware
 */
export function setupSessionMiddleware(app: Application): void {
  app.use(
    session({
      name: 'sessionId',
      secret: config.SESSION_SECRET || 'default-dev-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.TLS_ENABLED === true, // HTTPS only in production
        httpOnly: true, // Prevent XSS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'strict', // CSRF protection
      },
      rolling: true, // Reset expiry on activity
    }),
  );
}

/**
 * Setup CORS middleware
 */
export function setupCorsMiddleware(app: Application, middlewareConfig: MiddlewareConfig): void {
  if (!middlewareConfig.enableCors) {
    return;
  }

  app.use(
    cors({
      origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN,
      credentials: config.CORS_CREDENTIALS,
      maxAge: config.CORS_MAX_AGE,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-ID',
        'X-API-Key',
        'X-CSRF-Token',
      ],
    }),
  );
}

/**
 * Setup compression middleware
 */
export function setupCompressionMiddleware(
  app: Application,
  middlewareConfig: MiddlewareConfig,
): void {
  if (middlewareConfig.enableCompression) {
    app.use(compression());
  }
}

/**
 * Setup rate limiting middleware
 */
export function setupRateLimitingMiddleware(
  app: Application,
  middlewareConfig: MiddlewareConfig,
): void {
  if (middlewareConfig.enableRateLimit) {
    const limiter = createRateLimiter();
    app.use(limiter);
  }
}

/**
 * Setup body parsing middleware
 */
export function setupBodyParsingMiddleware(app: Application): void {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
}

/**
 * Setup CSRF protection middleware
 */
export function setupCSRFMiddleware(app: Application, middlewareConfig: MiddlewareConfig): void {
  if (middlewareConfig.enableCsrf) {
    const csrfProtection = createCSRFProtection();
    app.use(csrfProtection);
  }
}

/**
 * Setup request tracking middleware
 */
export function setupRequestTrackingMiddleware(app: Application): void {
  // Request ID middleware
  app.use(requestIdMiddleware());

  // Request context middleware (for audit logging)
  app.use(requestContextMiddleware);
}

/**
 * Setup telemetry middleware
 */
export function setupTelemetryMiddleware(
  app: Application,
  middlewareConfig: MiddlewareConfig,
): void {
  if (middlewareConfig.enableTelemetry) {
    app.use(contextPropagationMiddleware);
  }
}

/**
 * Setup request logging middleware
 */
export function setupRequestLoggingMiddleware(app: Application, logger: Logger): void {
  app.use(requestLogger(logger));
}

/**
 * Setup all middleware in the correct order
 */
export function setupAllMiddleware(app: Application, logger: Logger): void {
  const middlewareConfig = createMiddlewareConfig();

  // Order is important - security first, then functional middleware
  setupTrustProxy(app);
  setupSecurityMiddleware(app, middlewareConfig);
  setupSessionMiddleware(app);
  setupCorsMiddleware(app, middlewareConfig);
  setupCompressionMiddleware(app, middlewareConfig);
  setupRateLimitingMiddleware(app, middlewareConfig);
  setupBodyParsingMiddleware(app);
  setupCSRFMiddleware(app, middlewareConfig);
  setupRequestTrackingMiddleware(app);
  setupTelemetryMiddleware(app, middlewareConfig);
  setupRequestLoggingMiddleware(app, logger);
}
