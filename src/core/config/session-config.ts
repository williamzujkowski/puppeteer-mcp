/**
 * Session configuration parser
 * @module core/config/session-config
 * @nist cm-7 "Least functionality"
 */

import { parseBoolean, parseInt } from './base-parsers.js';

/**
 * Parse session configuration from environment
 */
export function parseSessionConfig(sessionSecret: string): {
  SESSION_STORE_TYPE: 'memory' | 'redis';
  SESSION_TIMEOUT: number;
  SESSION_CLEANUP_INTERVAL: number;
  SESSION_MAX_AGE: number;
  SESSION_SECRET: string;
  SESSION_RENEWAL_THRESHOLD: number;
  ENABLE_SESSION_MONITORING: boolean;
  SESSION_STORE_MONITORING_ENABLED: boolean;
  SESSION_STORE_REPLICATION_ENABLED: boolean;
  SESSION_STORE_MIGRATION_ENABLED: boolean;
} {
  return {
    SESSION_STORE_TYPE: (process.env.SESSION_STORE_TYPE as 'memory' | 'redis') ?? 'memory',
    SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT, 86400000),
    SESSION_CLEANUP_INTERVAL: parseInt(process.env.SESSION_CLEANUP_INTERVAL, 900000),
    SESSION_MAX_AGE: parseInt(process.env.SESSION_MAX_AGE, 604800000),
    SESSION_SECRET: sessionSecret,
    SESSION_RENEWAL_THRESHOLD: parseInt(process.env.SESSION_RENEWAL_THRESHOLD, 300000),
    ENABLE_SESSION_MONITORING: parseBoolean(process.env.ENABLE_SESSION_MONITORING, true),
    SESSION_STORE_MONITORING_ENABLED: parseBoolean(
      process.env.SESSION_STORE_MONITORING_ENABLED,
      true,
    ),
    SESSION_STORE_REPLICATION_ENABLED: parseBoolean(
      process.env.SESSION_STORE_REPLICATION_ENABLED,
      false,
    ),
    SESSION_STORE_MIGRATION_ENABLED: parseBoolean(
      process.env.SESSION_STORE_MIGRATION_ENABLED,
      false,
    ),
  };
}
