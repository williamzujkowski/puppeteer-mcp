/**
 * WebSocket request processor
 * @module ws/request-processor
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import { pino } from 'pino';
import type { SessionStore } from '../store/session-store.interface.js';
import { WSConnectionManager } from './connection-manager.js';
import { WSAuthHandler } from './auth-handler.js';
import { WSSessionHandler } from './session-handler.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';
import { sendResponse, sendError } from './message-handler-helpers.js';
import { AppError } from '../core/errors/app-error.js';
import { contextStore } from '../store/context-store.js';
import { Permission, requirePermission } from '../auth/permissions.js';
import {
  type WSRequestMessage,
  type WSConnectionState,
} from '../types/websocket.js';

interface SendResponseOptions {
  ws: WebSocket;
  requestId: string;
  statusCode: number;
  data: unknown;
  error?: { code: string; message: string };
}

/**
 * Route request parameters
 */
interface RouteRequestParams {
  connectionState: WSConnectionState;
  method: string;
  path: string;
  data: unknown;
  headers?: Record<string, string>;
}

interface AuthHandlerWithPermissions extends WSAuthHandler {
  validatePermissions(
    connectionState: { authenticated?: boolean; roles?: string[]; permissions?: string[]; scopes?: string[] },
    requiredPermission?: Permission
  ): boolean;
}

/**
 * WebSocket request processor
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */
export class WSRequestProcessor {
  private logger: pino.Logger;
  private connectionManager: WSConnectionManager;
  private sessionHandler: WSSessionHandler;

  constructor(
    logger: pino.Logger,
    sessionStore: SessionStore,
    connectionManager: WSConnectionManager,
    authHandler: WSAuthHandler
  ) {
    this.logger = logger.child({ module: 'ws-request-processor' });
    this.connectionManager = connectionManager;
    this.sessionHandler = new WSSessionHandler(sessionStore, authHandler, connectionManager);
  }

