/**
 * Factory for creating coordinator components
 * @module puppeteer/actions/execution/coordinator/coordinator-factory
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import type { PageManager } from '../../../interfaces/page-manager.interface.js';
import type { ExecutionConfig } from './configuration-manager.js';
import { ActionValidator } from '../action-validator.js';
import { ActionContextManager } from '../context-manager.js';
import { ActionErrorHandler } from '../error-handler.js';
import { ActionDispatcher } from '../action-dispatcher.js';
import { ActionHistoryManager } from '../../history-manager.js';
import { BatchActionExecutor } from '../../batch-executor.js';
import { ExecutionOrchestrator } from './execution-orchestrator.js';
import { MetricsCollector } from './metrics-collector.js';
import { ConfigurationManager } from './configuration-manager.js';
import { SecurityEventCoordinator } from './security-event-coordinator.js';
import { PerformanceOptimizer } from './performance-optimizer.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:coordinator-factory');

/**
 * Coordinator components
 */
export interface CoordinatorComponents {
  validator: ActionValidator;
  contextManager: ActionContextManager;
  errorHandler: ActionErrorHandler;
  dispatcher: ActionDispatcher;
  historyManager: ActionHistoryManager;
  batchExecutor: BatchActionExecutor;
  orchestrator: ExecutionOrchestrator;
  metricsCollector: MetricsCollector;
  configManager: ConfigurationManager;
  securityCoordinator: SecurityEventCoordinator;
  performanceOptimizer: PerformanceOptimizer;
}

/**
 * Factory options
 */
export interface CoordinatorFactoryOptions {
  pageManager?: PageManager;
  config?: Partial<ExecutionConfig>;
  enableMetrics?: boolean;
  enableSecurityBatching?: boolean;
  enablePerformanceOptimization?: boolean;
}

/**
 * Factory for creating coordinator components
 * @nist ac-3 "Access enforcement"
 */
export class CoordinatorFactory {
  /**
   * Create all coordinator components
   * @param options - Factory options
   * @returns Coordinator components
   */
  static createComponents(options: CoordinatorFactoryOptions = {}): CoordinatorComponents {
    logger.info('Creating coordinator components', {
      hasPageManager: !!options.pageManager,
      enableMetrics: options.enableMetrics ?? true,
      enableSecurityBatching: options.enableSecurityBatching ?? false,
      enablePerformanceOptimization: options.enablePerformanceOptimization ?? true,
    });

    // Create configuration manager first
    const configManager = new ConfigurationManager(options.config, options.pageManager);

    // Create metrics collector
    const metricsCollector =
      options.enableMetrics !== false ? new MetricsCollector() : this.createNoOpMetricsCollector();

    // Create security coordinator
    const securityCoordinator = new SecurityEventCoordinator(
      options.enableSecurityBatching ?? false,
    );

    // Create performance optimizer
    const performanceOptimizer =
      options.enablePerformanceOptimization !== false
        ? new PerformanceOptimizer(configManager, metricsCollector)
        : this.createNoOpPerformanceOptimizer();

    // Create core components
    const validator = new ActionValidator();
    const contextManager = new ActionContextManager(options.pageManager);
    const errorHandler = new ActionErrorHandler();
    const dispatcher = new ActionDispatcher();
    const historyManager = new ActionHistoryManager();

    // Create orchestrator with all dependencies
    const orchestrator = new ExecutionOrchestrator(
      validator,
      contextManager,
      errorHandler,
      dispatcher,
      historyManager,
      securityCoordinator,
      metricsCollector,
    );

    // Create batch executor (needs a reference to the main executor)
    // This will be wired up in the main facade
    const batchExecutor = null as any; // Placeholder, will be created by facade

    return {
      validator,
      contextManager,
      errorHandler,
      dispatcher,
      historyManager,
      batchExecutor,
      orchestrator,
      metricsCollector,
      configManager,
      securityCoordinator,
      performanceOptimizer,
    };
  }

  /**
   * Create a minimal set of components for testing
   * @param overrides - Component overrides
   * @returns Coordinator components
   */
  static createTestComponents(
    overrides: Partial<CoordinatorComponents> = {},
  ): CoordinatorComponents {
    const defaultComponents = this.createComponents({
      enableMetrics: false,
      enableSecurityBatching: false,
      enablePerformanceOptimization: false,
    });

    return {
      ...defaultComponents,
      ...overrides,
    };
  }

  /**
   * Create no-op metrics collector
   * @returns No-op metrics collector
   */
  private static createNoOpMetricsCollector(): MetricsCollector {
    const noOpCollector = new MetricsCollector();

    // Override methods to do nothing
    noOpCollector.recordExecutionStart = () => {};
    noOpCollector.recordExecutionEnd = () => {};
    noOpCollector.recordRetryAttempt = () => {};

    return noOpCollector;
  }

  /**
   * Create no-op performance optimizer
   * @returns No-op performance optimizer
   */
  private static createNoOpPerformanceOptimizer(): PerformanceOptimizer {
    return {
      getPerformanceHints: () => ({
        disableImages: false,
        disableJavaScript: false,
        blockResources: [],
        useCache: true,
        parallelizable: true,
        estimatedDuration: 0,
      }),
      applyOptimizations: async () => {},
      removeOptimizations: async () => {},
      registerStrategy: () => {},
      getOptimizationStats: () => ({
        strategiesCount: 0,
        enabledStrategies: [],
        resourceBlockPatterns: 0,
        cacheHitRate: 0,
      }),
    } as any;
  }
}
