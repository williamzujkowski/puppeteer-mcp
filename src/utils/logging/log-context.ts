/**
 * Logging context management
 * @module utils/logging/log-context
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { Response, NextFunction } from 'express';
import type { RequestContext, AuthenticatedRequest } from './types.js';
import { getCorrelationIds } from '../../telemetry/context.js';

// AsyncLocalStorage for request context
const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Get current request context
 */
export const getRequestContext = (): RequestContext | undefined => {
  return requestContext.getStore();
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
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void => {
  const xRequestId = req.headers['x-request-id'];
  const requestId =
    req.id ?? (typeof xRequestId === 'string' ? xRequestId : undefined) ?? 'unknown';
  const userId = req.user?.userId;

  runWithRequestContext(requestId, userId, () => {
    next();
  });
};

/**
 * Get mixin data for logs including context and correlation IDs
 */
export const getLogMixin = (): Record<string, string | undefined> => {
  const context = getRequestContext();
  const correlationIds = getCorrelationIds();
  
  const mixin: Record<string, string | undefined> = {};
  
  if (context) {
    mixin.requestId = context.requestId;
    mixin.userId = context.userId;
  }
  
  if (correlationIds.traceId !== undefined && correlationIds.traceId !== null && correlationIds.traceId !== '') {
    mixin.traceId = correlationIds.traceId;
  }
  
  if (correlationIds.spanId !== undefined && correlationIds.spanId !== null && correlationIds.spanId !== '') {
    mixin.spanId = correlationIds.spanId;
  }
  
  return mixin;
};