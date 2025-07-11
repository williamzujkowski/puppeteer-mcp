/**
 * Configuration presets for circuit breaker
 * @module puppeteer/pool/circuit-breaker/config-presets
 * @nist cm-2 "Baseline configuration"
 */

import { CircuitBreakerConfig } from './types.js';

/**
 * Default circuit breaker configuration
 * @nist cm-2 "Baseline configuration"
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeWindow: 60000, // 1 minute
  timeout: 30000, // 30 seconds
  monitorInterval: 5000, // 5 seconds
  exponentialBackoff: true,
  maxTimeout: 300000, // 5 minutes
  backoffMultiplier: 2,
  minimumThroughput: 3,
  enabled: true,
};

/**
 * Configuration presets for different scenarios
 */
export const CONFIG_PRESETS = {
  aggressive: {
    failureThreshold: 3,
    successThreshold: 5,
    timeWindow: 30000,
    timeout: 10000,
    exponentialBackoff: true,
    maxTimeout: 60000,
  } as Partial<CircuitBreakerConfig>,

  conservative: {
    failureThreshold: 10,
    successThreshold: 2,
    timeWindow: 120000,
    timeout: 60000,
    exponentialBackoff: false,
  } as Partial<CircuitBreakerConfig>,

  balanced: {
    failureThreshold: 5,
    successThreshold: 3,
    timeWindow: 60000,
    timeout: 30000,
    exponentialBackoff: true,
    maxTimeout: 180000,
  } as Partial<CircuitBreakerConfig>,

  testing: {
    failureThreshold: 2,
    successThreshold: 1,
    timeWindow: 5000,
    timeout: 1000,
    monitorInterval: 1000,
    exponentialBackoff: false,
    minimumThroughput: 1,
  } as Partial<CircuitBreakerConfig>,

  highThroughput: {
    failureThreshold: 20,
    successThreshold: 10,
    timeWindow: 30000,
    timeout: 5000,
    monitorInterval: 2000,
    exponentialBackoff: true,
    maxTimeout: 60000,
    minimumThroughput: 50,
  } as Partial<CircuitBreakerConfig>,

  microservice: {
    failureThreshold: 5,
    successThreshold: 2,
    timeWindow: 10000,
    timeout: 3000,
    exponentialBackoff: true,
    maxTimeout: 30000,
    backoffMultiplier: 1.5,
    minimumThroughput: 10,
  } as Partial<CircuitBreakerConfig>,

  batch: {
    failureThreshold: 3,
    successThreshold: 1,
    timeWindow: 300000, // 5 minutes
    timeout: 60000,
    exponentialBackoff: false,
    minimumThroughput: 1,
  } as Partial<CircuitBreakerConfig>,
};

/**
 * Get preset by name
 */
export function getPreset(
  name: keyof typeof CONFIG_PRESETS,
): Partial<CircuitBreakerConfig> | undefined {
  return CONFIG_PRESETS[name];
}

/**
 * Merge preset with custom config
 */
export function mergeWithPreset(
  presetName: keyof typeof CONFIG_PRESETS,
  customConfig: Partial<CircuitBreakerConfig> = {},
): CircuitBreakerConfig {
  const preset = CONFIG_PRESETS[presetName] || {};
  return {
    ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
    ...preset,
    ...customConfig,
  };
}

/**
 * Get all preset names
 */
export function getPresetNames(): Array<keyof typeof CONFIG_PRESETS> {
  return Object.keys(CONFIG_PRESETS) as Array<keyof typeof CONFIG_PRESETS>;
}

/**
 * Validate if preset exists
 */
export function isValidPreset(name: string): name is keyof typeof CONFIG_PRESETS {
  return name in CONFIG_PRESETS;
}
