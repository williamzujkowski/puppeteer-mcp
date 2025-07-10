/**
 * Configuration management module
 * @module puppeteer/actions/execution/coordinator/configuration-manager
 * @nist cm-2 "Baseline configuration"
 * @nist cm-7 "Least functionality"
 */

import type { PageManager } from '../../../interfaces/page-manager.interface.js';
import { ConfigValidator } from './config/config-validator.js';
import { DEFAULT_CONFIG, ACTION_TIMEOUT_MAP, NON_RETRYABLE_ACTIONS } from './config/config-defaults.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:configuration-manager');

/**
 * Execution configuration options
 */
export interface ExecutionConfig {
  // Retry configuration
  retry: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors: string[];
  };

  // Timeout configuration
  timeout: {
    default: number;
    navigation: number;
    interaction: number;
    evaluation: number;
    extraction: number;
  };

  // Performance configuration
  performance: {
    enableMetrics: boolean;
    maxMetricsStorage: number;
    metricsFlushInterval: number;
  };

  // Security configuration
  security: {
    enableSecurityEvents: boolean;
    enableInputValidation: boolean;
    maxPayloadSize: number;
    allowedDomains: string[];
  };

  // Cache configuration
  cache: {
    enablePageCache: boolean;
    maxCacheSize: number;
    cacheTimeout: number;
  };
}

/**
 * Manages execution configuration
 * @nist cm-2 "Baseline configuration"
 */
export class ConfigurationManager {
  private config: ExecutionConfig;
  private readonly validator: ConfigValidator;
  private readonly configHistory: Array<{
    timestamp: number;
    changes: Partial<ExecutionConfig>;
    reason?: string;
  }> = [];

  constructor(
    initialConfig?: Partial<ExecutionConfig>,
    private readonly pageManager?: PageManager,
  ) {
    this.validator = new ConfigValidator();
    this.config = this.mergeWithDefaults(initialConfig ?? {});
    this.validateConfiguration();
  }

  /**
   * Get current configuration
   * @returns Current execution configuration
   */
  getConfig(): Readonly<ExecutionConfig> {
    return Object.freeze(JSON.parse(JSON.stringify(this.config)));
  }

  /**
   * Update configuration
   * @param updates - Configuration updates
   * @param reason - Reason for update
   * @nist cm-3 "Configuration change control"
   */
  updateConfig(updates: Partial<ExecutionConfig>, reason?: string): void {
    const previousConfig = JSON.parse(JSON.stringify(this.config));
    
    this.config = this.mergeWithDefaults({
      ...this.config,
      ...updates,
    });

    this.validateConfiguration();

    // Record configuration change
    this.configHistory.push({
      timestamp: Date.now(),
      changes: updates,
      reason,
    });

    logger.info('Configuration updated', {
      reason,
      changes: Object.keys(updates),
    });

    // Emit configuration change event if page manager supports it
    if (this.pageManager && 'emit' in this.pageManager) {
      (this.pageManager as any).emit('configurationChanged', {
        previous: previousConfig,
        current: this.config,
        reason,
      });
    }
  }

  /**
   * Get configuration for specific action type
   * @param actionType - Action type
   * @returns Action-specific configuration
   */
  getActionConfig(actionType: string): {
    timeout: number;
    retryable: boolean;
    maxAttempts: number;
  } {
    const timeoutKey = ACTION_TIMEOUT_MAP[actionType] ?? 'default';
    const timeout = this.config.timeout[timeoutKey];

    return {
      timeout,
      retryable: this.isActionRetryable(actionType),
      maxAttempts: this.config.retry.maxAttempts,
    };
  }

  /**
   * Check if action type is retryable
   * @param actionType - Action type
   * @returns True if retryable
   */
  isActionRetryable(actionType: string): boolean {
    return !NON_RETRYABLE_ACTIONS.includes(actionType as any);
  }

