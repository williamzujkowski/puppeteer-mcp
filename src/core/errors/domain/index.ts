/**
 * Domain error exports
 * @module core/errors/domain
 * @nist si-11 "Error handling"
 */

// Re-export all domain errors
export * from './auth-errors.js';
export * from './browser-errors.js';
export * from './network-errors.js';
export * from './validation-errors.js';
export * from './session-errors.js';
export * from './resource-errors.js';

// Re-export interfaces
export type {
  BaseErrorOptions,
  AuthenticationErrorOptions,
  AuthorizationErrorOptions,
  BrowserErrorOptions,
  NetworkErrorOptions,
  ValidationErrorOptions,
  SessionErrorOptions,
  ConfigurationErrorOptions,
  SecurityErrorOptions,
  RateLimitErrorOptions,
  ResourceErrorOptions,
  ProxyErrorOptions,
  DomainErrorOptions,
} from '../domain-error-interfaces.js';