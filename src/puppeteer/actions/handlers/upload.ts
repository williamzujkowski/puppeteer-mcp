/**
 * File upload action handlers for browser automation
 * @module puppeteer/actions/handlers/upload
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import { promises as fs } from 'fs';
import { extname, basename } from 'path';
import type { Page } from 'puppeteer';
import type { 
  UploadAction,
  ActionResult, 
  ActionContext 
} from '../../interfaces/action-executor.interface.js';
import { sanitizeSelector } from '../validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:upload');

/**
 * Allowed file extensions for security
 * @nist si-10 "Information input validation"
 */
const ALLOWED_EXTENSIONS = [
  '.txt', '.csv', '.json', '.xml', '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.zip', '.tar', '.gz', '.rar'
];

/**
 * Maximum file size (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

/**
 * Handle drag and drop file upload
 * @param filePaths - Array of file paths to upload
 * @param selector - Target drop zone selector
 * @param page - Puppeteer page instance
 * @param context - Action execution context
 * @returns Action result
 */
export async function handleDragDropUpload(
  filePaths: string[],
  selector: string,
  page: Page,
  context: ActionContext
): Promise<ActionResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Executing drag and drop upload action', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector,
      fileCount: filePaths.length,
    });

    const sanitizedSelector = sanitizeSelector(selector);
    const validatedFiles = await validateFilePaths(filePaths, context);

    // Wait for drop zone element
    await page.waitForSelector(sanitizedSelector, {
      timeout: 30000,
      visible: true,
    });

    // Create file objects for drag and drop
    const fileData = await Promise.all(
      validatedFiles.map(async (file) => {
        const content = await fs.readFile(file.path);
        return {
          name: file.name,
          type: file.type,
          content: Array.from(content),
        };
      })
    );

    // Simulate drag and drop using JavaScript
    await page.evaluate(
      (dropSelector: string, files: typeof fileData) => {
        const doc = (globalThis as any).document;
        const dropZone = doc.querySelector(dropSelector);
        if (!dropZone) {
          throw new Error('Drop zone not found');
        }

        // Create file list
        const fileList = files.map(fileData => {
          const uint8Array = new Uint8Array(fileData.content);
          const file = new File([uint8Array], fileData.name, {
            type: fileData.type,
          });
          return file;
        });

        // Create data transfer object
        const DataTransfer = (globalThis as any).DataTransfer;
        const dataTransfer = new DataTransfer();
        fileList.forEach((file: any) => dataTransfer.items.add(file));

        // Create and dispatch drop event
        const DragEvent = (globalThis as any).DragEvent;
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        });

        dropZone.dispatchEvent(dropEvent);
      },
      sanitizedSelector,
      fileData
    );

    const duration = Date.now() - startTime;

    logger.info('Drag and drop upload action completed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector: sanitizedSelector,
      uploadedFiles: validatedFiles.length,
      duration,
    });

    return {
      success: true,
      actionType: 'dragDropUpload',
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
        originalSelector: selector,
        originalFilePaths: filePaths,
      },
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown drag drop upload error';

    logger.error('Drag and drop upload action failed', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      selector,
      error: errorMessage,
      duration,
    });

    return {
      success: false,
      actionType: 'dragDropUpload',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      metadata: {
        originalSelector: selector,
        originalFilePaths: filePaths,
      },
    };
  }
}

/**
 * Validate file paths for security and accessibility
 * @param filePaths - Array of file paths to validate
 * @param context - Action execution context
 * @returns Array of validated file information
 * @nist si-10 "Information input validation"
 */
async function validateFilePaths(
  filePaths: string[],
  context: ActionContext
): Promise<Array<{
  path: string;
  name: string;
  size: number;
  type: string;
}>> {
  const validatedFiles: Array<{
    path: string;
    name: string;
    size: number;
    type: string;
  }> = [];

  for (const filePath of filePaths) {
    // Validate file path security
    if (filePath.includes('..') || filePath.includes('./')) {
      throw new Error(`Invalid file path: ${filePath}`);
    }

    // Check if file exists and get stats
    let stats;
    try {
      stats = await fs.stat(filePath);
    } catch (error) {
      throw new Error(`File not found or not accessible: ${filePath}`);
    }

    // Check if it's a file (not directory)
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    // Check file size
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${filePath} (${stats.size} bytes, max ${MAX_FILE_SIZE})`);
    }

    // Check file extension
    const extension = extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new Error(`File type not allowed: ${extension}`);
    }

    // Get file name and MIME type
    const fileName = basename(filePath);
    const mimeType = getMimeType(extension);

    validatedFiles.push({
      path: filePath,
      name: fileName,
      size: stats.size,
      type: mimeType,
    });

    logger.info('File validated for upload', {
      sessionId: context.sessionId,
      contextId: context.contextId,
      filePath,
      fileName,
      fileSize: stats.size,
      mimeType,
    });
  }

  // Check total size
  const totalSize = validatedFiles.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_FILE_SIZE * 5) { // Max 50MB total
    throw new Error('Total file size too large');
  }

  return validatedFiles;
}

/**
 * Get MIME type from file extension
 * @param extension - File extension
 * @returns MIME type
 */
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wav': 'audio/wav',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.rar': 'application/vnd.rar',
  };

  return mimeTypes[extension] ?? 'application/octet-stream';
}