  /**
   * Get retry configuration
   * @returns Retry configuration
   */
  getRetryConfig(): ExecutionConfig['retry'] {
    return { ...this.config.retry };
  }

  /**
   * Get security configuration
   * @returns Security configuration
   */
  getSecurityConfig(): ExecutionConfig['security'] {
    return { ...this.config.security };
  }

  /**
   * Get performance configuration
   * @returns Performance configuration
   */
  getPerformanceConfig(): ExecutionConfig['performance'] {
    return { ...this.config.performance };
  }

  /**
   * Get cache configuration
   * @returns Cache configuration
   */
  getCacheConfig(): ExecutionConfig['cache'] {
    return { ...this.config.cache };
  }

  /**
   * Get configuration history
   * @param limit - Maximum number of entries
   * @returns Configuration history
   */
  getConfigHistory(limit = 100): Array<{
    timestamp: number;
    changes: Partial<ExecutionConfig>;
    reason?: string;
  }> {
    return this.configHistory.slice(-limit);
  }

  /**
   * Reset to default configuration
   * @param reason - Reason for reset
   */
  resetToDefaults(reason = 'Manual reset'): void {
    this.updateConfig(DEFAULT_CONFIG, reason);
  }

  /**
   * Validate domain against allowed list
   * @param domain - Domain to validate
   * @returns True if allowed
   */
  isDomainAllowed(domain: string): boolean {
    const { allowedDomains } = this.config.security;
    
    // If no domains specified, allow all
    if (allowedDomains.length === 0) {
      return true;
    }

    // Check exact match or wildcard patterns
    return allowedDomains.some(allowed => {
      if (allowed.startsWith('*.')) {
        const baseDomain = allowed.slice(2);
        return domain === baseDomain || domain.endsWith(`.${baseDomain}`);
      }
      return domain === allowed;
    });
  }

  /**
   * Export configuration as JSON
   * @returns Configuration JSON
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   * @param json - Configuration JSON
   * @param reason - Reason for import
   */
  importConfig(json: string, reason = 'Configuration import'): void {
    try {
      const imported = JSON.parse(json);
      this.updateConfig(imported, reason);
    } catch (error) {
      throw new Error(`Invalid configuration JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get configuration summary
   * @returns Configuration summary
   */
  getConfigSummary(): {
    retryEnabled: boolean;
    maxRetries: number;
    metricsEnabled: boolean;
    securityEventsEnabled: boolean;
    cacheEnabled: boolean;
    domainRestrictions: boolean;
  } {
    return {
      retryEnabled: this.config.retry.maxAttempts > 1,
      maxRetries: this.config.retry.maxAttempts,
      metricsEnabled: this.config.performance.enableMetrics,
      securityEventsEnabled: this.config.security.enableSecurityEvents,
      cacheEnabled: this.config.cache.enablePageCache,
      domainRestrictions: this.config.security.allowedDomains.length > 0,
    };
  }

  /**
   * Merge configuration with defaults
   * @param config - Partial configuration
   * @returns Merged configuration
   */
  private mergeWithDefaults(config: Partial<ExecutionConfig>): ExecutionConfig {
    return {
      retry: { ...DEFAULT_CONFIG.retry, ...config.retry },
      timeout: { ...DEFAULT_CONFIG.timeout, ...config.timeout },
      performance: { ...DEFAULT_CONFIG.performance, ...config.performance },
      security: { ...DEFAULT_CONFIG.security, ...config.security },
      cache: { ...DEFAULT_CONFIG.cache, ...config.cache },
    };
  }

  /**
   * Validate configuration
   * @throws Error if configuration is invalid
   */
  private validateConfiguration(): void {
    this.validator.validate(this.config);
  }

  /**
   * Get internal components for testing
   * @internal
   */
  getInternalComponents(): {
    validator: ConfigValidator;
    config: ExecutionConfig;
  } {
    return {
      validator: this.validator,
      config: this.config,
    };
  }
}