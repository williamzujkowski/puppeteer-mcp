/**
 * Error response utilities for sending error responses
 * @module core/middleware/error-response
 * @nist si-11 "Error handling"
 */

import type { Request, Response } from 'express';
import { EnhancedAppError } from '../errors/enhanced-app-error.js';
import { ErrorSerializer } from '../errors/error-serialization.js';
import '../../types/express.js';

/**
 * Configuration for error response handling
 */
export interface ErrorResponseConfig {
  includeStack?: boolean;
  includeTechnicalDetails?: boolean;
  includeRetryConfig?: boolean;
  includeHelpLinks?: boolean;
  sanitizeSensitiveData?: boolean;
}

/**
 * Error response handler for sending formatted error responses
 */
export class ErrorResponseHandler {
  private config: ErrorResponseConfig;

  constructor(config: ErrorResponseConfig = {}) {
    this.config = {
      includeStack: process.env.NODE_ENV === 'development',
      includeTechnicalDetails: true,
      includeRetryConfig: true,
      includeHelpLinks: true,
      sanitizeSensitiveData: true,
      ...config,
    };
  }

  /**
   * Send error response
   */
  sendErrorResponse(error: EnhancedAppError, req: Request, res: Response, startTime: number): void {
    const requestDuration = Date.now() - startTime;

    const serializedError = ErrorSerializer.serializeForRest(error, {
      requestId: error.getRequestId(),
      userId: error.getUserId(),
      endpoint: req.originalUrl,
      method: req.method,
      requestDuration,
      includeStack: this.config.includeStack,
      includeTechnicalDetails: this.config.includeTechnicalDetails,
      includeRetryConfig: this.config.includeRetryConfig,
      includeHelpLinks: this.config.includeHelpLinks,
      sanitizeSensitiveData: this.config.sanitizeSensitiveData,
    });

    // Set security headers
    this.setSecurityHeaders(res);

    // Don't leak sensitive information in error responses
    if (error.containsSensitiveData()) {
      delete serializedError.error.details;
    }

    res.status(error.statusCode).json(serializedError);
  }

  /**
   * Set security headers on response
   */
  private setSecurityHeaders(res: Response): void {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
  }
}
