/**
 * Error handling and gRPC status code management
 * @module mcp/adapters/grpc/error-handler
 * @nist si-11 "Error handling"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import { AppError } from '../../../core/errors/app-error.js';
import type { MCPResponse } from '../adapter.interface.js';
import type { ErrorDetails } from './types.js';

/**
 * gRPC error handler class
 */
export class GrpcErrorHandler {
  /**
   * gRPC to HTTP status code mapping
   */
  private readonly grpcToHttpStatus = new Map<grpc.status, number>([
    [grpc.status.OK, 200],
    [grpc.status.CANCELLED, 499],
    [grpc.status.INVALID_ARGUMENT, 400],
    [grpc.status.NOT_FOUND, 404],
    [grpc.status.ALREADY_EXISTS, 409],
    [grpc.status.PERMISSION_DENIED, 403],
    [grpc.status.UNAUTHENTICATED, 401],
    [grpc.status.RESOURCE_EXHAUSTED, 429],
    [grpc.status.FAILED_PRECONDITION, 412],
    [grpc.status.ABORTED, 409],
    [grpc.status.OUT_OF_RANGE, 400],
    [grpc.status.UNIMPLEMENTED, 501],
    [grpc.status.INTERNAL, 500],
    [grpc.status.UNAVAILABLE, 503],
    [grpc.status.DATA_LOSS, 500],
  ]);

  /**
   * Check if error is a gRPC error
   */
  private isGrpcError(error: unknown): error is { code: grpc.status; message: string } {
    return (
      error !== null &&
      error !== undefined &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error
    );
  }

  /**
   * Convert gRPC status code to HTTP status code
   * @nist si-11 "Error handling"
   */
  grpcStatusToHttp(grpcCode: grpc.status): number {
    return this.grpcToHttpStatus.get(grpcCode) ?? 500;
  }

  /**
   * Extract error details from various error types
   */
  extractErrorDetails(error: unknown): ErrorDetails {
    if (this.isGrpcError(error)) {
      return {
        errorMessage: error.message,
        errorCode: grpc.status[error.code] ?? 'UNKNOWN',
        statusCode: this.grpcStatusToHttp(error.code),
      };
    }

    if (error instanceof AppError) {
      return {
        errorMessage: error.message,
        errorCode: (error.details?.type as string) || error.name || 'APP_ERROR',
        statusCode: error.statusCode,
      };
    }

    if (error instanceof Error) {
      return {
        errorMessage: error.message,
        errorCode: 'UNKNOWN',
        statusCode: 500,
      };
    }

    return {
      errorMessage: 'Unknown error occurred',
      errorCode: 'UNKNOWN',
      statusCode: 500,
    };
  }

  /**
   * Transform error to MCP response format
   * @nist au-3 "Content of audit records"
   * @nist si-11 "Error handling"
   */
  transformErrorToMCPResponse(error: unknown, requestId: string): MCPResponse {
    const { errorMessage, errorCode, statusCode } = this.extractErrorDetails(error);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: {
                code: errorCode,
                message: errorMessage,
              },
            },
            null,
            2,
          ),
        },
      ],
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        protocol: 'grpc',
        status: statusCode,
        error: true,
      },
    };
  }
}
