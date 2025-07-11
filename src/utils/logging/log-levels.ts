/**
 * Log level management and configuration
 * @module utils/logging/log-levels
 */

import type { LogLevel } from './types.js';
import { config } from '../../core/config.js';

/**
 * Get the configured log level
 */
export const getLogLevel = (): LogLevel => {
  return config.LOG_LEVEL as LogLevel;
};

/**
 * Get the log level for audit logs
 * Audit logs should always be at info level or higher
 */
export const getAuditLogLevel = (): LogLevel => {
  return 'info';
};

/**
 * Check if a log level is enabled
 */
export const isLogLevelEnabled = (level: LogLevel, currentLevel: LogLevel): boolean => {
  const levels = new Map<LogLevel, number>([
    ['silent', 0],
    ['fatal', 10],
    ['error', 20],
    ['warn', 30],
    ['info', 40],
    ['debug', 50],
    ['trace', 60],
  ]);

  const levelValue = levels.get(level);
  const currentLevelValue = levels.get(currentLevel);

  if (levelValue === undefined || currentLevelValue === undefined) {
    return false;
  }

  return levelValue <= currentLevelValue;
};

/**
 * Get appropriate log level for development
 */
export const getDevelopmentLogLevel = (): LogLevel => {
  return config.NODE_ENV === 'development' ? 'debug' : getLogLevel();
};
