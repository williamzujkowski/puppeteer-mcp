/**
 * Factory for creating extraction handlers
 * @module puppeteer/actions/execution/extraction/extraction-factory
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  ScreenshotAction,
  PDFAction,
  ContentAction,
} from '../../../interfaces/action-executor.interface.js';
import { ScreenshotExtractor } from './screenshot-extractor.js';
import { PDFExtractor } from './pdf-extractor.js';
import { ContentExtractor } from './content-extractor.js';
import { TextExtractor } from './text-extractor.js';
import { AttributeExtractor } from './attribute-extractor.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:extraction-factory');

/**
 * Extraction handler interface
 * @nist ac-3 "Access enforcement"
 */
export interface ExtractionHandler {
  execute(
    action: BrowserAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult>;
}

/**
 * Supported extraction action types
 */
export enum ExtractionActionType {
  SCREENSHOT = 'screenshot',
  PDF = 'pdf',
  CONTENT = 'content',
  GET_TEXT = 'getText',
  GET_ATTRIBUTE = 'getAttribute',
}

/**
 * Factory for creating extraction handlers based on action type
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */
export class ExtractionFactory {
  private readonly screenshotExtractor: ScreenshotExtractor;
  private readonly pdfExtractor: PDFExtractor;
  private readonly contentExtractor: ContentExtractor;
  private readonly textExtractor: TextExtractor;
  private readonly attributeExtractor: AttributeExtractor;

  constructor() {
    this.screenshotExtractor = new ScreenshotExtractor();
    this.pdfExtractor = new PDFExtractor();
    this.contentExtractor = new ContentExtractor();
    this.textExtractor = new TextExtractor();
    this.attributeExtractor = new AttributeExtractor();
  }

  /**
   * Get handler for specific action type
   * @param actionType - Type of extraction action
   * @returns Extraction handler or null if not supported
   * @nist si-10 "Information input validation"
   */
  getHandler(actionType: string): ExtractionHandler | null {
    switch (actionType as ExtractionActionType) {
      case ExtractionActionType.SCREENSHOT:
        return {
          execute: async (action, page, context) =>
            this.screenshotExtractor.execute(
              action as ScreenshotAction,
              page,
              context,
            ),
        };

      case ExtractionActionType.PDF:
        return {
          execute: async (action, page, context) =>
            this.pdfExtractor.execute(
              action as PDFAction,
              page,
              context,
            ),
        };

      case ExtractionActionType.CONTENT:
        return {
          execute: async (action, page, context) =>
            this.contentExtractor.execute(
              action as ContentAction,
              page,
              context,
            ),
        };

      case ExtractionActionType.GET_TEXT:
        return {
          execute: async (action, page, context) => {
            const textAction = action as { selector: string; timeout?: number };
            return this.textExtractor.execute(
              {
                selector: textAction.selector,
                timeout: textAction.timeout,
              },
              page,
              context,
            );
          },
        };

      case ExtractionActionType.GET_ATTRIBUTE:
        return {
          execute: async (action, page, context) => {
            const attrAction = action as {
              selector: string;
              attribute: string;
              timeout?: number;
            };
            return this.attributeExtractor.execute(
              {
                selector: attrAction.selector,
                attribute: attrAction.attribute,
                timeout: attrAction.timeout,
              },
              page,
              context,
            );
          },
        };

      default:
        logger.warn('Unsupported extraction action type', { actionType });
        return null;
    }
  }

  /**
   * Check if action type is supported for extraction
   * @param actionType - Action type to check
   * @returns True if supported
   * @nist si-10 "Information input validation"
   */
  isSupported(actionType: string): boolean {
    return Object.values(ExtractionActionType).includes(actionType as ExtractionActionType);
  }

  /**
   * Get list of supported extraction action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return Object.values(ExtractionActionType);
  }

  /**
   * Execute extraction action
   * @param action - Browser action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @throws Error if action type is not supported
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute(
    action: BrowserAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const handler = this.getHandler(action.type);

    if (!handler) {
      const error = `Unsupported extraction action: ${action.type}`;
      logger.error(error, {
        sessionId: context.sessionId,
        contextId: context.contextId,
        actionType: action.type,
      });
      throw new Error(error);
    }

    return handler.execute(action, page, context);
  }
}