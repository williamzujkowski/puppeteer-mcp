/**
 * gRPC Context service implementation
 * @module grpc/services/context
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @nist si-10 "Information input validation"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import type { SessionStore } from '../../store/session-store.interface.js';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import {
  validateContextType,
  checkContextAccess,
  validateRequiredField,
  applyFieldUpdates,
  shouldIncludeContext,
  toProtoTimestamp,
  parsePagination,
  createPaginationResponse,
  type ContextFilter
} from './context-helpers.js';
import { CommandExecutor } from './command-executor.js';

// Context interface
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
}

// In-memory context store (should be replaced with proper storage)
const contexts = new Map<string, Context>();

/**
 * Context service implementation
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */
export class ContextServiceImpl {
  private commandExecutor: CommandExecutor;

  constructor(
    private logger: pino.Logger,
    private sessionStore: SessionStore
  ) {
    this.commandExecutor = new CommandExecutor(logger);
  }

  /**
   * Create a new context
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   * @evidence code, test
   */
  async createContext(
    call: grpc.ServerUnaryCall<unknown, unknown>,
    callback: grpc.sendUnaryData<unknown>
  ): Promise<void> {
    try {
      const { session_id, name, type, config, metadata } = call.request;

      // Validate session ownership
      if (call.session?.id !== session_id) {
        throw new AppError('Session mismatch', 403);
      }

      // Validate context type
      validateContextType(type);

      // Create context
      const contextId = uuidv4();
      const now = Date.now();
      
      const context: Context = {
        id: contextId,
        sessionId: session_id,
        name: name ?? `Context-${contextId.substring(0, 8)}`,
        type,
        config: config ?? {},
        metadata: metadata ?? {},
        createdAt: now,
        updatedAt: now,
        status: 'CONTEXT_STATUS_ACTIVE',
        userId: call.userId ?? '',
      };

      contexts.set(contextId, context);

      // Log context creation
      await logSecurityEvent(SecurityEventType.RESOURCE_CREATED, {
        resource: `context/${contextId}`,
        action: 'create',
        result: 'success',
        metadata: {
          sessionId: session_id,
          userId: call.userId,
          type,
          contextId,
        },
      });

      callback(null, {
        context: this.mapContextToProto(context),
      });
    } catch (error) {
      this.logger.error('Error creating context:', error);
      callback(error as grpc.ServiceError);
    }
  }

  /**
   * Get context details
   * @nist ac-3 "Access enforcement"
   */
  getContext(
    call: grpc.ServerUnaryCall<unknown, unknown>,
    callback: grpc.sendUnaryData<unknown>
  ): void {
    try {
      const { context_id } = call.request;

      validateRequiredField(context_id, 'Context ID');

      const context = contexts.get(context_id);

      if (!context) {
        throw new AppError('Context not found', 404);
      }

      // Check access permission
      checkContextAccess(context, call.userId, call.roles);

      callback(null, {
        context: this.mapContextToProto(context),
      });
    } catch (error) {
      callback(error as grpc.ServiceError);
    }
  }

  /**
   * Update context
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async updateContext(
    call: grpc.ServerUnaryCall<unknown, unknown>,
    callback: grpc.sendUnaryData<unknown>
  ): Promise<void> {
    try {
      const { context_id, config, metadata, update_mask } = call.request;

      validateRequiredField(context_id, 'Context ID');

      const context = contexts.get(context_id);

      if (!context) {
        throw new AppError('Context not found', 404);
      }

      // Check access permission
      checkContextAccess(context, call.userId, call.roles);

      // Apply updates
      applyFieldUpdates(context.config, config, 'config', update_mask);
      applyFieldUpdates(context.metadata, metadata, 'metadata', update_mask);

      context.updatedAt = Date.now();

      // Log context update
      await logSecurityEvent(SecurityEventType.RESOURCE_UPDATED, {
        resource: 'context',
        resourceId: context_id,
        action: 'update',
        result: 'success',
        metadata: {
          userId: call.userId,
          updatedFields: update_mask?.paths ?? ['config', 'metadata'],
        },
      });

      callback(null, {
        context: this.mapContextToProto(context),
      });
    } catch (error) {
      callback(error as grpc.ServiceError);
    }
  }

  /**
   * Delete context
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async deleteContext(
    call: grpc.ServerUnaryCall<unknown, unknown>,
    callback: grpc.sendUnaryData<unknown>
  ): Promise<void> {
    try {
      const { context_id } = call.request;

      validateRequiredField(context_id, 'Context ID');

      const context = contexts.get(context_id);

      if (!context) {
        throw new AppError('Context not found', 404);
      }

      // Check access permission
      checkContextAccess(context, call.userId, call.roles);

      // Clean up context resources
      context.status = 'CONTEXT_STATUS_TERMINATED';
      contexts.delete(context_id);

      // Log context deletion
      await logSecurityEvent(SecurityEventType.RESOURCE_DELETED, {
        resource: 'context',
        resourceId: context_id,
        action: 'delete',
        result: 'success',
        metadata: {
          userId: call.userId,
        },
      });

      callback(null, { success: true });
    } catch (error) {
      callback(error as grpc.ServiceError);
    }
  }

  /**
   * List contexts for a session
   * @nist ac-3 "Access enforcement"
   */
  async listContexts(
    call: grpc.ServerUnaryCall<unknown, unknown>,
    callback: grpc.sendUnaryData<unknown>
  ): Promise<void> {
    try {
      const { session_id, filter, pagination } = call.request;

      validateRequiredField(session_id, 'Session ID');

      // Verify session access
      const session = await this.sessionStore.get(session_id);
      if (!session) {
        throw new AppError('Session not found', 'NOT_FOUND');
      }

      checkContextAccess({ userId: session.userId } as Context, call.userId, call.roles);

      // Filter contexts
      const allContexts = Array.from(contexts.values())
        .filter(ctx => ctx.sessionId === session_id)
        .filter(ctx => shouldIncludeContext(ctx, filter as ContextFilter));

      // Paginate
      const { pageSize, offset } = parsePagination(pagination);
      const paginatedContexts = allContexts.slice(offset, offset + pageSize);

      callback(null, {
        contexts: paginatedContexts.map(ctx => this.mapContextToProto(ctx)),
        pagination: createPaginationResponse(
          allContexts.length,
          offset,
          pageSize,
          paginatedContexts.length
        ),
      });
    } catch (error) {
      callback(error as grpc.ServiceError);
    }
  }

