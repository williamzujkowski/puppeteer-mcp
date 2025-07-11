/**
 * Enhanced error serialization/deserialization for all protocols
 * @module core/errors/error-serialization
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of Audit Records"
 */

import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { EnhancedAppError } from './enhanced-app-error.js';
import { ErrorCategory, ErrorSeverity, RecoveryAction } from './error-context.js';
import {
  sanitizeDetails,
  inferCategory,
  inferSeverity,
  inferRecoverySuggestions,
} from './serialization-helpers.js';
import {
  buildRestSerializationOptions,
  buildRestErrorObject,
  buildRestMetaObject,
  serializeForGrpc,
  serializeForWebSocket,
  serializeForMcp,
} from './protocol-serializers.js';
import {
  SerializedError,
  RestErrorResponse,
  GrpcErrorResponse,
  WebSocketErrorResponse,
  McpErrorResponse,
  SerializationOptions,
} from './serialization-interfaces.js';

/**
 * Error serialization utility class
 */
export class ErrorSerializer {
  /**
   * Serialize error to common format
   */
  static serialize(
    error: Error | AppError | EnhancedAppError | ZodError,
    options: SerializationOptions = {},
  ): SerializedError {
    const timestamp = new Date().toISOString();

    if (error instanceof EnhancedAppError) {
      return this.serializeEnhancedAppError(error, options, timestamp);
    }

    if (error instanceof ZodError) {
      return this.serializeZodError(error, options, timestamp);
    }

    if (error instanceof AppError) {
      return this.serializeAppError(error, options, timestamp);
    }

    return this.serializeGenericError(error, options, timestamp);
  }

  /**
   * Serialize EnhancedAppError instance
   */
  private static serializeEnhancedAppError(
    error: EnhancedAppError,
    options: SerializationOptions,
    timestamp: string,
  ): SerializedError {
    const baseResult: SerializedError = {
      name: error.name,
      message: error.message,
      errorCode: error.errorContext.errorCode,
      category: error.errorContext.category,
      severity: error.errorContext.severity,
      userMessage: error.errorContext.userMessage,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      recoverySuggestions: error.errorContext.recoverySuggestions,
      context: this.buildEnhancedErrorContext(error, options, timestamp),
    };

    return this.addOptionalEnhancedErrorFields(baseResult, error, options);
  }

  /**
   * Build context for EnhancedAppError
   */
  private static buildEnhancedErrorContext(
    error: EnhancedAppError,
    options: SerializationOptions,
    timestamp: string,
  ): SerializedError['context'] {
    const errorContext = error.errorContext.context;
    const baseContext = this.buildBasicErrorContext(options, timestamp, error.stack);

    return {
      ...baseContext,
      sessionId: errorContext?.sessionId,
      correlationIds: errorContext?.correlationIds,
      operation: errorContext?.operation,
      resource: errorContext?.resource,
      environment: errorContext?.environment,
    };
  }

  /**
   * Add optional fields to enhanced error serialization
   */
  private static addOptionalEnhancedErrorFields(
    baseResult: SerializedError,
    error: EnhancedAppError,
    options: SerializationOptions,
  ): SerializedError {
    const result = { ...baseResult };

    if (
      options.includeTechnicalDetails === true &&
      error.errorContext.technicalDetails !== undefined
    ) {
      result.technicalDetails =
        options.sanitizeSensitiveData === true
          ? sanitizeDetails(error.errorContext.technicalDetails)
          : error.errorContext.technicalDetails;
    }

    if (options.includeRetryConfig === true && error.errorContext.retryConfig !== undefined) {
      result.retryConfig = error.errorContext.retryConfig;
    }

    if (options.includeHelpLinks === true && error.errorContext.helpLinks !== undefined) {
      result.helpLinks = error.errorContext.helpLinks;
    }

    if (options.includeTags === true && error.errorContext.tags !== undefined) {
      result.tags = error.errorContext.tags;
    }

    return result;
  }

  /**
   * Serialize ZodError instance
   */
  private static serializeZodError(
    error: ZodError,
    options: SerializationOptions,
    timestamp: string,
  ): SerializedError {
    const baseResult: SerializedError = {
      name: 'ValidationError',
      message: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      userMessage: 'Invalid request data',
      statusCode: 400,
      isOperational: true,
      recoverySuggestions: [RecoveryAction.VALIDATE_INPUT],
      context: this.buildBasicErrorContext(options, timestamp, error.stack),
    };

    if (options.includeTechnicalDetails === true) {
      baseResult.technicalDetails = {
        validationErrors: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      };
    }

    return baseResult;
  }

