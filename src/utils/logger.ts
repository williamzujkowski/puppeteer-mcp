/**
 * Logger utility with audit logging support
 * @module utils/logger
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-4 "Audit storage capacity"
 */

import { pino, Logger as PinoLogger, destination } from 'pino';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { config } from '../core/config.js';
import type { Request, Response, NextFunction } from 'express';

// AsyncLocalStorage for request context
const requestContext = new AsyncLocalStorage<{ requestId: string; userId?: string }>();

/**
 * Security event types for audit logging
 * @nist au-2 "Audit events"
 */
export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  TOKEN_REVOKE = 'TOKEN_REVOKE',
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  TOKEN_REFRESHED = 'TOKEN_REFRESHED',

  // Authorization events
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',

  // API Key events
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  API_KEY_USED = 'API_KEY_USED',

  // Data access events
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  DATA_DELETION = 'DATA_DELETION',
  API_ACCESS = 'API_ACCESS',
  RESOURCE_CREATED = 'RESOURCE_CREATED',
  RESOURCE_UPDATED = 'RESOURCE_UPDATED',
  RESOURCE_DELETED = 'RESOURCE_DELETED',

  // Security violations
  INVALID_TOKEN = 'INVALID_TOKEN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  VALIDATION_FAILURE = 'VALIDATION_FAILURE',

  // Connection events
  CONNECTION_ATTEMPT = 'CONNECTION_ATTEMPT',
  CONNECTION_ESTABLISHED = 'CONNECTION_ESTABLISHED',
  CONNECTION_TERMINATED = 'CONNECTION_TERMINATED',
  CONNECTION_CLOSED = 'CONNECTION_CLOSED',

  // System events
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  SERVICE_START = 'SERVICE_START',
  SERVICE_STOP = 'SERVICE_STOP',
  ERROR = 'ERROR',

  // Command execution events
  COMMAND_EXECUTED = 'COMMAND_EXECUTED',

  // Session events
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_UPDATED = 'SESSION_UPDATED',
  SESSION_DELETED = 'SESSION_DELETED',
}

/**
 * Create logger options based on configuration
 */
const createLoggerOptions = (name: string, isAudit = false): pino.LoggerOptions<never> => {
  const baseOptions: pino.LoggerOptions<never> = {
    name,
    level: config.LOG_LEVEL,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        ...bindings,
        environment: config.NODE_ENV,
        service: 'puppeteer-mcp',
      }),
    },
    serializers: {
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      err: pino.stdSerializers.err,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Add request context to all logs
    mixin: () => {
      const context = requestContext.getStore();
      return context ? { requestId: context.requestId, userId: context.userId } : {};
    },
  };

  // Development pretty printing (not for audit logs)
  if (config.NODE_ENV === 'development' && config.LOG_FORMAT === 'pretty' && !isAudit) {
    return {
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    };
  }

  return baseOptions;
};

/**
 * Create a configured logger instance
 * @param name - Logger name/module
 * @returns Configured Pino logger
 */
export const createLogger = (name: string): PinoLogger => {
  return pino(createLoggerOptions(name));
};

/**
 * Create audit logger instance
 * @nist au-3 "Content of audit records"
 * @nist au-4 "Audit storage capacity"
 */
const createAuditLogger = async (): Promise<PinoLogger> => {
  if (!config.AUDIT_LOG_ENABLED) {
    // Return a no-op logger if audit logging is disabled
    // In Pino v9, we need to ensure sync is true for exit handling
    return pino({ level: 'silent' });
  }

  // Ensure audit log directory exists
  const auditLogDir = dirname(config.AUDIT_LOG_PATH);
   
  await mkdir(auditLogDir, { recursive: true });

  const auditLogFile = join(
    config.AUDIT_LOG_PATH,
    `audit-${new Date().toISOString().split('T')[0]}.log`,
  );

  return pino(
    {
      ...createLoggerOptions('audit', true),
      level: 'info', // Audit logs should always be at info level or higher
    },
    destination({
      dest: auditLogFile,
      sync: false, // Async for better performance
      minLength: 4096, // Buffer size
    }),
  );
};

/**
 * Logger instances
 */
export const logger = createLogger('app');
let auditLoggerInstance: PinoLogger | null = null;
let auditLoggerPromise: Promise<PinoLogger> | null = null;

/**
 * Get audit logger instance
 */
const getAuditLogger = async (): Promise<PinoLogger> => {
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
  details: {
    userId?: string;
    resource?: string;
    action?: string;
    result?: 'success' | 'failure';
    reason?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> => {
  try {
    const auditLogger = await getAuditLogger();
    const context = requestContext.getStore();

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
          ip: details.metadata?.ip as string,
          userAgent: details.metadata?.userAgent as string,
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
  operation: 'READ' | 'WRITE' | 'DELETE',
  resource: string,
  details?: Record<string, unknown>,
): Promise<void> => {
  const eventType =
    operation === 'READ'
      ? SecurityEventType.DATA_ACCESS
      : operation === 'DELETE'
        ? SecurityEventType.DATA_DELETION
        : SecurityEventType.DATA_MODIFICATION;

  await logSecurityEvent(eventType, {
    action: operation,
    resource,
    metadata: details,
  });
};

/**
 * Create child logger with additional context
 */
export const createChildLogger = (
  parentLogger: PinoLogger,
  context: Record<string, unknown>,
): PinoLogger => {
  return parentLogger.child(context);
};

/**
 * Run function with request context
 */
export const runWithRequestContext = <T>(
  requestId: string,
  userId: string | undefined,
  fn: () => T,
): T => {
  return requestContext.run({ requestId, userId }, fn);
};

/**
 * Express middleware to set request context
 */
export const requestContextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const xRequestId = req.headers['x-request-id'];
  const requestId =
    req.id ??
    (typeof xRequestId === 'string' ? xRequestId : undefined) ??
    'unknown';
  const userId = req.user?.userId;

  runWithRequestContext(requestId, userId, () => {
    next();
  });
};

/**
 * Structured logging helpers
 */
export const loggers = {
  http: createLogger('http'),
  grpc: createLogger('grpc'),
  ws: createLogger('websocket'),
  auth: createLogger('auth'),
  session: createLogger('session'),
  db: createLogger('database'),
  redis: createLogger('redis'),
  performance: createLogger('performance'),
};
