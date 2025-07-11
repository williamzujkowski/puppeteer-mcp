/**
 * Browser pool recycling module exports
 * @module puppeteer/pool/recycling
 */

export { BrowserPoolRecycler } from './browser-pool-recycler.js';
export type {
  RecyclingConfig,
  RecyclingCandidate,
  RecyclingEvent,
  RecyclingStats,
  BrowserHealthMetrics,
  CandidateMetrics,
} from './types.js';
export { RecyclingStrategy, RecyclingReason, DEFAULT_RECYCLING_CONFIG } from './types.js';
