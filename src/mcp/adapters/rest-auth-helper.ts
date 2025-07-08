/**
 * REST Adapter Authentication Helper
 * @module mcp/adapters/rest-auth-helper
 * @description Helper functions for authentication in REST adapter
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 */

import { AppError } from '../../core/errors/app-error.js';
import { verifyToken } from '../../auth/jwt.js';
import type { AuthenticatedRequest } from '../../types/express.js';
import type { AuthParams } from './adapter.interface.js';
import { InMemorySessionStore } from '../../store/in-memory-session-store.js';
import { apiKeyStore } from '../../store/api-key-store.js';
import { logger } from '../../utils/logger.js';

// Create store instance
const sessionStore = new InMemorySessionStore(logger.child({ module: 'session-store' }));

/**
 * Handle JWT authentication
 */
async function handleJwtAuth(req: AuthenticatedRequest, credentials: string): Promise<void> {
  // Add JWT to Authorization header
  req.headers.authorization = `Bearer ${credentials}`;

  // Verify JWT
  const payload = await verifyToken(credentials, 'access');

  // Verify session
  const session = await sessionStore.get(payload.sessionId);
  if (!session) {
    throw new AppError('Invalid session', 401);
  }

  req.user = {
    userId: payload.sub,
    username: payload.username,
    roles: payload.roles,
    sessionId: payload.sessionId,
  };
}

/**
 * Handle API key authentication
 */
async function handleApiKeyAuth(req: AuthenticatedRequest, credentials: string): Promise<void> {
  // Add API key to header
  req.headers['x-api-key'] = credentials;

  // Verify API key
  const keyData = await apiKeyStore.verify(credentials);
  if (!keyData) {
    throw new AppError('Invalid API key', 401);
  }

  req.user = {
    userId: keyData.userId,
    username: `apikey:${keyData.name}`,
    roles: keyData.roles,
    sessionId: `apikey:${keyData.id}`,
  };
}

/**
 * Handle session authentication
 */
async function handleSessionAuth(
  req: AuthenticatedRequest,
  credentials: string,
  sessionId?: string,
): Promise<void> {
  // Use session ID directly
  const session = await sessionStore.get(sessionId ?? credentials);
  if (!session) {
    throw new AppError('Invalid session', 401);
  }

  req.user = {
    userId: session.data.userId,
    username: (session.data.metadata?.username as string) ?? 'unknown',
    roles: (session.data.metadata?.roles as string[]) ?? [],
    sessionId: session.id,
  };
}

/**
 * Apply authentication to request
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 */
export async function applyAuthentication(
  req: AuthenticatedRequest,
  auth: AuthParams,
  sessionId?: string,
): Promise<void> {
  switch (auth.type) {
    case 'jwt':
      await handleJwtAuth(req, auth.credentials);
      break;

    case 'apikey':
      await handleApiKeyAuth(req, auth.credentials);
      break;

    case 'session':
      await handleSessionAuth(req, auth.credentials, sessionId);
      break;

    default:
      throw new AppError('Unsupported authentication type', 400);
  }
}

/**
 * Create authenticated request user from session
 */
export async function createUserFromSession(
  sessionId: string,
): Promise<AuthenticatedRequest['user']> {
  const session = await sessionStore.get(sessionId);
  if (!session) {
    throw new AppError('Invalid session', 401);
  }

  return {
    userId: session.data.userId,
    username: (session.data.metadata?.username as string) ?? 'unknown',
    roles: (session.data.metadata?.roles as string[]) ?? [],
    sessionId: session.id,
  };
}
