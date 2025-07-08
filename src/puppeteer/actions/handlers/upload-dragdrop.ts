/**
 * Drag and drop file upload handler
 * @module puppeteer/actions/handlers/upload-dragdrop
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import { promises as fs } from 'fs';
import type { Page } from 'puppeteer';
import type { ActionResult, ActionContext } from '../../interfaces/action-executor.interface.js';
import type { BrowserWindow } from '../../types/browser-context.js';
import { sanitizeSelector } from '../validation.js';
import { validateFilePaths } from './upload-validation.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:upload-dragdrop');

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
  context: ActionContext,
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
    const fileData = await prepareFileData(validatedFiles);

    // Simulate drag and drop using JavaScript
    await simulateDragDrop(page, sanitizedSelector, fileData);

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
        uploadedFiles: validatedFiles.map((f) => ({
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
 * Prepare file data for drag and drop
 */

async function prepareFileData(
  validatedFiles: Array<{ path: string; name: string; type: string }>,
): Promise<Array<{ name: string; type: string; content: number[] }>> {
  return Promise.all(
    validatedFiles.map(async (file) => {
      // Security: File path is validated by validateFilePaths

      const content = await fs.readFile(file.path);
      return {
        name: file.name,
        type: file.type,
        content: Array.from(content),
      };
    }),
  );
}

/**
 * Simulate drag and drop in the browser
 */
async function simulateDragDrop(
  page: Page,
  selector: string,
  fileData: Array<{ name: string; type: string; content: number[] }>,
): Promise<void> {
  await page.evaluate(
    (dropSelector: string, files: typeof fileData) => {
      const doc = (globalThis as unknown as BrowserWindow).document;
      const dropZone = doc.querySelector(dropSelector);
      if (dropZone === null) {
        throw new Error('Drop zone not found');
      }

      // Create file list
      const fileList = files.map((fileData) => {
        const uint8Array = new Uint8Array(fileData.content);
        const FileConstructor = (globalThis as unknown as BrowserWindow).File;
        const file = new FileConstructor([uint8Array], fileData.name, {
          type: fileData.type,
        });
        return file;
      });

      // Create data transfer object
      const DataTransferConstructor = (globalThis as unknown as BrowserWindow).DataTransfer;
      const dataTransfer = new DataTransferConstructor();
      fileList.forEach((file) => {
        void dataTransfer.items.add(file);
      });

      // Create and dispatch drop event
      const DragEventConstructor = (globalThis as unknown as BrowserWindow).DragEvent;
      const dropEvent = new DragEventConstructor('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });

      (dropZone as unknown as { dispatchEvent: (event: unknown) => void }).dispatchEvent(dropEvent);
    },
    selector,
    fileData,
  );
}
