/**
 * Coordinator module exports
 * @module puppeteer/actions/execution/coordinator
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

export { ExecutionOrchestrator } from './execution-orchestrator.js';
export { MetricsCollector } from './metrics-collector.js';
export type { ActionMetrics, AggregatedMetrics } from './metrics-collector.js';

export { ConfigurationManager } from './configuration-manager.js';
export type { ExecutionConfig } from './configuration-manager.js';

export { SecurityEventCoordinator } from './security-event-coordinator.js';

export { PerformanceOptimizer } from './performance-optimizer.js';
export type { OptimizationStrategy, PerformanceHints } from './performance-optimizer.js';

export { CoordinatorFactory } from './coordinator-factory.js';
export type { CoordinatorComponents, CoordinatorFactoryOptions } from './coordinator-factory.js';
