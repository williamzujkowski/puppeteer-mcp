/**
 * Logger creation and configuration
 * @module utils/logging/logger-factory
 */

import { pino, type Logger as PinoLogger } from 'pino';
import { getLogLevel } from './log-levels.js';
import {
  createBaseFormatters,
  getStandardSerializers,
  createMixinFunction,
  getTimestampFunction,
  createDevelopmentTransport,
  shouldUsePrettyPrint,
} from './log-formatters.js';

/**
 * Create logger options based on configuration
 */
export const createLoggerOptions = (name: string, isAudit = false): pino.LoggerOptions => {
  const baseOptions: pino.LoggerOptions = {
    name,
    level: isAudit ? 'info' : getLogLevel(),
    formatters: createBaseFormatters(),
    serializers: getStandardSerializers(),
    timestamp: getTimestampFunction(),
    mixin: createMixinFunction(),
  };

  // Development pretty printing (not for audit logs)
  if (shouldUsePrettyPrint(isAudit)) {
    return {
      ...baseOptions,
      transport: createDevelopmentTransport(),
    };
  }

  return baseOptions;
};

/**
 * Create a configured logger instance
 * @param name - Logger name/module
 * @returns Configured Pino logger
 */
export const createLogger = (name: string): PinoLogger => {
  // In MCP stdio mode, write logs to stderr to avoid corrupting protocol
  const isMcpStdio = process.env.MCP_TRANSPORT === 'stdio';
  const isNotTty = !process.stdout.isTTY;
  
  if (isMcpStdio || isNotTty) {
    return pino(createLoggerOptions(name), pino.destination(2)); // 2 = stderr
  }
  
  return pino(createLoggerOptions(name));
};

/**
 * Create child logger with additional context
 */
export const createChildLogger = (
  parentLogger: PinoLogger,
  context: Record<string, unknown>,
): PinoLogger => {
  return parentLogger.child(context);
};