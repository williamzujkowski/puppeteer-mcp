/**
 * MCP Authentication Bridge
 * @module mcp/auth/mcp-auth
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { verifyToken, extractTokenFromHeader } from '../../auth/jwt.js';
import { apiKeyStore } from '../../store/api-key-store.js';
import { InMemorySessionStore } from '../../store/in-memory-session-store.js';
import { getPermissionsForRoles, Permission } from '../../auth/permissions.js';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import { pino } from 'pino';
import { extractCredentials } from './credential-extractor.js';

/**
 * Authentication context returned by the bridge
 */
export interface AuthContext {
  userId: string;
  username?: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
  apiKeyId?: string;
  authMethod: 'jwt' | 'apikey' | 'session';
}

/**
 * Authentication credentials for MCP requests
 */
export interface MCPAuthCredentials {
  type: 'jwt' | 'apikey' | 'session';
  credentials: string;
}

/**
 * MCP tool permission mapping
 * Maps MCP tool names to required permissions
 */
export const MCP_TOOL_PERMISSIONS: Record<string, Permission> = {
  // Browser control tools
  'navigate': Permission.CONTEXT_EXECUTE,
  'screenshot': Permission.CONTEXT_READ,
  'click': Permission.CONTEXT_EXECUTE,
  'type': Permission.CONTEXT_EXECUTE,
  'scroll': Permission.CONTEXT_EXECUTE,
  'waitForSelector': Permission.CONTEXT_EXECUTE,
  'evaluate': Permission.CONTEXT_EXECUTE,
  
  // Page information tools
  'getTitle': Permission.CONTEXT_READ,
  'getUrl': Permission.CONTEXT_READ,
  'getContent': Permission.CONTEXT_READ,
  'getCookies': Permission.CONTEXT_READ,
  
  // Session management tools
  'createSession': Permission.SESSION_CREATE,
  'closeSession': Permission.SESSION_DELETE,
  'listSessions': Permission.SESSION_LIST,
  
  // Context management tools
  'createContext': Permission.CONTEXT_CREATE,
  'getContext': Permission.CONTEXT_READ,
  'updateContext': Permission.CONTEXT_UPDATE,
  'deleteContext': Permission.CONTEXT_DELETE,
  'listContexts': Permission.CONTEXT_LIST,
};

/**
 * MCP Authentication Bridge
 * Provides unified authentication for MCP requests across different auth methods
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 */
export class MCPAuthBridge {
  private sessionStore: InMemorySessionStore;
  private logger: pino.Logger;

  constructor(sessionStore?: InMemorySessionStore, logger?: pino.Logger) {
    this.sessionStore = sessionStore ?? new InMemorySessionStore();
    this.logger = logger ?? pino({ level: 'info' });
  }

