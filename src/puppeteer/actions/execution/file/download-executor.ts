/**
 * File download operations executor
 * @module puppeteer/actions/execution/file/download-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-7 "Software, firmware, and information integrity"
 */

import type { Page, HTTPResponse } from 'puppeteer';
import path from 'path';
import type {
  ActionResult,
  ActionContext,
  BrowserAction,
} from '../../../interfaces/action-executor.interface.js';
import type { FileOperationExecutor, DownloadOperationResult, FileValidationResult } from './file-executor-types.js';
import { createLogger } from '../../../../utils/logger.js';
import { FileValidator } from './file-validator.js';
import { checkFileExists, getFileSize, ensureDirectory } from './file-utils.js';

const logger = createLogger('puppeteer:download-executor');

interface DownloadAction extends BrowserAction {
  type: 'download';
  url: string;
  downloadPath: string;
  timeout?: number;
  waitForDownload?: boolean;
}

/**
 * Download operation executor
 * @nist ac-3 "Access enforcement"
 * @nist si-7 "Software, firmware, and information integrity"
 */
export class DownloadExecutor implements FileOperationExecutor {
  private readonly validator: FileValidator;
  private readonly downloadTimeout: number;

  constructor(
    validator?: FileValidator,
    downloadTimeout: number = 30000,
  ) {
    this.validator = validator ?? new FileValidator();
    this.downloadTimeout = downloadTimeout;
  }

  /**
   * Get supported action type
   * @returns Action type identifier
   */
  getSupportedType(): string {
    return 'download';
  }

  /**
   * Execute file download action
   * @param action - Download action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute(
    action: BrowserAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult> {
    const downloadAction = action as DownloadAction;
    const startTime = Date.now();

    try {
      logger.debug('Executing download action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        url: downloadAction.url,
        downloadPath: downloadAction.downloadPath,
      });

      const { validationResult, response, fileExists, fileSize } = await this.performDownload(
        page,
        downloadAction,
      );

      const duration = Date.now() - startTime;

      logger.info('Download action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        url: downloadAction.url,
        downloadPath: downloadAction.downloadPath,
        fileExists,
        fileSize,
        duration,
      });

      return this.createSuccessResult({
        downloadAction,
        response,
        fileExists,
        fileSize,
        duration,
        validationResult,
      });
    } catch (error) {
      return this.createErrorResult(downloadAction, error, Date.now() - startTime, context);
    }
  }

  /**
   * Perform the download operation
   * @param page - Page instance
   * @param downloadAction - Download action
   * @returns Download results
   */
  private async performDownload(
    page: Page,
    downloadAction: DownloadAction,
  ): Promise<DownloadOperationResult> {
    // Validate download path
    const validationResult = await this.validator.validateDownloadPath(
      downloadAction.downloadPath
    );
    
    if (!validationResult.valid) {
      throw new Error(validationResult.error ?? 'Download path validation failed');
    }

    // Ensure download directory exists
    await ensureDirectory(path.dirname(downloadAction.downloadPath));

    // Set up download behavior
    await this.setupDownloadBehavior(page, downloadAction.downloadPath);

    // Navigate to download URL or trigger download
    const response = await this.triggerDownload(
      page,
      downloadAction.url,
      downloadAction.timeout ?? this.downloadTimeout,
    );

    // Wait for download to complete
    const fileExists = await this.waitForDownload(
      downloadAction.downloadPath,
      downloadAction.waitForDownload ?? true,
    );

    const fileSize = fileExists ? await getFileSize(downloadAction.downloadPath) : 0;

    return { validationResult, response, fileExists, fileSize };
  }

  /**
   * Create success result
   * @param params - Success result parameters
   * @returns Action result
   */
  private createSuccessResult(params: {
    downloadAction: DownloadAction;
    response: HTTPResponse | null;
    fileExists: boolean;
    fileSize: number;
    duration: number;
    validationResult: FileValidationResult;
  }): ActionResult {
    const { downloadAction, response, fileExists, fileSize, duration, validationResult } = params;
    return {
      success: fileExists,
      actionType: 'download',
      data: {
        url: downloadAction.url,
        downloadPath: downloadAction.downloadPath,
        fileSize,
        statusCode: response?.status(),
        downloaded: fileExists,
      },
      duration,
      timestamp: new Date(),
      metadata: {
        responseHeaders: response?.headers(),
        absolutePath: validationResult.metadata?.absolutePath,
      },
    };
  }

  /**
   * Create error result
   * @param downloadAction - Download action
   * @param error - Error that occurred
   * @param duration - Duration
   * @param context - Action context
   * @returns Action result
   */
  private createErrorResult(
    downloadAction: DownloadAction,
    error: unknown,
    duration: number,
    context: ActionContext,
  ): ActionResult {
    const errorMessage = error instanceof Error ? error.message : 'Download action failed';

    logger.error('Download action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      url: downloadAction.url,
      downloadPath: downloadAction.downloadPath,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'download',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        url: downloadAction.url,
        downloadPath: downloadAction.downloadPath,
      },
    };
  }

  /**
   * Set up download behavior in browser
   * @param page - Page instance
   * @param downloadPath - Path to save downloads
   * @nist ac-3 "Access enforcement"
   */
  private async setupDownloadBehavior(
    page: Page,
    downloadPath: string,
  ): Promise<void> {
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: path.dirname(downloadPath),
    });

    logger.debug('Download behavior configured', {
      downloadDir: path.dirname(downloadPath),
    });
  }

  /**
   * Trigger file download
   * @param page - Page instance
   * @param url - Download URL
   * @param timeout - Navigation timeout
   * @returns HTTP response
   */
  private async triggerDownload(
    page: Page,
    url: string,
    timeout: number,
  ): Promise<HTTPResponse | null> {
    try {
      const response = await page.goto(url, {
        timeout,
        waitUntil: 'networkidle0',
      });

      logger.debug('Download triggered', {
        url,
        status: response?.status(),
        contentType: response?.headers()['content-type'],
      });

      return response;
    } catch (error) {
      logger.error('Failed to trigger download', { url, error });
      throw error;
    }
  }

  /**
   * Wait for download to complete
   * @param downloadPath - Expected download path
   * @param waitForDownload - Whether to wait for file
   * @returns True if file exists
   */
  private async waitForDownload(
    downloadPath: string,
    waitForDownload: boolean,
  ): Promise<boolean> {
    if (!waitForDownload) {
      return checkFileExists(downloadPath);
    }

    const maxWaitTime = 10000; // 10 seconds
    const checkInterval = 500; // 500ms
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const exists = await checkFileExists(downloadPath);
      if (exists) {
        // Wait a bit more to ensure file is fully written
        await this.delay(500);
        return true;
      }
      await this.delay(checkInterval);
    }

    logger.warn('Download wait timeout', {
      downloadPath,
      waitTime: Date.now() - startTime,
    });

    return checkFileExists(downloadPath);
  }

  /**
   * Delay execution
   * @param ms - Milliseconds to delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  /**
   * Get validator instance
   * @returns File validator
   */
  getValidator(): FileValidator {
    return this.validator;
  }

  /**
   * Update download timeout
   * @param timeout - New timeout in milliseconds
   */
  setDownloadTimeout(timeout: number): void {
    this.downloadTimeout = timeout;
  }
}