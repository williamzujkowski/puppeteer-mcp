/**
 * Default retry configurations for different error categories
 * @module core/errors/retry-configs
 */

import { ErrorCategory, RetryConfig } from './types.js';

/**
 * Default retry configurations for different error categories
 */
export const DEFAULT_RETRY_CONFIGS: Record<ErrorCategory, RetryConfig | null> = {
  [ErrorCategory.NETWORK]: {
    maxAttempts: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000,
    jitter: 0.1,
  },
  [ErrorCategory.EXTERNAL_SERVICE]: {
    maxAttempts: 3,
    initialDelay: 2000,
    backoffMultiplier: 2,
    maxDelay: 30000,
    jitter: 0.2,
  },
  [ErrorCategory.RESOURCE]: {
    maxAttempts: 2,
    initialDelay: 5000,
    backoffMultiplier: 2,
    maxDelay: 30000,
    jitter: 0.1,
  },
  [ErrorCategory.BROWSER]: {
    maxAttempts: 2,
    initialDelay: 3000,
    backoffMultiplier: 2,
    maxDelay: 15000,
    jitter: 0.1,
  },
  [ErrorCategory.RATE_LIMIT]: {
    maxAttempts: 3,
    initialDelay: 60000,
    backoffMultiplier: 2,
    maxDelay: 300000,
    jitter: 0.3,
  },
  // Non-retryable categories
  [ErrorCategory.AUTHENTICATION]: null,
  [ErrorCategory.AUTHORIZATION]: null,
  [ErrorCategory.VALIDATION]: null,
  [ErrorCategory.SECURITY]: null,
  [ErrorCategory.BUSINESS_LOGIC]: null,
  [ErrorCategory.CONFIGURATION]: null,
  [ErrorCategory.DATABASE]: null,
  [ErrorCategory.SYSTEM]: null,
  [ErrorCategory.PERFORMANCE]: null,
};