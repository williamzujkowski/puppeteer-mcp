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

/**
 * Serialized error format for API responses
 */
export interface SerializedError {
  name: string;
  message: string;
  errorCode: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;
  statusCode: number;
  isOperational: boolean;
  recoverySuggestions: RecoveryAction[];
  context: {
    requestId?: string;
    userId?: string;
    sessionId?: string;
    timestamp: string;
    stack?: string;
    correlationIds?: string[];
    operation?: string;
    resource?: string;
    environment?: {
      nodeVersion?: string;
      platform?: string;
      service?: string;
      version?: string;
    };
  };
  technicalDetails?: Record<string, unknown>;
  retryConfig?: {
    maxAttempts: number;
    initialDelay: number;
    backoffMultiplier: number;
    maxDelay: number;
    jitter: number;
    retryableErrorCodes?: string[];
  };
  helpLinks?: {
    documentation?: string;
    troubleshooting?: string;
    support?: string;
    faq?: string;
  };
  tags?: Record<string, string>;
}

/**
 * REST API error response format
 */
export interface RestErrorResponse {
  error: {
    code: string;
    message: string;
    userMessage: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    details?: Record<string, unknown>;
    recoverySuggestions?: RecoveryAction[];
    retryConfig?: SerializedError['retryConfig'];
    helpLinks?: SerializedError['helpLinks'];
    timestamp: string;
    requestId?: string;
    correlationIds?: string[];
    tags?: Record<string, string>;
  };
  meta?: {
    version: string;
    endpoint: string;
    method: string;
    requestDuration?: number;
  };
}

/**
 * gRPC error response format
 */
export interface GrpcErrorResponse {
  code: number;
  message: string;
  details: string;
  metadata: {
    errorCode: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    userMessage: string;
    recoverySuggestions: RecoveryAction[];
    retryConfig?: string; // JSON stringified
    helpLinks?: string; // JSON stringified
    timestamp: string;
    requestId?: string;
    correlationIds?: string; // JSON stringified array
    tags?: string; // JSON stringified
  };
}

/**
 * WebSocket error response format
 */
export interface WebSocketErrorResponse {
  type: 'error';
  id?: string;
  error: {
    code: string;
    message: string;
    userMessage: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    details?: Record<string, unknown>;
    recoverySuggestions?: RecoveryAction[];
    retryConfig?: SerializedError['retryConfig'];
    helpLinks?: SerializedError['helpLinks'];
    timestamp: string;
    requestId?: string;
    correlationIds?: string[];
    tags?: Record<string, string>;
  };
  meta?: {
    connectionId: string;
    protocol: 'websocket';
  };
}

/**
 * MCP error response format
 */
export interface McpErrorResponse {
  jsonrpc: '2.0';
  error: {
    code: number;
    message: string;
    data?: {
      errorCode: string;
      category: ErrorCategory;
      severity: ErrorSeverity;
      userMessage: string;
      details?: Record<string, unknown>;
      recoverySuggestions?: RecoveryAction[];
      retryConfig?: SerializedError['retryConfig'];
      helpLinks?: SerializedError['helpLinks'];
      timestamp: string;
      requestId?: string;
      correlationIds?: string[];
      tags?: Record<string, string>;
    };
  };
  id?: string | number;
}

/**
 * Serialization options
 */
export interface SerializationOptions {
  includeStack?: boolean;
  includeTechnicalDetails?: boolean;
  includeRetryConfig?: boolean;
  includeHelpLinks?: boolean;
  includeTags?: boolean;
  sanitizeSensitiveData?: boolean;
  requestId?: string;
  endpoint?: string;
  method?: string;
  requestDuration?: number;
  connectionId?: string;
  userId?: string;
}

/**
 * Error serialization utility class
 */
