/**
 * Helper functions for error serialization
 * @module core/errors/serialization-helpers
 * @nist si-11 "Error handling"
 */

import { ErrorCategory, ErrorSeverity, RecoveryAction } from './error-context.js';

/**
 * Sanitize sensitive data from error details
 */
export function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    const lowercaseKey = key.toLowerCase();
    if (sensitiveKeys.some((sensitiveKey) => lowercaseKey.includes(sensitiveKey))) {
      Object.assign(sanitized, { [key]: '[REDACTED]' });
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(sanitized, { [key]: sanitizeDetails(value as Record<string, unknown>) });
    } else {
      Object.assign(sanitized, { [key]: value });
    }
  }

  return sanitized;
}

/**
 * Infer error category from error name
 */
export function inferCategory(errorName: string): ErrorCategory {
  const name = errorName.toLowerCase();

  if (name.includes('auth')) return ErrorCategory.AUTHENTICATION;
  if (name.includes('validation')) return ErrorCategory.VALIDATION;
  if (name.includes('network')) return ErrorCategory.NETWORK;
  if (name.includes('browser')) return ErrorCategory.BROWSER;
  if (name.includes('database')) return ErrorCategory.DATABASE;
  if (name.includes('resource')) return ErrorCategory.RESOURCE;
  if (name.includes('ratelimit')) return ErrorCategory.RATE_LIMIT;
  if (name.includes('security')) return ErrorCategory.SECURITY;
  if (name.includes('config')) return ErrorCategory.CONFIGURATION;

  return ErrorCategory.SYSTEM;
}

/**
 * Infer error severity from status code
 */
export function inferSeverity(statusCode: number): ErrorSeverity {
  if (statusCode >= 400 && statusCode < 500) return ErrorSeverity.MEDIUM;
  if (statusCode >= 500) return ErrorSeverity.HIGH;
  return ErrorSeverity.LOW;
}

/**
 * Infer recovery suggestions from status code
 */
export function inferRecoverySuggestions(statusCode: number): RecoveryAction[] {
  if (statusCode === 400) return [RecoveryAction.VALIDATE_INPUT];
  if (statusCode === 401) return [RecoveryAction.REFRESH_TOKEN];
  if (statusCode === 403) return [RecoveryAction.CHECK_PERMISSIONS];
  if (statusCode === 404) return [RecoveryAction.VALIDATE_INPUT];
  if (statusCode === 429) return [RecoveryAction.WAIT_AND_RETRY];
  if (statusCode >= 500) return [RecoveryAction.RETRY_WITH_BACKOFF, RecoveryAction.CONTACT_SUPPORT];

  return [RecoveryAction.CONTACT_SUPPORT];
}

/**
 * Convert HTTP status code to gRPC status code
 */
export function httpToGrpcStatus(httpStatus: number): number {
  const mapping = new Map<number, number>([
    [400, 3], // INVALID_ARGUMENT
    [401, 16], // UNAUTHENTICATED
    [403, 7], // PERMISSION_DENIED
    [404, 5], // NOT_FOUND
    [409, 6], // ALREADY_EXISTS
    [429, 8], // RESOURCE_EXHAUSTED
    [500, 13], // INTERNAL
    [501, 12], // UNIMPLEMENTED
    [503, 14], // UNAVAILABLE
    [504, 4], // DEADLINE_EXCEEDED
  ]);

  return mapping.get(httpStatus) ?? 2; // UNKNOWN
}

/**
 * Convert HTTP status code to MCP error code
 */
export function httpToMcpErrorCode(httpStatus: number): number {
  const mapping = new Map<number, number>([
    [400, -32602], // Invalid params
    [401, -32001], // Unauthorized
    [403, -32002], // Forbidden
    [404, -32601], // Method not found
    [429, -32003], // Rate limited
    [500, -32603], // Internal error
    [503, -32004], // Service unavailable
  ]);

  return mapping.get(httpStatus) ?? -32603; // Internal error
}
