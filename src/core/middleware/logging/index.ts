/**
 * Request/response logging middleware exports
 * @module core/middleware/logging
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-8 "Time stamps"
 * @nist au-10 "Non-repudiation"
 */

// Main middleware exports
export { requestResponseLogger, createRequestResponseLogger } from './request-response-logger.js';

// Configuration exports
export { 
  getDefaultConfig, 
  createPresetConfigs,
  DEFAULT_SENSITIVE_HEADERS,
  DEFAULT_SENSITIVE_BODY_FIELDS,
  DEFAULT_LOGGED_CONTENT_TYPES,
} from './log-configuration.js';

// Type exports
export type {
  RequestResponseLoggerOptions,
  RequestTiming,
  RequestLogData,
  ResponseLogData,
  VerbosityLevel,
  LogLevel,
  AuditResult,
} from './types.js';

// Utility exports
export { 
  redactSensitiveData, 
  redactSensitiveHeaders, 
  shouldLogContentType,
  sanitizeError,
} from './log-sanitizer.js';

export { 
  shouldSkipRequest, 
  shouldSkipResponse, 
  isSlowRequest, 
  getLogLevel, 
  getAuditResult,
  isSecuritySensitivePath,
  isMutatingRequest,
} from './log-filters.js';

export { 
  createTiming, 
  calculateTiming, 
  calculateDuration, 
  roundDuration, 
  formatDuration,
  PerformanceTracker,
  globalPerformanceTracker,
} from './performance-tracker.js';

export { 
  formatRequestLogData,
  formatResponseLogData,
  formatErrorLogData,
  formatAuditMetadata,
  generateRequestLogMessage,
  generateResponseLogMessage,
  generateErrorLogMessage,
  formatHeaders,
  formatContentLength,
} from './log-formatter.js';

export { 
  logRequest, 
  parseRequestBody, 
  attachRequestLogging,
} from './request-logger.js';

export { 
  logResponse, 
  extractResponseBody, 
  setupResponseBodyCapture, 
  setupResponseLogging,
} from './response-logger.js';

export { 
  logRequestError, 
  setupErrorLogging, 
  logUncaughtException, 
  logRequestTimeout, 
  logRequestCancellation,
  logMiddlewareError,
} from './error-logger.js';

export { 
  logAuditEvent, 
  logAuthenticationAudit, 
  logAuthorizationAudit, 
  logRateLimitAudit, 
  logValidationAudit, 
  logSuspiciousActivity,
  logSecurityEventWithContext,
} from './audit-logger.js';