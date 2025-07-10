/**
 * File operation executors module
 * @module puppeteer/actions/execution/file
 * @nist ac-3 "Access enforcement"
 * @nist si-7 "Software, firmware, and information integrity"
 */

// Export all executors
export { UploadExecutor } from './upload-executor.js';
export { DownloadExecutor } from './download-executor.js';
export { CookieExecutor } from './cookie-executor.js';

// Export factory
export { ExecutorFactory, type ExecutorFactoryConfig } from './executor-factory.js';

// Export validator
export { FileValidator } from './file-validator.js';

// Export utilities
export {
  checkFileExists,
  getFileSize,
  getFileMetadata,
  ensureDirectory,
  isPathSafe,
  sanitizeFilename,
  getMimeType,
} from './file-utils.js';

// Export types
export type {
  FileOperationExecutor,
  FileValidationResult,
  DownloadProgress,
  FileOperationMetrics,
  FileMetadata,
  DownloadOperationResult,
} from './file-executor-types.js';