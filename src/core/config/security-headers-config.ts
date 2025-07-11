/**
 * Security headers configuration parser
 * @module core/config/security-headers-config
 * @nist cm-7 "Least functionality"
 */

import { parseBoolean, parseInt, parseJSON } from './base-parsers.js';

/**
 * Parse security headers configuration from environment
 */
export function parseSecurityHeadersConfig(): {
  SECURITY_HEADERS_ENABLED: boolean;
  HSTS_MAX_AGE: number;
  CSP_DIRECTIVES: Record<string, string>;
} {
  return {
    SECURITY_HEADERS_ENABLED: parseBoolean(process.env.SECURITY_HEADERS_ENABLED, true),
    HSTS_MAX_AGE: parseInt(process.env.HSTS_MAX_AGE, 31536000),
    CSP_DIRECTIVES: parseJSON<Record<string, string>>(process.env.CSP_DIRECTIVES, {}),
  };
}
