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
import type {
  ExtendedCall,
  GrpcCallback,
  NextFunction,
  GrpcError,
  InterceptorFunction,
} from './types.js';

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
    grpcError.details = error.errors.map((err) => ({
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
  },
): GrpcCallback {
  return (error: Error | null, response?: unknown) => {
    if (error) {
      // Log error details
      const errorLogger = logger.child(requestContext);

      // Determine log level based on error type
      const grpcError = error as GrpcError;
      if (
        grpcError.code === grpc.status.CANCELLED ||
        grpcError.code === grpc.status.DEADLINE_EXCEEDED
      ) {
        errorLogger.debug('gRPC call cancelled or timed out', error);
      } else if (error instanceof AppError && error.statusCode < 500) {
        errorLogger.warn(
          {
            error: {
              message: error.message,
              code: grpcError.code,
              details: error.details,
            },
          },
          'Client error in gRPC call',
        );
      } else {
        errorLogger.error(
          {
            error: {
              message: error.message,
              stack: error.stack,
              code: grpcError.code,
            },
          },
          'Server error in gRPC call',
        );
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
interface StreamingCallContext {
  call: ExtendedCall;
  logger: pino.Logger;
  requestId: string;
  methodName: string;
}

/**
 * Handle streaming call errors
 */
function handleStreamingCall(
  context: StreamingCallContext,
  callback: GrpcCallback,
  next: NextFunction,
): void {
  const originalCall = context.call.call;

  if (originalCall && typeof originalCall.on === 'function') {
    originalCall.on('error', (error: unknown) => {
      context.logger.error(
        {
          requestId: context.requestId,
          method: context.methodName,
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  code: (error as GrpcError).code,
                }
              : 'Unknown error',
        },
        'Stream error in gRPC call',
      );
    });
  }

  // For server streaming, we need to handle errors differently
  next(context.call, callback);
}

interface RequestContext {
  requestId: string;
  method: string;
  userId?: string;
  sessionId?: string;
}

interface UnaryCallContext {
  call: ExtendedCall;
  logger: pino.Logger;
  requestContext: RequestContext;
}

/**
 * Handle unary call errors
 */
function handleUnaryCall(
  context: UnaryCallContext,
  callback: GrpcCallback,
  next: NextFunction,
): void {
  const wrappedCallback = createWrappedCallback(callback, context.logger, context.requestContext);
  next(context.call, wrappedCallback);
}

interface InterceptorErrorContext {
  error: unknown;
  logger: pino.Logger;
  requestId: string;
  methodName: string;
}

/**
 * Handle interceptor errors
 */
function handleInterceptorError(context: InterceptorErrorContext, callback: GrpcCallback): void {
  context.logger.error(
    {
      requestId: context.requestId,
      method: context.methodName,
      error: context.error instanceof Error ? context.error.message : 'Unknown error',
    },
    'Error interceptor failed',
  );

  const grpcError = createGrpcError(context.error, context.logger);
  callback(grpcError);
}

interface ProcessCallContext {
  call: ExtendedCall;
  logger: pino.Logger;
  requestId: string;
  methodName: string;
}

/**
 * Process interceptor call
 */
function processInterceptorCall(
  context: ProcessCallContext,
  callback: GrpcCallback,
  next: NextFunction,
): void {
  const requestContext: RequestContext = {
    requestId: context.requestId,
    method: context.methodName,
    userId: context.call.userId,
    sessionId: context.call.session?.id,
  };

  const isStreamingCall =
    context.call.call !== undefined &&
    context.call.call !== null &&
    typeof context.call.call.on === 'function';

  if (isStreamingCall) {
    const streamingContext: StreamingCallContext = {
      call: context.call,
      logger: context.logger,
      requestId: context.requestId,
      methodName: context.methodName,
    };
    handleStreamingCall(streamingContext, callback, next);
  } else {
    const unaryContext: UnaryCallContext = {
      call: context.call,
      logger: context.logger,
      requestContext,
    };
    handleUnaryCall(unaryContext, callback, next);
  }
}

export function errorInterceptor(logger: pino.Logger): InterceptorFunction {
  return (call: ExtendedCall, callback: GrpcCallback, next: NextFunction): void => {
    const methodName = call.handler?.path ?? 'unknown';
    const requestId = call.metadata?.get('x-request-id')?.[0]?.toString() ?? 'unknown';

    try {
      const context: ProcessCallContext = {
        call,
        logger,
        requestId,
        methodName,
      };
      processInterceptorCall(context, callback, next);
    } catch (error) {
      const errorContext: InterceptorErrorContext = {
        error,
        logger,
        requestId,
        methodName,
      };
      handleInterceptorError(errorContext, callback);
    }
  };
}

/**
 * Validation error interceptor
 * @nist si-10 "Information input validation"
 */
export function validationInterceptor(logger: pino.Logger): InterceptorFunction {
  return (call: ExtendedCall, callback: GrpcCallback, next: NextFunction): void => {
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

            logger.warn(
              {
                method: call.handler?.path || 'unknown',
                validationErrors: error.errors,
              },
              'Request validation failed',
            );

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
