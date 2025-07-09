/**
 * In-memory context store implementation
 * @module store/context-store
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';

/**
 * Context interface
 */
export interface Context {
  id: string;
  sessionId: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  status: string;
  userId: string;
  // Proxy support
  proxyConfig?: Record<string, unknown>;
  proxyId?: string;
  browserContextId?: string;
}

/**
 * Context store interface
 */
export interface ContextStore {
  create(context: Omit<Context, 'id' | 'createdAt' | 'updatedAt'>): Promise<Context>;
  get(id: string): Promise<Context | null>;
  update(id: string, updates: Partial<Context>): Promise<Context>;
  delete(id: string): Promise<boolean>;
  list(filter?: {
    sessionId?: string;
    userId?: string;
    types?: string[];
    statuses?: string[];
  }): Promise<Context[]>;
  clear(): Promise<void>;
}

/**
 * In-memory context store implementation
 * @nist ac-3 "Access enforcement"
 */
export class InMemoryContextStore implements ContextStore {
  private contexts: Map<string, Context> = new Map();

  /**
   * Create a new context
   * @nist au-3 "Content of audit records"
   */
  async create(contextData: Omit<Context, 'id' | 'createdAt' | 'updatedAt'>): Promise<Context> {
    const context: Context = {
      ...contextData,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.contexts.set(context.id, context);

    await logSecurityEvent(SecurityEventType.RESOURCE_CREATED, {
      resource: `context:${context.id}`,
      action: 'create',
      result: 'success',
      metadata: {
        userId: context.userId,
        sessionId: context.sessionId,
        type: context.type,
      },
    });

    return context;
  }

  /**
   * Get a context by ID
   */
  get(id: string): Promise<Context | null> {
    return Promise.resolve(this.contexts.get(id) ?? null);
  }

  /**
   * Update a context
   * @nist au-3 "Content of audit records"
   */
  async update(id: string, updates: Partial<Context>): Promise<Context> {
    const context = this.contexts.get(id);
    if (!context) {
      throw new AppError('Context not found', 404);
    }

    // Don't allow updating certain fields
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, createdAt, ...allowedUpdates } = updates;

    const updatedContext = {
      ...context,
      ...allowedUpdates,
      updatedAt: Date.now(),
    };

    this.contexts.set(id, updatedContext);

    await logSecurityEvent(SecurityEventType.RESOURCE_UPDATED, {
      resource: `context:${id}`,
      action: 'update',
      result: 'success',
      metadata: {
        userId: context.userId,
        updatedFields: Object.keys(allowedUpdates),
      },
    });

    return updatedContext;
  }

  /**
   * Delete a context
   * @nist au-3 "Content of audit records"
   */
  async delete(id: string): Promise<boolean> {
    const context = this.contexts.get(id);
    if (!context) {
      return false;
    }

    this.contexts.delete(id);

    await logSecurityEvent(SecurityEventType.RESOURCE_DELETED, {
      resource: `context:${id}`,
      action: 'delete',
      result: 'success',
      metadata: {
        userId: context.userId,
      },
    });

    return true;
  }

  /**
   * List contexts with optional filtering
   */
  list(filter?: {
    sessionId?: string;
    userId?: string;
    types?: string[];
    statuses?: string[];
  }): Promise<Context[]> {
    let contexts = Array.from(this.contexts.values());

    if (filter) {
      contexts = this.applyFilters(contexts, filter);
    }

    return Promise.resolve(contexts);
  }

  /**
   * Apply filters to context list
   * @private
   */
  private applyFilters(
    contexts: Context[],
    filter: {
      sessionId?: string;
      userId?: string;
      types?: string[];
      statuses?: string[];
    },
  ): Context[] {
    let filteredContexts = contexts;

    filteredContexts = this.filterBySessionId(filteredContexts, filter.sessionId);
    filteredContexts = this.filterByUserId(filteredContexts, filter.userId);
    filteredContexts = this.filterByTypes(filteredContexts, filter.types);
    filteredContexts = this.filterByStatuses(filteredContexts, filter.statuses);

    return filteredContexts;
  }

  /**
   * Filter contexts by session ID
   * @private
   */
  private filterBySessionId(contexts: Context[], sessionId?: string): Context[] {
    if (sessionId !== undefined && sessionId !== null && sessionId !== '') {
      return contexts.filter((ctx) => ctx.sessionId === sessionId);
    }
    return contexts;
  }

  /**
   * Filter contexts by user ID
   * @private
   */
  private filterByUserId(contexts: Context[], userId?: string): Context[] {
    if (userId !== undefined && userId !== null && userId !== '') {
      return contexts.filter((ctx) => ctx.userId === userId);
    }
    return contexts;
  }

  /**
   * Filter contexts by types
   * @private
   */
  private filterByTypes(contexts: Context[], types?: string[]): Context[] {
    if (types && types.length > 0) {
      return contexts.filter((ctx) => types.includes(ctx.type));
    }
    return contexts;
  }

  /**
   * Filter contexts by statuses
   * @private
   */
  private filterByStatuses(contexts: Context[], statuses?: string[]): Context[] {
    if (statuses && statuses.length > 0) {
      return contexts.filter((ctx) => statuses.includes(ctx.status));
    }
    return contexts;
  }

  /**
   * Clear all contexts
   */
  clear(): Promise<void> {
    this.contexts.clear();
    return Promise.resolve();
  }
}

/**
 * Singleton instance of context store
 */
export const contextStore = new InMemoryContextStore();
