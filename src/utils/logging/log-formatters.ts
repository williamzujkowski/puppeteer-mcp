/**
 * Log formatting utilities
 * @module utils/logging/log-formatters
 */

import { pino } from 'pino';
import { config } from '../../core/config.js';
import { getLogMixin } from './log-context.js';

/**
 * Create base formatters for logger
 */
export const createBaseFormatters = (): pino.LoggerOptions['formatters'] => ({
  level: (label) => ({ level: label }),
  bindings: (bindings) => ({
    ...bindings,
    environment: config.NODE_ENV,
    service: 'puppeteer-mcp',
  }),
});

/**
 * Get standard serializers
 */
export const getStandardSerializers = (): pino.LoggerOptions['serializers'] => ({
  req: pino.stdSerializers.req,
  res: pino.stdSerializers.res,
  err: pino.stdSerializers.err,
});

/**
 * Create mixin function for adding context to logs
 */
export const createMixinFunction = (): (() => Record<string, string | undefined>) => {
  return getLogMixin;
};

/**
 * Get timestamp function
 */
export const getTimestampFunction = (): (() => string) => {
  return pino.stdTimeFunctions.isoTime;
};

/**
 * Create development transport options
 */
export const createDevelopmentTransport = (): pino.TransportSingleOptions => ({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'HH:MM:ss Z',
    ignore: 'pid,hostname',
  },
});

/**
 * Check if pretty printing should be enabled
 */
export const shouldUsePrettyPrint = (isAudit: boolean): boolean => {
  return config.NODE_ENV === 'development' && config.LOG_FORMAT === 'pretty' && !isAudit;
};
