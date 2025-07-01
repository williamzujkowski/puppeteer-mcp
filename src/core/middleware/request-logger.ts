/**
 * Request logging middleware
 * @module core/middleware/request-logger
 * @nist au-3 "Content of audit records"
 */

import type { Logger } from 'pino';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Create request logging middleware
 * @param logger - Pino logger instance
 * @returns Express middleware
 */
export const requestLogger = (logger: Logger) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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
      const duration = Date.now() - (req.startTime ?? Date.now());

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
