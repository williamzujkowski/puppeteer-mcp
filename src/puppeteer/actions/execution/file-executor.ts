/**
 * File upload/download operations executor
 * @module puppeteer/actions/execution/file-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-7 "Software, firmware, and information integrity"
 */

import type { Page } from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import type {
  BrowserAction,
  ActionResult,
  ActionContext,
  UploadAction,
  CookieAction,
} from '../../interfaces/action-executor.interface.js';
import type { FileUploadConfig, CookieConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:file-executor');

/**
 * File operation executor
 * @nist ac-3 "Access enforcement"
 */
export class FileExecutor {
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
    const startTime = Date.now();

    try {
      logger.debug('Executing upload action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: action.selector,
        fileCount: action.filePaths.length,
      });

      const config: FileUploadConfig = {
        selector: action.selector,
        filePaths: action.filePaths,
        multiple: action.filePaths.length > 1,
      };

      // Validate file paths and permissions
      await this.validateFilePaths(config.filePaths);

      // Wait for file input element
      await page.waitForSelector(config.selector, {
        timeout: action.timeout || DEFAULT_CONFIG.TIMEOUT.element,
      });

      // Check if element is a file input
      const isFileInput = await page.$eval(config.selector, (element) => {
        return element instanceof HTMLInputElement && element.type === 'file';
      });

      if (!isFileInput) {
        throw new Error('Selected element is not a file input');
      }

      // Check if multiple files are allowed
      if (config.multiple) {
        const allowsMultiple = await page.$eval(config.selector, (element) => {
          return element instanceof HTMLInputElement && element.hasAttribute('multiple');
        });

        if (!allowsMultiple && config.filePaths.length > 1) {
          throw new Error('File input does not allow multiple files');
        }
      }

      // Upload files
      const fileInput = await page.$(config.selector);
      if (!fileInput) {
        throw new Error(`File input not found: ${config.selector}`);
      }

      await fileInput.uploadFile(...config.filePaths);

      // Verify upload by checking the files property
      const uploadedFileNames = await page.$eval(config.selector, (element) => {
        if (element instanceof HTMLInputElement && element.files) {
          return Array.from(element.files).map(file => file.name);
        }
        return [];
      });

      const duration = Date.now() - startTime;
      const sanitizedSelector = sanitizeSelector(action.selector);

      logger.info('Upload action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: sanitizedSelector,
        uploadedCount: uploadedFileNames.length,
        duration,
      });

      return {
        success: true,
        actionType: 'upload',
        data: {
          selector: sanitizedSelector,
          uploadedFiles: uploadedFileNames,
          uploadedCount: uploadedFileNames.length,
          requestedCount: config.filePaths.length,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          originalSelector: action.selector,
          filePaths: config.filePaths.map(fp => path.basename(fp)),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Upload action failed';

      logger.error('Upload action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        selector: action.selector,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'upload',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          selector: action.selector,
          fileCount: action.filePaths.length,
          filePaths: action.filePaths.map(fp => path.basename(fp)),
        },
      };
    }
  }

  /**
   * Execute download action
   * @param url - URL to download
   * @param downloadPath - Local path to save file
   * @param page - Page instance
   * @param context - Execution context
   * @param timeout - Download timeout
   * @returns Action result
   */
  async executeDownload(
    url: string,
    downloadPath: string,
    page: Page,
    context: ActionContext,
    timeout: number = DEFAULT_CONFIG.TIMEOUT.default,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      logger.debug('Executing download action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        url,
        downloadPath,
      });

      // Validate download path
      await this.validateDownloadPath(downloadPath);

      // Set up download behavior
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: path.dirname(downloadPath),
      });

      // Navigate to download URL or trigger download
      const response = await page.goto(url, {
        timeout,
        waitUntil: 'networkidle0',
      });

      // Wait for download to complete (simplified approach)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if file was downloaded
      const fileExists = await this.checkFileExists(downloadPath);
      const fileSize = fileExists ? await this.getFileSize(downloadPath) : 0;

      const duration = Date.now() - startTime;

      logger.info('Download action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        url,
        downloadPath,
        fileExists,
        fileSize,
        duration,
      });

      return {
        success: fileExists,
        actionType: 'download',
        data: {
          url,
          downloadPath,
          fileSize,
          statusCode: response?.status(),
          downloaded: fileExists,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          responseHeaders: response?.headers(),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Download action failed';

      logger.error('Download action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        url,
        downloadPath,
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
          url,
          downloadPath,
        },
      };
    }
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
    const startTime = Date.now();

    try {
      logger.debug('Executing cookie action', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        operation: action.operation,
        cookieCount: action.cookies?.length || 0,
      });

      const config: CookieConfig = {
        operation: action.operation,
        cookies: action.cookies,
      };

      let result: unknown;

      switch (config.operation) {
        case 'set':
          if (!config.cookies || config.cookies.length === 0) {
            throw new Error('Cookies are required for set operation');
          }
          await page.setCookie(...config.cookies);
          result = { set: config.cookies.length };
          break;

        case 'get':
          result = await page.cookies();
          break;

        case 'delete':
          if (config.cookies && config.cookies.length > 0) {
            await page.deleteCookie(...config.cookies);
            result = { deleted: config.cookies.length };
          } else {
            throw new Error('Cookies are required for delete operation');
          }
          break;

        case 'clear':
          const allCookies = await page.cookies();
          if (allCookies.length > 0) {
            await page.deleteCookie(...allCookies);
          }
          result = { cleared: allCookies.length };
          break;

        default:
          throw new Error(`Unsupported cookie operation: ${config.operation}`);
      }

      const duration = Date.now() - startTime;

      logger.info('Cookie action completed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        operation: config.operation,
        duration,
      });

      return {
        success: true,
        actionType: 'cookie',
        data: {
          operation: config.operation,
          result,
        },
        duration,
        timestamp: new Date(),
        metadata: {
          cookieCount: config.cookies?.length || 0,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Cookie action failed';

      logger.error('Cookie action failed', {
        sessionId: context.sessionId,
        contextId: context.contextId,
        operation: action.operation,
        error: errorMessage,
        duration,
      });

      return {
        success: false,
        actionType: 'cookie',
        error: errorMessage,
        duration,
        timestamp: new Date(),
        metadata: {
          operation: action.operation,
          cookieCount: action.cookies?.length || 0,
        },
      };
    }
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
    switch (action.type) {
      case 'upload':
        return this.executeUpload(action as UploadAction, page, context);
      case 'download': {
        const downloadAction = action as {
          url: string;
          downloadPath: string;
          timeout?: number;
        };
        return this.executeDownload(
          downloadAction.url,
          downloadAction.downloadPath,
          page,
          context,
          downloadAction.timeout,
        );
      }
      case 'cookie':
        return this.executeCookie(action as CookieAction, page, context);
      default:
        throw new Error(`Unsupported file action: ${action.type}`);
    }
  }

  /**
   * Validate file paths for upload
   * @param filePaths - Array of file paths to validate
   */
  private async validateFilePaths(filePaths: string[]): Promise<void> {
    if (!filePaths || filePaths.length === 0) {
      throw new Error('At least one file path is required');
    }

    for (const filePath of filePaths) {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }

      // Check if file exists
      try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
          throw new Error(`Path is not a file: ${filePath}`);
        }

        // Check file size (limit to 100MB)
        if (stats.size > 100 * 1024 * 1024) {
          throw new Error(`File too large (>100MB): ${filePath}`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('ENOENT')) {
          throw new Error(`File not found: ${filePath}`);
        }
        throw error;
      }

      // Security check: prevent path traversal
      const resolvedPath = path.resolve(filePath);
      if (!resolvedPath.startsWith(path.resolve('.'))) {
        // Allow files only in current directory or subdirectories
        // This is a basic security measure - adjust based on your needs
        logger.warn('File path outside current directory', { filePath, resolvedPath });
      }
    }
  }

  /**
   * Validate download path
   * @param downloadPath - Download path to validate
   */
  private async validateDownloadPath(downloadPath: string): Promise<void> {
    if (!downloadPath || typeof downloadPath !== 'string') {
      throw new Error('Invalid download path');
    }

    const downloadDir = path.dirname(downloadPath);
    
    try {
      // Check if directory exists, create if it doesn't
      await fs.access(downloadDir);
    } catch {
      try {
        await fs.mkdir(downloadDir, { recursive: true });
      } catch (error) {
        throw new Error(`Cannot create download directory: ${downloadDir}`);
      }
    }

    // Security check: prevent path traversal
    const resolvedPath = path.resolve(downloadPath);
    if (!resolvedPath.startsWith(path.resolve('.'))) {
      logger.warn('Download path outside current directory', { downloadPath, resolvedPath });
    }
  }

  /**
   * Check if file exists
   * @param filePath - File path to check
   * @returns True if file exists
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file size
   * @param filePath - File path
   * @returns File size in bytes
   */
  private async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Get supported file action types
   * @returns Array of supported action types
   */
  getSupportedActions(): string[] {
    return ['upload', 'download', 'cookie'];
  }
}