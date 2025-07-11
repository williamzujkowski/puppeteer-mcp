/**
 * Logging configuration parser
 * @module core/config/logging-config
 * @nist cm-7 "Least functionality"
 */

import { parseBoolean } from './base-parsers.js';

/**
 * Parse logging configuration from environment
 */
export function parseLoggingConfig(): {
  LOG_LEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  LOG_FORMAT: 'json' | 'pretty';
  AUDIT_LOG_ENABLED: boolean;
  AUDIT_LOG_PATH: string;
} {
  return {
    LOG_LEVEL:
      (process.env.LOG_LEVEL as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal') ?? 'info',
    LOG_FORMAT: (process.env.LOG_FORMAT as 'json' | 'pretty') ?? 'json',
    AUDIT_LOG_ENABLED: parseBoolean(process.env.AUDIT_LOG_ENABLED, true),
    AUDIT_LOG_PATH: process.env.AUDIT_LOG_PATH ?? './logs/audit',
  };
}
