/**
 * Comprehensive TypeScript types and interfaces for error system
 * @module core/errors/types
 */

// Import and re-export all types from modular files
export * from './base-types.js';
export * from './analytics-types.js';
export * from './monitoring-types.js';
export * from './resolution-types.js';
export * from './system-types.js';

// Import functions and re-export as named exports (converted from namespaces)
export * as ErrorTypeGuards from './type-guards.js';
export * as ErrorUtilityTypes from './utility-types.js';

/**
 * Re-export all error system types - qualified re-exports to avoid conflicts
 */
export type { ErrorContext } from './error-context.js';
export * from './error-serialization.js';
export * from './error-tracking.js';
export * from './error-recovery.js';
export { AppError } from './app-error.js';
export { EnhancedAppError } from './enhanced-app-error.js';
export * from './domain-errors.js';
export { ErrorFactory } from './error-factory.js';
