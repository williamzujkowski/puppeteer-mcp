/**
 * Security audit logging
 * @module core/middleware/logging/audit-logger
 * @nist au-2 "Audit events"
 * @nist au-3 "Content of audit records"
 * @nist au-10 "Non-repudiation"
 */

import type { Response } from 'express';
import type { RequestResponseLoggerOptions, ExtendedRequest } from './types.js';
import { logSecurityEvent, SecurityEventType } from '../../../utils/logger.js';
import { formatAuditMetadata } from './log-formatter.js';
import { getAuditResult } from './log-filters.js';

/**
 * Log security audit event for request/response
 */
export const logAuditEvent = async (
  req: ExtendedRequest,
  res: Response,
  auditData: {
    requestId: string;
    duration: number;
    isSlowRequest: boolean;
    config: RequestResponseLoggerOptions;
  },
): Promise<void> => {
  if (auditData.config.auditLogging !== true) {
    return;
  }

  const auditResult = getAuditResult(res.statusCode);
  const metadata = formatAuditMetadata({
    req,
    res,
    requestId: auditData.requestId,
    duration: auditData.duration,
    isSlowRequest: auditData.isSlowRequest,
  });
  
  await logSecurityEvent(SecurityEventType.HTTP_REQUEST_COMPLETED, {
    userId: req.user?.userId,
    resource: req.path,
    action: req.method,
    result: auditResult,
    reason: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
    metadata,
  });
};

/**
 * Log authentication audit event
 */
export const logAuthenticationAudit = async (
  req: ExtendedRequest,
  success: boolean,
  reason?: string,
): Promise<void> => {
  await logSecurityEvent(success ? SecurityEventType.AUTH_SUCCESS : SecurityEventType.AUTH_FAILURE, {
    userId: req.user?.userId,
    resource: req.path,
    action: 'AUTHENTICATE',
    result: success ? 'success' : 'failure',
    reason,
    metadata: {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      method: req.method,
      path: req.path,
    },
  });
};

/**
 * Log authorization audit event
 */
export const logAuthorizationAudit = async (
  req: ExtendedRequest,
  success: boolean,
  reason?: string,
): Promise<void> => {
  await logSecurityEvent(success ? SecurityEventType.ACCESS_GRANTED : SecurityEventType.ACCESS_DENIED, {
    userId: req.user?.userId,
    resource: req.path,
    action: 'AUTHORIZE',
    result: success ? 'success' : 'failure',
    reason,
    metadata: {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      method: req.method,
      path: req.path,
    },
  });
};

/**
 * Log rate limiting audit event
 */
export const logRateLimitAudit = async (
  req: ExtendedRequest,
  limit: number,
  windowMs: number,
  remaining: number,
): Promise<void> => {
  await logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, {
    userId: req.user?.userId,
    resource: req.path,
    action: 'RATE_LIMIT_CHECK',
    result: remaining <= 0 ? 'failure' : 'success',
    reason: remaining <= 0 ? 'Rate limit exceeded' : undefined,
    metadata: {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      method: req.method,
      path: req.path,
      limit,
      windowMs,
      remaining,
    },
  });
};

/**
 * Log input validation audit event
 */
export const logValidationAudit = async (
  req: ExtendedRequest,
  success: boolean,
  errors?: string[],
): Promise<void> => {
  await logSecurityEvent(SecurityEventType.VALIDATION_FAILURE, {
    userId: req.user?.userId,
    resource: req.path,
    action: 'VALIDATE_INPUT',
    result: success ? 'success' : 'failure',
    reason: errors?.join(', '),
    metadata: {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      method: req.method,
      path: req.path,
      errors,
    },
  });
};

/**
 * Log suspicious activity audit event
 */
export const logSuspiciousActivity = async (
  req: ExtendedRequest,
  activity: string,
  details: Record<string, unknown> = {},
): Promise<void> => {
  await logSecurityEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, {
    userId: req.user?.userId,
    resource: req.path,
    action: 'SUSPICIOUS_ACTIVITY',
    result: 'failure',
    reason: activity,
    metadata: {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      method: req.method,
      path: req.path,
      activity,
      ...details,
    },
  });
};

/**
 * Log security event with request context
 */
export const logSecurityEventWithContext = async (
  req: ExtendedRequest,
  eventType: SecurityEventType,
  details: {
    action: string;
    result: 'success' | 'failure';
    reason?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> => {
  await logSecurityEvent(eventType, {
    userId: req.user?.userId,
    resource: req.path,
    action: details.action,
    result: details.result,
    reason: details.reason,
    metadata: {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      method: req.method,
      path: req.path,
      ...details.metadata,
    },
  });
};