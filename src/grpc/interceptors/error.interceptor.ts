/**
 * gRPC error handling interceptor
 * @module grpc/interceptors/error
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import { AppError } from '../../core/errors/app-error.js';
import { z } from 'zod';
import type { ExtendedCall, GrpcCallback, NextFunction, GrpcError, InterceptorFunction } from './types.js';

/**
 * Check if error has a gRPC status code
 */
function hasGrpcStatusCode(error: unknown): error is { code: number } {
  return (
    error !== null &&
    error !== undefined &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'number'
  );
}

/**
 * Map AppError status code to gRPC status
 */
function mapAppErrorToGrpcStatus(statusCode: number): grpc.status {
  switch (statusCode) {
    case 400:
      return grpc.status.INVALID_ARGUMENT;
    case 401:
      return grpc.status.UNAUTHENTICATED;
    case 403:
      return grpc.status.PERMISSION_DENIED;
    case 404:
      return grpc.status.NOT_FOUND;
    case 409:
      return grpc.status.ALREADY_EXISTS;
    case 429:
      return grpc.status.RESOURCE_EXHAUSTED;
    case 503:
      return grpc.status.UNAVAILABLE;
    default:
      return grpc.status.INTERNAL;
  }
}

/**
 * Map application errors to gRPC status codes
 * @nist si-11 "Error handling"
 */
function mapErrorToGrpcStatus(error: unknown): grpc.status {
  if (hasGrpcStatusCode(error)) {
    return error.code;
  }

  if (error instanceof AppError) {
    return mapAppErrorToGrpcStatus(error.statusCode);
  }

  if (error instanceof z.ZodError) {
    return grpc.status.INVALID_ARGUMENT;
  }

  // Default to internal error
  return grpc.status.INTERNAL;
}

/**
 * Create gRPC error with details
 * @nist si-11 "Error handling"
 */
function createGrpcError(error: unknown, _logger: pino.Logger): GrpcError {
  const grpcError = new Error() as GrpcError;
  
  // Set gRPC status code
  grpcError.code = mapErrorToGrpcStatus(error);

  // Set error message
  if (error instanceof AppError) {
    grpcError.message = error.message;
    grpcError.details = error.details;
  } else if (error instanceof z.ZodError) {
    grpcError.message = 'Validation failed';
    grpcError.details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    }));
  } else if (error instanceof Error) {
    // In production, don't expose internal error details
    if (process.env.NODE_ENV === 'production') {
      grpcError.message = 'Internal server error';
    } else {
      grpcError.message = error.message;
    }
  } else {
    grpcError.message = 'Unknown error occurred';
  }

  // Add metadata
  const metadata = new grpc.Metadata();
  metadata.set('error-id', Date.now().toString());
  
  if (error instanceof AppError) {
    metadata.set('error-code', error.statusCode.toString());
  }
  
  grpcError.metadata = metadata;

  return grpcError;
}

/**
 * Wrap callback to handle errors
 */
function createWrappedCallback(
  originalCallback: GrpcCallback,
  logger: pino.Logger,
  requestContext: {
    requestId: string;
    method: string;
    userId?: string;
    sessionId?: string;
  }
): GrpcCallback {
  return (error: Error | null, response?: unknown) => {
    if (error) {
      // Log error details
      const errorLogger = logger.child(requestContext);

      // Determine log level based on error type
      const grpcError = error as GrpcError;
      if (grpcError.code === grpc.status.CANCELLED || 
          grpcError.code === grpc.status.DEADLINE_EXCEEDED) {
        errorLogger.debug('gRPC call cancelled or timed out', error);
      } else if (error instanceof AppError && error.statusCode < 500) {
        errorLogger.warn({
          error: {
            message: error.message,
            code: grpcError.code,
            details: error.details,
          },
        }, 'Client error in gRPC call');
      } else {
        errorLogger.error({
          error: {
            message: error.message,
            stack: error.stack,
            code: grpcError.code,
          },
        }, 'Server error in gRPC call');
      }

      // Convert to proper gRPC error
      const convertedError = createGrpcError(error, logger);
      originalCallback(convertedError);
    } else {
      // Success case
      originalCallback(null, response);
    }
  };
}