  /**
   * Handle request message
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  async handleRequestMessage(
    ws: WebSocket,
    connectionId: string,
    message: WSRequestMessage
  ): Promise<void> {
    // Check authentication
    const connectionState = this.connectionManager.getConnectionState(connectionId);
    
    try {
      if (connectionState?.authenticated !== true) {
        sendError({ ws, requestId: message.id, code: 'UNAUTHORIZED', message: 'Authentication required' }, this.logger);
        return;
      }

      // Log API access
      await logSecurityEvent(SecurityEventType.API_ACCESS, {
        resource: message.path,
        action: message.method,
        result: 'success',
        metadata: {
          connectionId,
          userId: connectionState.userId ?? 'unknown',
          requestId: message.id,
        },
      });

      // Route request based on path and method
      const response = await this.routeRequest({
        connectionState,
        method: message.method,
        path: message.path,
        data: message.data,
        headers: message.headers
      });

      // Send response
      sendResponse({ ws, requestId: message.id, status: 200, data: response }, this.logger);

      // Log successful access
      await logSecurityEvent(SecurityEventType.API_ACCESS, {
        resource: message.path,
        action: message.method,
        result: 'success',
        metadata: {
          connectionId,
          userId: connectionState.userId ?? 'unknown',
          requestId: message.id,
        },
      });
    } catch (error) {
      this.logger.error('Request handling error:', error);
      
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      const errorCode = (error as { code?: string }).code ?? 'REQUEST_ERROR';
      const errorMessage = error instanceof Error ? error.message : 'Request failed';

      this.sendResponse({
        ws,
        requestId: message.id,
        statusCode,
        data: null,
        error: {
          code: errorCode,
          message: errorMessage,
        }
      });

      // Log failed access
      await logSecurityEvent(SecurityEventType.API_ACCESS, {
        resource: message.path,
        action: message.method,
        result: 'failure',
        reason: errorMessage,
        metadata: {
          connectionId,
          userId: connectionState?.userId ?? 'unknown',
          requestId: message.id,
          statusCode,
        },
      });
    }
  }

  /**
   * Route request to appropriate handler
   * @nist ac-3 "Access enforcement"
   */
  private routeRequest(params: RouteRequestParams): Promise<unknown> {
    const { connectionState, method, path, data } = params;
    // Parse path
    const pathParts = path.split('/').filter(p => p);
    
    if (pathParts.length === 0) {
      throw new Error('Invalid path');
    }

    const resource = pathParts[0];
    const action = pathParts[1];

    // Route based on resource
    switch (resource) {
      case 'sessions': {
        const sessionId = pathParts[1];
        return this.sessionHandler.handleSessionRequest({
          connectionState,
          method,
          sessionId,
          data,
          action
        });
      }
      
      case 'contexts':
        return this.handleContextRequest(connectionState, method, action, data);
      
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }

  /**
   * Handle context-related requests
   * @nist ac-3 "Access enforcement"
   */
  private async handleContextRequest(
    connectionState: WSConnectionState,
    method: string,
    action: string,
    data: unknown
  ): Promise<unknown> {
    // Validate user is authenticated
    if (!connectionState.userId) {
      throw new AppError('Authentication required', 401);
    }

    // Route based on action
    switch (action) {
      case 'create':
        return this.createContext(connectionState, data);
        
      case 'get':
        return this.getContext(connectionState, data);
        
      case 'update':
        return this.updateContext(connectionState, data);
        
      case 'delete':
        return this.deleteContext(connectionState, data);
        
      case 'list':
        return this.listContexts(connectionState, data);
        
      default:
        throw new AppError(`Unknown context action: ${action}`, 400);
    }
  }

  /**
   * Create a new context
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private async createContext(
    connectionState: WSConnectionState,
    data: unknown
  ): Promise<unknown> {
    // Check permission
    await requirePermission(
      connectionState.userId!,
      connectionState.roles ?? [],
      Permission.CONTEXT_CREATE,
      'context',
      connectionState.scopes
    );

    // Validate input
    const contextData = data as {
      name?: string;
      type: string;
      config?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };

    if (!contextData.type) {
      throw new AppError('Context type is required', 400);
    }

    // Validate context type
    const validTypes = ['browser', 'api', 'database', 'custom'];
    if (!validTypes.includes(contextData.type)) {
      throw new AppError(`Invalid context type: ${contextData.type}`, 400);
    }

    // Create context
    const context = await contextStore.create({
      sessionId: connectionState.sessionId!,
      name: contextData.name ?? `Context-${Date.now()}`,
      type: contextData.type,
      config: contextData.config ?? {},
      metadata: contextData.metadata ?? {},
      status: 'active',
      userId: connectionState.userId!,
    });

    return { 
      context: {
        id: context.id,
        sessionId: context.sessionId,
        name: context.name,
        type: context.type,
        config: context.config,
        metadata: context.metadata,
        createdAt: new Date(context.createdAt).toISOString(),
        updatedAt: new Date(context.updatedAt).toISOString(),
        status: context.status,
        userId: context.userId,
      }
    };
  }

  /**
   * Get context details
   * @nist ac-3 "Access enforcement"
   */
  private async getContext(
    connectionState: WSConnectionState,
    data: unknown
  ): Promise<unknown> {
    // Check permission
    await requirePermission(
      connectionState.userId!,
      connectionState.roles ?? [],
      Permission.CONTEXT_READ,
      'context',
      connectionState.scopes
    );

    const { contextId } = data as { contextId: string };

    if (!contextId) {
      throw new AppError('Context ID is required', 400);
    }

    // Retrieve context
    const context = await contextStore.get(contextId);
    if (!context) {
      throw new AppError('Context not found', 404);
    }

    // Check access
    if (context.userId !== connectionState.userId && !connectionState.roles?.includes('admin')) {
      throw new AppError('Access denied', 403);
    }

    return {
      context: {
        id: context.id,
        sessionId: context.sessionId,
        name: context.name,
        type: context.type,
        config: context.config,
        metadata: context.metadata,
        createdAt: new Date(context.createdAt).toISOString(),
        updatedAt: new Date(context.updatedAt).toISOString(),
        status: context.status,
        userId: context.userId,
      }
    };
  }

  /**
   * Update context
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private async updateContext(
    connectionState: WSConnectionState,
    data: unknown
  ): Promise<unknown> {
    // Check permission
    await requirePermission(
      connectionState.userId!,
      connectionState.roles ?? [],
      Permission.CONTEXT_UPDATE,
      'context',
      connectionState.scopes
    );

    const updateData = data as {
      contextId: string;
      config?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };

    if (!updateData.contextId) {
      throw new AppError('Context ID is required', 400);
    }

    // Retrieve and check access
    const context = await contextStore.get(updateData.contextId);
    if (!context) {
      throw new AppError('Context not found', 404);
    }

    if (context.userId !== connectionState.userId && !connectionState.roles?.includes('admin')) {
      throw new AppError('Access denied', 403);
    }

    // Update context
    const updatedContext = await contextStore.update(updateData.contextId, {
      config: updateData.config ?? context.config,
      metadata: updateData.metadata ?? context.metadata,
    });

    return {
      context: {
        id: updatedContext.id,
        sessionId: updatedContext.sessionId,
        name: updatedContext.name,
        type: updatedContext.type,
        config: updatedContext.config,
        metadata: updatedContext.metadata,
        createdAt: new Date(updatedContext.createdAt).toISOString(),
        updatedAt: new Date(updatedContext.updatedAt).toISOString(),
        status: updatedContext.status,
        userId: updatedContext.userId,
      }
    };
  }

  /**
   * Delete context
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private async deleteContext(
    connectionState: WSConnectionState,
    data: unknown
  ): Promise<unknown> {
    // Check permission
    await requirePermission(
      connectionState.userId!,
      connectionState.roles ?? [],
      Permission.CONTEXT_DELETE,
      'context',
      connectionState.scopes
    );

    const { contextId } = data as { contextId: string };

    if (!contextId) {
      throw new AppError('Context ID is required', 400);
    }

    // Retrieve and check access
    const context = await contextStore.get(contextId);
    if (!context) {
      throw new AppError('Context not found', 404);
    }

    if (context.userId !== connectionState.userId && !connectionState.roles?.includes('admin')) {
      throw new AppError('Access denied', 403);
    }

    // Delete context
    await contextStore.delete(contextId);

    return { success: true };
  }

  /**
   * List contexts for a session
   * @nist ac-3 "Access enforcement"
   */
  private async listContexts(
    connectionState: WSConnectionState,
    data: unknown
  ): Promise<unknown> {
    // Check permission
    await requirePermission(
      connectionState.userId!,
      connectionState.roles ?? [],
      Permission.CONTEXT_LIST,
      'context',
      connectionState.scopes
    );

    const listData = data as {
      filter?: {
        types?: string[];
        statuses?: string[];
      };
      pagination?: {
        pageSize?: number;
        pageToken?: string;
      };
    };

    // List contexts for the user's session
    const contexts = await contextStore.list({
      sessionId: connectionState.sessionId!,
      types: listData.filter?.types,
      statuses: listData.filter?.statuses,
    });

    // Apply pagination
    const pageSize = Math.min(listData.pagination?.pageSize ?? 20, 100);
    const startIndex = listData.pagination?.pageToken 
      ? parseInt(listData.pagination.pageToken, 10) || 0 
      : 0;
    
    const paginatedContexts = contexts.slice(startIndex, startIndex + pageSize);
    const nextPageToken = startIndex + pageSize < contexts.length 
      ? String(startIndex + pageSize) 
      : undefined;

    return {
      contexts: paginatedContexts.map(ctx => ({
        id: ctx.id,
        sessionId: ctx.sessionId,
        name: ctx.name,
        type: ctx.type,
        config: ctx.config,
        metadata: ctx.metadata,
        createdAt: new Date(ctx.createdAt).toISOString(),
        updatedAt: new Date(ctx.updatedAt).toISOString(),
        status: ctx.status,
        userId: ctx.userId,
      })),
      nextPageToken,
      totalCount: contexts.length,
    };
  }

  /**
   * Send response message
   */
  private sendResponse(options: SendResponseOptions): void {
    const { ws, requestId, statusCode, data, error } = options;
    if (error) {
      sendError({ ws, requestId, code: error.code, message: error.message }, this.logger);
    } else {
      sendResponse({ ws, requestId, status: statusCode, data }, this.logger);
    }
  }
}