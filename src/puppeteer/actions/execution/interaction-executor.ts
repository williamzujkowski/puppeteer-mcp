/**
 * User interaction actions executor
 * @module puppeteer/actions/execution/interaction-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 *
 * This file maintains backward compatibility by re-exporting functionality
 * from the modularized interaction handlers.
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  ClickAction,
  TypeAction,
  SelectAction,
  KeyboardAction,
  MouseAction,
} from '../../interfaces/action-executor.interface.js';
import { InteractionHandlerFactory } from './interaction/handler-factory.js';
import type { InteractionHandler } from './interaction/base-handler.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:interaction-executor');

/**
 * Interaction action executor
 * Uses the Strategy pattern with handlers for each interaction type
 * @nist ac-3 "Access enforcement"
 */
export class InteractionExecutor {
  private handlerFactory: InteractionHandlerFactory;

  /**
   * Constructor
   */
  constructor() {
    this.handlerFactory = InteractionHandlerFactory.getInstance();
  }

  /**
   * Execute click action
   * @param action - Click action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @deprecated Use execute() method with action type 'click'
   */
  async executeClick(
    action: ClickAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const handler = this.handlerFactory.getHandlerForAction(action);
    return handler.execute(action, page, context);
  }

  /**
   * Execute type action
   * @param action - Type action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @deprecated Use execute() method with action type 'type'
   */
  async executeType(action: TypeAction, page: Page, context: ActionContext): Promise<ActionResult> {
    const handler = this.handlerFactory.getHandlerForAction(action);
    return handler.execute(action, page, context);
  }

  /**
   * Execute select action
   * @param action - Select action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @deprecated Use execute() method with action type 'select'
   */
  async executeSelect(
    action: SelectAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const handler = this.handlerFactory.getHandlerForAction(action);
    return handler.execute(action, page, context);
  }

  /**
   * Execute keyboard action
   * @param action - Keyboard action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @deprecated Use execute() method with action type 'keyboard'
   */
  async executeKeyboard(
    action: KeyboardAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const handler = this.handlerFactory.getHandlerForAction(action);
    return handler.execute(action, page, context);
  }

  /**
   * Execute mouse action
   * @param action - Mouse action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @deprecated Use execute() method with action type 'mouse'
   */
  async executeMouse(
    action: MouseAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const handler = this.handlerFactory.getHandlerForAction(action);
    return handler.execute(action, page, context);
  }

  /**
   * Execute hover action
   * @param selector - Element selector to hover over
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Action timeout
   * @returns Action result
   * @deprecated Use execute() method with action type 'hover'
   */
  async executeHover(
    selector: string,
    page: Page,
    context: ActionContext,
    timeout?: number,
  ): Promise<ActionResult> {
    const action = {
      type: 'hover' as const,
      selector,
      pageId: page.mainFrame().url(),
      timeout,
    };
    const handler = this.handlerFactory.getHandlerForAction(action);
    return handler.execute(action, page, context);
  }

  /**
   * Execute route handler for interaction actions
   * @param action - Browser action
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  async execute(action: BrowserAction, page: Page, context: ActionContext): Promise<ActionResult> {
    try {
      // Special handling for hover action with old interface
      if (action.type === 'hover' && 'selector' in action) {
        const hoverAction = {
          ...action,
          type: 'hover' as const,
        };
        const handler = this.handlerFactory.getHandlerForAction(hoverAction);
        return await handler.execute(hoverAction, page, context);
      }

      // Get appropriate handler from factory
      const handler = this.handlerFactory.getHandlerForAction(action);

      // Execute action using handler
      return await handler.execute(action, page, context);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to execute interaction action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
        error: errorMessage,
      });

      // Return error result if no handler found
      return {
        success: false,
        actionType: action.type,
        error: errorMessage,
        duration: 0,
        timestamp: new Date(),
        metadata: {
          action,
        },
      };
    }
  }

  /**
   * Get supported interaction action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return this.handlerFactory.getSupportedActionTypes();
  }

  /**
   * Register custom interaction handler
   * @param handler - Handler to register
   * @nist ac-3 "Access enforcement"
   */
  registerHandler(handler: InteractionHandler<any>): void {
    this.handlerFactory.registerHandler(handler);
  }

  /**
   * Unregister interaction handler
   * @param actionType - Action type to unregister
   */
  unregisterHandler(actionType: string): void {
    this.handlerFactory.unregisterHandler(actionType);
  }
}

// Re-export types and classes for backward compatibility
export * from './interaction/index.js';
