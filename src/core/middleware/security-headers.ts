/**
 * Security headers middleware
 * @module core/middleware/security-headers
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist sc-13 "Cryptographic protection"
 * @nist sc-28 "Protection of information at rest"
 */

import helmet from 'helmet';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { config } from '../config.js';
import { logger } from '../../utils/logger.js';
import {
  type SessionWithCSRF,
  type CSRFOptions,
  csrfTokens,
  shouldSkipCSRF,
  initializeCSRFSecret,
  extractCSRFToken,
  logCSRFSecurityEvent,
  sendCSRFError,
  handleCSRFVerificationError,
} from './csrf-utils.js';
import { SecurityEventType } from '../../utils/logger.js';

/**
 * Create security headers middleware
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ac-4 "Information flow enforcement"
 * @returns Express middleware with security headers
 */
export const securityHeaders = (): RequestHandler => {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'https:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        ...(parseCSPDirectives(String(config.CSP_DIRECTIVES || ''))),
      },
    },

    // HTTP Strict Transport Security
    hsts: {
      maxAge: config.HSTS_MAX_AGE,
      includeSubDomains: true,
      preload: true,
    },

    // X-Content-Type-Options
    noSniff: true,

    // X-Frame-Options
    frameguard: {
      action: 'deny',
    },

    // X-XSS-Protection (legacy, but still useful)
    xssFilter: true,

    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false,
    },

    // X-Download-Options
    ieNoOpen: true,

    // Origin-Agent-Cluster
    originAgentCluster: true,

    // Cross-Origin-Embedder-Policy
    crossOriginEmbedderPolicy: true,

    // Cross-Origin-Opener-Policy
    crossOriginOpenerPolicy: {
      policy: 'same-origin',
    },

    // Cross-Origin-Resource-Policy
    crossOriginResourcePolicy: {
      policy: 'same-origin',
    },
  });
};

/**
 * Create additional security headers middleware
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export const additionalSecurityHeaders = (): RequestHandler => {
  return (_req: Request, res: Response, next: NextFunction) => {
    // Feature Policy / Permissions Policy
    res.setHeader(
      'Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
    );

    // Expect-CT for Certificate Transparency
    if (config.TLS_ENABLED) {
      res.setHeader('Expect-CT', 'max-age=86400, enforce');
    }

    // Cache-Control for sensitive responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Remove potentially dangerous headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  };
};

/**
 * Create CORS middleware with security considerations
 * @nist ac-4 "Information flow enforcement"
 */
export const createCORSMiddleware = (): RequestHandler => {
  const allowedOrigins = config.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ?? config.ALLOWED_ORIGINS;

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // Check if origin is allowed
    if (
      origin !== undefined &&
      origin !== '' &&
      (allowedOrigins.includes('*') || allowedOrigins.includes(origin))
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', String(config.CORS_CREDENTIALS));
      res.setHeader('Vary', 'Origin');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Request-ID, X-API-Key',
      );
      res.setHeader('Access-Control-Max-Age', String(config.CORS_MAX_AGE));
      res.status(204).end();
      return;
    }

    next();
  };
};

/**
 * Parse CSP directives from config string
 */
