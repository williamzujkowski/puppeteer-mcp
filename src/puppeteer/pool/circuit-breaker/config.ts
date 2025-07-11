/**
 * Configuration management for circuit breaker
 * @module puppeteer/pool/circuit-breaker/config
 * @nist cm-7 "Least functionality"
 * @nist cm-2 "Baseline configuration"
 */

import { CircuitBreakerConfig } from './types.js';
import { createLogger } from '../../../utils/logger.js';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG, CONFIG_PRESETS, isValidPreset } from './config-presets.js';

const logger = createLogger('circuit-breaker-config');

// Re-export for backward compatibility
export { DEFAULT_CIRCUIT_BREAKER_CONFIG, CONFIG_PRESETS } from './config-presets.js';

/**
 * Configuration validator
 * @nist cm-7 "Least functionality"
 */
export class ConfigValidator {
  /**
   * Validate circuit breaker configuration
   */
  static validate(config: Partial<CircuitBreakerConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate failure threshold
    if (config.failureThreshold !== undefined) {
      if (config.failureThreshold < 1) {
        errors.push('failureThreshold must be at least 1');
      }
      if (config.failureThreshold > 100) {
        errors.push('failureThreshold should not exceed 100');
      }
    }

    // Validate success threshold
    if (config.successThreshold !== undefined) {
      if (config.successThreshold < 1) {
        errors.push('successThreshold must be at least 1');
      }
      if (config.successThreshold > 100) {
        errors.push('successThreshold should not exceed 100');
      }
    }

    // Validate time window
    if (config.timeWindow !== undefined) {
      if (config.timeWindow < 1000) {
        errors.push('timeWindow must be at least 1000ms (1 second)');
      }
      if (config.timeWindow > 3600000) {
        errors.push('timeWindow should not exceed 3600000ms (1 hour)');
      }
    }

    // Validate timeout
    if (config.timeout !== undefined) {
      if (config.timeout < 100) {
        errors.push('timeout must be at least 100ms');
      }
      if (config.timeout > 600000) {
        errors.push('timeout should not exceed 600000ms (10 minutes)');
      }
    }

    // Validate max timeout
    if (config.maxTimeout !== undefined && config.timeout !== undefined) {
      if (config.maxTimeout < config.timeout) {
        errors.push('maxTimeout must be greater than or equal to timeout');
      }
    }

    // Validate backoff multiplier
    if (config.backoffMultiplier !== undefined) {
      if (config.backoffMultiplier < 1) {
        errors.push('backoffMultiplier must be at least 1');
      }
      if (config.backoffMultiplier > 10) {
        errors.push('backoffMultiplier should not exceed 10');
      }
    }

    // Validate minimum throughput
    if (config.minimumThroughput !== undefined) {
      if (config.minimumThroughput < 0) {
        errors.push('minimumThroughput cannot be negative');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitize configuration values
   */
  static sanitize(config: Partial<CircuitBreakerConfig>): Partial<CircuitBreakerConfig> {
    const sanitized = { ...config };

    // Ensure positive values
    if (sanitized.failureThreshold !== undefined) {
      sanitized.failureThreshold = Math.max(1, sanitized.failureThreshold);
    }
    if (sanitized.successThreshold !== undefined) {
      sanitized.successThreshold = Math.max(1, sanitized.successThreshold);
    }
    if (sanitized.timeWindow !== undefined) {
      sanitized.timeWindow = Math.max(1000, sanitized.timeWindow);
    }
    if (sanitized.timeout !== undefined) {
      sanitized.timeout = Math.max(100, sanitized.timeout);
    }
    if (sanitized.backoffMultiplier !== undefined) {
      sanitized.backoffMultiplier = Math.max(1, sanitized.backoffMultiplier);
    }
    if (sanitized.minimumThroughput !== undefined) {
      sanitized.minimumThroughput = Math.max(0, sanitized.minimumThroughput);
    }

    return sanitized;
  }
}

/**
 * Configuration manager for circuit breaker
 * @nist cm-2 "Baseline configuration"
 */
export class ConfigManager {
  private config: CircuitBreakerConfig;
  private configHistory: Array<{ config: CircuitBreakerConfig; timestamp: Date }> = [];
  private readonly maxHistorySize = 10;

  constructor(
    private name: string,
    initialConfig: Partial<CircuitBreakerConfig> = {},
  ) {
    this.config = this.createConfig(initialConfig);
    this.addToHistory(this.config);
  }

  /**
   * Create configuration with defaults
   */
  private createConfig(partial: Partial<CircuitBreakerConfig>): CircuitBreakerConfig {
    const sanitized = ConfigValidator.sanitize(partial);
    const validation = ConfigValidator.validate(sanitized);

    if (!validation.valid) {
      logger.warn(
        {
          circuitBreaker: this.name,
          errors: validation.errors,
          config: partial,
        },
        'Invalid configuration values detected, using defaults for invalid fields',
      );
    }

    return { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...sanitized };
  }

  /**
   * Get current configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CircuitBreakerConfig>): { success: boolean; errors?: string[] } {
    const validation = ConfigValidator.validate(updates);

    if (!validation.valid) {
      logger.error(
        {
          circuitBreaker: this.name,
          errors: validation.errors,
          updates,
        },
        'Configuration update rejected due to validation errors',
      );

      return { success: false, errors: validation.errors };
    }

    const oldConfig = { ...this.config };
    this.config = this.createConfig({ ...this.config, ...updates });
    this.addToHistory(this.config);

    logger.info(
      {
        circuitBreaker: this.name,
        oldConfig,
        newConfig: this.config,
        changes: Object.keys(updates),
      },
      'Configuration updated',
    );

    return { success: true };
  }

  /**
   * Apply configuration preset
   */
  applyPreset(presetName: string): boolean {
    if (!isValidPreset(presetName)) {
      logger.error(
        {
          circuitBreaker: this.name,
          presetName,
        },
        'Unknown configuration preset',
      );
      return false;
    }

    const preset = CONFIG_PRESETS[presetName];
    const result = this.updateConfig(preset);
    if (result.success) {
      logger.info(
        {
          circuitBreaker: this.name,
          presetName,
        },
        'Configuration preset applied',
      );
    }

    return result.success;
  }

  /**
   * Get configuration history
   */
  getHistory(): Array<{ config: CircuitBreakerConfig; timestamp: Date }> {
    return [...this.configHistory];
  }

  /**
   * Rollback to previous configuration
   */
  rollback(): boolean {
    if (this.configHistory.length <= 1) {
      logger.warn(
        {
          circuitBreaker: this.name,
        },
        'Cannot rollback, no previous configuration available',
      );
      return false;
    }

    // Remove current config
    this.configHistory.pop();

    // Get previous config
    const previous = this.configHistory[this.configHistory.length - 1];
    if (previous) {
      this.config = { ...previous.config };

      logger.info(
        {
          circuitBreaker: this.name,
          rolledBackTo: previous.timestamp,
        },
        'Configuration rolled back',
      );

      return true;
    }

    return false;
  }

  /**
   * Export configuration
   */
  exportConfig(): {
    name: string;
    config: CircuitBreakerConfig;
    timestamp: Date;
  } {
    return {
      name: this.name,
      config: this.getConfig(),
      timestamp: new Date(),
    };
  }

  /**
   * Import configuration
   */
  importConfig(data: { config: Partial<CircuitBreakerConfig> }): {
    success: boolean;
    errors?: string[];
  } {
    return this.updateConfig(data.config);
  }

  /**
   * Add configuration to history
   */
  private addToHistory(config: CircuitBreakerConfig): void {
    this.configHistory.push({
      config: { ...config },
      timestamp: new Date(),
    });

    if (this.configHistory.length > this.maxHistorySize) {
      this.configHistory.shift();
    }
  }
}
