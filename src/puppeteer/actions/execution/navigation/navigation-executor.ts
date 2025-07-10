/**
 * Main navigation executor orchestrating all navigation modules
 * @module puppeteer/actions/execution/navigation/navigation-executor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  NavigateAction,
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../../utils/logger.js';
import { NavigationFactory, type NavigationFactoryConfig } from './navigation-factory.js';
import { UrlValidator } from './url-validator.js';
import { PerformanceMonitor } from './performance-monitor.js';

const logger = createLogger('puppeteer:navigation:main-executor');

/**
 * Navigation executor configuration
 */
export interface NavigationExecutorConfig extends NavigationFactoryConfig {
  /** Enable request/response logging */
  enableRequestLogging?: boolean;
  /** Enable execution metrics */
  enableExecutionMetrics?: boolean;
  /** Maximum concurrent navigations per session */
  maxConcurrentNavigations?: number;
}

/**
 * Execution metrics for monitoring
 */
interface ExecutionMetrics {
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Average execution time */
  averageExecutionTime: number;
  /** Executions by action type */
  executionsByType: Record<string, number>;
  /** Last execution timestamp */
  lastExecution?: Date;
}

/**
 * Session tracking for concurrent navigation limits
 */
interface SessionTracker {
  /** Active navigation count */
  activeNavigations: number;
  /** Last activity timestamp */
  lastActivity: Date;
}

