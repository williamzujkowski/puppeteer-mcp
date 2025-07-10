/**
 * Navigation factory implementing Strategy pattern for navigation operations
 * @module puppeteer/actions/execution/navigation/navigation-factory
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../../utils/logger.js';
import { PageNavigator, type PageNavigationConfig } from './page-navigator.js';
import { HistoryNavigator, type HistoryNavigationConfig } from './history-navigator.js';
import { ViewportManager, type ViewportValidationConfig } from './viewport-manager.js';
import { UrlValidator, type UrlValidationConfig } from './url-validator.js';
import { PerformanceMonitor, type PerformanceConfig } from './performance-monitor.js';

const logger = createLogger('puppeteer:navigation:factory');

/**
 * Navigation strategy interface
 */
export interface NavigationStrategy {
  /** Strategy name */
  name: string;
  /** Supported action types */
  supportedActions: string[];
  /** Execute navigation action */
  execute(action: BrowserAction, page: Page, context: ActionContext): Promise<ActionResult>;
}

/**
 * Navigation factory configuration
 */
export interface NavigationFactoryConfig {
  /** URL validation configuration */
  urlValidation?: Partial<UrlValidationConfig>;
  /** Page navigation configuration */
  pageNavigation?: Partial<PageNavigationConfig>;
  /** History navigation configuration */
  historyNavigation?: Partial<HistoryNavigationConfig>;
  /** Viewport validation configuration */
  viewportValidation?: Partial<ViewportValidationConfig>;
  /** Performance monitoring configuration */
  performanceMonitoring?: Partial<PerformanceConfig>;
  /** Enable performance monitoring globally */
  enablePerformanceMonitoring?: boolean;
  /** Enable URL validation globally */
  enableUrlValidation?: boolean;
}

/**
 * Navigation strategy registry
 */
interface StrategyRegistry {
  [actionType: string]: NavigationStrategy;
}

/**
 * Page navigation strategy wrapper
 */
class PageNavigationStrategy implements NavigationStrategy {
  readonly name = 'page-navigation';
  readonly supportedActions = ['navigate'];

  constructor(private readonly navigator: PageNavigator) {}

  async execute(
    action: BrowserAction,
    page: Page,
    context: ActionContext
  ): Promise<ActionResult> {
    if (action.type !== 'navigate') {
      throw new Error(`Page navigation strategy does not support action type: ${action.type}`);
    }
    return this.navigator.navigate(action, page, context);
  }
}

/**
 * History navigation strategy wrapper
 */
class HistoryNavigationStrategy implements NavigationStrategy {
  readonly name = 'history-navigation';
  readonly supportedActions = ['goBack', 'goForward', 'refresh'];

  constructor(private readonly navigator: HistoryNavigator) {}

  async execute(
    action: BrowserAction,
    page: Page,
    context: ActionContext
  ): Promise<ActionResult> {
    switch (action.type) {
      case 'goBack':
        return this.navigator.goBack(page, context, action.timeout);
      case 'goForward':
        return this.navigator.goForward(page, context, action.timeout);
      case 'refresh':
        return this.navigator.refresh(page, context, action.timeout);
      default:
        throw new Error(`History navigation strategy does not support action type: ${action.type}`);
    }
  }
}

/**
 * Viewport management strategy wrapper
 */
class ViewportStrategy implements NavigationStrategy {
  readonly name = 'viewport-management';
  readonly supportedActions = ['setViewport'];

  constructor(private readonly manager: ViewportManager) {}

  async execute(
    action: BrowserAction,
    page: Page,
    context: ActionContext
  ): Promise<ActionResult> {
    if (action.type !== 'setViewport') {
      throw new Error(`Viewport strategy does not support action type: ${action.type}`);
    }

    // Type assertion - in practice this would be validated by the dispatcher
    const viewportAction = action as any;
    
    return this.manager.setViewport(page, context, {
      width: viewportAction.width,
      height: viewportAction.height,
      deviceScaleFactor: viewportAction.deviceScaleFactor,
    });
  }
}

