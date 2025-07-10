/**
 * Security error analysis utilities
 * @module puppeteer/actions/execution/coordinator/security/error-analyzer
 * @nist si-4 "Information system monitoring"
 * @nist si-10 "Information input validation"
 */

import type { BrowserAction } from '../../../../interfaces/action-executor.interface.js';

/**
 * Analyzes errors for security implications
 * @nist si-4 "Information system monitoring"
 */
export class SecurityErrorAnalyzer {
  private readonly suspiciousPatterns: RegExp[] = [
    /script.*injection/i,
    /xss/i,
    /sql.*injection/i,
    /unauthorized/i,
    /malicious/i,
    /exploit/i,
    /payload.*too.*large/i,
    /forbidden/i,
    /csrf/i,
    /cross.*site/i,
    /authentication.*failed/i,
    /access.*denied/i,
  ];

  private readonly errorClassifications = new Map<string, string>([
    ['TimeoutError', 'TIMEOUT'],
    ['NetworkError', 'NETWORK'],
    ['ProtocolError', 'PROTOCOL'],
    ['PermissionError', 'PERMISSION'],
    ['ValidationError', 'VALIDATION'],
    ['NotFoundError', 'NOT_FOUND'],
  ]);

  /**
   * Classify error type
   * @param error - Error instance
   * @returns Error classification
   */
  classifyError(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'UNKNOWN';
    }

    const message = error.message.toLowerCase();
    const name = error.name;

    // Check error name first
    const nameClassification = this.errorClassifications.get(name);
    if (nameClassification) {
      return nameClassification;
    }

    // Check message patterns
    if (name === 'TimeoutError' || message.includes('timeout')) {
      return 'TIMEOUT';
    }
    if (name === 'NetworkError' || message.includes('network')) {
      return 'NETWORK';
    }
    if (message.includes('permission') || message.includes('denied')) {
      return 'PERMISSION';
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return 'VALIDATION';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'NOT_FOUND';
    }
    if (message.includes('protocol') || name === 'ProtocolError') {
      return 'PROTOCOL';
    }

    return 'EXECUTION';
  }

  /**
   * Check if error is suspicious
   * @param error - Error instance
   * @returns True if suspicious
   */
  isSuspiciousError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message;
    return this.suspiciousPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Sanitize action payload for logging
   * @param action - Browser action
   * @returns Sanitized payload
   */
  sanitizeActionPayload(action: BrowserAction): any {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'auth',
      'apikey',
      'api_key',
      'credential',
      'private',
      'session',
    ];

    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      const result: any = Array.isArray(obj) ? [] : {};

      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'string' && this.isSensitiveValue(value)) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    return sanitizeObject({ ...action });
  }

  /**
   * Check if value appears to be sensitive
   * @param value - String value
   * @returns True if sensitive
   */
  private isSensitiveValue(value: string): boolean {
    // Check for common token/key patterns
    const patterns = [
      /^[A-Za-z0-9+/]{40,}={0,2}$/, // Base64
      /^[0-9a-f]{32,}$/i, // Hex strings
      /^Bearer\s+.+$/i, // Bearer tokens
      /^Basic\s+.+$/i, // Basic auth
    ];

    return patterns.some(pattern => pattern.test(value));
  }

  /**
   * Get error severity
   * @param error - Error instance
   * @returns Severity level
   */
  getErrorSeverity(error: unknown): 'low' | 'medium' | 'high' | 'critical' {
    if (this.isSuspiciousError(error)) {
      return 'critical';
    }

    const classification = this.classifyError(error);
    
    switch (classification) {
      case 'PERMISSION':
      case 'AUTHENTICATION':
        return 'high';
      case 'VALIDATION':
      case 'PROTOCOL':
        return 'medium';
      case 'TIMEOUT':
      case 'NETWORK':
      case 'NOT_FOUND':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Add custom suspicious pattern
   * @param pattern - Regular expression pattern
   */
  addSuspiciousPattern(pattern: RegExp): void {
    this.suspiciousPatterns.push(pattern);
  }

  /**
   * Add custom error classification
   * @param errorName - Error name
   * @param classification - Classification string
   */
  addErrorClassification(errorName: string, classification: string): void {
    this.errorClassifications.set(errorName, classification);
  }
}