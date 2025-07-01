/**
 * Type definitions for gRPC interceptors
 * @module grpc/interceptors/types
 */

import * as grpc from '@grpc/grpc-js';
import type { Session } from '../../types/session.js';

/**
 * Extended gRPC call with session context
 */
export interface ExtendedCall {
  metadata: grpc.Metadata;
  handler?: {
    path: string;
    requestSchema?: { parse: (data: unknown) => unknown }; // Zod-like schema interface
  };
  request?: unknown;
  session?: Session;
  userId?: string;
  username?: string;
  roles?: string[];
  call?: {
    on: (event: string, handler: (error: unknown) => void) => void;
  };
  sendMetadata: (metadata: grpc.Metadata) => void;
  getPeer?: () => string;
}

/**
 * gRPC callback function type
 */
export type GrpcCallback<T = unknown> = (error: Error | null, response?: T) => void;

/**
 * Next function in interceptor chain
 */
export type NextFunction = (call: ExtendedCall, callback: GrpcCallback) => void;

/**
 * Interceptor function signature
 */
export type InterceptorFunction = (
  call: ExtendedCall,
  callback: GrpcCallback,
  next: NextFunction
) => void | Promise<void>;

/**
 * gRPC error with extended properties
 */
export interface GrpcError extends Error {
  code: grpc.status;
  details?: unknown;
  metadata?: grpc.Metadata;
}

/**
 * Extended ServerUnaryCall with session context
 */
export interface AuthenticatedServerUnaryCall<RequestType, ResponseType> 
  extends grpc.ServerUnaryCall<RequestType, ResponseType> {
  session?: Session;
  userId?: string;
  username?: string;
  roles?: string[];
}

/**
 * Extended ServerWritableStream with session context
 */
export interface AuthenticatedServerWritableStream<RequestType, ResponseType>
  extends grpc.ServerWritableStream<RequestType, ResponseType> {
  session?: Session;
  userId?: string;
  username?: string;
  roles?: string[];
}