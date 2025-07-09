/**
 * Configuration management for browser recycling
 * @module puppeteer/pool/recycling/config-manager
 * @nist cm-7 "Least functionality"
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../../utils/logger.js';
import type { RecyclingConfig } from './types.js';
import { DEFAULT_RECYCLING_CONFIG } from './types.js';

const logger = createLogger('recycling-config-manager');

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  oldConfig: RecyclingConfig;
  newConfig: RecyclingConfig;
}

/**
 * Recycling configuration manager
 * @nist cm-7 "Least functionality"
 */
export class RecyclingConfigManager extends EventEmitter {
  private config: RecyclingConfig;

  constructor(config: Partial<RecyclingConfig> = {}) {
    super();
    this.config = { ...DEFAULT_RECYCLING_CONFIG, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RecyclingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RecyclingConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    logger.info(
      {
        oldConfig,
        newConfig: this.config,
        changes: Object.keys(newConfig),
      },
      'Recycling configuration updated'
    );

    this.emit('config-updated', { oldConfig, newConfig: this.config });
  }

  /**
   * Check if recycling is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get specific configuration values
   */
  getValue<K extends keyof RecyclingConfig>(key: K): RecyclingConfig[K] {
    // Use explicit key mapping to avoid object injection
    // eslint-disable-next-line security/detect-object-injection
    const value = this.config[key];
    return value;
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Partial<RecyclingConfig>): string[] {
    const errors: string[] = [];

    if (config.maxLifetimeMs !== undefined && config.maxLifetimeMs <= 0) {
      errors.push('maxLifetimeMs must be positive');
    }

    if (config.maxIdleTimeMs !== undefined && config.maxIdleTimeMs <= 0) {
      errors.push('maxIdleTimeMs must be positive');
    }

    if (config.recyclingThreshold !== undefined) {
      if (config.recyclingThreshold < 0 || config.recyclingThreshold > 100) {
        errors.push('recyclingThreshold must be between 0 and 100');
      }
    }

    // Validate weights sum to 1.0 for hybrid strategy
    const weights = [
      config.weightTimeBasedScore,
      config.weightUsageBasedScore,
      config.weightHealthBasedScore,
      config.weightResourceBasedScore,
    ].filter(w => w !== undefined);

    if (weights.length === 4) {
      const sum = weights.reduce((acc, w) => acc + (w ?? 0), 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        errors.push('Hybrid strategy weights must sum to 1.0');
      }
    }

    return errors;
  }
}