  /**
   * Stream context events
   * @nist au-3 "Content of audit records"
   */
  async streamContextEvents(
    call: grpc.ServerWritableStream<unknown, unknown>
  ): Promise<void> {
    try {
      const { session_id } = call.request;

      // Verify session access
      if (session_id !== null && session_id !== undefined && session_id !== '') {
        const session = await this.sessionStore.get(session_id);
        if (!session) {
          call.emit('error', new AppError('Session not found', 'NOT_FOUND'));
          return;
        }

        try {
          checkContextAccess({ userId: session.userId } as Context, call.userId, call.roles);
        } catch (error) {
          call.emit('error', error);
          return;
        }
      }

      // TODO: Implement actual event streaming
      // For now, send a test event
      setTimeout(() => {
        call.write({
          id: uuidv4(),
          type: 'CONTEXT_EVENT_TYPE_CREATED',
          context_id: 'test-context',
          session_id: session_id ?? 'test-session',
          timestamp: {
            seconds: Math.floor(Date.now() / 1000),
            nanos: (Date.now() % 1000) * 1000000,
          },
          data: { test: 'event' },
        });
      }, 1000);

      // Keep stream open
      call.on('cancelled', () => {
        this.logger.info('Context event stream cancelled');
      });
    } catch (error) {
      this.logger.error('Error in streamContextEvents:', error);
      call.emit('error', error);
    }
  }

  /**
   * Execute command in context
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   * @nist au-3 "Content of audit records"
   */
  executeCommand(
    call: grpc.ServerUnaryCall<unknown, unknown>,
    callback: grpc.sendUnaryData<unknown>
  ): void {
    try {
      const { context_id } = call.request;
      validateRequiredField(context_id, 'Context ID');

      const context = contexts.get(context_id);
      if (!context) {
        throw new AppError('Context not found', 404);
      }

      // Delegate to command executor
      this.commandExecutor.executeCommand(call, callback, context).catch((error) => {
        callback(error as grpc.ServiceError);
      });
    } catch (error) {
      callback(error as grpc.ServiceError);
    }
  }

  /**
   * Stream command execution
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  streamCommand(
    call: grpc.ServerWritableStream<unknown, unknown>
  ): void {
    try {
      const { context_id } = call.request;
      
      try {
        validateRequiredField(context_id, 'Context ID');
      } catch (error) {
        call.emit('error', error);
        return;
      }

      const context = contexts.get(context_id);
      if (!context) {
        call.emit('error', new AppError('Context not found', 'NOT_FOUND'));
        return;
      }

      this.commandExecutor.streamCommand(call, context);
    } catch (error) {
      this.logger.error('Error in streamCommand:', error);
      call.emit('error', error);
    }
  }

  /**
   * Map internal context to proto format
   */
  private mapContextToProto(context: Context): unknown {
    return {
      id: context.id,
      session_id: context.sessionId,
      name: context.name,
      type: context.type,
      config: context.config,
      metadata: context.metadata,
      created_at: toProtoTimestamp(context.createdAt),
      updated_at: toProtoTimestamp(context.updatedAt),
      status: context.status,
    };
  }

}