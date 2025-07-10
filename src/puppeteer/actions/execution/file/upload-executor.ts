/**
 * File upload operations executor
 * @module puppeteer/actions/execution/file/upload-executor
 * @nist ac-3 "Access enforcement"
 * @nist si-7 "Software, firmware, and information integrity"
 */

import type { Page } from 'puppeteer';
import path from 'path';
import type {
  ActionResult,
  ActionContext,
  UploadAction,
} from '../../../interfaces/action-executor.interface.js';
import type { FileUploadConfig } from '../types.js';
import type { FileOperationExecutor } from './file-executor-types.js';
import { DEFAULT_CONFIG } from '../types.js';
import { sanitizeSelector } from '../../validation.js';
import { createLogger } from '../../../../utils/logger.js';
import { FileValidator } from './file-validator.js';

const logger = createLogger('puppeteer:upload-executor');

/**
 * Upload operation executor
 * @nist ac-3 "Access enforcement"
 * @nist si-7 "Software, firmware, and information integrity"
 */
export class UploadExecutor implements FileOperationExecutor {
  private readonly validator: FileValidator;

  constructor(validator?: FileValidator) {
    this.validator = validator ?? new FileValidator();
  }

  /**
   * Get supported action type
   * @returns Action type identifier
   */
  getSupportedType(): string {
    return 'upload';
  }

  /**
   * Execute file upload action
   * @param action - Upload action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async execute(
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
      const validationResults = await this.validator.validateUploadPaths(config.filePaths);
      const invalidResults = validationResults.filter(r => !r.valid);
      
      if (invalidResults.length > 0) {
        const errors = invalidResults.map(r => r.error).join('; ');
        throw new Error(`File validation failed: ${errors}`);
      }

      // Wait for file input element
      await page.waitForSelector(config.selector, {
        timeout: action.timeout ?? DEFAULT_CONFIG.TIMEOUT.element,
      });

      // Validate element is a file input
      await this.validateFileInputElement(page, config);

      // Upload files
      const uploadedFileNames = await this.performUpload(page, config);

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
   * Validate file input element
   * @param page - Page instance
   * @param config - Upload configuration
   * @nist si-10 "Information input validation"
   */
  private async validateFileInputElement(
    page: Page,
    config: FileUploadConfig,
  ): Promise<void> {
    // Check if element is a file input
    const isFileInput = await page.$eval(config.selector, (element) => {
      return element instanceof HTMLInputElement && element.type === 'file';
    });

    if (!isFileInput) {
      throw new Error('Selected element is not a file input');
    }

    // Check if multiple files are allowed
    if (config.multiple === true) {
      const allowsMultiple = await page.$eval(config.selector, (element) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return element instanceof HTMLInputElement && element.hasAttribute('multiple');
      }) as boolean;

      if (!allowsMultiple && config.filePaths.length > 1) {
        throw new Error('File input does not allow multiple files');
      }
    }
  }

  /**
   * Perform file upload
   * @param page - Page instance
   * @param config - Upload configuration
   * @returns Array of uploaded file names
   */
  private async performUpload(
    page: Page,
    config: FileUploadConfig,
  ): Promise<string[]> {
    const fileInput = await page.$(config.selector);
    if (!fileInput) {
      throw new Error(`File input not found: ${config.selector}`);
    }

    await (fileInput as any).uploadFile(...config.filePaths);

    // Verify upload by checking the files property
    const uploadedFileNames = await page.$eval(config.selector, (element) => {
      if (element instanceof HTMLInputElement && element.files !== null) {
        return Array.from(element.files).map((file: File) => file.name);
      }
      return [];
    });

    // Verify all files were uploaded
    if (uploadedFileNames.length !== config.filePaths.length) {
      logger.warn('Not all files were uploaded', {
        requested: config.filePaths.length,
        uploaded: uploadedFileNames.length,
      });
    }

    return uploadedFileNames;
  }

  /**
   * Get validator instance
   * @returns File validator
   */
  getValidator(): FileValidator {
    return this.validator;
  }
}