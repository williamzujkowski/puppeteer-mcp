/**
 * Error fingerprint generation utilities
 * @module core/errors/tracking/fingerprint-generator
 * @nist au-3 "Content of Audit Records"
 */

import { SerializedError } from '../serialization-interfaces.js';

/**
 * Generates error fingerprints and unique IDs
 */
export class FingerprintGenerator {
  /**
   * Generate error fingerprint for deduplication
   */
  static generateFingerprint(error: SerializedError): string {
    const components = [
      error.errorCode,
      error.category,
      error.message,
      error.context.operation ?? '',
      error.context.resource ?? '',
    ];

    return Buffer.from(components.join('|')).toString('base64');
  }

  /**
   * Generate unique ID for error tracking entry
   */
  static generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate correlation group ID
   */
  static generateCorrelationGroup(ruleName: string): string {
    return `${ruleName}_${Date.now()}`;
  }
}
