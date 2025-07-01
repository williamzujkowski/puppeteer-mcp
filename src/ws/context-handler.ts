/**
 * WebSocket context request handler
 * @module ws/context-handler
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 * @nist au-3 "Content of audit records"
 */

import type { WSConnectionState } from '../types/websocket.js';
import { contextStore, type Context } from '../store/context-store.js';
import { Permission, requirePermission } from '../auth/permissions.js';
import { AppError } from '../core/errors/app-error.js';

/**
 * Context request data interfaces
 */
interface CreateContextData {
  name?: string;
  type: string;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface ContextIdData {
  contextId: string;
}

interface UpdateContextData extends ContextIdData {
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface ListContextsData {
  filter?: { types?: string[]; statuses?: string[] };
  pagination?: { pageSize?: number; pageToken?: string };
}

/**
 * WebSocket context request handler
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */
export class WSContextHandler {
  /**
   * Handle context-related requests
   * @nist ac-3 "Access enforcement"
   */
  handleContextRequest(
    connectionState: WSConnectionState,
    _method: string,
    action: string,
    data: unknown
  ): Promise<unknown> {
    if (connectionState.userId === null || connectionState.userId === '') {
      throw new AppError('Authentication required', 401);
    }

    switch (action) {
      case 'create': return this.createContext(connectionState, data);
      case 'get': return this.getContext(connectionState, data);
      case 'update': return this.updateContext(connectionState, data);
      case 'delete': return this.deleteContext(connectionState, data);
      case 'list': return this.listContexts(connectionState, data);
      default: throw new AppError(`Unknown context action: ${action}`, 400);
    }
  }

  private async checkPermission(state: WSConnectionState, perm: Permission): Promise<void> {
    await requirePermission({
      userId: state.userId as string,
      roles: state.roles ?? [],
      permission: perm,
      resource: 'context',
      scopes: state.scopes
    });
  }

  private checkAccess(context: { userId: string }, state: WSConnectionState): void {
    const isAdmin = state.roles?.includes('admin') === true;
    if (context.userId !== state.userId && !isAdmin) {
      throw new AppError('Access denied', 403);
    }
  }

  private formatContext(ctx: Context): Record<string, unknown> {
    return {
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
    };
  }

  private async getAndValidate(id: string, state: WSConnectionState): Promise<Context> {
    const context = await contextStore.get(id);
    if (!context) {throw new AppError('Context not found', 404);}
    this.checkAccess(context, state);
    return context;
  }

  /**
   * Create a new context
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private async createContext(
    state: WSConnectionState,
    data: unknown
  ): Promise<unknown> {
    await this.checkPermission(state, Permission.CONTEXT_CREATE);

    const input = data as CreateContextData;
    if (!input.type) {throw new AppError('Context type is required', 400);}

    const validTypes = ['browser', 'api', 'database', 'custom'];
    if (!validTypes.includes(input.type)) {
      throw new AppError(`Invalid context type: ${input.type}`, 400);
    }

    if (state.sessionId === null || state.sessionId === '') {
      throw new AppError('Session required to create context', 400);
    }

    const context = await contextStore.create({
      sessionId: state.sessionId as string,
      name: input.name ?? `Context-${Date.now()}`,
      type: input.type,
      config: input.config ?? {},
      metadata: input.metadata ?? {},
      status: 'active',
      userId: state.userId as string,
    });

    return { context: this.formatContext(context) };
  }

  /**
   * Get context details
   * @nist ac-3 "Access enforcement"
   */
  private async getContext(
    state: WSConnectionState,
    data: unknown
  ): Promise<unknown> {
    await this.checkPermission(state, Permission.CONTEXT_READ);

    const input = data as ContextIdData;
    if (!input.contextId) {throw new AppError('Context ID is required', 400);}

    const context = await this.getAndValidate(input.contextId, state);
    return { context: this.formatContext(context) };
  }

  /**
   * Update context
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private async updateContext(
    state: WSConnectionState,
    data: unknown
  ): Promise<unknown> {
    await this.checkPermission(state, Permission.CONTEXT_UPDATE);

    const input = data as UpdateContextData;
    if (!input.contextId) {throw new AppError('Context ID is required', 400);}

    const context = await this.getAndValidate(input.contextId, state);
    const updated = await contextStore.update(input.contextId, {
      config: input.config ?? context.config,
      metadata: input.metadata ?? context.metadata,
    });

    return { context: this.formatContext(updated) };
  }

  /**
   * Delete context
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private async deleteContext(
    state: WSConnectionState,
    data: unknown
  ): Promise<unknown> {
    await this.checkPermission(state, Permission.CONTEXT_DELETE);

    const input = data as ContextIdData;
    if (!input.contextId) {throw new AppError('Context ID is required', 400);}

    await this.getAndValidate(input.contextId, state);
    await contextStore.delete(input.contextId);
    return { success: true };
  }

  /**
   * List contexts for a session
   * @nist ac-3 "Access enforcement"
   */
  private async listContexts(
    state: WSConnectionState,
    data: unknown
  ): Promise<unknown> {
    await this.checkPermission(state, Permission.CONTEXT_LIST);

    if (state.sessionId === null || state.sessionId === '') {
      throw new AppError('Session required to list contexts', 400);
    }

    const input = data as ListContextsData;
    const contexts = await contextStore.list({
      sessionId: state.sessionId,
      types: input.filter?.types,
      statuses: input.filter?.statuses,
    });

    const pageSize = Math.min(input.pagination?.pageSize ?? 20, 100);
    const token = input.pagination?.pageToken;
    const startIdx = (token !== null && token !== undefined && token !== '') ? parseInt(token, 10) || 0 : 0;
    
    const page = contexts.slice(startIdx, startIdx + pageSize);
    const nextToken = startIdx + pageSize < contexts.length 
      ? String(startIdx + pageSize) : undefined;

    return {
      contexts: page.map(ctx => this.formatContext(ctx)),
      nextPageToken: nextToken,
      totalCount: contexts.length,
    };
  }
}