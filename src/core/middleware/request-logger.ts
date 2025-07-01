/**
 * Request logging middleware
 * @module core/middleware/request-logger
 * @nist au-3 "Content of audit records"
 */

// Express types are handled through any for now
import type { Logger } from 'pino';
import { randomUUID } from 'crypto';

// Type extensions are now in types/express.d.ts

/**
 * Create request logging middleware
 * @param logger - Pino logger instance
 * @returns Express middleware
 */
export const requestLogger = (logger: Logger) => {
  return (req: any, res: any, next: any): void => {
    // Assign unique request ID
    req.id = randomUUID();
    req.startTime = Date.now();

    // Log request
    logger.info({
      type: 'request',
      requestId: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Log response on finish
    res.on('finish', () => {
      const duration = Date.now() - req.startTime;

      logger.info({
        type: 'response',
        requestId: req.id,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length'),
      });
    });

    next();
  };
};
