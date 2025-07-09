/**
 * Convenient serialization function exports
 * @module core/errors/serialization-exports
 */

import { ErrorSerializer } from './error-serialization.js';

/**
 * Convenient serialization functions
 */
export const serializeError = ErrorSerializer.serialize.bind(ErrorSerializer);
export const serializeErrorForRest = ErrorSerializer.serializeForRest.bind(ErrorSerializer);
export const serializeErrorForGrpc = ErrorSerializer.serializeForGrpc.bind(ErrorSerializer);
export const serializeErrorForWebSocket = ErrorSerializer.serializeForWebSocket.bind(ErrorSerializer);
export const serializeErrorForMcp = ErrorSerializer.serializeForMcp.bind(ErrorSerializer);

// Re-export everything from the main modules for convenience
export * from './error-serialization.js';
export * from './serialization-helpers.js';
export * from './serialization-interfaces.js';
export * from './protocol-serializers.js';