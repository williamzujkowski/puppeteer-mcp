/**
 * Data sanitization for sensitive information in logs
 * @module core/middleware/logging/log-sanitizer
 * @nist au-3 "Content of audit records"
 * @nist ia-5 "Authenticator management"
 */

import type { HttpHeaders } from './types.js';

/**
 * Redact sensitive data from object recursively
 * @nist au-3 "Content of audit records"
 * @nist ia-5 "Authenticator management"
 */
export const redactSensitiveData = (
  obj: Record<string, unknown>,
  sensitiveFields: string[],
): Record<string, unknown> => {
  const redactRecursive = (target: unknown, path: string[] = []): unknown => {
    if (typeof target !== 'object' || target === null) {
      return target;
    }

    if (Array.isArray(target)) {
      return target.map((item, index) => redactRecursive(item, [...path, index.toString()]));
    }

    const result: Record<string, unknown> = {};
    const targetRecord = target as Record<string, unknown>;
    for (const [key, value] of Object.entries(targetRecord)) {
      const lowerKey = key.toLowerCase();
      const fullPath = [...path, key].join('.');

      // Check if this field should be redacted
      const shouldRedact = sensitiveFields.some(
        (field) =>
          lowerKey.includes(field.toLowerCase()) ||
          fullPath.toLowerCase().includes(field.toLowerCase()),
      );

      if (shouldRedact) {
        // eslint-disable-next-line security/detect-object-injection
        result[key] = '[REDACTED]';
      } else {
        // eslint-disable-next-line security/detect-object-injection
        result[key] = redactRecursive(value, [...path, key]);
      }
    }
    return result;
  };

  return redactRecursive({ ...obj }) as Record<string, unknown>;
};

/**
 * Redact sensitive headers
 * @nist au-3 "Content of audit records"
 * @nist ia-5 "Authenticator management"
 */
export const redactSensitiveHeaders = (
  headers: HttpHeaders,
  sensitiveHeaders: string[],
): Record<string, string | string[]> => {
  const redacted: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    const shouldRedact = sensitiveHeaders.some((header) => lowerKey.includes(header.toLowerCase()));

    if (shouldRedact) {
      // eslint-disable-next-line security/detect-object-injection
      redacted[key] = '[REDACTED]';
    } else {
      // eslint-disable-next-line security/detect-object-injection
      redacted[key] = value ?? '';
    }
  }

  return redacted;
};

/**
 * Check if content type should be logged
 */
export const shouldLogContentType = (
  contentType: string | undefined,
  loggedTypes: string[],
): boolean => {
  if (contentType === undefined || contentType === null || contentType === '') return false;
  const type = contentType.toLowerCase().split(';')[0] ?? '';
  return loggedTypes.some((loggedType) => type.includes(loggedType));
};

/**
 * Sanitize error object for logging
 */
export const sanitizeError = (error: Error): Record<string, unknown> => {
  return {
    message: error.message,
    name: error.name,
    stack: error.stack,
  };
};
