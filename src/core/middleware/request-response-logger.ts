/**
 * Request/response logging middleware - Re-export from modular structure
 * @module core/middleware/request-response-logger
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-8 "Time stamps"
 * @nist au-10 "Non-repudiation"
 */

// Re-export everything from the modular logging structure
export * from './logging/index.js';

// Import specific items for backwards compatibility
import {
  requestResponseLogger,
  createRequestResponseLogger,
  createPresetConfigs,
} from './logging/index.js';

// Export specific items to maintain backward compatibility
export { requestResponseLogger, createRequestResponseLogger };

// Export preset configurations with the old naming for compatibility
export const createRequestResponseLoggerPresets = {
  minimal: createRequestResponseLogger.minimal,
  standard: createRequestResponseLogger.standard,
  verbose: createRequestResponseLogger.verbose,
  debug: createRequestResponseLogger.debug,
  production: createPresetConfigs.production,
  development: createPresetConfigs.development,
  security: createPresetConfigs.security,
  performance: createPresetConfigs.performance,
};
