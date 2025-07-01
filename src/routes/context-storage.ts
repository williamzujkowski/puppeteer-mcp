/**
 * Context storage management
 * @module routes/context-storage
 * @nist ac-3 "Access enforcement"
 * @nist au-2 "Audit events"
 */

import { AppError } from '../core/errors/app-error.js';
import { logDataAccess } from '../utils/logger.js';
import type { Context } from './context-validators.js';
import type { contextConfigSchema } from './context-validators.js';
import { z } from 'zod';

/**
 * Context storage manager
 * @nist ac-3 "Access enforcement"
 */
export class ContextStorage {
  // In-memory storage for contexts (replace with proper storage in production)
  private contexts = new Map<string, Context>();
  private userContexts = new Map<string, Set<string>>();

  /**
   * Create a new context
   * @nist au-2 "Audit events"
   */
  async createContext(
    userId: string,
    config: z.infer<typeof contextConfigSchema>
  ): Promise<Context> {
    // Generate context ID
    const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create context object
    const context: Context = {
      id: contextId,
      userId,
      config,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      status: 'active',
    };

    // Store context
    this.contexts.set(contextId, context);

    // Track user contexts
    if (!this.userContexts.has(userId)) {
      this.userContexts.set(userId, new Set());
    }
    const userContextSet = this.userContexts.get(userId);
    if (userContextSet !== undefined) {
      userContextSet.add(contextId);
    }

    // Log context creation
    await logDataAccess('WRITE', `context/${contextId}`, {
      userId,
      action: 'create_context',
      contextName: config.name,
    });

    return context;
  }

  /**
   * Get all contexts for a user
   * @nist au-2 "Audit events"
   */
  async getUserContexts(userId: string): Promise<Context[]> {
    const userContextIds = this.userContexts.get(userId) ?? new Set();
    const userContextList = Array.from(userContextIds)
      .map((id) => this.contexts.get(id))
      .filter((ctx): ctx is Context => ctx !== undefined);

    // Log data access
    await logDataAccess('READ', 'contexts', {
      userId,
      action: 'list_contexts',
      count: userContextList.length,
    });

    return userContextList;
  }

  /**
   * Get a specific context
   * @nist ac-3 "Access enforcement"
   */
  async getContext(contextId: string, userId: string, userRoles: string[]): Promise<Context> {
    const context = this.contexts.get(contextId);

    if (!context) {
      throw new AppError('Context not found', 404);
    }

    // Check ownership
    if (context.userId !== userId && !userRoles.includes('admin')) {
      throw new AppError('Access denied', 403);
    }

    // Update last used timestamp
    context.lastUsedAt = new Date().toISOString();

    // Log data access
    await logDataAccess('READ', `context/${contextId}`, {
      userId,
      action: 'get_context',
    });

    return context;
  }

  /**
   * Update a context
   * @nist ac-3 "Access enforcement"
   * @nist au-2 "Audit events"
   */
  async updateContext(
    contextId: string,
    updates: Partial<z.infer<typeof contextConfigSchema>>,
    userId: string,
    userRoles: string[]
  ): Promise<Context> {
    const context = this.contexts.get(contextId);

    if (!context) {
      throw new AppError('Context not found', 404);
    }

    // Check ownership
    if (context.userId !== userId && !userRoles.includes('admin')) {
      throw new AppError('Access denied', 403);
    }

    // Update context
    context.config = { ...context.config, ...updates };
    context.lastUsedAt = new Date().toISOString();

    // Log data modification
    await logDataAccess('WRITE', `context/${contextId}`, {
      userId,
      action: 'update_context',
      updates: Object.keys(updates),
    });

    return context;
  }

  /**
   * Delete a context
   * @nist ac-3 "Access enforcement"
   * @nist au-2 "Audit events"
   */
  async deleteContext(
    contextId: string,
    userId: string,
    userRoles: string[]
  ): Promise<void> {
    const context = this.contexts.get(contextId);

    if (!context) {
      throw new AppError('Context not found', 404);
    }

    // Check ownership
    if (context.userId !== userId && !userRoles.includes('admin')) {
      throw new AppError('Access denied', 403);
    }

    // Remove context
    this.contexts.delete(contextId);
    this.userContexts.get(context.userId)?.delete(contextId);

    // Log data deletion
    await logDataAccess('DELETE', `context/${contextId}`, {
      userId,
      action: 'delete_context',
      contextName: context.config.name,
    });
  }

  /**
   * Update context last used timestamp
   * @nist ac-3 "Access enforcement"
   */
  touchContext(
    contextId: string,
    userId: string,
    userRoles: string[]
  ): Context {
    const context = this.contexts.get(contextId);

    if (!context) {
      throw new AppError('Context not found', 404);
    }

    // Check ownership
    if (context.userId !== userId && !userRoles.includes('admin')) {
      throw new AppError('Access denied', 403);
    }

    // Update last used timestamp
    context.lastUsedAt = new Date().toISOString();

    return context;
  }
}