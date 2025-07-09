/**
 * gRPC Adapter for MCP (Re-export)
 * @module mcp/adapters/grpc-adapter
 * @description Re-exports the modular gRPC adapter implementation
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @nist ia-2 "Identification and authentication"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

// Re-export the main GrpcAdapter class from the modular implementation
export { GrpcAdapter } from './grpc/grpc-adapter.js';

// Re-export commonly used types
export type {
  GrpcServiceHandler,
  GrpcResponse,
  GrpcOperation,
  ServiceMetadata,
  GrpcCapabilities,
} from './grpc/types.js';