/**
 * Navigation factory implementing Strategy pattern
 * @nist ac-3 "Access enforcement"
 */
export class NavigationFactory {
  private readonly strategies: StrategyRegistry = {};
  private readonly urlValidator: UrlValidator;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly config: Required<Omit<NavigationFactoryConfig, 
    'urlValidation' | 'pageNavigation' | 'historyNavigation' | 
    'viewportValidation' | 'performanceMonitoring'>>;

  constructor(config?: NavigationFactoryConfig) {
    this.config = {
      enablePerformanceMonitoring: config?.enablePerformanceMonitoring ?? true,
      enableUrlValidation: config?.enableUrlValidation ?? true,
    };

    // Initialize shared components
    this.urlValidator = new UrlValidator(config?.urlValidation);
    this.performanceMonitor = new PerformanceMonitor(config?.performanceMonitoring);

    // Initialize and register strategies
    this.initializeStrategies(config);

    logger.debug('Navigation factory initialized', {
      enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
      enableUrlValidation: this.config.enableUrlValidation,
      registeredStrategies: Object.keys(this.strategies),
    });
  }

  /**
   * Initialize navigation strategies
   * @param config - Factory configuration
   */
  private initializeStrategies(config?: NavigationFactoryConfig): void {
    // Page navigation strategy
    const pageNavigator = new PageNavigator({
      urlValidator: this.config.enableUrlValidation ? this.urlValidator : undefined,
      performanceMonitor: this.config.enablePerformanceMonitoring ? this.performanceMonitor : undefined,
      ...config?.pageNavigation,
    });
    this.registerStrategy(new PageNavigationStrategy(pageNavigator));

    // History navigation strategy
    const historyNavigator = new HistoryNavigator({
      performanceMonitor: this.config.enablePerformanceMonitoring ? this.performanceMonitor : undefined,
      ...config?.historyNavigation,
    });
    this.registerStrategy(new HistoryNavigationStrategy(historyNavigator));

    // Viewport management strategy
    const viewportManager = new ViewportManager(config?.viewportValidation);
    this.registerStrategy(new ViewportStrategy(viewportManager));
  }

  /**
   * Register a navigation strategy
   * @param strategy - Navigation strategy to register
   */
  registerStrategy(strategy: NavigationStrategy): void {
    for (const actionType of strategy.supportedActions) {
      if (this.strategies[actionType]) {
        logger.warn('Overriding existing strategy for action type', {
          actionType,
          oldStrategy: this.strategies[actionType].name,
          newStrategy: strategy.name,
        });
      }
      
      this.strategies[actionType] = strategy;
      
      logger.debug('Registered navigation strategy', {
        actionType,
        strategyName: strategy.name,
      });
    }
  }

  /**
   * Unregister a navigation strategy
   * @param actionType - Action type to unregister
   */
  unregisterStrategy(actionType: string): void {
    if (this.strategies[actionType]) {
      const strategyName = this.strategies[actionType].name;
      delete this.strategies[actionType];
      
      logger.debug('Unregistered navigation strategy', {
        actionType,
        strategyName,
      });
    }
  }

  /**
   * Get strategy for action type
   * @param actionType - Action type
   * @returns Navigation strategy or null
   */
  getStrategy(actionType: string): NavigationStrategy | null {
    return this.strategies[actionType] ?? null;
  }

  /**
   * Execute navigation action using appropriate strategy
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
    context: ActionContext
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing navigation action via factory', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
      });

      // Get appropriate strategy
      const strategy = this.getStrategy(action.type);
      if (!strategy) {
        const availableActions = this.getSupportedActions();
        return {
          success: false,
          actionType: action.type,
          error: `Unsupported navigation action: ${action.type}. Supported actions: ${availableActions.join(', ')}`,
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      // Execute using strategy
      const result = await strategy.execute(action, page, context);

      logger.debug('Navigation action completed via factory', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        strategyName: strategy.name,
        success: result.success,
        duration: result.duration,
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Navigation execution failed';
      const duration = Date.now() - startTime;

      logger.error('Navigation action failed via factory', {
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
        },
      };
    }
  }

  /**
   * Check if action type is supported
   * @param actionType - Action type to check
   * @returns True if supported
   */
  isActionSupported(actionType: string): boolean {
    return this.strategies[actionType] !== undefined;
  }

