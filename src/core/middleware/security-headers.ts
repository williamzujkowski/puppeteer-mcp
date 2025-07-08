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
        ...parseCSPDirectives(config.CSP_DIRECTIVES),
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
  const allowedOrigins = config.CORS_ORIGIN.split(',').map((origin) => origin.trim());

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
