/**
 * Navigation module public API
 * @module puppeteer/actions/execution/navigation
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

// Main executor
export {
  NavigationExecutor,
  createNavigationExecutor,
  type NavigationExecutorConfig,
} from './navigation-executor.js';

// Import NavigationExecutor type for return type annotations
import type { NavigationExecutor } from './navigation-executor.js';

// Navigation factory and strategy pattern
export {
  NavigationFactory,
  createNavigationFactory,
  createNavigationFactoryWithStrategies,
  type NavigationFactoryConfig,
  type NavigationStrategy,
} from './navigation-factory.js';

// Individual navigators
export {
  PageNavigator,
  createPageNavigator,
  type PageNavigationConfig,
} from './page-navigator.js';

export {
  HistoryNavigator,
  createHistoryNavigator,
  type HistoryNavigationConfig,
  type HistoryNavigationType,
  type HistoryCapability,
} from './history-navigator.js';

// Viewport management
export {
  ViewportManager,
  createViewportManager,
  type ViewportConfig,
  type ViewportValidationConfig,
  VIEWPORT_PRESETS,
} from './viewport-manager.js';

// URL validation and SSRF protection
export {
  UrlValidator,
  createUrlValidator,
  validateUrl,
  type UrlValidationConfig,
  type UrlValidationResult,
} from './url-validator.js';

// Performance monitoring
export {
  PerformanceMonitor,
  createPerformanceMonitor,
  type PerformanceConfig,
  type NavigationMetrics,
  type PerformanceStats,
} from './performance-monitor.js';

/**
 * Re-export common types from main interfaces
 */
export type {
  BrowserAction,
  NavigateAction,
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';

export type {
  NavigationWaitOptions,
} from '../types.js';

// Import the function to ensure it's available
import { createNavigationExecutor } from './navigation-executor.js';

/**
 * Default navigation executor instance with sensible defaults
 * @nist ac-3 "Access enforcement"
 */
export const defaultNavigationExecutor = createNavigationExecutor({
  enablePerformanceMonitoring: true,
  enableUrlValidation: true,
  enableRequestLogging: true,
  enableExecutionMetrics: true,
  maxConcurrentNavigations: 5,
});

/**
 * Create a navigation executor with security-focused configuration
 * @returns Navigation executor with enhanced security settings
 */
export function createSecureNavigationExecutor(): NavigationExecutor {
  return createNavigationExecutor({
    enablePerformanceMonitoring: true,
    enableUrlValidation: true,
    enableRequestLogging: true,
    enableExecutionMetrics: true,
    maxConcurrentNavigations: 3,
    urlValidation: {
      allowPrivateNetworks: false,
      allowFileProtocol: false,
      maxLength: 1024,
      allowedProtocols: ['https:'], // Only HTTPS
    },
    pageNavigation: {
      defaultTimeout: 15000, // Shorter timeout
      enablePerformanceMonitoring: true,
    },
    historyNavigation: {
      defaultTimeout: 10000, // Shorter timeout
      enableHistoryValidation: true,
    },
    performanceMonitoring: {
      enableDetailedMetrics: true,
      enableMemoryTracking: true,
      maxMetricsHistory: 500,
      retentionPeriod: 12 * 60 * 60 * 1000, // 12 hours
    },
  });
}

/**
 * Create a navigation executor optimized for performance
 * @returns Navigation executor with performance-optimized settings
 */
export function createPerformanceOptimizedNavigationExecutor(): NavigationExecutor {
  return createNavigationExecutor({
    enablePerformanceMonitoring: true,
    enableUrlValidation: true,
    enableRequestLogging: false, // Disable for performance
    enableExecutionMetrics: false, // Disable for performance
    maxConcurrentNavigations: 10,
    pageNavigation: {
      defaultTimeout: 30000,
      defaultWaitUntil: 'domcontentloaded', // Faster than 'load'
      enablePerformanceMonitoring: true,
    },
    historyNavigation: {
      defaultTimeout: 20000,
      enableHistoryValidation: false, // Skip for performance
    },
    performanceMonitoring: {
      enableDetailedMetrics: false, // Basic metrics only
      enableMemoryTracking: false,
      maxMetricsHistory: 100,
      retentionPeriod: 60 * 60 * 1000, // 1 hour
    },
  });
}

/**
 * Create a minimal navigation executor for testing
 * @returns Navigation executor with minimal configuration
 */
export function createMinimalNavigationExecutor(): NavigationExecutor {
  return createNavigationExecutor({
    enablePerformanceMonitoring: false,
    enableUrlValidation: false,
    enableRequestLogging: false,
    enableExecutionMetrics: false,
    maxConcurrentNavigations: 1,
  });
}