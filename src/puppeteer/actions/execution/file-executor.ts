/**
 * File upload/download operations executor
 * @module puppeteer/actions/execution/file-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-7 "Software, firmware, and information integrity"
 * 
 * This file maintains backward compatibility by re-exporting the modularized components.
 * The implementation has been split into focused modules under the ./file/ directory.
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  UploadAction,
  CookieAction,
  DownloadAction,
} from '../../interfaces/action-executor.interface.js';
import { ExecutorFactory } from './file/executor-factory.js';
import { FileValidator } from './file/file-validator.js';

// Re-export all modules for backward compatibility
export * from './file/index.js';

/**
 * File operation executor (backward compatibility wrapper)
 * @nist ac-3 "Access enforcement"
 * @deprecated Use individual executors from ./file/ directory for better modularity
 */
export class FileExecutor {
  private readonly executorFactory: ExecutorFactory;
  private readonly validator: FileValidator;

  constructor() {
    this.validator = new FileValidator();
    this.executorFactory = new ExecutorFactory({ validator: this.validator });
  }

  /**
   * Execute file upload action
   * @param action - Upload action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeUpload(
    action: UploadAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const executor = this.executorFactory.createExecutor('upload');
    return executor.execute(action, page, context);
  }

  /**
   * Execute download action
   * @param options - Download options
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeDownload(
    options: { url: string; downloadPath: string; timeout?: number },
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const action: DownloadAction = {
      type: 'download',
      pageId: page.target().targetId,
      url: options.url,
      downloadPath: options.downloadPath,
      timeout: options.timeout,
    };

    const executor = this.executorFactory.createExecutor('download');
    return executor.execute(action, page, context);
  }

  /**
   * Execute cookie operations
   * @param action - Cookie action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async executeCookie(
    action: CookieAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const executor = this.executorFactory.createExecutor('cookie');
    return executor.execute(action, page, context);
  }

  /**
   * Execute route handler for file operations
   * @param action - Browser action
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  async execute(
    action: BrowserAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const executor = this.executorFactory.getExecutor(action.type);
    
    if (!executor) {
      throw new Error(`Unsupported file action: ${action.type}`);
    }

    // Special handling for download action to maintain backward compatibility
    if (action.type === 'download') {
      const downloadAction = action as BrowserAction & {
        url: string;
        downloadPath: string;
        timeout?: number;
      };
      
      const normalizedAction: DownloadAction = {
        ...action,
        type: 'download',
        url: downloadAction.url,
        downloadPath: downloadAction.downloadPath,
        timeout: downloadAction.timeout,
      } as DownloadAction;

      return executor.execute(normalizedAction, page, context);
    }

    return executor.execute(action, page, context);
  }

  /**
   * Get supported file action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return this.executorFactory.getSupportedTypes();
  }

  /**
   * Get the executor factory instance
   * @returns Executor factory
   */
  getExecutorFactory(): ExecutorFactory {
    return this.executorFactory;
  }

  /**
   * Get the validator instance
   * @returns File validator
   */
  getValidator(): FileValidator {
    return this.validator;
  }
}