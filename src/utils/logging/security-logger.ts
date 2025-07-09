/**
 * Security event logging functionality
 * @module utils/logging/security-logger
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-10 "Non-repudiation"
 */

import { pino, type Logger as PinoLogger, destination } from 'pino';
import { mkdir } from 'fs/promises';
import { join, isAbsolute } from 'path';
import { homedir } from 'os';
import { config } from '../../core/config.js';
import { createLoggerOptions } from './logger-factory.js';
import { getRequestContext } from './log-context.js';
import { extractSafeMetadata } from './log-sanitizer.js';
import { SecurityEventType, type SecurityEventDetails, type DataOperation } from './types.js';
import { logger } from './logger.js';

let auditLoggerInstance: PinoLogger | null = null;
let auditLoggerPromise: Promise<PinoLogger> | null = null;

/**
 * Get the appropriate data directory for logs
 * When running from global npm install, use user's home directory
 */
const getDataDirectory = (): string => {
  // In test environment, always use current directory
  const isTest = process.env.NODE_ENV === 'test';
  const isJest = process.env.JEST_WORKER_ID !== undefined;
  
  if (isTest || isJest) {
    return process.cwd();
  }

  // If running from a global npm install (not in development)
  if (config.NODE_ENV !== 'development') {
    // Check if we're in a global install by looking for node_modules in path
    const scriptPath = process.argv[1] ?? '';

    // If the script is running from a global node_modules, use home directory
    const isGlobalInstall = scriptPath.includes('node_modules');
    const isNotInCwd = !scriptPath.includes(process.cwd());
    
    if (isGlobalInstall && isNotInCwd) {
      return join(homedir(), '.puppeteer-mcp');
    }
  }

  // In development or local install, use current directory
  return process.cwd();
};

/**
 * Get the audit log path
 * Resolves relative paths against the appropriate data directory
 */
const getAuditLogPath = (): string => {
  const auditPath = config.AUDIT_LOG_PATH;

  // If already absolute, use as-is
  if (isAbsolute(auditPath)) {
    return auditPath;
  }

  // Otherwise, resolve against data directory
  return join(getDataDirectory(), auditPath);
};

/**
 * Create audit logger instance
 * @nist au-3 "Content of audit records"
 * @nist au-4 "Audit storage capacity"
 */
const createAuditLogger = async (): Promise<PinoLogger> => {
  if (!config.AUDIT_LOG_ENABLED) {
    // Return a no-op logger if audit logging is disabled
    return pino({ level: 'silent' });
  }

  try {
    // Get the resolved audit log directory
    const auditLogDir = getAuditLogPath();

    // Create the directory if it doesn't exist
    await mkdir(auditLogDir, { recursive: true });

    // Create the full path to the audit log file
    const dateString = new Date().toISOString().split('T')[0];
    const auditLogFile = join(auditLogDir, `audit-${dateString}.log`);

    const stream = destination({
      dest: auditLogFile,
      sync: false, // Async for better performance
      minLength: 4096, // Buffer size
    });

    // Handle stream errors to prevent crashes
    stream.on('error', (error) => {
      logger.error({ error, file: auditLogFile }, 'Audit log stream error');
    });

    return pino(
      createLoggerOptions('audit', true),
      stream,
    );
  } catch (error) {
    // If audit logging setup fails, log error and return no-op logger
    logger.error({ error }, 'Failed to initialize audit logger');
    return pino({ level: 'silent' });
  }
};

/**
 * Get audit logger instance
 */
export const getAuditLogger = async (): Promise<PinoLogger> => {
  if (!auditLoggerInstance) {
    auditLoggerPromise ??= createAuditLogger();
    auditLoggerInstance = await auditLoggerPromise;
  }
  return auditLoggerInstance;
};

/**
 * Log security event for audit trail
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-10 "Non-repudiation"
 */
export const logSecurityEvent = async (
  eventType: SecurityEventType,
  details: SecurityEventDetails,
): Promise<void> => {
  try {
    const auditLogger = await getAuditLogger();
    const context = getRequestContext();
    const { ip, userAgent } = extractSafeMetadata(details.metadata);

    auditLogger.info(
      {
        type: 'SECURITY_EVENT',
        eventType,
        timestamp: new Date().toISOString(),
        requestId: context?.requestId,
        userId: details.userId ?? context?.userId,
        resource: details.resource,
        action: details.action,
        result: details.result,
        reason: details.reason,
        metadata: details.metadata,
        source: {
          ip,
          userAgent,
        },
      },
      `Security event: ${eventType}`,
    );
  } catch (error) {
    // Fallback to regular logger if audit logger fails
    logger.error({ error, eventType, details }, 'Failed to log security event to audit log');
  }
};

/**
 * Log data access for compliance
 * @nist au-2 "Audit events"
 * @nist ac-4 "Information flow enforcement"
 */
export const logDataAccess = async (
  operation: DataOperation,
  resource: string,
  details?: Record<string, unknown>,
): Promise<void> => {
  let eventType: SecurityEventType;
  switch (operation) {
    case 'READ':
      eventType = SecurityEventType.DATA_ACCESS;
      break;
    case 'WRITE':
      eventType = SecurityEventType.DATA_MODIFICATION;
      break;
    case 'DELETE':
      eventType = SecurityEventType.DATA_DELETION;
      break;
  }
  
  await logSecurityEvent(eventType, {
    action: operation,
    resource,
    metadata: details,
  });
};

/**
 * Cleanup audit logger for tests
 */
export const cleanupAuditLogger = (): void => {
  auditLoggerInstance = null;
  auditLoggerPromise = null;
};