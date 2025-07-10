/**
 * File operation utilities
 * @module puppeteer/actions/execution/file/file-utils
 * @nist si-7 "Software, firmware, and information integrity"
 * @nist ac-3 "Access enforcement"
 */

import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '../../../../utils/logger.js';
import type { FileMetadata } from './file-executor-types.js';

const logger = createLogger('puppeteer:file-utils');

/**
 * Check if file exists
 * @param filePath - File path to check
 * @returns True if file exists
 * @nist si-7 "Software, firmware, and information integrity"
 */
export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size in bytes
 * @param filePath - File path
 * @returns File size in bytes or 0 if error
 * @nist si-7 "Software, firmware, and information integrity"
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    logger.warn('Failed to get file size', { filePath });
    return 0;
  }
}

/**
 * Get file metadata
 * @param filePath - File path
 * @returns File metadata
 * @nist si-7 "Software, firmware, and information integrity"
 */
export async function getFileMetadata(filePath: string): Promise<FileMetadata> {
  const absolutePath = path.resolve(filePath);
  const basename = path.basename(filePath);
  const extension = path.extname(filePath);

  try {
    const stats = await fs.stat(filePath);
    return {
      exists: true,
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      absolutePath,
      basename,
      extension,
    };
  } catch {
    return {
      exists: false,
      size: 0,
      isFile: false,
      isDirectory: false,
      absolutePath,
      basename,
      extension,
    };
  }
}

/**
 * Ensure directory exists
 * @param dirPath - Directory path
 * @nist ac-3 "Access enforcement"
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      logger.debug('Created directory', { dirPath });
    } catch {
      throw new Error(`Cannot create directory: ${dirPath}`);
    }
  }
}

/**
 * Check if path is safe (no traversal)
 * @param targetPath - Path to check
 * @param basePath - Base path to validate against
 * @returns True if path is safe
 * @nist ac-3 "Access enforcement"
 */
export function isPathSafe(targetPath: string, basePath: string = '.'): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(basePath);
  
  // Check if target path is within base path
  const isSafe = resolvedTarget.startsWith(resolvedBase);
  
  if (!isSafe) {
    logger.warn('Unsafe path detected', { 
      targetPath, 
      resolvedTarget, 
      basePath,
      resolvedBase 
    });
  }
  
  return isSafe;
}

/**
 * Sanitize filename for security
 * @param filename - Filename to sanitize
 * @returns Sanitized filename
 * @nist si-10 "Information input validation"
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and other dangerous characters
  return filename
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[<>:"|?*]/g, '_')
    .trim();
}

/**
 * Get MIME type from file extension
 * @param filePath - File path
 * @returns MIME type or 'application/octet-stream'
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = new Map<string, string>([
    ['.pdf', 'application/pdf'],
    ['.txt', 'text/plain'],
    ['.html', 'text/html'],
    ['.htm', 'text/html'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.gif', 'image/gif'],
    ['.svg', 'image/svg+xml'],
    ['.json', 'application/json'],
    ['.xml', 'application/xml'],
    ['.zip', 'application/zip'],
    ['.csv', 'text/csv'],
    ['.doc', 'application/msword'],
    ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['.xls', 'application/vnd.ms-excel'],
    ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ]);

  return mimeTypes.get(ext) ?? 'application/octet-stream';
}