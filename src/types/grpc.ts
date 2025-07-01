/**
 * gRPC type definitions
 * @module types/grpc
 */

import { z } from 'zod';

/**
 * gRPC status codes
 */
export enum GrpcStatus {
  OK = 0,
  CANCELLED = 1,
  UNKNOWN = 2,
  INVALID_ARGUMENT = 3,
  DEADLINE_EXCEEDED = 4,
  NOT_FOUND = 5,
  ALREADY_EXISTS = 6,
  PERMISSION_DENIED = 7,
  RESOURCE_EXHAUSTED = 8,
  FAILED_PRECONDITION = 9,
  ABORTED = 10,
  OUT_OF_RANGE = 11,
  UNIMPLEMENTED = 12,
  INTERNAL = 13,
  UNAVAILABLE = 14,
  DATA_LOSS = 15,
  UNAUTHENTICATED = 16,
}

/**
 * gRPC metadata schema
 */
export const grpcMetadataSchema = z.record(z.union([
  z.string(),
  z.array(z.string()),
  z.instanceof(Buffer),
  z.array(z.instanceof(Buffer)),
]));

/**
 * gRPC error details schema
 */
export const grpcErrorDetailsSchema = z.object({
  code: z.nativeEnum(GrpcStatus),
  message: z.string(),
  details: z.array(z.object({
    type: z.string(),
    value: z.unknown(),
  })).optional(),
});

/**
 * Common gRPC request metadata
 */
export const grpcRequestMetadataSchema = z.object({
  'x-request-id': z.string().optional(),
  'authorization': z.string().optional(),
  'x-api-key': z.string().optional(),
  'x-user-agent': z.string().optional(),
  'x-forwarded-for': z.string().optional(),
});

/**
 * Pagination request schema
 */
export const grpcPaginationRequestSchema = z.object({
  pageSize: z.number().int().positive().max(100).default(20),
  pageToken: z.string().optional(),
});

/**
 * Pagination response schema
 */
export const grpcPaginationResponseSchema = z.object({
  nextPageToken: z.string().optional(),
  totalSize: z.number().int().nonnegative().optional(),
});

/**
 * Common field mask schema
 */
export const grpcFieldMaskSchema = z.object({
  paths: z.array(z.string()),
});

/**
 * Timestamp schema (Google protobuf timestamp)
 */
export const grpcTimestampSchema = z.object({
  seconds: z.number().int(),
  nanos: z.number().int().min(0).max(999999999),
});

/**
 * Duration schema (Google protobuf duration)
 */
export const grpcDurationSchema = z.object({
  seconds: z.number().int(),
  nanos: z.number().int().min(-999999999).max(999999999),
});

/**
 * Empty message schema
 */
export const grpcEmptySchema = z.object({});

/**
 * Types
 */
export type GrpcMetadata = z.infer<typeof grpcMetadataSchema>;
export type GrpcErrorDetails = z.infer<typeof grpcErrorDetailsSchema>;
export type GrpcRequestMetadata = z.infer<typeof grpcRequestMetadataSchema>;
export type GrpcPaginationRequest = z.infer<typeof grpcPaginationRequestSchema>;
export type GrpcPaginationResponse = z.infer<typeof grpcPaginationResponseSchema>;
export type GrpcFieldMask = z.infer<typeof grpcFieldMaskSchema>;
export type GrpcTimestamp = z.infer<typeof grpcTimestampSchema>;
export type GrpcDuration = z.infer<typeof grpcDurationSchema>;
export type GrpcEmpty = z.infer<typeof grpcEmptySchema>;

/**
 * gRPC call options
 */
export interface GrpcCallOptions {
  deadline?: Date;
  metadata?: GrpcMetadata;
  credentials?: any;
  propagateFlags?: number;
}

/**
 * gRPC server options
 */
export interface GrpcServerOptions {
  host: string;
  port: number;
  credentials?: any;
  maxReceiveMessageSize?: number;
  maxSendMessageSize?: number;
  keepaliveTime?: number;
  keepaliveTimeout?: number;
  maxConcurrentCalls?: number;
}

/**
 * gRPC client options
 */
export interface GrpcClientOptions {
  address: string;
  credentials?: any;
  maxReceiveMessageSize?: number;
  maxSendMessageSize?: number;
  channelOptions?: Record<string, unknown>;
}

/**
 * Convert Date to gRPC timestamp
 */
export const dateToGrpcTimestamp = (date: Date): GrpcTimestamp => {
  const seconds = Math.floor(date.getTime() / 1000);
  const nanos = (date.getTime() % 1000) * 1000000;
  return { seconds, nanos };
};

/**
 * Convert gRPC timestamp to Date
 */
export const grpcTimestampToDate = (timestamp: GrpcTimestamp): Date => {
  return new Date(timestamp.seconds * 1000 + timestamp.nanos / 1000000);
};

/**
 * Convert milliseconds to gRPC duration
 */
export const msToGrpcDuration = (ms: number): GrpcDuration => {
  const seconds = Math.floor(ms / 1000);
  const nanos = (ms % 1000) * 1000000;
  return { seconds, nanos };
};

/**
 * Convert gRPC duration to milliseconds
 */
export const grpcDurationToMs = (duration: GrpcDuration): number => {
  return duration.seconds * 1000 + duration.nanos / 1000000;
};