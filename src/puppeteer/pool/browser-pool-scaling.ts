/**
 * Browser Pool Scaling Implementation
 * @module puppeteer/pool/browser-pool-scaling
 * @nist cm-2 "Baseline configuration"
 * @nist si-4 "Information system monitoring"
 * @nist au-3 "Content of audit records"
 *
 * This file re-exports the browser pool scaling functionality from the modular structure
 */

export {
  BrowserPoolScaling,
  BrowserPoolScalingStrategy,
  ScalingEvent,
  ScalingDecision,
  ScalingMetrics,
  DEFAULT_STRATEGIES,
} from './scaling/index.js';
