/**
 * PDF extraction handler
 * @module puppeteer/actions/execution/extraction/pdf-extractor
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type {
  PDFAction,
  ActionResult,
  ActionContext,
} from '../../../interfaces/action-executor.interface.js';
import { DEFAULT_CONFIG } from '../types.js';
import { createLogger } from '../../../../utils/logger.js';

const logger = createLogger('puppeteer:pdf-extractor');

/**
 * PDF configuration interface
 * @nist si-10 "Information input validation"
 */
interface PDFConfig {
  format: PDFAction['format'];
  landscape: boolean;
  scale: number;
  displayHeaderFooter: boolean;
  headerTemplate: string;
  footerTemplate: string;
  printBackground: boolean;
  preferCSSPageSize: boolean;
  pageRanges: string;
  margin: PDFAction['margin'];
  timeout: number;
}

/**
 * PDF extractor for generating PDF documents
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class PDFExtractor {
  /**
   * Get default PDF configuration
   * @returns Default PDF configuration
   * @nist si-10 "Information input validation"
   */
  private getDefaultConfig(): PDFConfig {
    return {
      format: 'a4' as PDFAction['format'],
      landscape: false,
      scale: 1,
      displayHeaderFooter: false,
      headerTemplate: '',
      footerTemplate: '',
      printBackground: false,
      preferCSSPageSize: false,
      pageRanges: '',
      margin: {},
      timeout: DEFAULT_CONFIG.TIMEOUT.default,
    };
  }

  /**
   * Extract layout configuration from action
   * @param action - PDF action
   * @param defaults - Default configuration
   * @returns Layout configuration subset
   */
  private extractLayoutConfig(action: PDFAction, defaults: PDFConfig) {
    return {
      format: action.format ?? defaults.format,
      landscape: action.landscape ?? defaults.landscape,
      scale: action.scale ?? defaults.scale,
      margin: action.margin ?? defaults.margin,
    };
  }

  /**
   * Extract display configuration from action
   * @param action - PDF action
   * @param defaults - Default configuration
   * @returns Display configuration subset
   */
  private extractDisplayConfig(action: PDFAction, defaults: PDFConfig) {
    return {
      displayHeaderFooter: action.displayHeaderFooter ?? defaults.displayHeaderFooter,
      headerTemplate: action.headerTemplate ?? defaults.headerTemplate,
      footerTemplate: action.footerTemplate ?? defaults.footerTemplate,
      printBackground: action.printBackground ?? defaults.printBackground,
      preferCSSPageSize: action.preferCSSPageSize ?? defaults.preferCSSPageSize,
      pageRanges: action.pageRanges ?? defaults.pageRanges,
      timeout: action.timeout ?? defaults.timeout,
    };
  }

  /**
   * Extract PDF configuration from action
   * @param action - PDF action
   * @returns PDF configuration
   * @nist si-10 "Information input validation"
   */
  private extractConfig(action: PDFAction): PDFConfig {
    const defaults = this.getDefaultConfig();
    const layoutConfig = this.extractLayoutConfig(action, defaults);
    const displayConfig = this.extractDisplayConfig(action, defaults);

    return {
      ...layoutConfig,
      ...displayConfig,
    };
  }

  /**
   * Generate PDF from page
   * @param page - Page instance
   * @param config - PDF configuration
   * @returns PDF buffer
   * @nist ac-3 "Access enforcement"
   */
  private async generatePDF(page: Page, config: PDFConfig): Promise<Buffer> {
    return page.pdf({
      format: config.format,
      landscape: config.landscape,
      scale: config.scale,
      displayHeaderFooter: config.displayHeaderFooter,
      headerTemplate: config.headerTemplate,
      footerTemplate: config.footerTemplate,
      printBackground: config.printBackground,
      preferCSSPageSize: config.preferCSSPageSize,
      pageRanges: config.pageRanges,
      margin: config.margin,
      timeout: config.timeout,
    });
  }

  /**
   * Build successful PDF result
   * @param buffer - PDF buffer
   * @param config - PDF configuration
   * @param duration - Execution duration
   * @returns Action result
   * @nist au-3 "Content of audit records"
   */
  private buildSuccessResult(
    buffer: Buffer,
    config: PDFConfig,
    duration: number,
  ): ActionResult {
    const base64 = buffer.toString('base64');

    return {
      success: true,
      actionType: 'pdf',
      data: {
        pdf: base64,
        format: config.format,
        size: buffer.length,
        landscape: config.landscape,
        scale: config.scale,
      },
      duration,
      timestamp: new Date(),
      metadata: {
        displayHeaderFooter: config.displayHeaderFooter,
        printBackground: config.printBackground,
        preferCSSPageSize: config.preferCSSPageSize,
      },
    };
  }

  /**
   * Build error result
   * @param error - Error that occurred
   * @param action - Original action
   * @param duration - Execution duration
   * @returns Action result
   * @nist au-3 "Content of audit records"
   */
  private buildErrorResult(
    error: unknown,
    action: PDFAction,
    duration: number,
  ): ActionResult {
    const errorMessage = error instanceof Error ? error.message : 'PDF action failed';

    return {
      success: false,
      actionType: 'pdf',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        format: action.format,
        landscape: action.landscape,
        scale: action.scale,
      },
    };
  }

  /**
   * Execute PDF generation
   * @param action - PDF action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute(
    action: PDFAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing PDF action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        format: action.format,
        landscape: action.landscape,
        scale: action.scale,
      });

      const config = this.extractConfig(action);
      const buffer = await this.generatePDF(page, config);
      const duration = Date.now() - startTime;

      logger.info('PDF action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        format: config.format,
        size: buffer.length,
        duration,
      });

      return this.buildSuccessResult(buffer, config, duration);
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('PDF action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      return this.buildErrorResult(error, action, duration);
    }
  }
}