export class ErrorSerializer {
  /**
   * Serialize error to common format
   */
  static serialize(
    error: Error | AppError | EnhancedAppError | ZodError,
    options: SerializationOptions = {}
  ): SerializedError {
    const timestamp = new Date().toISOString();
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (error instanceof EnhancedAppError) {
      return {
        name: error.name,
        message: error.message,
        errorCode: error.errorContext.errorCode,
        category: error.errorContext.category,
        severity: error.errorContext.severity,
        userMessage: error.errorContext.userMessage,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        recoverySuggestions: error.errorContext.recoverySuggestions,
        context: {
          requestId: options.requestId ?? error.errorContext.context?.requestId,
          userId: options.userId ?? error.errorContext.context?.userId,
          sessionId: error.errorContext.context?.sessionId,
          timestamp,
          ...(Boolean(options.includeStack) && { stack: error.stack }),
          correlationIds: error.errorContext.context?.correlationIds,
          operation: error.errorContext.context?.operation,
          resource: error.errorContext.context?.resource,
          environment: error.errorContext.context?.environment,
        },
        ...(Boolean(options.includeTechnicalDetails) && Boolean(error.errorContext.technicalDetails) && {
          technicalDetails: options.sanitizeSensitiveData
            ? this.sanitizeDetails(error.errorContext.technicalDetails)
            : error.errorContext.technicalDetails,
        }),
        ...(Boolean(options.includeRetryConfig) && Boolean(error.errorContext.retryConfig) && {
          retryConfig: error.errorContext.retryConfig,
        }),
        ...(Boolean(options.includeHelpLinks) && Boolean(error.errorContext.helpLinks) && {
          helpLinks: error.errorContext.helpLinks,
        }),
        ...(Boolean(options.includeTags) && Boolean(error.errorContext.tags) && {
          tags: error.errorContext.tags,
        }),
      };
    }

    if (error instanceof ZodError) {
      return {
        name: 'ValidationError',
        message: 'Validation failed',
        errorCode: 'VALIDATION_ERROR',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'Invalid request data',
        statusCode: 400,
        isOperational: true,
        recoverySuggestions: [RecoveryAction.VALIDATE_INPUT],
        context: {
          requestId: options.requestId,
          userId: options.userId,
          timestamp,
          ...(Boolean(options.includeStack) && { stack: error.stack }),
        },
        ...(Boolean(options.includeTechnicalDetails) && {
          technicalDetails: {
            validationErrors: error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message,
              code: e.code,
            })),
          },
        }),
      };
    }

    if (error instanceof AppError) {
      return {
        name: error.name,
        message: error.message,
        errorCode: error.name.toUpperCase().replace(/ERROR$/, ''),
        category: this.inferCategory(error.name),
        severity: this.inferSeverity(error.statusCode),
        userMessage: error.message,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        recoverySuggestions: this.inferRecoverySuggestions(error.statusCode),
        context: {
          requestId: options.requestId,
          userId: options.userId,
          timestamp,
          ...(Boolean(options.includeStack) && { stack: error.stack }),
        },
        ...(options.includeTechnicalDetails && error.details && {
          technicalDetails: options.sanitizeSensitiveData 
            ? this.sanitizeDetails(error.details)
            : error.details,
        }),
      };
    }

    // Generic error
    return {
      name: error.name || 'Error',
      message: error.message,
      errorCode: 'INTERNAL_SERVER_ERROR',
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.CRITICAL,
      userMessage: isDevelopment ? error.message : 'An unexpected error occurred',
      statusCode: 500,
      isOperational: false,
      recoverySuggestions: [RecoveryAction.CONTACT_SUPPORT],
      context: {
        requestId: options.requestId,
        userId: options.userId,
        timestamp,
        ...(options.includeStack && isDevelopment && { stack: error.stack }),
      },
    };
  }

  /**
   * Serialize error for REST API response
   */
  static serializeForRest(
    error: Error | AppError | EnhancedAppError | ZodError,
    options: SerializationOptions = {}
  ): RestErrorResponse {
    const serialized = this.serialize(error, {
      ...options,
      includeStack: options.includeStack || false,
      includeTechnicalDetails: options.includeTechnicalDetails || true,
      includeRetryConfig: options.includeRetryConfig || true,
      includeHelpLinks: options.includeHelpLinks || true,
      includeTags: options.includeTags || false,
      sanitizeSensitiveData: options.sanitizeSensitiveData || true,
    });

    return {
      error: {
        code: serialized.errorCode,
        message: serialized.message,
        userMessage: serialized.userMessage,
        category: serialized.category,
        severity: serialized.severity,
        details: serialized.technicalDetails,
        recoverySuggestions: serialized.recoverySuggestions,
        retryConfig: serialized.retryConfig,
        helpLinks: serialized.helpLinks,
        timestamp: serialized.context.timestamp,
        requestId: serialized.context.requestId,
        correlationIds: serialized.context.correlationIds,
        tags: serialized.tags,
      },
      meta: {
        version: '1.0',
        endpoint: options.endpoint || 'unknown',
        method: options.method || 'unknown',
        ...(options.requestDuration && { requestDuration: options.requestDuration }),
      },
    };
  }

  /**
   * Serialize error for gRPC response
   */
  static serializeForGrpc(
    error: Error | AppError | EnhancedAppError | ZodError,
    options: SerializationOptions = {}
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

    return {
      code: this.httpToGrpcStatus(serialized.statusCode),
      message: serialized.userMessage,
      details: JSON.stringify(serialized.technicalDetails || {}),
      metadata: {
        errorCode: serialized.errorCode,
        category: serialized.category,
        severity: serialized.severity,
        userMessage: serialized.userMessage,
        recoverySuggestions: serialized.recoverySuggestions,
        ...(serialized.retryConfig && { retryConfig: JSON.stringify(serialized.retryConfig) }),
        ...(serialized.helpLinks && { helpLinks: JSON.stringify(serialized.helpLinks) }),
        timestamp: serialized.context.timestamp,
        requestId: serialized.context.requestId,
        ...(serialized.context.correlationIds && { 
          correlationIds: JSON.stringify(serialized.context.correlationIds) 
        }),
        ...(serialized.tags && { tags: JSON.stringify(serialized.tags) }),
      },
    };
  }

  /**
   * Serialize error for WebSocket response
   */
  static serializeForWebSocket(
    error: Error | AppError | EnhancedAppError | ZodError,
    messageId?: string,
    options: SerializationOptions = {}
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

    return {
      type: 'error',
      id: messageId,
      error: {
        code: serialized.errorCode,
        message: serialized.message,
        userMessage: serialized.userMessage,
        category: serialized.category,
        severity: serialized.severity,
        details: serialized.technicalDetails,
        recoverySuggestions: serialized.recoverySuggestions,
        retryConfig: serialized.retryConfig,
        helpLinks: serialized.helpLinks,
        timestamp: serialized.context.timestamp,
        requestId: serialized.context.requestId,
        correlationIds: serialized.context.correlationIds,
        tags: serialized.tags,
      },
      meta: {
        connectionId: options.connectionId || 'unknown',
        protocol: 'websocket',
      },
    };
  }

  /**
   * Serialize error for MCP response
   */
  static serializeForMcp(
    error: Error | AppError | EnhancedAppError | ZodError,
    id?: string | number,
    options: SerializationOptions = {}
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

    return {
      jsonrpc: '2.0',
      error: {
        code: this.httpToMcpErrorCode(serialized.statusCode),
        message: serialized.userMessage,
        data: {
          errorCode: serialized.errorCode,
          category: serialized.category,
          severity: serialized.severity,
          userMessage: serialized.userMessage,
          details: serialized.technicalDetails,
          recoverySuggestions: serialized.recoverySuggestions,
          retryConfig: serialized.retryConfig,
          helpLinks: serialized.helpLinks,
          timestamp: serialized.context.timestamp,
          requestId: serialized.context.requestId,
          correlationIds: serialized.context.correlationIds,
          tags: serialized.tags,
        },
      },
      id,
    };
  }

  /**
   * Sanitize sensitive data from error details
   */
  private static sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      const lowercaseKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitiveKey => lowercaseKey.includes(sensitiveKey))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeDetails(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Infer error category from error name
   */
  private static inferCategory(errorName: string): ErrorCategory {
    const name = errorName.toLowerCase();
    
    if (name.includes('auth')) return ErrorCategory.AUTHENTICATION;
    if (name.includes('validation')) return ErrorCategory.VALIDATION;
    if (name.includes('network')) return ErrorCategory.NETWORK;
    if (name.includes('browser')) return ErrorCategory.BROWSER;
    if (name.includes('database')) return ErrorCategory.DATABASE;
    if (name.includes('resource')) return ErrorCategory.RESOURCE;
    if (name.includes('ratelimit')) return ErrorCategory.RATE_LIMIT;
    if (name.includes('security')) return ErrorCategory.SECURITY;
    if (name.includes('config')) return ErrorCategory.CONFIGURATION;
    
    return ErrorCategory.SYSTEM;
  }

  /**
   * Infer error severity from status code
   */
  private static inferSeverity(statusCode: number): ErrorSeverity {
    if (statusCode >= 400 && statusCode < 500) return ErrorSeverity.MEDIUM;
    if (statusCode >= 500) return ErrorSeverity.HIGH;
    return ErrorSeverity.LOW;
  }

  /**
   * Infer recovery suggestions from status code
   */
  private static inferRecoverySuggestions(statusCode: number): RecoveryAction[] {
    if (statusCode === 400) return [RecoveryAction.VALIDATE_INPUT];
    if (statusCode === 401) return [RecoveryAction.REFRESH_TOKEN];
    if (statusCode === 403) return [RecoveryAction.CHECK_PERMISSIONS];
    if (statusCode === 404) return [RecoveryAction.VALIDATE_INPUT];
    if (statusCode === 429) return [RecoveryAction.WAIT_AND_RETRY];
    if (statusCode >= 500) return [RecoveryAction.RETRY_WITH_BACKOFF, RecoveryAction.CONTACT_SUPPORT];
    
    return [RecoveryAction.CONTACT_SUPPORT];
  }

  /**
   * Convert HTTP status code to gRPC status code
   */
  private static httpToGrpcStatus(httpStatus: number): number {
    const mapping: Record<number, number> = {
      400: 3, // INVALID_ARGUMENT
      401: 16, // UNAUTHENTICATED
      403: 7, // PERMISSION_DENIED
      404: 5, // NOT_FOUND
      409: 6, // ALREADY_EXISTS
      429: 8, // RESOURCE_EXHAUSTED
      500: 13, // INTERNAL
      501: 12, // UNIMPLEMENTED
      503: 14, // UNAVAILABLE
      504: 4, // DEADLINE_EXCEEDED
    };

    return mapping[httpStatus] || 2; // UNKNOWN
  }

  /**
   * Convert HTTP status code to MCP error code
   */
  private static httpToMcpErrorCode(httpStatus: number): number {
    const mapping: Record<number, number> = {
      400: -32602, // Invalid params
      401: -32001, // Unauthorized
      403: -32002, // Forbidden
      404: -32601, // Method not found
      429: -32003, // Rate limited
      500: -32603, // Internal error
      503: -32004, // Service unavailable
    };

    return mapping[httpStatus] || -32603; // Internal error
  }
}

/**
 * Convenient serialization functions
 */
export const serializeError = ErrorSerializer.serialize;
export const serializeErrorForRest = ErrorSerializer.serializeForRest;
export const serializeErrorForGrpc = ErrorSerializer.serializeForGrpc;
export const serializeErrorForWebSocket = ErrorSerializer.serializeForWebSocket;
export const serializeErrorForMcp = ErrorSerializer.serializeForMcp;