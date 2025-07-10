/**
 * Server configuration management and validation
 * @module server/server-config
 * @nist cm-7 "Least functionality"
 * @nist si-10 "Information input validation"
 */

import { readFileSync } from 'fs';
import * as https from 'https';
import { config, validateProductionConfig } from '../core/config.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { ServerConfig } from './types.js';

/**
 * Server configuration error
 */
export class ServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerError';
  }
}

/**
 * Create server configuration from environment
 */
export function createServerConfig(): ServerConfig {
  return {
    port: config.PORT ?? 8443,
    host: config.HOST ?? '0.0.0.0',
    grpcPort: config.GRPC_PORT ?? 50051,
    grpcHost: config.GRPC_HOST ?? '0.0.0.0',
    nodeEnv: config.NODE_ENV ?? 'development',
    tlsEnabled: config.TLS_ENABLED === true,
    apiPrefix: config.API_PREFIX ?? '/api',
    apiVersion: 'v1',
    wsPath: config.WS_PATH ?? '/ws',
  };
}

/**
 * Validate server configuration
 */
export function validateServerConfig(serverConfig: ServerConfig): void {
  // Validate production configuration
  validateProductionConfig();

  // Validate port ranges
  if (serverConfig.port < 1 || serverConfig.port > 65535) {
    throw new ServerError(`Invalid port: ${serverConfig.port}. Must be between 1 and 65535.`);
  }

  if (serverConfig.grpcPort < 1 || serverConfig.grpcPort > 65535) {
    throw new ServerError(`Invalid gRPC port: ${serverConfig.grpcPort}. Must be between 1 and 65535.`);
  }

  // Validate TLS configuration in production
  if (serverConfig.nodeEnv === 'production' && !serverConfig.tlsEnabled) {
    throw new ServerError('TLS must be enabled in production environment');
  }

  // Validate host binding
  if (serverConfig.nodeEnv === 'production' && serverConfig.host === '0.0.0.0') {
    console.warn('Warning: Binding to 0.0.0.0 in production. Consider using a specific interface.');
  }
}

/**
 * Check if TLS should be enabled based on configuration
 */
export function shouldEnableTLS(): boolean {
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
 * Validate TLS file paths for security
 */
function validateTlsPaths(certPath: string, keyPath: string): void {
  if (certPath.includes('..') || keyPath.includes('..')) {
    throw new ServerError('Invalid TLS file paths - path traversal detected');
  }
}

/**
 * Read TLS certificates
 */
function readTlsCertificates(certPath: string, keyPath: string): { cert: Buffer; key: Buffer } {
  try {
    const cert = readFileSync(certPath);
    const key = readFileSync(keyPath);
    return { cert, key };
  } catch (error) {
    throw error instanceof Error ? error : new ServerError('Failed to read TLS certificates');
  }
}

/**
 * Create HTTPS options for TLS configuration
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist sc-13 "Cryptographic protection"
 */
export function createHttpsOptions(): https.ServerOptions {
  const certPath = config.TLS_CERT_PATH as string;
  const keyPath = config.TLS_KEY_PATH as string;

  try {
    // Validate paths for security
    validateTlsPaths(certPath, keyPath);
    
    // Read certificates
    const { cert, key } = readTlsCertificates(certPath, keyPath);

    // Log successful TLS certificate loading
    void logSecurityEventSafe(SecurityEventType.TLS_CERTIFICATE_LOADED, {
      result: 'success',
      metadata: {
        certPath: certPath.replace(/^.*\//, '***/'), // Hide sensitive path info
        keyPath: keyPath.replace(/^.*\//, '***/'),
        minVersion: config.TLS_MIN_VERSION,
        hasCA: Boolean(config.TLS_CA_PATH),
        timestamp: new Date().toISOString(),
      },
    });

    const httpsOptions: https.ServerOptions = {
      cert,
      key,
      minVersion: config.TLS_MIN_VERSION,
      ciphers: 'TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256:ECDHE-RSA-AES256-GCM-SHA384',
    };

    // Add CA certificate if configured
    if (config.TLS_CA_PATH !== null && config.TLS_CA_PATH !== undefined && config.TLS_CA_PATH !== '') {
      const caPath = config.TLS_CA_PATH;
      if (caPath.includes('..')) {
        throw new ServerError('Invalid CA file path - path traversal detected');
      }
      httpsOptions.ca = readFileSync(caPath);
    }

    return httpsOptions;
  } catch (error) {
    // Log TLS certificate loading failure
    void logSecurityEventSafe(SecurityEventType.TLS_CERTIFICATE_LOADED, {
      result: 'failure',
      reason: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        certPath: certPath.replace(/^.*\//, '***/'),
        keyPath: keyPath.replace(/^.*\//, '***/'),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    if (error instanceof Error) {
      throw error;
    }
    throw new ServerError('Unknown TLS configuration error');
  }
}

/**
 * Log security event with error handling
 */
async function logSecurityEventSafe(
  eventType: (typeof SecurityEventType)[keyof typeof SecurityEventType],
  eventData: Record<string, unknown>,
): Promise<void> {
  try {
    if (SecurityEventType?.SERVICE_START !== undefined && logSecurityEvent !== undefined) {
      await logSecurityEvent(eventType, eventData);
    }
  } catch {
    // Ignore errors during security logging to prevent cascading failures
  }
}

/**
 * Get trust proxy configuration
 */
export function getTrustProxyConfig(): boolean | string | number {
  if (config.NODE_ENV === 'development') {
    return 'loopback'; // Trust localhost only in development
  }
  
  if (config.TRUST_PROXY !== undefined && config.TRUST_PROXY !== null) {
    return config.TRUST_PROXY; // Use configured value in production
  }
  
  return false; // Default to no proxy trust
}