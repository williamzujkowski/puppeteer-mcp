/**
 * Path utilities for ES modules compatibility
 * @module utils/path-utils
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Check if we're in a test environment
 */
const isTestEnvironment =
  process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

/**
 * Get the directory path of a module
 * Works in both ES modules and Jest/CommonJS environments
 *
 * @param importMetaUrl - The import.meta.url value from the calling module
 * @returns The directory path
 */
export function getDirname(importMetaUrl: string): string {
  // In test environments, use process.cwd() as base
  if (isTestEnvironment) {
    // Return the src directory path for consistent behavior
    return join(process.cwd(), 'src');
  }

  // In production ES modules, derive from import.meta.url
  /* istanbul ignore next - production-only code path */
  const __filename = fileURLToPath(importMetaUrl);
  /* istanbul ignore next - production-only code path */
  return dirname(__filename);
}

/**
 * Get directory path with fallback for test environments
 * This is used when we can't pass import.meta.url due to syntax limitations
 *
 * @param relativePath - Path relative to src directory (e.g., 'grpc' for src/grpc)
 * @returns The directory path
 */
export function getDirnameFromSrc(relativePath: string): string {
  if (isTestEnvironment) {
    return join(process.cwd(), 'src', relativePath);
  }

  // In production, resolve from the dist directory
  /* istanbul ignore next - production-only code path */
  try {
    // Use process.argv[1] to get the current script path as a safer alternative
    // This avoids using Function constructor and the no-implied-eval issue
    const currentScriptPath = process.argv[1];
    if (currentScriptPath) {
      const scriptDir = dirname(currentScriptPath);
      // If we're in the dist directory, use it; otherwise fall back to process.cwd()
      if (scriptDir.includes('dist')) {
        return join(scriptDir, relativePath);
      }
    }
    // Fallback to dist directory from current working directory
    return join(process.cwd(), 'dist', relativePath);
  } catch {
    // Fallback if path resolution fails
    return join(process.cwd(), 'dist', relativePath);
  }
}
