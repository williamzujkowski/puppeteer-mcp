/**
 * Session route handlers
 * @module routes/session-handlers
 * @nist ac-12 "Session termination"
 * @nist au-2 "Audit events"
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SessionStore } from '../store/session-store.interface.js';
import { refreshAccessToken, revokeRefreshToken } from '../auth/refresh.js';
import { AppError } from '../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { generateTokenPair } from '../auth/jwt.js';
import { config } from '../core/config.js';
import crypto from 'crypto';

/**
 * Refresh access token handler
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 */
export async function handleRefreshToken(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): Promise<void> {
  try {
    // Validate request body
    const refreshSchema = z.object({
      refreshToken: z.string(),
      accessToken: z.string().optional(),
    });

    const body = refreshSchema.parse(req.body);

    // Refresh token
    const newTokens = await refreshAccessToken(body, sessionStore, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: newTokens,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Revoke refresh token handler
 * @nist ac-12 "Session termination"
 */
export async function handleRevokeToken(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): Promise<void> {
  try {
    // Validate request body
    const revokeSchema = z.object({
      refreshToken: z.string(),
    });

    const body = revokeSchema.parse(req.body);

    // Revoke token
    await revokeRefreshToken(body.refreshToken, sessionStore, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Token revoked successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current session info handler
 * @nist au-2 "Audit events"
 */
export async function handleGetCurrentSession(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const session = await sessionStore.get(req.user.sessionId);

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: session.id,
        userId: session.data.userId,
        username: session.data.username,
        roles: session.data.roles,
        createdAt: session.data.createdAt,
        expiresAt: session.data.expiresAt,
        lastAccessedAt: session.lastAccessedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user sessions handler
 * @nist au-2 "Audit events"
 */
export async function handleGetUserSessions(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const sessions = await sessionStore.getByUserId(req.user.userId);

    res.json({
      success: true,
      data: sessions.map((session) => ({
        id: session.id,
        createdAt: session.data.createdAt,
        expiresAt: session.data.expiresAt,
        lastAccessedAt: session.lastAccessedAt,
        isCurrent: session.id === req.user?.sessionId,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Terminate specific session handler
 * @nist ac-12 "Session termination"
 */
export async function handleTerminateSession(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { sessionId } = req.params;
    if (sessionId === undefined || sessionId === null || sessionId === '') {
      throw new AppError('Session ID is required', 400);
    }

    // Get session to verify ownership
    const session = await sessionStore.get(sessionId);

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Check if user owns this session or is admin
    if (session.data.userId !== req.user.userId && !req.user.roles.includes('admin')) {
      throw new AppError('Cannot terminate session for another user', 403);
    }

    // Delete session
    const deleted = await sessionStore.delete(sessionId);

    if (!deleted) {
      throw new AppError('Failed to delete session', 500);
    }

    // Log session termination
    await logSecurityEvent(SecurityEventType.LOGOUT, {
      userId: req.user.userId,
      result: 'success',
      metadata: {
        terminatedSessionId: sessionId,
        terminatedByUser: req.user.userId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      message: 'Session terminated successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Terminate all user sessions handler
 * @nist ac-12 "Session termination"
 */
export async function handleTerminateAllSessions(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    // Get all user sessions
    const sessions = await sessionStore.getByUserId(req.user.userId);

    let deletedCount = 0;

    // Delete all sessions except current
    for (const session of sessions) {
      if (session.id !== req.user.sessionId) {
        const deleted = await sessionStore.delete(session.id);
        if (deleted) {
          deletedCount++;
        }
      }
    }

    // Log mass session termination
    await logSecurityEvent(SecurityEventType.LOGOUT, {
      userId: req.user.userId,
      result: 'success',
      metadata: {
        action: 'terminate_all',
        deletedCount,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      message: `Terminated ${deletedCount} sessions`,
      data: {
        deletedCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin list all sessions handler
 * @nist au-2 "Audit events"
 * @nist ac-3 "Access enforcement"
 */
export function handleListAllSessions(_req: Request, _res: Response, next: NextFunction): void {
  try {
    // This would require modification to SessionStore interface
    // For now, return not implemented
    throw new AppError('List all sessions not implemented', 501);
  } catch (error) {
    next(error);
  }
}

/**
 * Admin terminate any session handler
 * @nist ac-12 "Session termination"
 * @nist ac-3 "Access enforcement"
 */
export async function handleAdminTerminateSession(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): Promise<void> {
  try {
    const { sessionId } = req.params;
    if (sessionId === undefined || sessionId === null || sessionId === '') {
      throw new AppError('Session ID is required', 400);
    }

    // Get session info before deletion
    const session = await sessionStore.get(sessionId);

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    // Delete session
    const deleted = await sessionStore.delete(sessionId);

    if (!deleted) {
      throw new AppError('Failed to delete session', 500);
    }

    // Log admin session termination
    await logSecurityEvent(SecurityEventType.LOGOUT, {
      userId: session.data.userId,
      result: 'success',
      metadata: {
        terminatedSessionId: sessionId,
        terminatedByAdmin: req.user?.userId ?? 'unknown',
        action: 'admin_terminate',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      message: 'Session terminated successfully',
      data: {
        terminatedUserId: session.data.userId,
        terminatedUsername: session.data.username,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Development-only session creation handler
 * WARNING: This endpoint bypasses authentication and should NEVER be enabled in production
 */
export async function handleDevCreateSession(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): Promise<void> {
  try {
    // Only allow in development mode - SECURITY: Remove this endpoint in production
    if (config.NODE_ENV === 'production' || config.NODE_ENV !== 'development') {
      throw new AppError('Development endpoint disabled in production', 403);
    }

    // Validate request body
    const createSessionSchema = z.object({
      userId: z.string().optional(),
      username: z.string().default('dev-user'),
      roles: z.array(z.string()).default(['user', 'admin']),
    });

    const { userId, username, roles } = createSessionSchema.parse(req.body);
    const finalUserId = userId ?? crypto.randomUUID();

    // Create session data
    const sessionData = {
      userId: finalUserId,
      username,
      roles,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    // Create session in store
    const sessionId = await sessionStore.create(sessionData);

    // Generate token pair
    const tokens = generateTokenPair(finalUserId, username, roles, sessionId);

    // Log session creation
    await logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
      userId: finalUserId,
      result: 'success',
      metadata: {
        method: 'dev-session-creation',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      data: {
        sessionId,
        userId: finalUserId,
        username,
        roles,
        ...tokens,
      },
    });
  } catch (error) {
    next(error);
  }
}
