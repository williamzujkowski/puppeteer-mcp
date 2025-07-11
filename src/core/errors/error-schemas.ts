/**
 * Zod schemas for error context validation
 * @module core/errors/error-schemas
 * @nist si-11 "Error handling"
 */

import { z } from 'zod';
import { ErrorCategory, ErrorSeverity, RecoveryAction } from './error-types.js';

/**
 * Schema for validating error context
 */
export const ErrorContextSchema = z.object({
  errorCode: z.string().min(1, 'Error code cannot be empty'),
  category: z.nativeEnum(ErrorCategory),
  severity: z.nativeEnum(ErrorSeverity),
  userMessage: z.string().min(1, 'User message cannot be empty'),
  technicalDetails: z.record(z.unknown()).optional(),
  recoverySuggestions: z.array(z.nativeEnum(RecoveryAction)),
  retryConfig: z
    .object({
      maxAttempts: z.number().int().min(1).max(10),
      initialDelay: z.number().int().min(100).max(60000),
      backoffMultiplier: z.number().min(1).max(10),
      maxDelay: z.number().int().min(1000).max(300000),
      jitter: z.number().min(0).max(1),
      retryableErrorCodes: z.array(z.string()).optional(),
    })
    .optional(),
  context: z
    .object({
      requestId: z.string().optional(),
      userId: z.string().optional(),
      sessionId: z.string().optional(),
      timestamp: z.date(),
      stack: z.string().optional(),
      statusCode: z.number().optional(),
      correlationIds: z.array(z.string()).optional(),
      operation: z.string().optional(),
      resource: z.string().optional(),
      environment: z
        .object({
          nodeVersion: z.string().optional(),
          platform: z.string().optional(),
          service: z.string().optional(),
          version: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  localization: z
    .object({
      locale: z.string().optional(),
      translations: z.record(z.string()).optional(),
    })
    .optional(),
  helpLinks: z
    .object({
      documentation: z.string().url().optional(),
      troubleshooting: z.string().url().optional(),
      support: z.string().url().optional(),
      faq: z.string().url().optional(),
    })
    .optional(),
  tags: z.record(z.string()).optional(),
  shouldReport: z.boolean().optional(),
  containsSensitiveData: z.boolean().optional(),
});
