/**
 * File path and operation validator
 * @module puppeteer/actions/execution/file/file-validator
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */

import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../../../utils/logger.js';
import type { FileValidationResult, FileMetadata } from './file-executor-types.js';
import { isPathSafe, getFileMetadata } from './file-utils.js';

const logger = createLogger('puppeteer:file-validator');

// Configuration constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES_PER_UPLOAD = 10;
const ALLOWED_UPLOAD_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.txt', '.csv', '.json', '.xml',
  '.zip', '.tar', '.gz'
];

/**
 * File path validator
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 */
export class FileValidator {
  private maxFileSize: number;
  private maxFilesPerUpload: number;
  private allowedExtensions: Set<string>;
  private basePath: string;

  constructor(options?: {
    maxFileSize?: number;
    maxFilesPerUpload?: number;
    allowedExtensions?: string[];
    basePath?: string;
  }) {
    this.maxFileSize = options?.maxFileSize ?? MAX_FILE_SIZE;
    this.maxFilesPerUpload = options?.maxFilesPerUpload ?? MAX_FILES_PER_UPLOAD;
    this.allowedExtensions = new Set(
      options?.allowedExtensions ?? ALLOWED_UPLOAD_EXTENSIONS
    );
    this.basePath = options?.basePath ?? '.';
  }

  /**
   * Validate file paths for upload
   * @param filePaths - Array of file paths to validate
   * @returns Validation results
   * @nist si-10 "Information input validation"
   */
  async validateUploadPaths(filePaths: string[]): Promise<FileValidationResult[]> {
    if (filePaths.length === 0) {
      return [{
        valid: false,
        error: 'At least one file path is required',
      }];
    }

    if (filePaths.length > this.maxFilesPerUpload) {
      return [{
        valid: false,
        error: `Too many files. Maximum allowed: ${this.maxFilesPerUpload}`,
      }];
    }

    const results = await Promise.all(
      filePaths.map(filePath => this.validateSingleUploadPath(filePath))
    );

    return results;
  }

  /**
   * Validate single file path for upload
   * @param filePath - File path to validate
   * @returns Validation result
   * @nist si-10 "Information input validation"
   */
  private async validateSingleUploadPath(filePath: string): Promise<FileValidationResult> {
    try {
      // Basic validation
      const basicValidation = this.validateBasicPath(filePath);
      if (!basicValidation.valid) {
        return basicValidation;
      }

      // Security check: prevent path traversal
      const securityValidation = this.validatePathSecurity(filePath);
      if (!securityValidation.valid) {
        return securityValidation;
      }

      // Get file metadata and validate
      const metadata = await getFileMetadata(filePath);
      return this.validateFileMetadata(filePath, metadata);

    } catch {
      const errorMessage = 'File validation failed';
      logger.error('File validation error', { filePath, error: errorMessage });
      
      return { 
        valid: false, 
        error: errorMessage,
      };
    }
  }

