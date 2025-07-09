/**
 * Logger utility with audit logging support
 * @module utils/logging
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-4 "Audit storage capacity"
 */

// Re-export types
export type {
  SecurityEventDetails,
  RequestContext,
  AuthenticatedRequest,
  LoggerInstances,
  LogLevel,
  DataOperation,
} from './types.js';

export { SecurityEventType } from './types.js';

// Re-export main functionality
export { createLogger, createChildLogger } from './logger-factory.js';
export { logSecurityEvent, logDataAccess } from './security-logger.js';
export { logger, loggers, cleanupLoggers } from './logger.js';
export { 
  runWithRequestContext, 
  requestContextMiddleware,
  getRequestContext,
} from './log-context.js';

// Re-export sanitization utilities if needed externally
export { sanitizeLogData, sanitizeError } from './log-sanitizer.js';