  /**
   * Get all supported action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return Object.keys(this.strategies);
  }

  /**
   * Get registered strategies
   * @returns Strategy registry
   */
  getRegisteredStrategies(): Record<string, string> {
    const strategyMap: Record<string, string> = {};
    
    for (const [actionType, strategy] of Object.entries(this.strategies)) {
      strategyMap[actionType] = strategy.name;
    }
    
    return strategyMap;
  }

  /**
   * Get URL validator instance
   * @returns URL validator
   */
  getUrlValidator(): UrlValidator {
    return this.urlValidator;
  }

  /**
   * Get performance monitor instance
   * @returns Performance monitor
   */
  getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  /**
   * Clear performance metrics for session
   * @param sessionId - Session ID
   */
  clearSessionMetrics(sessionId: string): void {
    this.performanceMonitor.clearSessionMetrics(sessionId);
  }

  /**
   * Get performance statistics
   * @param sessionId - Optional session ID filter
   * @returns Performance statistics
   */
  getPerformanceStatistics(sessionId?: string) {
    return this.performanceMonitor.getStatistics(sessionId);
  }

  /**
   * Update factory configuration
   * @param config - Configuration updates
   */
  updateConfig(config: Partial<NavigationFactoryConfig>): void {
    if (config.enablePerformanceMonitoring !== undefined) {
      this.config.enablePerformanceMonitoring = config.enablePerformanceMonitoring;
    }
    if (config.enableUrlValidation !== undefined) {
      this.config.enableUrlValidation = config.enableUrlValidation;
    }

    logger.info('Navigation factory configuration updated', {
      config,
      currentConfig: this.config,
    });
  }

  /**
   * Get current factory configuration
   * @returns Current configuration
   */
  getConfig(): Required<Omit<NavigationFactoryConfig,
    'urlValidation' | 'pageNavigation' | 'historyNavigation' | 
    'viewportValidation' | 'performanceMonitoring'>> {
    return { ...this.config };
  }

  /**
   * Validate action before execution
   * @param action - Action to validate
   * @returns Validation result
   */
  async validateAction(action: BrowserAction): Promise<{
    isValid: boolean;
    error?: string;
    warnings?: string[];
  }> {
    try {
      // Check if action type is supported
      if (!this.isActionSupported(action.type)) {
        return {
          isValid: false,
          error: `Unsupported action type: ${action.type}`,
        };
      }

      // URL validation for navigate actions
      if (action.type === 'navigate' && this.config.enableUrlValidation) {
        const navigateAction = action;
        const urlValidation = await this.urlValidator.validateUrl(navigateAction.url);
        
        if (!urlValidation.isValid) {
          return {
            isValid: false,
            error: urlValidation.error,
          };
        }

        return {
          isValid: true,
          warnings: urlValidation.warnings,
        };
      }

      return { isValid: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      
      logger.error('Action validation failed', {
        actionType: action.type,
        error: errorMessage,
      });

      return {
        isValid: false,
        error: `Validation error: ${errorMessage}`,
      };
    }
  }
}

/**
 * Create navigation factory instance
 * @param config - Optional factory configuration
 * @returns Navigation factory instance
 */
export function createNavigationFactory(config?: NavigationFactoryConfig): NavigationFactory {
  return new NavigationFactory(config);
}

/**
 * Create navigation factory with custom strategies
 * @param strategies - Custom strategies to register
 * @param config - Optional factory configuration
 * @returns Navigation factory instance with custom strategies
 */
export function createNavigationFactoryWithStrategies(
  strategies: NavigationStrategy[],
  config?: NavigationFactoryConfig
): NavigationFactory {
  const factory = new NavigationFactory(config);
  
  for (const strategy of strategies) {
    factory.registerStrategy(strategy);
  }
  
  return factory;
}