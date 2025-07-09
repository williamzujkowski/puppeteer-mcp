/**
 * API configuration parser
 * @module core/config/api-config
 * @nist cm-7 "Least functionality"
 */

import { parseInt } from './base-parsers.js';

/**
 * Parse API configuration from environment
 */
export function parseAPIConfig(): {
  API_PREFIX: string;
  API_TIMEOUT: number;
  API_MAX_PAYLOAD_SIZE: string;
} {
  return {
    API_PREFIX: process.env.API_PREFIX ?? '/api/v1',
    API_TIMEOUT: parseInt(process.env.API_TIMEOUT, 30000),
    API_MAX_PAYLOAD_SIZE: process.env.API_MAX_PAYLOAD_SIZE ?? '10mb',
  };
}