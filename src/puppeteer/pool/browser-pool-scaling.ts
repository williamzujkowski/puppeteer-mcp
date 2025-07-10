/**
 * Browser Pool Scaling Implementation
 * @module puppeteer/pool/browser-pool-scaling
 * @nist cm-2 "Baseline configuration"
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 *
 * This file re-exports the browser pool scaling functionality from the modular structure
 */

export { BrowserPoolScaling } from './scaling/index.js';
export type {
  BrowserPoolScalingStrategy,
  ScalingEvent,
  ScalingDecision,
  ScalingMetrics,
} from './scaling/index.js';

// Import and re-export DEFAULT_STRATEGIES
import { DEFAULT_STRATEGIES } from './scaling/types.js';
export { DEFAULT_STRATEGIES };

// Export a default scaling strategy
export const DEFAULT_SCALING_STRATEGY = DEFAULT_STRATEGIES.balanced;
