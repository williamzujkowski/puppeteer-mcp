/**
 * Default configuration values
 * @module puppeteer/actions/execution/coordinator/config/config-defaults
 * @nist cm-2 "Baseline configuration"
 * @nist cm-7 "Least functionality"
 */

import type { ExecutionConfig } from '../configuration-manager.js';

/**
 * Default execution configuration
 * @nist cm-2 "Baseline configuration"
 */
export const DEFAULT_CONFIG: ExecutionConfig = {
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['TimeoutError', 'NetworkError', 'ProtocolError'],
  },
  timeout: {
    default: 30000,
    navigation: 30000,
    interaction: 10000,
    evaluation: 10000,
    extraction: 30000,
  },
  performance: {
    enableMetrics: true,
    maxMetricsStorage: 10000,
    metricsFlushInterval: 300000, // 5 minutes
  },
  security: {
    enableSecurityEvents: true,
    enableInputValidation: true,
    maxPayloadSize: 1048576, // 1MB
    allowedDomains: [],
  },
  cache: {
    enablePageCache: true,
    maxCacheSize: 100,
    cacheTimeout: 600000, // 10 minutes
  },
};

/**
 * Action type to timeout key mapping
 */
export const ACTION_TIMEOUT_MAP: Record<string, keyof ExecutionConfig['timeout']> = {
  navigate: 'navigation',
  click: 'interaction',
  type: 'interaction',
  hover: 'interaction',
  select: 'interaction',
  evaluate: 'evaluation',
  extractText: 'extraction',
  extractContent: 'extraction',
  screenshot: 'extraction',
  pdf: 'extraction',
};

/**
 * Non-retryable action types
 */
export const NON_RETRYABLE_ACTIONS = [
  'evaluate',
  'injectScript',
  'setCookie',
  'deleteCookie',
] as const;

/**
 * Configuration limits
 */
export const CONFIG_LIMITS = {
  retry: {
    minAttempts: 1,
    maxAttempts: 10,
    minDelay: 0,
    maxDelay: 60000,
    minBackoff: 1,
    maxBackoff: 10,
  },
  timeout: {
    min: 0,
    max: 300000, // 5 minutes
  },
  performance: {
    minMetricsStorage: 100,
    maxMetricsStorage: 100000,
    minFlushInterval: 0,
    maxFlushInterval: 3600000, // 1 hour
  },
  security: {
    minPayloadSize: 1024, // 1KB
    maxPayloadSize: 104857600, // 100MB
  },
  cache: {
    minSize: 0,
    maxSize: 1000,
    minTimeout: 0,
    maxTimeout: 86400000, // 24 hours
  },
} as const;
