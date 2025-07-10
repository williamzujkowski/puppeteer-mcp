/**
 * Data extraction actions executor
 * @module puppeteer/actions/execution/extraction-executor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * 
 * This file maintains backward compatibility while delegating to modular components
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  ScreenshotAction,
  PDFAction,
  ContentAction,
} from '../../interfaces/action-executor.interface.js';
import { ExtractionFactory } from './extraction/extraction-factory.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:extraction-executor');

/**
 * Extraction action executor
 * Maintains backward compatibility while using new modular extraction components
 * @nist ac-3 "Access enforcement"
 */
export class ExtractionExecutor {
  private readonly extractionFactory: ExtractionFactory;

  constructor() {
    this.extractionFactory = new ExtractionFactory();
  }

  /**
   * Execute screenshot action
   * @param action - Screenshot action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @deprecated Use ExtractionFactory directly for new implementations
   */
  async executeScreenshot(
    action: ScreenshotAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    logger.debug('Delegating screenshot action to factory', {
      sessionId: context.sessionId,
      contextId: context.contextId,
    });
    return this.extractionFactory.execute(action, page, context);
  }

  /**
   * Execute PDF generation action
   * @param action - PDF action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @deprecated Use ExtractionFactory directly for new implementations
   */
  async executePDF(
    action: PDFAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    logger.debug('Delegating PDF action to factory', {
      sessionId: context.sessionId,
      contextId: context.contextId,
    });
    return this.extractionFactory.execute(action, page, context);
  }

  /**
   * Execute content extraction action
   * @param action - Content action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @deprecated Use ExtractionFactory directly for new implementations
   */
  async executeContent(
    action: ContentAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    logger.debug('Delegating content action to factory', {
      sessionId: context.sessionId,
      contextId: context.contextId,
    });
    return this.extractionFactory.execute(action, page, context);
  }

  /**
   * Execute text extraction action
   * @param selector - Element selector
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Action timeout
   * @returns Action result
   * @deprecated Use ExtractionFactory directly for new implementations
   */
  async executeGetText(
    selector: string,
    page: Page,
    context: ActionContext,
    timeout?: number,
  ): Promise<ActionResult> {
    logger.debug('Delegating getText action to factory', {
      sessionId: context.sessionId,
      contextId: context.contextId,
    });
    const action: BrowserAction = {
      type: 'getText',
      pageId: context.contextId,
      selector,
      timeout,
    } as any;
    return this.extractionFactory.execute(action, page, context);
  }

  /**
   * Execute attribute extraction action
   * @param selector - Element selector
   * @param attribute - Attribute name
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Action timeout
   * @returns Action result
   * @deprecated Use ExtractionFactory directly for new implementations
   */
  async executeGetAttribute(
    selector: string,
    attribute: string,
    page: Page,
    context: ActionContext,
    timeout?: number,
  ): Promise<ActionResult> {
    logger.debug('Delegating getAttribute action to factory', {
      sessionId: context.sessionId,
      contextId: context.contextId,
    });
    const action: BrowserAction = {
      type: 'getAttribute',
      pageId: context.contextId,
      selector,
      attribute,
      timeout,
    } as any;
    return this.extractionFactory.execute(action, page, context);
  }

  /**
   * Execute route handler for extraction actions
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
    logger.debug('Executing extraction action via factory', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      actionType: action.type,
    });
    return this.extractionFactory.execute(action, page, context);
  }

  /**
   * Get supported extraction action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return this.extractionFactory.getSupportedActions();
  }
}

// Re-export modular components for direct usage
export * from './extraction/index.js';