  /**
   * Serialize AppError instance
   */
  private static serializeAppError(
    error: AppError,
    options: SerializationOptions,
    timestamp: string,
  ): SerializedError {
    const baseResult: SerializedError = {
      name: error.name,
      message: error.message,
      errorCode: error.name.toUpperCase().replace(/ERROR$/, ''),
      category: inferCategory(error.name),
      severity: inferSeverity(error.statusCode),
      userMessage: error.message,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      recoverySuggestions: inferRecoverySuggestions(error.statusCode),
      context: this.buildBasicErrorContext(options, timestamp, error.stack),
    };

    if (options.includeTechnicalDetails === true && error.details !== undefined) {
      baseResult.technicalDetails =
        options.sanitizeSensitiveData === true ? sanitizeDetails(error.details) : error.details;
    }

    return baseResult;
  }

  /**
   * Serialize generic Error instance
   */
  private static serializeGenericError(
    error: Error,
    options: SerializationOptions,
    timestamp: string,
  ): SerializedError {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const context = this.buildBasicErrorContext(options, timestamp, error.stack);

    // Only include stack for generic errors in development mode
    if (isDevelopment !== true || options.includeStack !== true) {
      delete context.stack;
    }

    return {
      name: error.name ?? 'Error',
      message: error.message,
      errorCode: 'INTERNAL_SERVER_ERROR',
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
      userMessage: isDevelopment === true ? error.message : 'An unexpected error occurred',
      statusCode: 500,
      isOperational: false,
      recoverySuggestions: [RecoveryAction.CONTACT_SUPPORT],
      context,
    };
  }

  /**
   * Build basic error context for non-enhanced errors
   */
  private static buildBasicErrorContext(
    options: SerializationOptions,
    timestamp: string,
    stack?: string,
  ): SerializedError['context'] {
    const context: SerializedError['context'] = {
      requestId: options.requestId,
      userId: options.userId,
      timestamp,
    };

    if (options.includeStack === true && stack !== undefined) {
      context.stack = stack;
    }

    return context;
  }

  /**
   * Serialize error for REST API response
   */
  static serializeForRest(
    error: Error | AppError | EnhancedAppError | ZodError,
    options: SerializationOptions = {},
  ): RestErrorResponse {
    const restOptions = buildRestSerializationOptions(options);
    const serialized = this.serialize(error, restOptions);

    return {
      error: buildRestErrorObject(serialized),
      meta: buildRestMetaObject(options),
    };
  }

  /**
   * Serialize error for gRPC response
   */
  static serializeForGrpc(
    error: Error | AppError | EnhancedAppError | ZodError,
    options: SerializationOptions = {},
  ): GrpcErrorResponse {
    const serialized = this.serialize(error, {
      ...options,
      includeStack: false,
      includeTechnicalDetails: true,
      includeRetryConfig: true,
      includeHelpLinks: true,
      includeTags: true,
      sanitizeSensitiveData: true,
    });

    return serializeForGrpc(serialized);
  }

  /**
   * Serialize error for WebSocket response
   */
  static serializeForWebSocket(
    error: Error | AppError | EnhancedAppError | ZodError,
    messageId?: string,
    options: SerializationOptions = {},
  ): WebSocketErrorResponse {
    const serialized = this.serialize(error, {
      ...options,
      includeStack: false,
      includeTechnicalDetails: true,
      includeRetryConfig: true,
      includeHelpLinks: true,
      includeTags: true,
      sanitizeSensitiveData: true,
    });

    return serializeForWebSocket(serialized, messageId, options.connectionId);
  }

  /**
   * Serialize error for MCP response
   */
  static serializeForMcp(
    error: Error | AppError | EnhancedAppError | ZodError,
    id?: string | number,
    options: SerializationOptions = {},
  ): McpErrorResponse {
    const serialized = this.serialize(error, {
      ...options,
      includeStack: false,
      includeTechnicalDetails: true,
      includeRetryConfig: true,
      includeHelpLinks: true,
      includeTags: true,
      sanitizeSensitiveData: true,
    });

    return serializeForMcp(serialized, id);
  }
}