  /**
   * Validate basic path requirements
   * @param filePath - File path to validate
   * @returns Validation result
   */
  private validateBasicPath(filePath: string): FileValidationResult {
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, error: 'Invalid file path' };
    }
    return { valid: true };
  }

  /**
   * Validate path security
   * @param filePath - File path to validate
   * @returns Validation result
   */
  private validatePathSecurity(filePath: string): FileValidationResult {
    if (!isPathSafe(filePath, this.basePath)) {
      return { 
        valid: false, 
        error: 'File path outside allowed directory',
      };
    }
    return { valid: true };
  }

  /**
   * Validate file metadata
   * @param filePath - File path
   * @param metadata - File metadata
   * @returns Validation result
   */
  private validateFileMetadata(filePath: string, metadata: FileMetadata): FileValidationResult {
    if (!metadata.exists) {
      return { 
        valid: false, 
        error: `File not found: ${filePath}`,
        metadata,
      };
    }

    if (!metadata.isFile) {
      return { 
        valid: false, 
        error: `Path is not a file: ${filePath}`,
        metadata,
      };
    }

    const sizeValidation = this.validateFileSize(metadata);
    if (!sizeValidation.valid) {
      return { ...sizeValidation, metadata };
    }

    const extensionValidation = this.validateFileExtension(metadata);
    if (!extensionValidation.valid) {
      return { ...extensionValidation, metadata };
    }

    logger.debug('File validation passed', { 
      filePath, 
      size: metadata.size,
      extension: metadata.extension,
    });

    return { 
      valid: true,
      metadata,
    };
  }

  /**
   * Validate file size
   * @param metadata - File metadata
   * @returns Validation result
   */
  private validateFileSize(metadata: FileMetadata): FileValidationResult {
    if (metadata.size > this.maxFileSize) {
      return { 
        valid: false, 
        error: `File too large (${Math.round(metadata.size / 1024 / 1024)}MB). Maximum: ${Math.round(this.maxFileSize / 1024 / 1024)}MB`,
      };
    }
    return { valid: true };
  }

  /**
   * Validate file extension
   * @param metadata - File metadata
   * @returns Validation result
   */
  private validateFileExtension(metadata: FileMetadata): FileValidationResult {
    if (this.allowedExtensions.size > 0 && !this.allowedExtensions.has(metadata.extension.toLowerCase())) {
      return { 
        valid: false, 
        error: `File type not allowed: ${metadata.extension}`,
      };
    }
    return { valid: true };
  }

  /**
   * Validate download path
   * @param downloadPath - Download path to validate
   * @returns Validation result
   * @nist si-10 "Information input validation"
   * @nist ac-3 "Access enforcement"
   */
  async validateDownloadPath(downloadPath: string): Promise<FileValidationResult> {
    try {
      // Basic validation
      if (!downloadPath || typeof downloadPath !== 'string') {
        return { valid: false, error: 'Invalid download path' };
      }

      // Security check: prevent path traversal
      if (!isPathSafe(downloadPath, this.basePath)) {
        return { 
          valid: false, 
          error: 'Download path outside allowed directory',
        };
      }

      const downloadDir = path.dirname(downloadPath);
      const dirMetadata = await getFileMetadata(downloadDir);

      // Check if directory exists or can be created
      if (!dirMetadata.exists) {
        try {
          await fs.mkdir(downloadDir, { recursive: true });
          logger.debug('Created download directory', { downloadDir });
        } catch {
          return { 
            valid: false, 
            error: `Cannot create download directory: ${downloadDir}`,
          };
        }
      } else if (!dirMetadata.isDirectory) {
        return { 
          valid: false, 
          error: `Download directory path is not a directory: ${downloadDir}`,
        };
      }

      return { 
        valid: true,
        metadata: {
          absolutePath: path.resolve(downloadPath),
        },
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download path validation failed';
      logger.error('Download path validation error', { downloadPath, error: errorMessage });
      
      return { 
        valid: false, 
        error: errorMessage,
      };
    }
  }

  /**
   * Update configuration
   * @param options - New configuration options
   */
  updateConfig(options: {
    maxFileSize?: number;
    maxFilesPerUpload?: number;
    allowedExtensions?: string[];
    basePath?: string;
  }): void {
    if (options.maxFileSize !== undefined) {
      this.maxFileSize = options.maxFileSize;
    }
    if (options.maxFilesPerUpload !== undefined) {
      this.maxFilesPerUpload = options.maxFilesPerUpload;
    }
    if (options.allowedExtensions !== undefined) {
      this.allowedExtensions = new Set(options.allowedExtensions);
    }
    if (options.basePath !== undefined) {
      this.basePath = options.basePath;
    }
  }

  /**
   * Get current configuration
   * @returns Current validator configuration
   */
  getConfig(): {
    maxFileSize: number;
    maxFilesPerUpload: number;
    allowedExtensions: string[];
    basePath: string;
  } {
    return {
      maxFileSize: this.maxFileSize,
      maxFilesPerUpload: this.maxFilesPerUpload,
      allowedExtensions: Array.from(this.allowedExtensions),
      basePath: this.basePath,
    };
  }
}