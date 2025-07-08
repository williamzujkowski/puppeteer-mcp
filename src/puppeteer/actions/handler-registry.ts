/**
 * Action handler registry for browser automation
 * @module puppeteer/actions/handler-registry
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  NavigateAction,
  ClickAction,
  TypeAction,
  SelectAction,
  KeyboardAction,
  MouseAction,
  ScreenshotAction,
  PDFAction,
  WaitAction,
  ScrollAction,
  EvaluateAction,
  UploadAction,
  CookieAction,
} from '../interfaces/action-executor.interface.js';
import { createLogger } from '../../utils/logger.js';

// Import action handlers
import { handleNavigate } from './handlers/navigation.js';
import { handleClick, handleType, handleSelect } from './handlers/interaction.js';
import { handleEvaluate } from './handlers/evaluation.js';
import { handleWait } from './handlers/waiting.js';
import { handleScreenshot, handlePdf } from './handlers/content.js';
import { handleKeyboard } from './handlers/keyboard.js';
import { handleMouse } from './handlers/mouse.js';
import { handleUpload } from './handlers/upload.js';
import { handleCookie } from './handlers/cookies.js';
import { handleScroll } from './handlers/scroll.js';

const logger = createLogger('puppeteer:handler-registry');

/**
 * Action handler function type
 */
export type ActionHandler<T extends BrowserAction = BrowserAction> = (
  action: T,
  page: Page,
  context: ActionContext,
) => Promise<ActionResult>;

/**
 * Registry for action handlers
 */
export class ActionHandlerRegistry {
  private readonly handlers = new Map<string, ActionHandler>();

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Register custom action handler
   * @param actionType - Action type identifier
   * @param handler - Action handler function
   */
  registerHandler<T extends BrowserAction>(actionType: string, handler: ActionHandler<T>): void {
    logger.info('Registering custom action handler', { actionType });
    this.handlers.set(actionType, handler as ActionHandler);
  }

  /**
   * Unregister action handler
   * @param actionType - Action type identifier
   */
  unregisterHandler(actionType: string): void {
    logger.info('Unregistering action handler', { actionType });
    this.handlers.delete(actionType);
  }

  /**
   * Get handler for action type
   * @param actionType - Action type to get handler for
   * @returns Handler function or undefined
   */
  getHandler(actionType: string): ActionHandler | undefined {
    return this.handlers.get(actionType);
  }

  /**
   * Get supported action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if action type is supported
   * @param actionType - Action type to check
   * @returns True if supported
   */
  isActionSupported(actionType: string): boolean {
    return this.handlers.has(actionType);
  }

  /**
   * Register default action handlers
   */
  private registerDefaultHandlers(): void {
    // Navigation handlers
    this.handlers.set('navigate', (action, page, context) =>
      handleNavigate(action as NavigateAction, page, context),
    );

    // Interaction handlers
    this.handlers.set('click', (action, page, context) =>
      handleClick(action as ClickAction, page, context),
    );
    this.handlers.set('type', (action, page, context) =>
      handleType(action as TypeAction, page, context),
    );
    this.handlers.set('select', (action, page, context) =>
      handleSelect(action as SelectAction, page, context),
    );

    // Keyboard handlers
    this.handlers.set('keyboard', (action, page, context) =>
      handleKeyboard(action as KeyboardAction, page, context),
    );

    // Mouse handlers
    this.handlers.set('mouse', (action, page, context) =>
      handleMouse(action as MouseAction, page, context),
    );

    // Content handlers
    this.handlers.set('screenshot', (action, page, context) =>
      handleScreenshot(action as ScreenshotAction, page, context),
    );
    this.handlers.set('pdf', (action, page, context) =>
      handlePdf(action as PDFAction, page, context),
    );

    // Wait handlers
    this.handlers.set('wait', (action, page, context) =>
      handleWait(action as WaitAction, page, context),
    );

    // Scroll handlers
    this.handlers.set('scroll', (action, page, context) =>
      handleScroll(action as ScrollAction, page, context),
    );

    // Evaluation handlers
    this.handlers.set('evaluate', (action, page, context) =>
      handleEvaluate(action as EvaluateAction, page, context),
    );

    // Upload handlers
    this.handlers.set('upload', (action, page, context) =>
      handleUpload(action as UploadAction, page, context),
    );

    // Cookie handlers
    this.handlers.set('cookie', (action, page, context) =>
      handleCookie(action as CookieAction, page, context),
    );

    logger.info('Default action handlers registered', {
      handlerCount: this.handlers.size,
      supportedActions: this.getSupportedActions(),
    });
  }
}