const parseCSPDirectives = (directives: string): Record<string, string[]> => {
  const parsed: Record<string, string[]> = {};

  if (!directives) {
    return parsed;
  }

  // Split by semicolon and parse each directive
  directives.split(';').forEach((directive) => {
    const [key, ...values] = directive.trim().split(/\s+/);
    if (key !== undefined && key !== '' && values.length > 0) {
      // Convert camelCase to kebab-case for CSP directives
      const cspKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();

      // Skip if it's a default directive that we're already setting
      const defaultDirectives = [
        'default-src',
        'style-src',
        'script-src',
        'img-src',
        'connect-src',
        'font-src',
        'object-src',
        'media-src',
        'frame-src',
      ];
      if (defaultDirectives.includes(cspKey)) {
        return;
      }

      // Safe assignment with string key
      Object.defineProperty(parsed, cspKey, {
        value: values,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
  });

  return parsed;
};

/**
 * API-specific security headers
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export const apiSecurityHeaders = (): RequestHandler => {
  return (_req: Request, res: Response, next: NextFunction) => {
    // API responses should not be cached by browsers
    res.setHeader('Cache-Control', 'no-store');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Force content type for JSON responses
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    next();
  };
};

/**
 * WebSocket-specific security headers
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export const wsSecurityHeaders = (): RequestHandler => {
  return (_req: Request, res: Response, next: NextFunction) => {
    // WebSocket upgrade specific headers
    res.setHeader('X-WebSocket-Protocol', 'v1');

    next();
  };
};

/**
 * gRPC-specific security headers
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export const grpcSecurityHeaders = (): RequestHandler => {
  return (_req: Request, res: Response, next: NextFunction) => {
    // gRPC specific headers
    res.setHeader('Content-Type', 'application/grpc');
    res.setHeader('grpc-accept-encoding', 'gzip');

    next();
  };
};

/**
 * Create CSRF secret middleware
 */
const createCSRFSecretMiddleware = (): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (shouldSkipCSRF(req)) {
      return next();
    }

    initializeCSRFSecret(req);
    next();
  };
};

/**
 * Create CSRF validation middleware
 */
const createCSRFValidationMiddleware = (options: CSRFOptions): RequestHandler => {
  const ignoreMethods = options.ignoreMethods ?? ['GET', 'HEAD', 'OPTIONS'];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (shouldSkipCSRF(req)) {
      return next();
    }

    // Skip validation for safe methods
    if (ignoreMethods.includes(req.method)) {
      return next();
    }

    // Get secret from session
    const session = req.session as unknown as SessionWithCSRF | undefined;
    const secret = session?.csrfSecret;

    // ESLint timing attack warning is false positive - we're only checking existence, not comparing secrets
    if (secret === undefined) {
      logCSRFSecurityEvent(SecurityEventType.CSRF_TOKEN_MISSING, req);
      sendCSRFError(res, 'CSRF_SECRET_MISSING', 'CSRF secret not found in session');
      return;
    }

    const token = extractCSRFToken(req, options);

    // ESLint timing attack warning is false positive - we're only checking existence, not comparing tokens
    if (token === undefined) {
      logCSRFSecurityEvent(SecurityEventType.CSRF_TOKEN_MISSING, req);
      sendCSRFError(res, 'CSRF_TOKEN_MISSING', 'CSRF token is required');
      return;
    }

    // Verify token
    try {
      const valid = csrfTokens.verify(secret, token);
      if (!valid) {
        logCSRFSecurityEvent(SecurityEventType.CSRF_TOKEN_INVALID, req, {
          token: token.substring(0, 8) + '...', // Log partial token for debugging
        });

        sendCSRFError(res, 'CSRF_TOKEN_INVALID', 'Invalid CSRF token');
        return;
      }

      // Token is valid, continue
      next();
    } catch (error) {
      logger.error({ error, path: req.path }, 'CSRF token verification error');
      handleCSRFVerificationError(req, res, error);
      return;
    }
  };
};

/**
 * CSRF Protection Middleware
 * @nist si-10 "Information input validation"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */
export const createCSRFProtection = (options: CSRFOptions = {}): RequestHandler[] => {
  return [createCSRFSecretMiddleware(), createCSRFValidationMiddleware(options)];
};

/**
 * CSRF Token Generation Endpoint
 * @nist si-10 "Information input validation"
 */
export const createCSRFTokenEndpoint = (): RequestHandler => {
  return (req: Request, res: Response): void => {
    const session = req.session as unknown as SessionWithCSRF | undefined;
    const secret = session?.csrfSecret;

    // ESLint timing attack warning is false positive - we're only checking existence, not comparing secrets
    if (secret === undefined) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CSRF_SECRET_MISSING',
          message: 'CSRF secret not initialized',
        },
      });
      return;
    }

    try {
      const token = csrfTokens.create(secret);

      res.json({
        success: true,
        data: {
          csrfToken: token,
          expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to create CSRF token');

      res.status(500).json({
        success: false,
        error: {
          code: 'CSRF_TOKEN_GENERATION_FAILED',
          message: 'Failed to generate CSRF token',
        },
      });
    }
  };
};