  /**
   * Authenticate an MCP request
   * @nist ia-2 "Identification and authentication"
   * @nist au-3 "Content of audit records"
   */
  async authenticate(auth?: MCPAuthCredentials): Promise<AuthContext> {
    if (!auth) {
      await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
        reason: 'No authentication credentials provided',
        result: 'failure',
        metadata: { context: 'mcp' }
      });
      throw new AppError('Authentication required', 401);
    }

    try {
      switch (auth.type) {
        case 'jwt':
          return await this.authenticateJWT(auth.credentials);
        case 'apikey':
          return await this.authenticateApiKey(auth.credentials);
        case 'session':
          return await this.authenticateSession(auth.credentials);
        default:
          await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
            reason: 'Invalid authentication type',
            result: 'failure',
            metadata: { type: auth.type, context: 'mcp' }
          });
          throw new AppError('Invalid authentication type', 400);
      }
    } catch (error) {
      // Re-throw AppErrors as-is
      if (error instanceof AppError) {
        throw error;
      }
      
      // Log unexpected errors
      this.logger.error({ error }, 'Authentication error');
      throw new AppError('Authentication failed', 401);
    }
  }

  /**
   * Authenticate using JWT token
   * @nist ia-2 "Identification and authentication"
   * @nist ia-5 "Authenticator management"
   */
  private async authenticateJWT(token: string): Promise<AuthContext> {
    try {
      // Handle Bearer token format if already prefixed
      const actualToken = token.startsWith('Bearer ') 
        ? extractTokenFromHeader(token) ?? token
        : token;
      
      // Verify the token
      const decoded = await verifyToken(actualToken);
      
      // Get permissions for roles
      const permissions = getPermissionsForRoles(decoded.roles);
      
      await logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
        userId: decoded.sub,
        result: 'success',
        metadata: { 
          method: 'jwt',
          context: 'mcp',
          sessionId: decoded.sessionId
        }
      });
      
      return {
        userId: decoded.sub,
        username: decoded.username,
        roles: decoded.roles,
        permissions: permissions.map(p => p.toString()),
        sessionId: decoded.sessionId,
        authMethod: 'jwt'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'JWT verification failed';
      await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
        reason: errorMessage,
        result: 'failure',
        metadata: { 
          method: 'jwt', 
          context: 'mcp',
          errorDetails: error instanceof Error ? error.stack : String(error)
        }
      });
      
      // Log the actual error for debugging
      this.logger.error({ error, errorMessage }, 'JWT authentication failed');
      
      throw new AppError('Invalid or expired JWT token', 401);
    }
  }

  /**
   * Authenticate using API key
   * @nist ia-2 "Identification and authentication"
   * @nist ia-5 "Authenticator management"
   */
  private async authenticateApiKey(key: string): Promise<AuthContext> {
    try {
      // Verify the API key
      const apiKey = await apiKeyStore.verify(key);
      
      if (!apiKey) {
        await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
          reason: 'Invalid API key',
          result: 'failure',
          metadata: { method: 'apikey', context: 'mcp' }
        });
        throw new AppError('Invalid API key', 401);
      }
      
      // Get permissions based on roles and scopes
      const rolePermissions = getPermissionsForRoles(apiKey.roles);
      const allPermissions = new Set<string>([
        ...rolePermissions.map(p => p.toString()),
        ...apiKey.scopes
      ]);
      
      await logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
        userId: apiKey.userId,
        result: 'success',
        metadata: { 
          method: 'apikey',
          context: 'mcp',
          apiKeyId: apiKey.id,
          keyPrefix: apiKey.prefix
        }
      });
      
      return {
        userId: apiKey.userId,
        roles: apiKey.roles,
        permissions: Array.from(allPermissions),
        apiKeyId: apiKey.id,
        authMethod: 'apikey'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
        reason: 'API key verification failed',
        result: 'failure',
        metadata: { method: 'apikey', context: 'mcp' }
      });
      throw new AppError('API key authentication failed', 401);
    }
  }

  /**
   * Authenticate using session ID
   * @nist ia-2 "Identification and authentication"
   * @nist ac-3 "Access enforcement"
   */
  private async authenticateSession(sessionId: string): Promise<AuthContext> {
    try {
      // Get session from store
      const session = await this.sessionStore.get(sessionId);
      
      if (!session) {
        await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
          reason: 'Invalid or expired session',
          result: 'failure',
          metadata: { method: 'session', context: 'mcp' }
        });
        throw new AppError('Invalid or expired session', 401);
      }
      
      // Touch session to update last accessed time
      await this.sessionStore.touch(sessionId);
      
      // Get permissions for roles
      const permissions = getPermissionsForRoles(session.data.roles);
      
      await logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
        userId: session.data.userId,
        result: 'success',
        metadata: { 
          method: 'session',
          context: 'mcp',
          sessionId: session.id
        }
      });
      
      return {
        userId: session.data.userId,
        username: session.data.username,
        roles: session.data.roles,
        permissions: permissions.map(p => p.toString()),
        sessionId: session.id,
        authMethod: 'session'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
        reason: 'Session authentication failed',
        result: 'failure',
        metadata: { method: 'session', context: 'mcp' }
      });
      throw new AppError('Session authentication failed', 401);
    }
  }

  /**
   * Check if an auth context has permission for an MCP tool
   * @nist ac-3 "Access enforcement"
   */
  hasToolPermission(authContext: AuthContext, toolName: string): boolean {
    // eslint-disable-next-line security/detect-object-injection
    const requiredPermission = MCP_TOOL_PERMISSIONS[toolName];
    
    if (requiredPermission === null || requiredPermission === undefined) {
      // Unknown tool - deny by default (fail-safe)
      this.logger.warn({ toolName }, 'Unknown MCP tool requested');
      return false;
    }
    
    return authContext.permissions.includes(requiredPermission);
  }

  /**
   * Require permission for an MCP tool or throw error
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async requireToolPermission(authContext: AuthContext, toolName: string): Promise<void> {
    if (!this.hasToolPermission(authContext, toolName)) {
      // eslint-disable-next-line security/detect-object-injection
      const requiredPermission = MCP_TOOL_PERMISSIONS[toolName] ?? 'unknown';
      
      await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
        userId: authContext.userId,
        resource: `mcp:tool:${toolName}`,
        action: requiredPermission,
        result: 'failure',
        metadata: {
          context: 'mcp',
          tool: toolName,
          authMethod: authContext.authMethod,
          userPermissions: authContext.permissions
        }
      });
      
      throw new AppError(
        `Permission denied: ${requiredPermission} required for tool ${toolName}`,
        403
      );
    }
  }

  /**
   * Extract authentication credentials from various sources
   * Delegates to credential-extractor module
   */
  extractCredentials(source: {
    headers?: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[] | undefined>;
    metadata?: Record<string, unknown>;
  }): MCPAuthCredentials | undefined {
    return extractCredentials(source);
  }
}

// Export singleton instance
export const mcpAuthBridge = new MCPAuthBridge();