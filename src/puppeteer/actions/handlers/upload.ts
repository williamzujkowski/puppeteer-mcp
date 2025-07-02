/**
 * File upload action handlers for browser automation
 * @module puppeteer/actions/handlers/upload
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { Page } from 'puppeteer';
import type { 
  UploadAction,
  ActionResult, 
  ActionContext 
} from '../../interfaces/action-executor.interface.js';
import { sanitizeSelector } from '../validation.js';
import { validateFilePaths } from './upload-validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:upload');

/**
 * Handle file upload action
 * @param action - Upload action
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */
export async function handleUpload(
  action: UploadAction,
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing upload action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      selector: action.selector,
      fileCount: action.filePaths.length,
    });

    // Sanitize selector for security
    const sanitizedSelector = sanitizeSelector(action.selector);

    // Validate file paths
    const validatedFiles = await validateFilePaths(action.filePaths, context);

    // Wait for file input element
    await page.waitForSelector(sanitizedSelector, {
      timeout: action.timeout ?? 30000,
    });

    // Verify element is a file input
    const isFileInput = await page.$eval(sanitizedSelector, (el: any) => {
      return el.tagName === 'INPUT' && el.type === 'file';
    });

    if (!isFileInput) {
      throw new Error('Element is not a file input');
    }

    // Upload files
    const fileInputElement = await page.$(sanitizedSelector);
    if (!fileInputElement) {
      throw new Error(`File input element not found: ${sanitizedSelector}`);
    }

    await fileInputElement.uploadFile(...validatedFiles.map(f => f.path));

    const duration = Date.now() - startTime;

    logger.info('Upload action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
      selector: sanitizedSelector,
      uploadedFiles: validatedFiles.length,
      duration,
    });

    return {
      success: true,
      actionType: 'upload',
      data: {
        selector: sanitizedSelector,
        uploadedFiles: validatedFiles.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type,
        })),
        totalSize: validatedFiles.reduce((sum, f) => sum + f.size, 0),
      },
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: action.selector,
        originalFilePaths: action.filePaths,
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';

    logger.error('Upload action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      pageId: action.pageId,
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
        originalSelector: action.selector,
        originalFilePaths: action.filePaths,
      },
    };
  }
}

// Re-export drag and drop handler from separate module
export { handleDragDropUpload } from './upload-dragdrop.js';