/**
 * Shared types and interfaces for gRPC adapter
 * @module mcp/adapters/grpc/types
 * @nist cm-7 "Least functionality"
 * @nist ac-3 "Access enforcement"
 */

import * as grpc from '@grpc/grpc-js';
import { z } from 'zod';
import type { AuthParams } from '../adapter.interface.js';

/**
 * Generic service interface for gRPC services
 */
export interface GrpcServiceHandler {
  [methodName: string]: (
    call: {
      request: Record<string, unknown>;
      metadata: grpc.Metadata;
      getPeer: () => string;
      sendMetadata: () => void;
      end?: () => void;
      write?: (chunk: unknown) => boolean;
      destroy?: (error?: Error) => void;
      on?: (event: string, listener: (...args: unknown[]) => void) => unknown;
      emit?: (event: string, ...args: unknown[]) => boolean;
    },
    callback?: (error: grpc.ServiceError | null, response?: Record<string, unknown>) => void,
  ) => void;
}

/**
 * gRPC response type for transformations
 */
export type GrpcResponse = Record<string, unknown> | Record<string, unknown>[];

/**
 * gRPC operation parameters schema
 */
export const GrpcOperationSchema = z.object({
  service: z.enum(['SessionService', 'ContextService', 'HealthService']),
  method: z.string(),
  request: z.unknown().optional(),
  streaming: z.boolean().optional().default(false),
});

export type GrpcOperation = z.infer<typeof GrpcOperationSchema>;

/**
 * Authentication parameters schema
 */
export const AuthParamsSchema = z.object({
  type: z.enum(['jwt', 'apikey', 'session']),
  credentials: z.string(),
});

/**
 * Mock stream call interface for streaming operations
 */
export interface MockStreamCall {
  request: Record<string, unknown>;
  metadata: grpc.Metadata;
  getPeer: () => string;
  sendMetadata: () => void;
  write: (chunk: unknown) => boolean;
  end: () => void;
  destroy: (error?: Error) => void;
  on: () => MockStreamCall;
  emit: () => boolean;
}

/**
 * Error details interface
 */
export interface ErrorDetails {
  errorMessage: string;
  errorCode: string;
  statusCode: number;
}

/**
 * Service metadata for endpoint discovery
 */
export interface ServiceMetadata {
  name: string;
  methods: Array<{
    name: string;
    type: 'unary' | 'server-streaming' | 'client-streaming' | 'bidirectional-streaming';
  }>;
}

/**
 * gRPC capabilities interface
 */
export interface GrpcCapabilities {
  protocol: string;
  version: string;
  features: string[];
  [key: string]: unknown;
}

/**
 * Validation helper type guards
 */
export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

/**
 * Request execution parameters
 */
export interface ExecuteRequestParams {
  operation: unknown;
  auth?: unknown;
  sessionId?: string;
}

/**
 * Metadata creation options
 */
export interface MetadataOptions {
  auth?: AuthParams;
  sessionId?: string;
  requestId?: string;
}