/**
 * Main navigation executor class
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class NavigationExecutor {
  private readonly factory: NavigationFactory;
  private readonly config: Required<Omit<NavigationExecutorConfig,
    keyof NavigationFactoryConfig>>;
  private readonly executionMetrics: ExecutionMetrics;
  private readonly sessionTrackers: Map<string, SessionTracker> = new Map();

  constructor(config?: NavigationExecutorConfig) {
    this.config = {
      enableRequestLogging: config?.enableRequestLogging ?? true,
      enableExecutionMetrics: config?.enableExecutionMetrics ?? true,
      maxConcurrentNavigations: config?.maxConcurrentNavigations ?? 5,
    };

    // Initialize navigation factory
    this.factory = new NavigationFactory(config);

    // Initialize execution metrics
    this.executionMetrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      executionsByType: {},
    };

    // Start cleanup interval for session trackers
    this.startCleanupInterval();

    logger.debug('Navigation executor initialized', {
      enableRequestLogging: this.config.enableRequestLogging,
      enableExecutionMetrics: this.config.enableExecutionMetrics,
      maxConcurrentNavigations: this.config.maxConcurrentNavigations,
      supportedActions: this.factory.getSupportedActions(),
    });
  }

  /**
   * Execute navigation action
   * @param action - Navigation action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute(
    action: BrowserAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const executionStartTime = Date.now();

    try {
      // Check concurrent navigation limit
      const concurrencyCheck = await this.checkConcurrencyLimit(context.sessionId);
      if (!concurrencyCheck.allowed) {
        return this.createConcurrencyLimitResult(action, executionStartTime, concurrencyCheck.reason || 'Concurrency limit exceeded');
      }

      // Track navigation start
      this.trackNavigationStart(context.sessionId);

      // Log request if enabled
      if (this.config.enableRequestLogging) {
        this.logNavigationRequest(action, context);
      }

      // Pre-execution validation
      const validation = await this.factory.validateAction(action);
      if (!validation.isValid) {
        this.trackNavigationEnd(context.sessionId);
        return this.createValidationFailureResult(action, executionStartTime, validation.error!);
      }

      // Execute via factory
      const result = await this.factory.execute(action, page, context);

      // Track navigation end
      this.trackNavigationEnd(context.sessionId);

      // Update execution metrics
      if (this.config.enableExecutionMetrics) {
        this.updateExecutionMetrics(action.type, result.success, result.duration);
      }

      // Log response if enabled
      if (this.config.enableRequestLogging) {
        this.logNavigationResponse(action, context, result);
      }

      // Add validation warnings to metadata if present
      if (validation.warnings && result.metadata) {
        result.metadata.validationWarnings = validation.warnings;
      }

      return result;

    } catch (error) {
      // Track navigation end
      this.trackNavigationEnd(context.sessionId);

      const errorMessage = error instanceof Error ? error.message : 'Navigation execution failed';
      const duration = Date.now() - executionStartTime;

      // Update metrics for failed execution
      if (this.config.enableExecutionMetrics) {
        this.updateExecutionMetrics(action.type, false, duration);
      }

      logger.error('Navigation execution failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: action.type,
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          currentUrl: page.url(),
          executorError: true,
        },
      };
    }
  }

  /**
   * Execute navigate action (compatibility method)
   * @param action - Navigate action
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeNavigate(
    action: NavigateAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    return this.execute(action, page, context);
  }

  /**
   * Execute go back action (compatibility method)
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Action result
   */
  async executeGoBack(
    page: Page,
    context: ActionContext,
    timeout?: number,
  ): Promise<ActionResult> {
    const action: BrowserAction = {
      type: 'goBack' as any, // Type assertion for navigation actions
      pageId: context.contextId,
      timeout,
    };
    return this.execute(action, page, context);
  }

  /**
   * Execute go forward action (compatibility method)
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Action result
   */
  async executeGoForward(
    page: Page,
    context: ActionContext,
    timeout?: number,
  ): Promise<ActionResult> {
    const action: BrowserAction = {
      type: 'goForward' as any, // Type assertion for navigation actions
      pageId: context.contextId,
      timeout,
    };
    return this.execute(action, page, context);
  }

  /**
   * Execute refresh action (compatibility method)
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Navigation timeout
   * @returns Action result
   */
  async executeRefresh(
    page: Page,
    context: ActionContext,
    timeout?: number,
  ): Promise<ActionResult> {
    const action: BrowserAction = {
      type: 'refresh' as any, // Type assertion for navigation actions
      pageId: context.contextId,
      timeout,
    };
    return this.execute(action, page, context);
  }

  /**
   * Execute set viewport action (compatibility method)
   * @param page - Page instance
   * @param context - Execution context
   * @param width - Viewport width
   * @param height - Viewport height
   * @param deviceScaleFactor - Device scale factor
   * @returns Action result
   */
  async executeSetViewport(
    page: Page,
    context: ActionContext,
    width: number,
    height: number,
    deviceScaleFactor = 1,
  ): Promise<ActionResult> {
    const action: BrowserAction = {
      type: 'setViewport' as any, // Type assertion for navigation actions
      pageId: context.contextId,
      width,
      height,
      deviceScaleFactor,
    } as any; // Type assertion for compatibility
    return this.execute(action, page, context);
  }

  /**
   * Check concurrent navigation limit for session
   * @param sessionId - Session ID
   * @returns Concurrency check result
   */
  private async checkConcurrencyLimit(sessionId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const tracker = this.sessionTrackers.get(sessionId);
    
    if (!tracker) {
      return { allowed: true };
    }

    if (tracker.activeNavigations >= this.config.maxConcurrentNavigations) {
      return {
        allowed: false,
        reason: `Maximum concurrent navigations (${this.config.maxConcurrentNavigations}) exceeded for session`,
      };
    }

    return { allowed: true };
  }

  /**
   * Track navigation start for session
   * @param sessionId - Session ID
   */
  private trackNavigationStart(sessionId: string): void {
    const tracker = this.sessionTrackers.get(sessionId) ?? {
      activeNavigations: 0,
      lastActivity: new Date(),
    };

    tracker.activeNavigations++;
    tracker.lastActivity = new Date();
    
    this.sessionTrackers.set(sessionId, tracker);
  }

  /**
   * Track navigation end for session
   * @param sessionId - Session ID
   */
  private trackNavigationEnd(sessionId: string): void {
    const tracker = this.sessionTrackers.get(sessionId);
    
    if (tracker) {
      tracker.activeNavigations = Math.max(0, tracker.activeNavigations - 1);
      tracker.lastActivity = new Date();
    }
  }

  /**
   * Log navigation request
   * @param action - Navigation action
   * @param context - Execution context
   */
  private logNavigationRequest(action: BrowserAction, context: ActionContext): void {
    logger.info('Navigation request', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionType: action.type,
      action: this.sanitizeActionForLogging(action),
    });
  }

  /**
   * Log navigation response
   * @param action - Navigation action
   * @param context - Execution context
   * @param result - Action result
   */
  private logNavigationResponse(
    action: BrowserAction,
    context: ActionContext,
    result: ActionResult
  ): void {
    logger.info('Navigation response', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionType: action.type,
      success: result.success,
      duration: result.duration,
      error: result.error,
    });
  }

  /**
   * Sanitize action data for logging (remove sensitive information)
   * @param action - Navigation action
   * @returns Sanitized action
   */
  private sanitizeActionForLogging(action: BrowserAction): Partial<BrowserAction> {
    const sanitized: Partial<BrowserAction> = {
      type: action.type,
      pageId: action.pageId,
      timeout: action.timeout,
    };

    // Add non-sensitive action-specific fields
    if (action.type === 'navigate') {
      const navigateAction = action;
      (sanitized as any).url = navigateAction.url;
      (sanitized as any).waitUntil = navigateAction.waitUntil;
    }

    return sanitized;
  }

  /**
   * Update execution metrics
   * @param actionType - Action type
   * @param success - Whether execution succeeded
   * @param duration - Execution duration
   */
  private updateExecutionMetrics(actionType: string, success: boolean, duration: number): void {
    this.executionMetrics.totalExecutions++;
    
    if (success) {
      this.executionMetrics.successfulExecutions++;
    } else {
      this.executionMetrics.failedExecutions++;
    }

    // Update average execution time
    const totalTime = this.executionMetrics.averageExecutionTime * (this.executionMetrics.totalExecutions - 1) + duration;
    this.executionMetrics.averageExecutionTime = totalTime / this.executionMetrics.totalExecutions;

    // Update by type
    this.executionMetrics.executionsByType[actionType] = 
      (this.executionMetrics.executionsByType[actionType] ?? 0) + 1;

    this.executionMetrics.lastExecution = new Date();
  }

  /**
   * Create concurrency limit exceeded result
   * @param action - Navigation action
   * @param startTime - Execution start time
   * @param reason - Reason for limit
   * @returns Action result
   */
  private createConcurrencyLimitResult(
    action: BrowserAction,
    startTime: number,
    reason: string
  ): ActionResult {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      actionType: action.type,
      error: reason,
      duration,
      timestamp: new Date(),
      metadata: {
        concurrencyLimitExceeded: true,
        maxConcurrentNavigations: this.config.maxConcurrentNavigations,
      },
    };
  }

  /**
   * Create validation failure result
   * @param action - Navigation action
   * @param startTime - Execution start time
   * @param error - Validation error
   * @returns Action result
   */
  private createValidationFailureResult(
    action: BrowserAction,
    startTime: number,
    error: string
  ): ActionResult {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      actionType: action.type,
      error: `Validation failed: ${error}`,
      duration,
      timestamp: new Date(),
      metadata: {
        validationFailure: true,
      },
    };
  }

  /**
   * Start cleanup interval for session trackers
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Cleanup every minute
  }

  /**
   * Cleanup inactive session trackers
   */
  private cleanupInactiveSessions(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleanedCount = 0;

    for (const [sessionId, tracker] of this.sessionTrackers.entries()) {
      if (tracker.lastActivity < cutoffTime && tracker.activeNavigations === 0) {
        this.sessionTrackers.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up inactive session trackers', {
        cleanedCount,
        remainingCount: this.sessionTrackers.size,
      });
    }
  }

  /**
   * Get supported navigation action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return this.factory.getSupportedActions();
  }

  /**
   * Check if action type is supported
   * @param actionType - Action type to check
   * @returns True if supported
   */
  isActionSupported(actionType: string): boolean {
    return this.factory.isActionSupported(actionType);
  }

  /**
   * Get execution metrics
   * @returns Current execution metrics
   */
  getExecutionMetrics(): ExecutionMetrics {
    return { ...this.executionMetrics };
  }

  /**
   * Get performance statistics
   * @param sessionId - Optional session ID filter
   * @returns Performance statistics
   */
  getPerformanceStatistics(sessionId?: string) {
    return this.factory.getPerformanceStatistics(sessionId);
  }

  /**
   * Clear session metrics
   * @param sessionId - Session ID
   */
  clearSessionMetrics(sessionId: string): void {
    this.factory.clearSessionMetrics(sessionId);
    this.sessionTrackers.delete(sessionId);
  }

  /**
   * Get URL validator instance
   * @returns URL validator
   */
  getUrlValidator(): UrlValidator {
    return this.factory.getUrlValidator();
  }

  /**
   * Get performance monitor instance
   * @returns Performance monitor
   */
  getPerformanceMonitor(): PerformanceMonitor {
    return this.factory.getPerformanceMonitor();
  }

  /**
   * Get navigation factory instance
   * @returns Navigation factory
   */
  getNavigationFactory(): NavigationFactory {
    return this.factory;
  }

  /**
   * Update executor configuration
   * @param config - Configuration updates
   */
  updateConfig(config: Partial<NavigationExecutorConfig>): void {
    // Update local config
    Object.assign(this.config, config);
    
    // Update factory config
    this.factory.updateConfig(config);

    logger.info('Navigation executor configuration updated', { config });
  }
}

/**
 * Create navigation executor instance
 * @param config - Optional executor configuration
 * @returns Navigation executor instance
 */
export function createNavigationExecutor(config?: NavigationExecutorConfig): NavigationExecutor {
  return new NavigationExecutor(config);
}