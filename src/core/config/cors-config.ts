/**
 * CORS configuration parser
 * @module core/config/cors-config
 * @nist cm-7 "Least functionality"
 */

import { parseBoolean, parseInt, parseArray } from './base-parsers.js';

/**
 * Parse CORS configuration from environment
 */
export function parseCORSConfig(allowedOrigins: string[]): {
  CORS_ENABLED: boolean;
  CORS_CREDENTIALS: boolean;
  CORS_MAX_AGE: number;
  CORS_ALLOWED_METHODS: string[];
  CORS_ALLOWED_HEADERS: string[];
  CORS_EXPOSED_HEADERS: string[];
  CORS_ORIGIN: string | undefined;
  ALLOWED_ORIGINS: string[];
} {
  return {
    CORS_ENABLED: parseBoolean(process.env.CORS_ENABLED, true),
    CORS_CREDENTIALS: parseBoolean(process.env.CORS_CREDENTIALS, true),
    CORS_MAX_AGE: parseInt(process.env.CORS_MAX_AGE, 86400),
    CORS_ALLOWED_METHODS: parseArray(process.env.CORS_ALLOWED_METHODS, ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
    CORS_ALLOWED_HEADERS: parseArray(process.env.CORS_ALLOWED_HEADERS, [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Session-ID',
    ]),
    CORS_EXPOSED_HEADERS: parseArray(process.env.CORS_EXPOSED_HEADERS, ['X-Request-ID', 'X-RateLimit-Remaining']),
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    ALLOWED_ORIGINS: allowedOrigins,
  };
}