/**
 * Comprehensive error handling system
 * @module core/errors
 * @nist si-11 "Error handling"
 */

import { ZodError } from 'zod';
import { AppError } from './errors/app-error.js';

// Re-export base error classes
export * from './errors/app-error.js';

/**
 * Error codes for consistent API responses
 */
export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  CONFLICT: 'CONFLICT',
  GONE: 'GONE',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  
  // Server errors (5xx)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  BAD_GATEWAY: 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
  
  // Custom business errors
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  INVALID_OPERATION: 'INVALID_OPERATION',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Additional error classes
 */
export class BadRequestError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, true, details);
    this.name = 'BadRequestError';
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 422, true, details);
    this.name = 'UnprocessableEntityError';
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: Record<string, unknown>) {
    super(message, 500, false, details);
    this.name = 'InternalServerError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', details?: Record<string, unknown>) {
    super(message, 503, true, details);
    this.name = 'ServiceUnavailableError';
  }
}

export class GatewayTimeoutError extends AppError {
  constructor(message: string = 'Gateway timeout', details?: Record<string, unknown>) {
    super(message, 504, true, details);
    this.name = 'GatewayTimeoutError';
  }
}

/**
 * Business logic errors
 */
export class SessionExpiredError extends AppError {
  constructor(message: string = 'Session has expired') {
    super(message, 401, true);
    this.name = 'SessionExpiredError';
  }
}

export class TokenError extends AppError {
  constructor(message: string, code: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' = 'INVALID_TOKEN') {
    super(message, 401, true, { code });
    this.name = 'TokenError';
  }
}

export class ResourceLockedError extends AppError {
  constructor(resource: string) {
    super(`Resource ${resource} is locked`, 423, true);
    this.name = 'ResourceLockedError';
  }
}

export class DuplicateEntryError extends AppError {
  constructor(field: string, value: string) {
    super(`Duplicate entry for ${field}: ${value}`, 409, true, { field, value });
    this.name = 'DuplicateEntryError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: unknown) {
    super(message, 500, false, { originalError });
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, statusCode = 502) {
    super(`External service error (${service}): ${message}`, statusCode, true, { service });
    this.name = 'ExternalServiceError';
  }
}

/**
 * Error response format for different protocols
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Serialize error for REST API response
 * @nist au-10 "Non-repudiation"
 */
export const serializeErrorForREST = (
  error: Error | AppError | ZodError,
  requestId?: string,
): ErrorResponse => {
  const timestamp = new Date().toISOString();
  
  if (error instanceof ZodError) {
    return {
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: {
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
            type: e.code,
          })),
        },
        timestamp,
        requestId,
      },
    };
  }
  
  if (error instanceof AppError) {
    return {
      error: {
        code: getErrorCode(error),
        message: error.message,
        details: error.details,
        timestamp,
        requestId,
      },
    };
  }
  
  // Generic error
  return {
    error: {
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message,
      timestamp,
      requestId,
    },
  };
};

/**
 * Serialize error for gRPC response
 */
export const serializeErrorForGRPC = (error: Error | AppError | ZodError): {
  code: number;
  message: string;
  details: string;
} => {
  if (error instanceof ZodError) {
    return {
      code: 3, // INVALID_ARGUMENT
      message: 'Validation failed',
      details: JSON.stringify(error.errors),
    };
  }
  
  if (error instanceof AppError) {
    return {
      code: grpcStatusFromHttpStatus(error.statusCode),
      message: error.message,
      details: JSON.stringify(error.details ?? {}),
    };
  }
  
  return {
    code: 13, // INTERNAL
    message: 'Internal server error',
    details: process.env.NODE_ENV === 'production' ? '' : error.message,
  };
};

/**
 * Serialize error for WebSocket response
 */
export const serializeErrorForWebSocket = (
  error: Error | AppError | ZodError,
  messageId?: string,
): {
  type: 'error';
  id?: string;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
} => {
  const serialized = serializeErrorForREST(error);
  
  return {
    type: 'error',
    id: messageId,
    error: {
      code: serialized.error.code,
      message: serialized.error.message,
      details: serialized.error.details,
    },
  };
};

/**
 * Mapping of HTTP status codes to error codes
 */
const STATUS_TO_ERROR_CODE: Record<number, string> = {
  400: ErrorCodes.BAD_REQUEST,
  403: ErrorCodes.FORBIDDEN,
  404: ErrorCodes.NOT_FOUND,
  409: ErrorCodes.CONFLICT,
  422: ErrorCodes.UNPROCESSABLE_ENTITY,
  429: ErrorCodes.TOO_MANY_REQUESTS,
  500: ErrorCodes.INTERNAL_SERVER_ERROR,
  502: ErrorCodes.BAD_GATEWAY,
  503: ErrorCodes.SERVICE_UNAVAILABLE,
  504: ErrorCodes.GATEWAY_TIMEOUT,
};

/**
 * Get error code from AppError
 */
const getErrorCode = (error: AppError): string => {
  // Special case for 401 errors
  if (error.statusCode === 401) {
    return error.name === 'AuthenticationError' 
      ? ErrorCodes.AUTHENTICATION_FAILED 
      : ErrorCodes.UNAUTHORIZED;
  }
  
  // Use Object.prototype.hasOwnProperty.call for safe property access
  if (Object.prototype.hasOwnProperty.call(STATUS_TO_ERROR_CODE, error.statusCode)) {
    return STATUS_TO_ERROR_CODE[error.statusCode] ?? ErrorCodes.INTERNAL_SERVER_ERROR;
  }
  return ErrorCodes.INTERNAL_SERVER_ERROR;
};

/**
 * Mapping of HTTP status codes to gRPC status codes
 */
const HTTP_TO_GRPC_STATUS: Record<number, number> = {
  400: 3,  // INVALID_ARGUMENT
  401: 16, // UNAUTHENTICATED
  403: 7,  // PERMISSION_DENIED
  404: 5,  // NOT_FOUND
  409: 6,  // ALREADY_EXISTS
  429: 8,  // RESOURCE_EXHAUSTED
  500: 13, // INTERNAL
  501: 12, // UNIMPLEMENTED
  503: 14, // UNAVAILABLE
  504: 4,  // DEADLINE_EXCEEDED
};

/**
 * Map HTTP status to gRPC status code
 */
const grpcStatusFromHttpStatus = (httpStatus: number): number => {
  // Use Object.prototype.hasOwnProperty.call for safe property access
  // This prevents prototype pollution and object injection vulnerabilities
  if (Object.prototype.hasOwnProperty.call(HTTP_TO_GRPC_STATUS, httpStatus)) {
    // Use Object.getOwnPropertyDescriptor for safe access to avoid object injection
    const descriptor = Object.getOwnPropertyDescriptor(HTTP_TO_GRPC_STATUS, httpStatus);
    if (descriptor && descriptor.value !== undefined && typeof descriptor.value === 'number') {
      return descriptor.value;
    }
  }
  return 2; // UNKNOWN
};

/**
 * Type guard for AppError
 */
export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

/**
 * Type guard for operational errors
 */
export const isOperationalError = (error: unknown): boolean => {
  return error instanceof AppError && error.isOperational;
};

/**
 * Create error from unknown value
 */
export const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  
  if (typeof error === 'string') {
    return new Error(error);
  }
  
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return new Error(String(error.message));
  }
  
  return new Error('An unknown error occurred');
};