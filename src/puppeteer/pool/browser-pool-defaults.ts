/**
 * Default configurations for browser pool optimization components
 * @module puppeteer/pool/browser-pool-defaults
 */

import { DEFAULT_SCALING_STRATEGY } from './browser-pool-scaling.js';
import { DEFAULT_RESOURCE_CONFIG } from './browser-pool-resource-manager.js';
import { DEFAULT_RECYCLING_CONFIG } from './browser-pool-recycler.js';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './browser-pool-circuit-breaker.js';
import { DEFAULT_PERFORMANCE_CONFIG } from './browser-pool-performance-monitor.js';

// Re-export all default configurations for centralized access
export {
  DEFAULT_SCALING_STRATEGY,
  DEFAULT_RESOURCE_CONFIG,
  DEFAULT_RECYCLING_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG,
};