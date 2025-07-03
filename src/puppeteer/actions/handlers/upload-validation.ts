/**
 * File upload validation utilities
 * @module puppeteer/actions/handlers/upload-validation
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import { promises as fs } from 'fs';
import { extname, basename } from 'path';
import type { ActionContext } from '../../interfaces/action-executor.interface.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('puppeteer:upload-validation');

/**
 * Allowed file extensions for security
 * @nist si-10 "Information input validation"
 */
export const ALLOWED_EXTENSIONS = [
  '.txt', '.csv', '.json', '.xml', '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
  '.mp3', '.mp4', '.avi', '.mov', '.wav', '.zip', '.tar', '.gz', '.rar'
];

/**
 * Maximum file size (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * MIME type mapping
 */
const MIME_TYPES: Record<string, string> = {
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

/**
 * Validated file information
 */
export interface ValidatedFile {
  path: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Get MIME type from file extension
 * @param extension - File extension
 * @returns MIME type
 */
export function getMimeType(extension: string): string {
  // eslint-disable-next-line security/detect-object-injection
  return MIME_TYPES[extension] ?? 'application/octet-stream';
}

/**
 * Validate file paths for security and accessibility
 * @param filePaths - Array of file paths to validate
 * @param context - Action execution context
 * @returns Array of validated file information
 * @nist si-10 "Information input validation"
 */
export async function validateFilePaths(
  filePaths: string[],
  context: ActionContext
): Promise<ValidatedFile[]> {
  const validatedFiles: ValidatedFile[] = [];

  for (const filePath of filePaths) {
    // Validate file path security
    if (filePath.includes('..') || filePath.includes('./')) {
      throw new Error(`Invalid file path: ${filePath}`);
    }

    // Check if file exists and get stats
    let stats;
    try {
      // Security: File path is validated above
      // eslint-disable-next-line security/detect-non-literal-fs-filename
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