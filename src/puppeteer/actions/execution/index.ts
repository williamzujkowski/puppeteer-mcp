/**
 * Modular action execution system exports
 * @module puppeteer/actions/execution
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

// Main executor (re-exported as BrowserActionExecutor for backward compatibility)
export { ModularBrowserActionExecutor as BrowserActionExecutor } from './action-executor.js';

// Individual components (for advanced usage and testing)
export { ActionValidator } from './action-validator.js';
export { ActionContextManager } from './context-manager.js';
export { ActionErrorHandler } from './error-handler.js';
export { ActionDispatcher } from './action-dispatcher.js';

// Specialized executors (for direct usage if needed)
export { NavigationExecutor } from './navigation-executor.js';
export { InteractionExecutor } from './interaction-executor.js';
export { ExtractionExecutor } from './extraction-executor.js';
export { EvaluationExecutor } from './evaluation-executor.js';
export { WaitExecutor } from './wait-executor.js';
export { FileExecutor } from './file-executor.js';

// Types and interfaces
export type {
  ActionHandler,
  HandlerRegistry,
  RetryConfig,
  ExecutionOptions,
  NavigationWaitOptions,
  InteractionOptions,
  WaitCondition,
  WaitConditionConfig,
  ScreenshotConfig,
  FileUploadConfig,
  ScrollConfig,
  EvaluationConfig,
  CookieConfig,
  ExecutionMetrics,
  ExecutionState,
  ActionExecutionErrorDetails,
  ValidationError,
} from './types.js';

export {
  ActionExecutionError,
  DEFAULT_CONFIG,
} from './types.js';

// Re-export commonly used types from main interfaces
export type {
  ActionExecutor,
  BrowserAction,
  ActionResult,
  ActionContext,
  ValidationResult,
  NavigateAction,
  ClickAction,
  TypeAction,
  SelectAction,
  KeyboardAction,
  MouseAction,
  ScreenshotAction,
  PDFAction,
  ContentAction,
  WaitAction,
  ScrollAction,
  EvaluateAction,
  UploadAction,
  CookieAction,
} from '../../interfaces/action-executor.interface.js';

/**
 * Create a new modular browser action executor
 * @param pageManager - Optional page manager instance
 * @returns Configured action executor
 */
export function createBrowserActionExecutor(pageManager?: import('../../interfaces/page-manager.interface.js').PageManager) {
  // Import is now synchronous using require
  const { ModularBrowserActionExecutor } = require('./action-executor.js');
  return new ModularBrowserActionExecutor(pageManager);
}

/**
 * Create action executor with custom configuration
 * @param config - Configuration options
 * @returns Configured action executor
 */
export function createConfiguredExecutor(config: {
  pageManager?: import('../../interfaces/page-manager.interface.js').PageManager;
  retryConfig?: Partial<import('./types.js').RetryConfig>;
  enableHistory?: boolean;
  enableMetrics?: boolean;
}) {
  const { ModularBrowserActionExecutor } = require('./action-executor.js');
  const executor = new ModularBrowserActionExecutor(config.pageManager);

  if (config.retryConfig) {
    executor.updateRetryConfig(config.retryConfig);
  }

  return executor;
}

/**
 * Get default retry configuration
 * @returns Default retry configuration
 */
export function getDefaultRetryConfig(): import('./types.js').RetryConfig {
  const { DEFAULT_CONFIG } = require('./types.js');
  return DEFAULT_CONFIG.RETRY;
}

/**
 * Get all supported action types
 * @returns Array of supported action types
 */
export function getSupportedActionTypes(): string[] {
  const { ModularBrowserActionExecutor } = require('./action-executor.js');
  const executor = new ModularBrowserActionExecutor();
  return executor.getSupportedActions();
}

/**
 * Get action categories mapping
 * @returns Map of categories to action types
 */
export function getActionCategories(): Map<string, string[]> {
  const { ModularBrowserActionExecutor } = require('./action-executor.js');
  const executor = new ModularBrowserActionExecutor();
  return executor.getActionCategories();
}

/**
 * Validate action without executing
 * @param action - Action to validate
 * @param context - Execution context
 * @returns Validation result
 */
export async function validateAction(
  action: import('../../interfaces/action-executor.interface.js').BrowserAction,
  context: import('../../interfaces/action-executor.interface.js').ActionContext,
): Promise<import('../../interfaces/action-executor.interface.js').ValidationResult> {
  const { ActionValidator } = require('./action-validator.js');
  const validator = new ActionValidator();
  return validator.validate(action, context);
}

/**
 * Check if action type is supported
 * @param actionType - Action type to check
 * @returns True if supported
 */
export function isActionSupported(actionType: string): boolean {
  const supportedTypes = getSupportedActionTypes();
  return supportedTypes.includes(actionType);
}

/**
 * Get execution recommendation for action type
 * @param actionType - Action type
 * @returns Execution recommendation or null
 */
export function getExecutionRecommendation(actionType: string): {
  executor: string;
  category: string;
  complexity: 'low' | 'medium' | 'high';
  estimatedDuration: number;
} | null {
  const { ModularBrowserActionExecutor } = require('./action-executor.js');
  const executor = new ModularBrowserActionExecutor();
  return executor.getExecutionRecommendation(actionType);
}

// Version information
export const MODULAR_EXECUTOR_VERSION = '1.0.0';
export const COMPONENTS_VERSION = {
  validator: '1.0.0',
  contextManager: '1.0.0',
  errorHandler: '1.0.0',
  dispatcher: '1.0.0',
  navigation: '1.0.0',
  interaction: '1.0.0',
  extraction: '1.0.0',
  evaluation: '1.0.0',
  wait: '1.0.0',
  file: '1.0.0',
} as const;