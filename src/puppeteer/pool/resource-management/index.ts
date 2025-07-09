/**
 * Resource management module exports
 * @module puppeteer/pool/resource-management
 * @nist si-4 "Information system monitoring"
 * @nist sc-2 "Application partitioning"
 * @nist sc-3 "Security function isolation"
 */

// Type exports
export * from './resource-types.js';
export * from './resource-events.js';
export * from './resource-monitor.interface.js';
export * from './resource-optimization-strategy.js';

// Component exports
export { SystemResourceMonitor } from './system-resource-monitor.js';
export { BrowserResourceMonitor } from './browser-resource-monitor.js';
export { ResourceAlertManager } from './resource-alert-manager.js';
export { ResourceHistoryManager } from './resource-history-manager.js';
export { MemoryOptimizationStrategy } from './memory-optimization-strategy.js';
export { CpuOptimizationStrategy } from './cpu-optimization-strategy.js';
export { ResourceManagerFactory } from './resource-manager-factory.js';