/**
 * Rate limiting configuration parser
 * @module core/config/rate-limiting-config
 * @nist cm-7 "Least functionality"
 */

import { parseBoolean, parseInt } from './base-parsers.js';

/**
 * Parse rate limiting configuration from environment
 */
export function parseRateLimitingConfig(): {
  RATE_LIMIT_ENABLED: boolean;
  RATE_LIMIT_WINDOW: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: boolean;
  RATE_LIMIT_SKIP_FAILED_REQUESTS: boolean;
} {
  return {
    RATE_LIMIT_ENABLED: parseBoolean(process.env.RATE_LIMIT_ENABLED, true),
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW, 900000),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
    RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: parseBoolean(
      process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS,
      false,
    ),
    RATE_LIMIT_SKIP_FAILED_REQUESTS: parseBoolean(
      process.env.RATE_LIMIT_SKIP_FAILED_REQUESTS,
      false,
    ),
  };
}
