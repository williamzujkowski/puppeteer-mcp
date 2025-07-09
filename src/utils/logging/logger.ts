/**
 * Main logger class and coordination
 * @module utils/logging/logger
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-4 "Audit storage capacity"
 */

import type { Logger as PinoLogger } from 'pino';
import { createLogger } from './logger-factory.js';
import type { LoggerInstances } from './types.js';

/**
 * Main application logger
 */
export const logger = createLogger('app');

/**
 * Structured logging helpers
 */
export const loggers: LoggerInstances = {
  http: createLogger('http'),
  grpc: createLogger('grpc'),
  ws: createLogger('websocket'),
  auth: createLogger('auth'),
  session: createLogger('session'),
  db: createLogger('database'),
  redis: createLogger('redis'),
  performance: createLogger('performance'),
};

/**
 * Helper function to safely get stream from logger instance
 */
export const getLoggerStream = (loggerInstance: PinoLogger): unknown => {
  const symbols = Object.getOwnPropertySymbols(loggerInstance);
  const streamSymbol = symbols.find((s) => s.toString().includes('pino.stream'));

  if (!streamSymbol) {
    return null;
  }

  // Use Reflect.get to safely access symbol property
  return Reflect.get(loggerInstance, streamSymbol);
};

/**
 * Helper function to flush and end a stream
 */
export const flushAndEndStream = (stream: unknown): void => {
  if (stream === null || stream === undefined) {
    return;
  }
  
  if (!(typeof stream === 'object' && stream !== null)) {
    return;
  }

  const streamObj = stream as {
    readyState?: string;
    flushSync?: () => void;
    end?: () => void;
  };

  // Try to flush synchronously if ready
  const isReady = streamObj.readyState !== 'opening';
  const hasFlushSync = typeof streamObj.flushSync === 'function';
  
  if (isReady && hasFlushSync && streamObj.flushSync) {
    try {
      streamObj.flushSync();
    } catch {
      // Ignore flush errors
    }
  }

  // End the stream
  if (typeof streamObj.end === 'function') {
    streamObj.end();
  }
};

/**
 * Cleanup function for tests
 */
export const cleanupLoggers = async (): Promise<void> => {
  // Import dynamically to avoid circular dependency
  const securityLoggerModule = await import('./security-logger.js');
  const { getAuditLogger, cleanupAuditLogger } = securityLoggerModule;
  
  try {
    const auditLogger = await getAuditLogger();
    const stream = getLoggerStream(auditLogger);
    flushAndEndStream(stream);

    // Wait a bit for the stream to finish
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 100);
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
    });
  } catch {
    // Ignore cleanup errors in tests
  }

  cleanupAuditLogger();
};