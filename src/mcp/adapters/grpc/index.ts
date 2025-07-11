/**
 * gRPC adapter module exports
 * @module mcp/adapters/grpc
 * @description Re-exports the main gRPC adapter class and related types
 */

export { GrpcAdapter } from './grpc-adapter.js';
export type {
  GrpcServiceHandler,
  GrpcResponse,
  GrpcOperation,
  MockStreamCall,
  ErrorDetails,
  ServiceMetadata,
  GrpcCapabilities,
  ValidationResult,
  ExecuteRequestParams,
  MetadataOptions,
} from './types.js';

// Export component classes for advanced usage
export { GrpcConnectionManager } from './connection-manager.js';
export { GrpcServiceMethodHandler } from './service-handler.js';
export { GrpcMetadataManager } from './metadata-manager.js';
export { GrpcProtocolHandler } from './protocol-handler.js';
export { GrpcErrorHandler } from './error-handler.js';
export { GrpcMiddlewarePipeline } from './middleware-pipeline.js';
export { GrpcAuthHandler } from './auth-handler.js';
export { GrpcStreamManager } from './stream-manager.js';
export { GrpcSerializationManager } from './serialization-manager.js';

export type { GrpcMiddleware } from './middleware-pipeline.js';