/**
 * Error handling interceptor for gRPC calls
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of audit records"
 * @evidence code, test
 */
/**
 * Handle streaming call errors
 */
function handleStreamingCall(
  call: ExtendedCall,
  logger: pino.Logger,
  requestId: string,
  methodName: string,
  callback: GrpcCallback,
  next: NextFunction
): void {
  const originalCall = call.call;
  
  if (originalCall && typeof originalCall.on === 'function') {
    originalCall.on('error', (error: unknown) => {
      logger.error({
        requestId,
        method: methodName,
        error: error instanceof Error ? {
          message: error.message,
          code: (error as GrpcError).code,
        } : 'Unknown error',
      }, 'Stream error in gRPC call');
    });
  }

  // For server streaming, we need to handle errors differently
  next(call, callback);
}

/**
 * Handle unary call errors
 */
function handleUnaryCall(
  call: ExtendedCall,
  callback: GrpcCallback,
  logger: pino.Logger,
  requestContext: RequestContext,
  next: NextFunction
): void {
  const wrappedCallback = createWrappedCallback(callback, logger, requestContext);
  next(call, wrappedCallback);
}

/**
 * Handle interceptor errors
 */
function handleInterceptorError(
  error: unknown,
  logger: pino.Logger,
  requestId: string,
  methodName: string,
  callback: GrpcCallback
): void {
  logger.error({
    requestId,
    method: methodName,
    error: error instanceof Error ? error.message : 'Unknown error',
  }, 'Error interceptor failed');

  const grpcError = createGrpcError(error, logger);
  callback(grpcError);
}

/**
 * Process interceptor call
 */
function processInterceptorCall(
  call: ExtendedCall,
  callback: GrpcCallback,
  next: NextFunction,
  logger: pino.Logger,
  requestId: string,
  methodName: string
): void {
  const requestContext = {
    requestId,
    method: methodName,
    userId: call.userId,
    sessionId: call.session?.id,
  };

  const isStreamingCall = call.call && typeof call.call.on === 'function';
  
  if (isStreamingCall) {
    handleStreamingCall(call, logger, requestId, methodName, callback, next);
  } else {
    handleUnaryCall(call, callback, logger, requestContext, next);
  }
}

export function errorInterceptor(logger: pino.Logger): InterceptorFunction {
  return (
    call: ExtendedCall,
    callback: GrpcCallback,
    next: NextFunction
  ): void => {
    const methodName = call.handler?.path ?? 'unknown';
    const requestId = call.metadata?.get('x-request-id')?.[0]?.toString() ?? 'unknown';

    try {
      processInterceptorCall(call, callback, next, logger, requestId, methodName);
    } catch (error) {
      handleInterceptorError(error, logger, requestId, methodName, callback);
    }
  };
}

/**
 * Validation error interceptor
 * @nist si-10 "Information input validation"
 */
export function validationInterceptor(logger: pino.Logger): InterceptorFunction {
  return (
    call: ExtendedCall,
    callback: GrpcCallback,
    next: NextFunction
  ): void => {
    try {
      // Validate request if schema is available
      if (call.handler?.requestSchema !== undefined) {
        try {
          call.request = call.handler.requestSchema.parse(call.request);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const grpcError = new Error('Validation failed') as GrpcError;
            grpcError.code = grpc.status.INVALID_ARGUMENT;
            grpcError.details = error.errors;
            
            logger.warn({
              method: call.handler?.path || 'unknown',
              validationErrors: error.errors,
            }, 'Request validation failed');
            
            return callback(grpcError);
          }
          throw error;
        }
      }

      next(call, callback);
    } catch (error) {
      logger.error('Validation interceptor error:', error);
      next(call, callback);
    }
  };
}