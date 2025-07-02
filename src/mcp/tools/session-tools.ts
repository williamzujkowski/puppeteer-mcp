/**
 * Session Tools Implementation
 * @module mcp/tools/session-tools
 */

import { logger } from '../../utils/logger.js';
import { generateTokenPair } from '../../auth/jwt.js';
import { userService } from '../auth/user-service.js';
import type { InMemorySessionStore } from '../../store/in-memory-session-store.js';
import type { SessionData } from '../../types/session.js';
import type { 
  CreateSessionArgs, 
  ListSessionsArgs, 
  DeleteSessionArgs, 
  ToolResponse,
  ToolErrorResponse
} from '../types/tool-types.js';

/**
 * Session tools handler
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export class SessionTools {
  constructor(private sessionStore: InMemorySessionStore) {}

  /**
   * Create a new session
   * @evidence code, test
   */
  async createSession(args: CreateSessionArgs): Promise<ToolResponse> {
    try {
      // Validate input
      if (!args.username || !args.password) {
        return this.errorResponse('Username and password are required', 'INVALID_CREDENTIALS');
      }

      // Authenticate user
      const user = await userService.authenticateUser(args.username, args.password);
      
      // Calculate session duration (default 1 hour)
      const duration = args.duration || 3600;
      const expiresAt = new Date(Date.now() + duration * 1000);
      
      // Create session data
      const sessionData: SessionData = {
        userId: user.id,
        username: user.username,
        roles: user.roles,
        metadata: {
          ...user.metadata,
          authMethod: 'password',
          createdBy: 'mcp',
        },
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
      
      // Create session in store
      const sessionId = await this.sessionStore.create(sessionData);
      
      // Generate JWT tokens
      const tokens = generateTokenPair(
        user.id,
        user.username,
        user.roles,
        sessionId
      );
      
      // Log session creation
      logger.info({
        msg: 'MCP session created',
        userId: user.id,
        username: user.username,
        sessionId,
        duration,
      });
      
      return this.successResponse({
        sessionId,
        userId: user.id,
        username: user.username,
        roles: user.roles,
        createdAt: sessionData.createdAt,
        expiresAt: sessionData.expiresAt,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      });
    } catch (error) {
      logger.error({
        msg: 'MCP session creation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        username: args.username,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Authentication failed',
        'AUTH_FAILED'
      );
    }
  }

  /**
   * List sessions
   */
  async listSessions(args: ListSessionsArgs): Promise<ToolResponse> {
    try {
      let sessions: any[] = [];
      
      if (args.userId) {
        // Get sessions for specific user
        const userSessions = await this.sessionStore.getByUserId(args.userId);
        sessions = userSessions.map(session => ({
          id: session.id,
          userId: session.data.userId,
          username: session.data.username,
          roles: session.data.roles,
          createdAt: session.data.createdAt,
          expiresAt: session.data.expiresAt,
          lastAccessedAt: session.lastAccessedAt,
          metadata: session.data.metadata,
        }));
        
        logger.info({
          msg: 'Listed sessions for user',
          userId: args.userId,
          count: sessions.length,
        });
      } else {
        // Note: In production, this should require admin permissions
        // For now, return empty array for non-user-specific queries
        logger.warn({
          msg: 'Session listing without userId not implemented',
          note: 'Admin functionality required',
        });
      }
      
      return this.successResponse({
        sessions,
        count: sessions.length,
      });
    } catch (error) {
      logger.error({
        msg: 'MCP session listing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: args.userId,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to list sessions',
        'LIST_FAILED'
      );
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(args: DeleteSessionArgs): Promise<ToolResponse> {
    try {
      // Validate input
      if (!args.sessionId) {
        return this.errorResponse('Session ID is required', 'INVALID_SESSION_ID');
      }
      
      // Get session to verify it exists
      const session = await this.sessionStore.get(args.sessionId);
      if (!session) {
        return this.errorResponse('Session not found', 'SESSION_NOT_FOUND');
      }
      
      // Delete the session
      const deleted = await this.sessionStore.delete(args.sessionId);
      
      logger.info({
        msg: 'MCP session deleted',
        sessionId: args.sessionId,
        userId: session.data.userId,
        deleted,
      });
      
      return this.successResponse({
        success: deleted,
        sessionId: args.sessionId,
        message: deleted ? 'Session deleted successfully' : 'Failed to delete session',
      });
    } catch (error) {
      logger.error({
        msg: 'MCP session deletion failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId: args.sessionId,
      });
      
      return this.errorResponse(
        error instanceof Error ? error.message : 'Failed to delete session',
        'DELETE_FAILED'
      );
    }
  }

  /**
   * Create error response
   */
  private errorResponse(error: string, code: string): ToolResponse {
    const errorData: ToolErrorResponse = { error, code };
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(errorData),
      }],
    };
  }

  /**
   * Create success response
   */
  private successResponse(data: any): ToolResponse {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data),
      }],
    };
  }
}