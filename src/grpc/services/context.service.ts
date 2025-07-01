/**
 * gRPC Context service implementation
 * @module grpc/services/context
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @nist si-10 "Information input validation"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import type { SessionStore } from '../../store/session-store.interface.js';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import {
  validateContextType,
  checkContextAccess,
  validateRequiredField,
  toProtoTimestamp,
  parsePagination,
} from './context-helpers.js';
import { CommandExecutor } from './command-executor.js';
import type {
  CreateContextRequest,
  CreateContextResponse,
  GetContextRequest,
  GetContextResponse,
  UpdateContextRequest,
  UpdateContextResponse,
  DeleteContextRequest,
  DeleteContextResponse,
  ListContextsRequest,
  ListContextsResponse,
  ExecuteCommandRequest,
  ExecuteCommandResponse,
  StreamContextEventsRequest,
  ContextEvent,
  ContextProto,
} from '../types/context.types.js';
import type {
  AuthenticatedServerUnaryCall,
  AuthenticatedServerWritableStream,
} from '../interceptors/types.js';
import { contextStore, type Context } from '../../store/context-store.js';

/**
 * Context service implementation
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */
export class ContextServiceImpl {
  private commandExecutor: CommandExecutor;

  constructor(
    private logger: pino.Logger,
    private sessionStore: SessionStore,
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
    call: AuthenticatedServerUnaryCall<CreateContextRequest, CreateContextResponse>,
    callback: grpc.sendUnaryData<CreateContextResponse>,
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
      const context = await contextStore.create({
        sessionId: session_id,
        name: name ?? `Context-${Date.now()}`,
        type,
        config: config ?? {},
        metadata: metadata ?? {},
        status: 'CONTEXT_STATUS_ACTIVE',
        userId: call.userId ?? '',
      });

      // Log context creation
      await logSecurityEvent(SecurityEventType.RESOURCE_CREATED, {
        resource: `context/${context.id}`,
        action: 'create',
        result: 'success',
        metadata: {
          sessionId: session_id,
          userId: call.userId,
          type,
          contextId: context.id,
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
  async getContext(
    call: AuthenticatedServerUnaryCall<GetContextRequest, GetContextResponse>,
    callback: grpc.sendUnaryData<GetContextResponse>,
  ): Promise<void> {
    try {
      const { context_id } = call.request;

      validateRequiredField(context_id, 'Context ID');

      const context = await contextStore.get(context_id);

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
    call: AuthenticatedServerUnaryCall<UpdateContextRequest, UpdateContextResponse>,
    callback: grpc.sendUnaryData<UpdateContextResponse>,
  ): Promise<void> {
    try {
      const { context_id, config, metadata, update_mask } = call.request;

      validateRequiredField(context_id, 'Context ID');

      const context = await contextStore.get(context_id);

      if (!context) {
        throw new AppError('Context not found', 404);
      }

      // Check access permission
      checkContextAccess(context, call.userId, call.roles);

      // Apply updates and save
      await contextStore.update(context_id, {
        config: config ?? context.config,
        metadata: metadata ?? context.metadata,
      });

      // Log context update
      await logSecurityEvent(SecurityEventType.RESOURCE_UPDATED, {
        resource: `context:${context_id}`,
        action: 'update',
        result: 'success',
        metadata: {
          userId: call.userId,
          updatedFields: update_mask ?? ['config', 'metadata'],
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
    call: AuthenticatedServerUnaryCall<DeleteContextRequest, DeleteContextResponse>,
    callback: grpc.sendUnaryData<DeleteContextResponse>,
  ): Promise<void> {
    try {
      const { context_id } = call.request;

      validateRequiredField(context_id, 'Context ID');

      const context = await contextStore.get(context_id);

      if (!context) {
        throw new AppError('Context not found', 404);
      }

      // Check access permission
      checkContextAccess(context, call.userId, call.roles);

      // Clean up context resources
      await contextStore.update(context_id, { status: 'CONTEXT_STATUS_TERMINATED' });
      await contextStore.delete(context_id);

      // Log context deletion
      await logSecurityEvent(SecurityEventType.RESOURCE_DELETED, {
        resource: `context:${context_id}`,
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
    call: AuthenticatedServerUnaryCall<ListContextsRequest, ListContextsResponse>,
    callback: grpc.sendUnaryData<ListContextsResponse>,
  ): Promise<void> {
    try {
      const { session_id, filter, pagination } = call.request;

      validateRequiredField(session_id, 'Session ID');

      // Verify session access
      const session = await this.sessionStore.get(session_id);
      if (!session) {
        throw new AppError('Session not found', 404);
      }

      checkContextAccess({ userId: session.data.userId } as Context, call.userId, call.roles);

      // Filter contexts
      const allContexts = await contextStore.list({
        sessionId: session_id,
        types: filter?.types,
        statuses: filter?.statuses,
      });

      // Paginate
      const { pageSize, offset } = parsePagination(pagination);
      const paginatedContexts = allContexts.slice(offset, offset + pageSize);

      callback(null, {
        contexts: paginatedContexts.map((ctx) => this.mapContextToProto(ctx)),
        next_page_token:
          offset + pageSize < allContexts.length ? String(offset + pageSize) : undefined,
        total_count: allContexts.length,
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
    call: AuthenticatedServerWritableStream<StreamContextEventsRequest, ContextEvent>,
  ): Promise<void> {
    try {
      const { session_id } = call.request;

      // Verify session access
      if (session_id !== null && session_id !== undefined && session_id !== '') {
        const session = await this.sessionStore.get(session_id);
        if (!session) {
          call.emit('error', new AppError('Session not found', 404));
          return;
        }

        try {
          checkContextAccess({ userId: session.data.userId } as Context, call.userId, call.roles);
        } catch (error) {
          call.emit('error', error);
          return;
        }
      }

      // TODO: Implement actual event streaming
      // For now, send a test event
      setTimeout(() => {
        call.write({
          event_type: 'CONTEXT_EVENT_TYPE_CREATED',
          context_id: 'test-context',
          session_id: session_id ?? 'test-session',
          timestamp: new Date().toISOString(),
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
  async executeCommand(
    call: AuthenticatedServerUnaryCall<ExecuteCommandRequest, ExecuteCommandResponse>,
    callback: grpc.sendUnaryData<ExecuteCommandResponse>,
  ): Promise<void> {
    try {
      const { context_id } = call.request;
      validateRequiredField(context_id, 'Context ID');

      const context = await contextStore.get(context_id);
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
  async streamCommand(
    call: AuthenticatedServerWritableStream<ExecuteCommandRequest, ExecuteCommandResponse>,
  ): Promise<void> {
    try {
      const { context_id } = call.request;

      try {
        validateRequiredField(context_id, 'Context ID');
      } catch (error) {
        call.emit('error', error);
        return;
      }

      const context = await contextStore.get(context_id);
      if (!context) {
        call.emit('error', new AppError('Context not found', 404));
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
  private mapContextToProto(context: Context): ContextProto {
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
