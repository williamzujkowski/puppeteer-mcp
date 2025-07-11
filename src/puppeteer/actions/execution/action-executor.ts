/**
 * Main action executor coordinator facade
 * @module puppeteer/actions/execution/action-executor
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 * @nist si-10 "Information input validation"
 */

import type {
  ActionExecutor,
  BrowserAction,
  ActionResult,
  ActionContext,
  ValidationResult,
} from '../../interfaces/action-executor.interface.js';
import type { ActionMetrics } from '../../interfaces/action-executor/core.interface.js';
import type { PageManager } from '../../interfaces/page-manager.interface.js';
import type { BatchExecutionOptions } from '../batch-executor.js';
import type { ExecutionConfig } from './coordinator/configuration-manager.js';
import type { ActionMetrics as CollectorActionMetrics, AggregatedMetrics } from './coordinator/metrics-collector.js';
import type { PerformanceHints } from './coordinator/performance-optimizer.js';
import type { RetryConfig } from './types.js';
import { BatchActionExecutor } from '../batch-executor.js';
import { CoordinatorFactory } from './coordinator/coordinator-factory.js';
import type { CoordinatorComponents } from './coordinator/coordinator-factory.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:modular-action-executor');

/**
 * Modular browser action executor implementation (Facade Pattern)
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class ModularBrowserActionExecutor implements ActionExecutor {
  private readonly components: CoordinatorComponents;
  private readonly batchExecutor: BatchActionExecutor;

  constructor(pageManager?: PageManager, config?: Partial<ExecutionConfig>) {
    // Create all coordinator components using factory
    this.components = CoordinatorFactory.createComponents({
      pageManager,
      config,
      enableMetrics: config?.performance?.enableMetrics ?? true,
      enableSecurityBatching: false,
      enablePerformanceOptimization: true,
    });

    // Create batch executor with reference to this facade
    this.batchExecutor = new BatchActionExecutor(this);
    
    // Wire up the batch executor in components
    this.components.batchExecutor = this.batchExecutor;

    logger.info('Modular action executor initialized', {
      hasPageManager: !!pageManager,
      componentsCount: Object.keys(this.components).length,
    });
  }

  /**
   * Execute a browser action using orchestrated components
   * @param action - Browser action to execute
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute<T = unknown>(
    action: BrowserAction,
    context: ActionContext,
  ): Promise<ActionResult<T>> {
    // Get performance hints
    const hints = this.components.performanceOptimizer.getPerformanceHints(action, context);
    
    // Log performance hints if significant
    if (hints.estimatedDuration > 5000 || hints.blockResources.length > 0) {
      logger.debug('Performance hints generated', {
        actionType: action.type,
        estimatedDuration: hints.estimatedDuration,
        resourceBlocking: hints.blockResources.length,
      });
    }

    // Delegate to orchestrator
    return this.components.orchestrator.orchestrateExecution<T>(action, context);
  }

  /**
   * Execute multiple actions in sequence or parallel
   * @param actions - Array of browser actions
   * @param context - Execution context
   * @param options - Execution options
   * @returns Array of action results
   */
  executeBatch(
    actions: BrowserAction[],
    context: ActionContext,
    options?: BatchExecutionOptions,
  ): Promise<ActionResult[]> {
    return this.batchExecutor.executeBatch(actions, context, options);
  }

  /**
   * Validate an action before execution
   * @param action - Browser action to validate
   * @param context - Execution context
   * @returns Validation result
   * @nist si-10 "Information input validation"
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult> {
    try {
      logger.debug('Validating browser action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
      });

      // Check if action type is supported
      if (!this.components.dispatcher.isActionSupported(action.type)) {
        return {
          valid: false,
          errors: [{
            field: 'type',
            message: `Unsupported action type: ${action.type}`,
            code: 'UNSUPPORTED_ACTION',
          }],
        };
      }

      // Validate dispatcher compatibility
      if (!this.components.dispatcher.validateActionForDispatch(action)) {
        return {
          valid: false,
          errors: [{
            field: 'action',
            message: 'Action is not valid for dispatch',
            code: 'INVALID_ACTION_FOR_DISPATCH',
          }],
        };
      }

      // Perform detailed validation
      return this.components.validator.validate(action, context);
    } catch (error) {
      logger.error('Action validation failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        error: error instanceof Error ? error.message : 'Unknown validation error',
      });

      return {
        valid: false,
        errors: [{
          field: 'unknown',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'VALIDATION_ERROR',
        }],
      };
    }
  }

  /**
   * Validate multiple actions
   * @param actions - Array of browser actions
   * @param context - Execution context
   * @returns Array of validation results
   */
  async validateBatch(
    actions: BrowserAction[],
    context: ActionContext,
  ): Promise<ValidationResult[]> {
    return this.components.validator.validateBatch(actions, context);
  }

  /**
   * Register custom action handler
   * @param actionType - Action type identifier
   * @param handler - Action handler function
   */
  registerHandler<T extends BrowserAction>(
    actionType: string,
    handler: (action: T, context: ActionContext) => Promise<ActionResult>,
  ): void {
    // Wrap handler to include page retrieval
    this.components.dispatcher.registerHandler(actionType, async (action, _page, context) => {
      return handler(action as T, context);
    });
  }

  /**
   * Unregister action handler
   * @param actionType - Action type identifier
   */
  unregisterHandler(actionType: string): void {
    this.components.dispatcher.unregisterHandler(actionType);
  }

  /**
   * Get supported action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return this.components.dispatcher.getSupportedActions();
  }

  /**
   * Check if action type is supported
   * @param actionType - Action type to check
   * @returns True if supported
   */
  isActionSupported(actionType: string): boolean {
    return this.components.dispatcher.isActionSupported(actionType);
  }

  /**
   * Get action execution history
   * @param context - Execution context
   * @param options - Query options
   * @returns Array of historical action results
   * @nist au-7 "Audit reduction and report generation"
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getHistory(
    context: ActionContext,
    options?: {
      limit?: number;
      offset?: number;
      actionTypes?: string[];
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<ActionResult[]> {
    return this.components.historyManager.getHistory(context, options);
  }

  /**
   * Clear action history
   * @param context - Execution context
   * @param before - Clear history before this date
   * @nist au-4 "Audit storage capacity"
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async clearHistory(context: ActionContext, before?: Date): Promise<void> {
    this.components.historyManager.clearHistory(context, before);
  }

  /**
   * Get action metrics
   * @param context - Execution context
   * @returns Action execution metrics
   * @nist au-6 "Audit review, analysis, and reporting"
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getMetrics(context: ActionContext): Promise<ActionMetrics> {
    return this.components.historyManager.getMetrics(context);
  }

  /**
   * Get aggregated performance metrics
   * @param context - Optional context filter
   * @param options - Query options
   * @returns Aggregated metrics
   */
  getAggregatedMetrics(
    context?: ActionContext,
    options?: {
      startDate?: Date;
      endDate?: Date;
      actionTypes?: string[];
    },
  ): AggregatedMetrics {
    return this.components.metricsCollector.getAggregatedMetrics(context, options);
  }

  /**
   * Get session metrics
   * @param sessionId - Session identifier
   * @returns Session metrics
   */
  getSessionMetrics(sessionId: string): ActionMetrics[] {
    return this.components.metricsCollector.getSessionMetrics(sessionId);
  }

  /**
   * Get performance hints for action
   * @param action - Browser action
   * @param context - Execution context
   * @returns Performance hints
   */
  getPerformanceHints(action: BrowserAction, context: ActionContext): PerformanceHints {
    return this.components.performanceOptimizer.getPerformanceHints(action, context);
  }

  /**
   * Get current configuration
   * @returns Execution configuration
   */
  getConfiguration(): Readonly<ExecutionConfig> {
    return this.components.configManager.getConfig();
  }

  /**
   * Update configuration
   * @param updates - Configuration updates
   * @param reason - Reason for update
   */
  updateConfiguration(updates: Partial<ExecutionConfig>, reason?: string): void {
    this.components.configManager.updateConfig(updates, reason);
  }

  /**
   * Get configuration history
   * @param limit - Maximum entries to return
   * @returns Configuration history
   */
  getConfigurationHistory(limit = 100): Array<{
    timestamp: number;
    changes: Partial<ExecutionConfig>;
    reason?: string;
  }> {
    return this.components.configManager.getConfigHistory(limit);
  }

  /**
   * Get executor statistics
   * @returns Executor component statistics
   */
  getExecutorStats(): {
    components: string[];
    dispatcher: {
      builtInExecutors: number;
      customHandlers: number;
      totalActions: number;
      actionsByCategory: Record<string, number>;
    };
    contextManager: {
      size: number;
      pages: string[];
    };
    errorHandler: RetryConfig;
    performanceOptimizer: {
      strategiesCount: number;
      enabledStrategies: string[];
      resourceBlockPatterns: number;
      cacheHitRate: number;
    };
    configuration: {
      hasPageManager: boolean;
      metricsEnabled: boolean;
      securityEventsEnabled: boolean;
    };
  } {
    const config = this.components.configManager.getConfig();
    
    return {
      components: Object.keys(this.components),
      dispatcher: this.components.dispatcher.getDispatcherStats(),
      contextManager: this.components.contextManager.getCacheStats(),
      errorHandler: this.components.errorHandler.getRetryConfig(),
      performanceOptimizer: this.components.performanceOptimizer.getOptimizationStats(),
      configuration: {
        hasPageManager: this.components.contextManager.hasPageManager(),
        metricsEnabled: config.performance.enableMetrics,
        securityEventsEnabled: config.security.enableSecurityEvents,
      },
    };
  }

  /**
   * Get action categories and their supported types
   * @returns Map of categories to action types
   */
  getActionCategories(): Map<string, string[]> {
    return this.components.dispatcher.getActionCategories();
  }

  /**
   * Get recommendation for action execution
   * @param actionType - Action type
   * @returns Execution recommendation
   */
  getExecutionRecommendation(actionType: string): ReturnType<typeof this.components.dispatcher.getExecutorRecommendation> {
    return this.components.dispatcher.getExecutorRecommendation(actionType);
  }

  /**
   * Update retry configuration
   * @param config - Partial retry configuration
   */
  updateRetryConfig(config: Parameters<typeof this.components.errorHandler.updateRetryConfig>[0]): void {
    this.components.errorHandler.updateRetryConfig(config);
  }

  /**
   * Clear page cache
   */
  clearPageCache(): void {
    this.components.contextManager.clearCache();
  }

  /**
   * Stop all background processes
   */
  stop(): void {
    // Stop security event coordinator if it has background processes
    if ('stop' in this.components.securityCoordinator) {
      this.components.securityCoordinator.stop();
    }
    
    logger.info('Modular action executor stopped');
  }

  /**
   * Get internal components for testing purposes
   * @internal
   */
  getInternalComponents(): CoordinatorComponents {
    return this.components;
  }
}