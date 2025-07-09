/**
 * Server configuration parser
 * @module core/config/server-config
 * @nist cm-7 "Least functionality"
 */

import { parseInt, parseBoolean } from './base-parsers.js';

/**
 * Parse server configuration from environment
 */
export function parseServerConfig(): {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  HOST: string;
} {
  return {
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'test' | 'production') ?? 'development',
    PORT: parseInt(process.env.PORT, 8443),
    HOST: process.env.HOST ?? '0.0.0.0',
  };
}

/**
 * Parse TLS configuration from environment
 */
export function parseTLSConfig(): {
  TLS_ENABLED: boolean;
  TLS_CERT_PATH: string | undefined;
  TLS_KEY_PATH: string | undefined;
  TLS_CA_PATH: string | undefined;
  TLS_MIN_VERSION: 'TLSv1.2' | 'TLSv1.3';
} {
  return {
    TLS_ENABLED: parseBoolean(process.env.TLS_ENABLED, true),
    TLS_CERT_PATH: process.env.TLS_CERT_PATH,
    TLS_KEY_PATH: process.env.TLS_KEY_PATH,
    TLS_CA_PATH: process.env.TLS_CA_PATH,
    TLS_MIN_VERSION: (process.env.TLS_MIN_VERSION as 'TLSv1.2' | 'TLSv1.3') ?? 'TLSv1.2',
  };
}