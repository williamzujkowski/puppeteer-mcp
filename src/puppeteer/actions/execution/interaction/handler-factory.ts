/**
 * Handler factory for interaction actions
 * @module puppeteer/actions/execution/interaction/handler-factory
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { BrowserAction } from '../../../interfaces/action-executor.interface.js';
import type { InteractionHandler } from './base-handler.js';
import { ClickHandler } from './click-handler.js';
import { TypeHandler } from './type-handler.js';
import { SelectHandler } from './select-handler.js';
import { KeyboardHandler } from './keyboard-handler.js';
import { MouseHandler } from './mouse-handler.js';
import { HoverHandler } from './hover-handler.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:interaction:handler-factory');

/**
 * Handler registry type
 */
type HandlerRegistry = Map<string, InteractionHandler<any>>;

/**
 * Factory for creating and managing interaction handlers
 * @nist ac-3 "Access enforcement"
 */
export class InteractionHandlerFactory {
  private static instance: InteractionHandlerFactory;
  private handlers: HandlerRegistry;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.handlers = new Map();
    this.registerDefaultHandlers();
  }

  /**
   * Get factory instance
   * @returns Factory instance
   */
  static getInstance(): InteractionHandlerFactory {
    if (!InteractionHandlerFactory.instance) {
      InteractionHandlerFactory.instance = new InteractionHandlerFactory();
    }
    return InteractionHandlerFactory.instance;
  }

  /**
   * Register default handlers
   */
  private registerDefaultHandlers(): void {
    const defaultHandlers = [
      new ClickHandler(),
      new TypeHandler(),
      new SelectHandler(),
      new KeyboardHandler(),
      new MouseHandler(),
      new HoverHandler(),
    ];

    for (const handler of defaultHandlers) {
      this.registerHandler(handler);
    }

    logger.info('Default interaction handlers registered', {
      handlerCount: this.handlers.size,
      handlerTypes: Array.from(this.handlers.keys()),
    });
  }

  /**
   * Register a handler
   * @param handler - Handler to register
   * @nist ac-3 "Access enforcement"
   */
  registerHandler(handler: InteractionHandler<any>): void {
    const actionType = handler.getActionType();

    if (this.handlers.has(actionType)) {
      logger.warn('Overwriting existing handler', { actionType });
    }

    this.handlers.set(actionType, handler);

    logger.debug('Handler registered', { actionType });
  }

  /**
   * Unregister a handler
   * @param actionType - Action type to unregister
   */
  unregisterHandler(actionType: string): void {
    if (!this.handlers.has(actionType)) {
      logger.warn('Handler not found for unregistration', { actionType });
      return;
    }

    this.handlers.delete(actionType);

    logger.debug('Handler unregistered', { actionType });
  }

  /**
   * Get handler for action type
   * @param actionType - Action type
   * @returns Handler instance or undefined
   */
  getHandler(actionType: string): InteractionHandler<any> | undefined {
    return this.handlers.get(actionType);
  }

  /**
   * Get handler for action
   * @param action - Browser action
   * @returns Handler instance
   * @throws Error if no handler found
   * @nist si-10 "Information input validation"
   */
  getHandlerForAction(action: BrowserAction): InteractionHandler<any> {
    const handler = this.handlers.get(action.type);

    if (!handler) {
      throw new Error(`No handler registered for action type: ${action.type}`);
    }

    return handler;
  }

  /**
   * Check if handler exists for action type
   * @param actionType - Action type to check
   * @returns True if handler exists
   */
  hasHandler(actionType: string): boolean {
    return this.handlers.has(actionType);
  }

  /**
   * Get all supported action types
   * @returns Array of action types
   */
  getSupportedActionTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all handlers
   */
  clearHandlers(): void {
    this.handlers.clear();
    logger.info('All handlers cleared');
  }

  /**
   * Reset to default handlers
   */
  resetToDefaults(): void {
    this.clearHandlers();
    this.registerDefaultHandlers();
    logger.info('Handlers reset to defaults');
  }
}
