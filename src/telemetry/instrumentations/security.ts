/**
 * Security instrumentation for OpenTelemetry
 * @module telemetry/instrumentations/security
 * @nist au-2 "Audit events"
 * @nist au-10 "Non-repudiation"
 */

import { trace, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { getTracer } from '../index.js';
import { appMetrics } from '../metrics/index.js';
import { SecurityEventType } from '../../utils/logger.js';
import type { Request, Response, NextFunction } from 'express';

/**
 * Security event attributes
 */
interface SecurityEventAttributes {
  eventType: SecurityEventType;
  userId?: string;
  resource?: string;
  action?: string;
  result?: 'success' | 'failure';
  reason?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: any;
}

/**
 * Record security event with telemetry
 */
export function recordSecurityEvent(attributes: SecurityEventAttributes): void {
  const tracer = getTracer('security');
  const span = tracer.startSpan('security.event', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'security.event_type': attributes.eventType,
      'security.user_id': attributes.userId,
      'security.resource': attributes.resource,
      'security.action': attributes.action,
      'security.result': attributes.result,
      'security.reason': attributes.reason,
      'security.ip': attributes.ip,
      'security.user_agent': attributes.userAgent,
    },
  });

  // Add custom attributes
  Object.entries(attributes).forEach(([key, value]) => {
    if (
      ![
        'eventType',
        'userId',
        'resource',
        'action',
        'result',
        'reason',
        'ip',
        'userAgent',
      ].includes(key)
    ) {
      span.setAttribute(`security.custom.${key}`, value);
    }
  });

  // Set span status based on result
  if (attributes.result === 'failure') {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: attributes.reason || 'Security event failed',
    });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }

  // Record metrics based on event type
  switch (attributes.eventType) {
    case SecurityEventType.LOGIN_SUCCESS:
    case SecurityEventType.LOGIN_FAILURE:
      appMetrics.security.authAttemptsTotal.add(1, {
        method: 'login',
        success: (attributes.result === 'success').toString(),
      });
      if (attributes.result === 'failure') {
        appMetrics.security.authFailuresTotal.add(1, {
          method: 'login',
          reason: attributes.reason || 'unknown',
        });
      }
      break;

    case SecurityEventType.TOKEN_REFRESH:
    case SecurityEventType.TOKEN_REFRESHED:
      appMetrics.security.authTokensIssued.add(1, { type: 'refresh' });
      break;

    case SecurityEventType.TOKEN_REVOKE:
      appMetrics.security.authTokensRevoked.add(1);
      break;

    case SecurityEventType.RATE_LIMIT_EXCEEDED:
      appMetrics.puppeteer.apiRateLimitHits.add(1, {
        endpoint: attributes.resource || 'unknown',
      });
      break;

    case SecurityEventType.VALIDATION_FAILURE:
      appMetrics.puppeteer.validationErrors.add(1, {
        resource: attributes.resource || 'unknown',
      });
      break;
  }

  span.end();
}

/**
 * Authentication span wrapper
 */
export function wrapAuthentication<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  method: string,
): T {
  const tracer = getTracer('security');

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const span = tracer.startSpan(`auth.${method}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'auth.method': method,
      },
    });

    const startTime = Date.now();

    try {
      const result = await context.with(trace.setSpan(context.active(), span), async () => {
        return fn(...args);
      });

      const duration = Date.now() - startTime;

      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttribute('auth.success', true);
      span.setAttribute('auth.duration', duration);

      // Record success metrics
      appMetrics.security.authAttemptsTotal.add(1, {
        method,
        success: 'true',
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Authentication failed',
      });
      span.setAttribute('auth.success', false);
      span.setAttribute('auth.duration', duration);

      // Record failure metrics
      appMetrics.security.authAttemptsTotal.add(1, {
        method,
        success: 'false',
      });
      appMetrics.security.authFailuresTotal.add(1, {
        method,
        reason: error instanceof Error ? error.message : 'unknown',
      });

      throw error;
    } finally {
      span.end();
    }
  }) as T;
}

/**
 * Authorization span wrapper
 */
export function wrapAuthorization<T extends (...args: any[]) => Promise<boolean>>(
  fn: T,
  resource: string,
  action: string,
): T {
  const tracer = getTracer('security');

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const span = tracer.startSpan('authz.check', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'authz.resource': resource,
        'authz.action': action,
      },
    });

    try {
      const authorized = await context.with(trace.setSpan(context.active(), span), async () => {
        return fn(...args);
      });

      span.setAttribute('authz.result', authorized);
      span.setStatus({ code: SpanStatusCode.OK });

      // Record security event
      recordSecurityEvent({
        eventType: authorized ? SecurityEventType.ACCESS_GRANTED : SecurityEventType.ACCESS_DENIED,
        resource,
        action,
        result: authorized ? 'success' : 'failure',
      });

      return await Promise.resolve(authorized as ReturnType<T>);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Authorization check failed',
      });

      // Record security event
      recordSecurityEvent({
        eventType: SecurityEventType.ACCESS_DENIED,
        resource,
        action,
        result: 'failure',
        reason: error instanceof Error ? error.message : 'Authorization error',
      });

      throw error;
    } finally {
      span.end();
    }
  }) as T;
}

/**
 * CSRF validation instrumentation
 */
export function instrumentCsrfValidation(
  validator: (req: Request) => boolean,
): (req: Request) => boolean {
  const tracer = getTracer('security');

  return (req: Request): boolean => {
    const span = tracer.startSpan('csrf.validate', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'csrf.method': req.method,
        'csrf.path': req.path,
      },
    });

    try {
      const valid = validator(req);

      span.setAttribute('csrf.valid', valid);
      span.setStatus({ code: SpanStatusCode.OK });

      if (!valid) {
        // Record security event
        recordSecurityEvent({
          eventType: SecurityEventType.CSRF_TOKEN_INVALID,
          resource: req.path,
          action: req.method,
          result: 'failure',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }

      return valid;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'CSRF validation error',
      });

      // Record security event
      recordSecurityEvent({
        eventType: SecurityEventType.CSRF_TOKEN_MISSING,
        resource: req.path,
        action: req.method,
        result: 'failure',
        reason: error instanceof Error ? error.message : 'CSRF validation error',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      throw error;
    } finally {
      span.end();
    }
  };
}

/**
 * Rate limiting instrumentation
 */
export function instrumentRateLimiter(
  limiter: (req: Request, res: Response, next: NextFunction) => void,
): (req: Request, res: Response, next: NextFunction) => void {
  const tracer = getTracer('security');

  return (req: Request, res: Response, next: NextFunction): void => {
    const span = tracer.startSpan('ratelimit.check', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'ratelimit.path': req.path,
        'ratelimit.method': req.method,
        'ratelimit.ip': req.ip,
      },
    });

    // Wrap the next function to detect rate limit hits
    const wrappedNext: NextFunction = (error?: any) => {
      if (error && error.status === 429) {
        span.setAttribute('ratelimit.exceeded', true);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Rate limit exceeded',
        });

        // Record security event
        recordSecurityEvent({
          eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
          resource: req.path,
          action: req.method,
          result: 'failure',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      } else {
        span.setAttribute('ratelimit.exceeded', false);
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
      next(error);
    };

    context.with(trace.setSpan(context.active(), span), () => {
      limiter(req, res, wrappedNext);
    });
  };
}
