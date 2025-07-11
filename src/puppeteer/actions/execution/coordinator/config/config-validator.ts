/**
 * Configuration validation utilities
 * @module puppeteer/actions/execution/coordinator/config/config-validator
 * @nist cm-2 "Baseline configuration"
 * @nist si-10 "Information input validation"
 */

import type { ExecutionConfig } from '../configuration-manager.js';

/**
 * Validates execution configuration
 * @nist si-10 "Information input validation"
 */
export class ConfigValidator {
  /**
   * Validate configuration values
   * @param config - Configuration to validate
   * @throws Error if configuration is invalid
   */
  validate(config: ExecutionConfig): void {
    this.validateRetryConfig(config.retry);
    this.validateTimeoutConfig(config.timeout);
    this.validatePerformanceConfig(config.performance);
    this.validateSecurityConfig(config.security);
    this.validateCacheConfig(config.cache);
  }

  /**
   * Validate retry configuration
   * @param retry - Retry configuration
   */
  private validateRetryConfig(retry: ExecutionConfig['retry']): void {
    if (retry.maxAttempts < 1 || retry.maxAttempts > 10) {
      throw new Error('retry.maxAttempts must be between 1 and 10');
    }

    if (retry.initialDelay < 0) {
      throw new Error('retry.initialDelay must be non-negative');
    }

    if (retry.maxDelay < retry.initialDelay) {
      throw new Error('retry.maxDelay must be greater than or equal to initialDelay');
    }

    if (retry.backoffMultiplier < 1) {
      throw new Error('retry.backoffMultiplier must be at least 1');
    }
  }

  /**
   * Validate timeout configuration
   * @param timeout - Timeout configuration
   */
  private validateTimeoutConfig(timeout: ExecutionConfig['timeout']): void {
    const MIN_TIMEOUT = 0;
    const MAX_TIMEOUT = 300000; // 5 minutes

    Object.entries(timeout).forEach(([key, value]) => {
      if (value < MIN_TIMEOUT || value > MAX_TIMEOUT) {
        throw new Error(`timeout.${key} must be between ${MIN_TIMEOUT} and ${MAX_TIMEOUT}ms`);
      }
    });
  }

  /**
   * Validate performance configuration
   * @param performance - Performance configuration
   */
  private validatePerformanceConfig(performance: ExecutionConfig['performance']): void {
    if (performance.maxMetricsStorage < 100 || performance.maxMetricsStorage > 100000) {
      throw new Error('performance.maxMetricsStorage must be between 100 and 100000');
    }

    if (performance.metricsFlushInterval < 0) {
      throw new Error('performance.metricsFlushInterval must be non-negative');
    }
  }

  /**
   * Validate security configuration
   * @param security - Security configuration
   */
  private validateSecurityConfig(security: ExecutionConfig['security']): void {
    const MIN_PAYLOAD_SIZE = 1024; // 1KB
    const MAX_PAYLOAD_SIZE = 104857600; // 100MB

    if (security.maxPayloadSize < MIN_PAYLOAD_SIZE || security.maxPayloadSize > MAX_PAYLOAD_SIZE) {
      throw new Error(
        `security.maxPayloadSize must be between ${MIN_PAYLOAD_SIZE} and ${MAX_PAYLOAD_SIZE} bytes`,
      );
    }

    // Validate allowed domains
    for (const domain of security.allowedDomains) {
      if (!this.isValidDomainPattern(domain)) {
        throw new Error(`Invalid domain pattern: ${domain}`);
      }
    }
  }

  /**
   * Validate cache configuration
   * @param cache - Cache configuration
   */
  private validateCacheConfig(cache: ExecutionConfig['cache']): void {
    if (cache.maxCacheSize < 0 || cache.maxCacheSize > 1000) {
      throw new Error('cache.maxCacheSize must be between 0 and 1000');
    }

    if (cache.cacheTimeout < 0) {
      throw new Error('cache.cacheTimeout must be non-negative');
    }
  }

  /**
   * Check if domain pattern is valid
   * @param pattern - Domain pattern
   * @returns True if valid
   */
  private isValidDomainPattern(pattern: string): boolean {
    // Empty pattern is invalid
    if (pattern.length === 0) {
      return false;
    }

    // Check for wildcard patterns
    if (pattern.startsWith('*.')) {
      const baseDomain = pattern.slice(2);
      return this.isValidDomain(baseDomain);
    }

    return this.isValidDomain(pattern);
  }

  /**
   * Check if domain is valid
   * @param domain - Domain to validate
   * @returns True if valid
   */
  private isValidDomain(domain: string): boolean {
    // Basic domain validation
    const domainRegex = /^([a-z0-9-]+\.)*[a-z0-9-]+$/i;
    return domainRegex.test(domain);
  }
}
