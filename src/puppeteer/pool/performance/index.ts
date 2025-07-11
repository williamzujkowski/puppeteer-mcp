/**
 * Performance monitoring module exports
 * @module puppeteer/pool/performance
 */

// Types and interfaces
export * from './types/performance-monitor.types.js';
export * from './types/strategy.interfaces.js';

// Strategies
export { MetricsCollector } from './strategies/metrics-collector.js';
export { AlertManager } from './strategies/alert-manager.js';
export { TrendAnalyzer } from './strategies/trend-analyzer.js';
export { AnomalyDetector } from './strategies/anomaly-detector.js';
export { OptimizationEngine } from './strategies/optimization-engine.js';

// Utilities
export { PerformanceCalculations } from './utils/performance-calculations.js';

// Configuration
export { DEFAULT_PERFORMANCE_CONFIG } from './config/default-config.js';
