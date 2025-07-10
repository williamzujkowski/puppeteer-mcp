/**
 * Action executor implementation for browser automation
 * Re-exports the modular action executor for backward compatibility
 * @module puppeteer/actions/action-executor
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 * @nist au-3 "Content of audit records"
 * @nist si-10 "Information input validation"
 */

// Re-export the modular action executor as the main BrowserActionExecutor
export { BrowserActionExecutor } from './execution/index.js';

// Re-export commonly used types for backward compatibility
export type {
  ActionExecutor,
  BrowserAction,
  ActionResult,
  ActionContext,
  ValidationResult,
} from '../interfaces/action-executor.interface.js';

// Re-export batch execution types
export type { BatchExecutionOptions } from './batch-executor.js';

/**
 * @deprecated Use BrowserActionExecutor from './execution/index.js' instead
 * This is kept for backward compatibility
 */
export { BrowserActionExecutor as LegacyBrowserActionExecutor } from './execution/index.js';
