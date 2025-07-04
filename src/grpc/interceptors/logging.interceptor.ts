/**
 * gRPC logging interceptor
 * @module grpc/interceptors/logging
 * @nist au-3 "Content of audit records"
 * @nist au-8 "Time stamps"
 * @nist au-9 "Protection of audit information"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { ExtendedCall, GrpcCallback, NextFunction, GrpcError, InterceptorFunction } from './types.js';

/**
 * Extract request context for logging
 */
interface LogContext {
  requestId: string;
  methodName: string;
  clientIp: string;
  userAgent: string;
  userId?: string;
  sessionId?: string;
}

/**
 * Extract or generate request ID
 */
function getRequestId(metadata: grpc.Metadata): string {
  const existingId = metadata.get('x-request-id')?.[0]?.toString();
  if (existingId !== null && existingId !== undefined && existingId !== '') {
    return existingId;
  }
  
  const newId = uuidv4();
  metadata.set('x-request-id', newId);
  return newId;
}

/**
 * Get client IP from metadata or call
 */
function getClientIp(metadata: grpc.Metadata, call: ExtendedCall): string {
  const forwardedFor = metadata.get('x-forwarded-for')?.[0]?.toString();
  if (forwardedFor) return forwardedFor;
  
  const peer = call.getPeer?.();
  return peer ?? 'unknown';
}

/**
 * Extract logging context from call
 */
function extractLogContext(call: ExtendedCall): LogContext {
  const metadata = call.metadata;
  const requestId = getRequestId(metadata);
  const clientIp = getClientIp(metadata, call);
  const userAgent = metadata.get('x-user-agent')?.[0]?.toString() ?? 'unknown';
  
  return {
    requestId,
    methodName: call.handler?.path ?? 'unknown',
    clientIp,
    userAgent,
    userId: call.userId,
    sessionId: call.session?.id,
  };
}

/**
 * Log request start
 */
async function logRequestStart(logger: pino.Logger, context: LogContext): Promise<void> {
  logger.info({
    type: 'grpc_request',
    timestamp: new Date().toISOString(),
    ...context,
  }, 'gRPC request received');

  await logSecurityEvent(SecurityEventType.API_ACCESS, {
    resource: context.methodName,
    action: 'grpc_call',
    result: 'success',
    metadata: {
      requestId: context.requestId,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      userId: context.userId,
      sessionId: context.sessionId,
    },
  });
}

/**
 * Log successful response
 */
async function logSuccessResponse(
  logger: pino.Logger,
  context: LogContext,
  duration: number
): Promise<void> {
  logger.info({
    type: 'grpc_response',
    timestamp: new Date().toISOString(),
    duration,
    statusCode: grpc.status.OK,
    ...context,
  }, 'gRPC request completed');

  await logSecurityEvent(SecurityEventType.API_ACCESS, {
    resource: context.methodName,
    action: 'grpc_call',
    result: 'success',
    metadata: {
      requestId: context.requestId,
      clientIp: context.clientIp,
      userId: context.userId,
      sessionId: context.sessionId,
      duration,
    },
  });
}

/**
 * Log error response
 */
async function logErrorResponse(
  logger: pino.Logger,
  context: LogContext,
  error: Error,
  duration: number
): Promise<void> {
  const statusCode = (error as GrpcError).code ?? grpc.status.UNKNOWN;
  const errorMessage = error.message ?? 'Unknown error';

  logger.error({
    type: 'grpc_response',
    timestamp: new Date().toISOString(),
    duration,
    statusCode,
    error: errorMessage,
    stack: error.stack,
    ...context,
  }, 'gRPC request failed');

  await logSecurityEvent(SecurityEventType.ERROR, {
    resource: context.methodName,
    action: 'grpc_call',
    result: 'failure',
    reason: errorMessage,
    metadata: {
      requestId: context.requestId,
      clientIp: context.clientIp,
      userId: context.userId,
      sessionId: context.sessionId,
      duration,
      statusCode,
    },
  });
}

/**
 * Setup stream logging handlers
 */
function setupStreamLogging(
  call: ExtendedCall,
  logger: pino.Logger,
  startTime: number
): void {
  if (call.call && typeof call.call.on === 'function') {
    logger.info('gRPC streaming call initiated');
    
    call.call.on('data', (_data: unknown) => {
      logger.debug({
        type: 'grpc_stream_data',
        timestamp: new Date().toISOString(),
      }, 'Stream data received');
    });

    call.call.on('end', () => {
      logger.info({
        type: 'grpc_stream_end',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      }, 'Stream ended');
    });

    call.call.on('error', (error: unknown) => {
      logger.error({
        type: 'grpc_stream_error',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Stream error');
    });
  }
}

/**
 * Logging interceptor for gRPC calls
 * @nist au-3 "Content of audit records"
 * @nist au-8 "Time stamps"
 * @evidence code, test
 */
export function loggingInterceptor(logger: pino.Logger): InterceptorFunction {
  return async (
    call: ExtendedCall,
    callback: GrpcCallback,
    next: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();
    const context = extractLogContext(call);
    
    // Create child logger with request context
    const requestLogger = logger.child(context);

    // Log request start
    await logRequestStart(requestLogger, context);

    // Intercept callback to log response
    const wrappedCallback = async (error: Error | null, response?: unknown): Promise<void> => {
      const duration = Date.now() - startTime;
      
      if (error !== null && error !== undefined) {
        await logErrorResponse(requestLogger, context, error, duration);
      } else {
        await logSuccessResponse(requestLogger, context, duration);
      }

      // Call original callback
      callback(error, response);
    };

    try {
      // Setup stream logging if applicable
      setupStreamLogging(call, requestLogger, startTime);

      // Continue to next handler
      next(call, wrappedCallback as GrpcCallback);
    } catch (error) {
      requestLogger.error({
        type: 'grpc_interceptor_error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }, 'Logging interceptor error');

      // Continue with original callback
      next(call, callback);
    }
  };
}

/**
 * Performance logging interceptor
 * @nist au-3 "Content of audit records"
 */
export function performanceInterceptor(logger: pino.Logger): InterceptorFunction {
  return (
    call: ExtendedCall,
    callback: GrpcCallback,
    next: NextFunction
  ): void => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    const wrappedCallback = (error: Error | null, response?: unknown): void => {
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      const memoryDelta = {
        rss: endMemory.rss - startMemory.rss,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external,
      };

      logger.debug({
        type: 'grpc_performance',
        method: call.handler?.path ?? 'unknown',
        duration,
        memoryDelta,
        timestamp: new Date().toISOString(),
      }, 'gRPC performance metrics');

      callback(error, response);
    };

    next(call, wrappedCallback);
  };
}