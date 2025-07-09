/**
 * Backward compatibility layer for browser pool optimization
 * @module puppeteer/pool/browser-pool-compatibility
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */

// Re-export from the modular compatibility system
export {
  BrowserPoolFactory,
  MigrationUtils,
  default as BrowserPoolCompatibility,
  LegacyBrowserPool,
  EnhancedBrowserPool,
} from './compatibility/index.js';

// Re-export types for backward compatibility
export type {
  CompatibilityConfig,
  MigrationMetrics,
  ExtendedMigrationMetrics,
  UsageStatistics,
  MigrationRisk,
  CompatibilityAnalysis,
  MigrationPhase,
  MigrationPlan,
  VersionCompatibility,
  CompatibilityCheckResult,
} from './compatibility/index.js';

// Re-export default
export { default } from './compatibility/index.js';
