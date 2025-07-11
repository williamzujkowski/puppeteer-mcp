/**
 * Error handling system exports
 * @module core/errors
 */

// Main error classes
export * from './app-error.js';
export * from './enhanced-app-error.js';
export * from './error-context.js';

// Serialization system
export * from './error-serialization.js';
export * from './serialization-interfaces.js';
export * from './serialization-helpers.js';
export * from './protocol-serializers.js';
export * from './serialization-exports.js';

// Error factories
export * from './error-factory.js';
export * from './factories/index.js';

// Error tracking
export * from './error-tracker.js';
export * from './error-tracking-interfaces.js';
export * from './error-tracking-storage.js';

// Domain errors
export * from './domain-errors.js';

// Types - qualified re-exports to avoid conflicts
export type { ErrorContext } from './error-context.js';
export type { ErrorFactory } from './error-factory.js';
export * from './types.js';

// Utils
export * from './retry-configs.js';
