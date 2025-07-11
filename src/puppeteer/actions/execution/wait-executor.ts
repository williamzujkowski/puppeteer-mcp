/**
 * Wait operations and condition checking executor
 * @module puppeteer/actions/execution/wait-executor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 *
 * This file maintains backward compatibility by re-exporting the modularized wait executor.
 * The implementation has been refactored into smaller, focused modules under the wait/ directory.
 */

// Re-export the modularized wait executor as WaitExecutor for backward compatibility
export { ModularWaitExecutor as WaitExecutor } from './wait/wait-executor.js';

// Re-export types for backward compatibility
export type {
  WaitStrategy,
  WaitResult,
  WaitExecutorConfig,
  FunctionValidationResult,
} from './wait/types.js';

// Re-export strategy implementations if needed by other modules
export {
  BaseWaitStrategy,
  SelectorWaitStrategy,
  NavigationWaitStrategy,
  TimeoutWaitStrategy,
  FunctionWaitStrategy,
  LoadStateWaitStrategy,
  WaitStrategyFactory,
} from './wait/index.js';

// Re-export navigation wait types
export type { NavigationWaitUntil } from './wait/index.js';

/**
 * Extend Page with waitForLoadState compatibility method
 * @deprecated This is provided for compatibility only
 */
declare module 'puppeteer' {
  interface Page {
    waitForLoadState?(
      state: 'load' | 'domcontentloaded' | 'networkidle',
      options?: { timeout?: number },
    ): Promise<void>;
  }
}

// Note: waitForLoadState implementation is provided as a compatibility shim
// but is not actually implemented here to avoid runtime prototype modification
