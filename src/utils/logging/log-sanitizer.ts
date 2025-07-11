/**
 * Data sanitization for logging
 * @module utils/logging/log-sanitizer
 */

/**
 * Sensitive field patterns to redact
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /credential/i,
  /api[-_]?key/i,
  /access[-_]?token/i,
  /refresh[-_]?token/i,
];

/**
 * Redacted value placeholder
 */
const REDACTED = '[REDACTED]';

/**
 * Check if a field name is sensitive
 */
const isSensitiveField = (field: string): boolean => {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(field));
};

/**
 * Sanitize an object for logging
 */
export const sanitizeLogData = <T extends Record<string, unknown>>(data: T): T => {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveField(key)) {
      // Use Object.defineProperty to avoid object injection warnings
      Object.defineProperty(sanitized, key, {
        value: REDACTED,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } else if (
      value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      Object.defineProperty(sanitized, key, {
        value: sanitizeLogData(value as Record<string, unknown>),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } else if (Array.isArray(value)) {
      Object.defineProperty(sanitized, key, {
        value: value.map((item) =>
          item !== null && item !== undefined && typeof item === 'object'
            ? sanitizeLogData(item as Record<string, unknown>)
            : (item as unknown),
        ),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } else {
      Object.defineProperty(sanitized, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }

  return sanitized as T;
};

/**
 * Sanitize error objects for logging
 */
export const sanitizeError = (error: Error): Record<string, unknown> => {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error instanceof Error && 'code' in error ? { code: error.code } : {}),
  };
};

/**
 * Extract safe metadata from request
 */
export const extractSafeMetadata = (
  metadata?: Record<string, unknown>,
): {
  ip?: string;
  userAgent?: string;
} => {
  if (!metadata) {
    return {};
  }

  return {
    ip: typeof metadata.ip === 'string' ? metadata.ip : undefined,
    userAgent: typeof metadata.userAgent === 'string' ? metadata.userAgent : undefined,
  };
};
