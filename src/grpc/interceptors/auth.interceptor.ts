/**
 * gRPC authentication interceptor
 * @module grpc/interceptors/auth
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import { verifyToken } from '../../auth/jwt.js';
import type { SessionStore } from '../../store/session-store.interface.js';
import type { Session } from '../../types/session.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { ExtendedCall, GrpcCallback, NextFunction, GrpcError, InterceptorFunction } from './types.js';

/**
 * Extract token from gRPC metadata
 * @nist ia-2 "Identification and authentication"
 */
function extractToken(metadata: grpc.Metadata): string | null {
  // Check Authorization header
  const authHeaders = metadata.get('authorization');
  if (authHeaders !== undefined && authHeaders.length > 0) {
    const authHeader = authHeaders[0]?.toString();
    if (authHeader !== undefined && authHeader !== '' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
  }

  // Check x-api-key header
  const apiKeys = metadata.get('x-api-key');
  if (apiKeys !== undefined && apiKeys.length > 0) {
    return apiKeys[0]?.toString() ?? null;
  }

  return null;
}

/**
 * Create authentication error with proper gRPC status
 */
function createAuthError(message: string): GrpcError {
  const error = new Error(message) as GrpcError;
  error.code = grpc.status.UNAUTHENTICATED;
  return error;
}

/**
 * Extract request context from call
 */
interface RequestContext {
  methodName: string;
  requestId: string;
  metadata: grpc.Metadata;
}

function extractRequestContext(call: ExtendedCall): RequestContext {
  return {
    methodName: call.handler?.path ?? 'unknown',
    requestId: call.metadata.get('x-request-id')?.[0]?.toString() ?? 'unknown',
    metadata: call.metadata,
  };
}

/**
 * Log authentication failure
 */
async function logAuthFailure(
  context: RequestContext,
  reason: string,
  additionalMetadata?: Record<string, unknown>
): Promise<void> {
  await logSecurityEvent(SecurityEventType.AUTH_FAILURE, {
    resource: context.methodName,
    action: 'authenticate',
    result: 'failure',
    reason,
    metadata: {
      requestId: context.requestId,
      ...additionalMetadata,
    },
  });
}

/**
 * Log authentication success
 */
async function logAuthSuccess(
  context: RequestContext,
  session: Session
): Promise<void> {
  await logSecurityEvent(SecurityEventType.AUTH_SUCCESS, {
    resource: context.methodName,
    action: 'authenticate',
    result: 'success',
    metadata: {
      requestId: context.requestId,
      sessionId: session.id,
      userId: session.data.userId,
      username: session.data.username,
    },
  });
}

/**
 * Validate token and return session
 */
async function validateTokenAndSession(
  token: string,
  sessionStore: SessionStore,
  context: RequestContext
): Promise<Session | null> {
  // Verify token
  const payload = await verifyToken(token, 'access');
  
  if (!payload?.sessionId) {
    await logAuthFailure(context, 'Invalid token');
    return null;
  }

  // Validate session
  const session = await sessionStore.get(payload.sessionId);
  
  if (!session) {
    await logAuthFailure(context, 'Session not found', {
      sessionId: payload.sessionId,
    });
    return null;
  }

  // Check session expiration
  const expiresAt = new Date(session.data.expiresAt).getTime();
  if (expiresAt < Date.now()) {
    await logAuthFailure(context, 'Session expired', {
      sessionId: payload.sessionId,
      userId: session.data.userId,
    });
    return null;
  }

  return session;
}

/**
 * Attach session to call and send response metadata
 */
function attachSessionToCall(call: ExtendedCall, session: Session): void {
  // Attach session to call context
  call.session = session;
  call.userId = session.data.userId;
  call.username = session.data.username;
  call.roles = session.data.roles;

  // Add session info to response metadata
  const responseMetadata = new grpc.Metadata();
  responseMetadata.set('x-session-id', session.id);
  responseMetadata.set('x-user-id', session.data.userId);
  call.sendMetadata(responseMetadata);
}

/**
 * Authentication interceptor for gRPC calls
 * @nist ia-2 "User authentication"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @evidence code, test
 */
export function authInterceptor(
  logger: pino.Logger,
  sessionStore: SessionStore
): InterceptorFunction {
  return async (
    call: ExtendedCall,
    callback: GrpcCallback,
    next: NextFunction
  ): Promise<void> => {
    const context = extractRequestContext(call);
    
    try {
      // Extract authentication token
      const token = extractToken(call.metadata);
      
      if (token === null || token === undefined || token === '') {
        await logAuthFailure(context, 'Missing authentication token');
        return callback(createAuthError('Missing authentication token'));
      }

      // Validate token and get session
      const session = await validateTokenAndSession(token, sessionStore, context);
      
      if (!session) {
        return callback(createAuthError('Invalid authentication token'));
      }

      // Update session last accessed time
      await sessionStore.touch(session.id);

      // Log successful authentication
      await logAuthSuccess(context, session);

      // Attach session to call
      attachSessionToCall(call, session);

      // Continue to next handler
      next(call, callback);
    } catch (error) {
      logger.error('Authentication error:', error);
      
      await logAuthFailure(
        context,
        error instanceof Error ? error.message : 'Unknown error'
      );

      callback(createAuthError('Authentication failed'));
    }
  };
}

/**
 * Try to authenticate optionally
 */
async function tryOptionalAuth(
  call: ExtendedCall,
  sessionStore: SessionStore,
  logger: pino.Logger
): Promise<void> {
  const token = extractToken(call.metadata);
  
  if (token === null || token === undefined || token === '') {
    return;
  }

  try {
    const payload = await verifyToken(token, 'access');
    
    if (!payload?.sessionId) {
      return;
    }

    const session = await sessionStore.get(payload.sessionId);
    
    if (!session) {
      return;
    }

    const expiresAt = new Date(session.data.expiresAt).getTime();
    if (expiresAt < Date.now()) {
      return;
    }

    // Update session last accessed time
    await sessionStore.touch(session.id);
    
    // Attach session to call
    attachSessionToCall(call, session);
  } catch (error) {
    // Ignore auth errors for optional auth
    logger.debug('Optional auth failed:', error);
  }
}

/**
 * Optional authentication interceptor (for endpoints that don't require auth)
 * @nist ia-2 "Identification and authentication"
 */
export function optionalAuthInterceptor(
  logger: pino.Logger,
  sessionStore: SessionStore
): InterceptorFunction {
  return async (
    call: ExtendedCall,
    callback: GrpcCallback,
    next: NextFunction
  ): Promise<void> => {
    try {
      await tryOptionalAuth(call, sessionStore, logger);
      next(call, callback);
    } catch (error) {
      // Continue even if there's an error
      logger.debug('Optional auth error:', error);
      next(call, callback);
    }
  };
}