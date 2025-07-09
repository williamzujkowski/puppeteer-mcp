/**
 * Browser pool compatibility module exports
 * @module puppeteer/pool/compatibility
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */

// Main compatibility orchestrator
export {
  BrowserPoolFactory,
  MigrationUtils,
  default as BrowserPoolCompatibility,
  LegacyBrowserPool,
  EnhancedBrowserPool,
} from './browser-pool-compatibility.js';

// Core components
export { CompatibilityChecker } from './compatibility-checker.js';
export { CompatibilityValidator } from './compatibility-validator.js';
export { CompatibilityReporter } from './compatibility-reporter.js';
export { MigrationPlanner } from './migration-planner.js';
export { MigrationPhaseFactory } from './migration-phase-factory.js';
export { MigrationExecutor } from './migration-executor.js';
export { VersionDetector } from './version-detector.js';
export { CompatibilityUtils } from './compatibility-utils.js';

// Types and interfaces
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
} from './types.js';

export { DEFAULT_COMPATIBILITY_CONFIG, DEFAULT_RECYCLING_CONFIG } from './types.js';

// Re-export for convenience
export { BrowserPoolFactory as default } from './browser-pool-compatibility.js';
