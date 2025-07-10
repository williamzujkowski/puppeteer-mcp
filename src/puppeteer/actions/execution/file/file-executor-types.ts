/**
 * File executor specific types and interfaces
 * @module puppeteer/actions/execution/file/file-executor-types
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import type { Page } from 'puppeteer';
import type {
  ActionResult,
  ActionContext,
  BrowserAction,
} from '../../../interfaces/action-executor.interface.js';

/**
 * File operation executor interface
 * @nist ac-3 "Access enforcement"
 */
export interface FileOperationExecutor {
  /**
   * Execute the file operation
   * @param action - Action to execute
   * @param page - Page instance
   * @param context - Execution context
   * @returns Action result
   */
  execute(
    action: BrowserAction,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult>;

  /**
   * Get supported action type
   * @returns Action type identifier
   */
  getSupportedType(): string;
}

/**
 * File validation result
 * @nist si-10 "Information input validation"
 */
export interface FileValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** File metadata */
  metadata?: {
    size?: number;
    exists?: boolean;
    isFile?: boolean;
    absolutePath?: string;
  };
}

/**
 * Download progress info
 */
export interface DownloadProgress {
  /** Downloaded bytes */
  bytesReceived: number;
  /** Total bytes to download */
  totalBytes?: number;
  /** Download percentage */
  percentage?: number;
  /** Download speed in bytes/sec */
  speed?: number;
}

/**
 * File operation metrics
 */
export interface FileOperationMetrics {
  /** Operation start time */
  startTime: number;
  /** Operation end time */
  endTime?: number;
  /** Files processed */
  filesProcessed: number;
  /** Total bytes processed */
  bytesProcessed: number;
  /** Errors encountered */
  errors: string[];
}

/**
 * File metadata information
 */
export interface FileMetadata {
  exists: boolean;
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  absolutePath: string;
  basename: string;
  extension: string;
}

/**
 * Download operation result
 */
export interface DownloadOperationResult {
  validationResult: FileValidationResult;
  response: import('puppeteer').HTTPResponse | null;
  fileExists: boolean;
  fileSize: number;
}