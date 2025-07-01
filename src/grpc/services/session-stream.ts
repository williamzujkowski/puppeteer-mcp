/**
 * gRPC Session streaming operations
 * @module grpc/services/session-stream
 * @nist au-3 "Content of audit records"
 * @nist ac-3 "Access enforcement"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import type { SessionStore } from '../../store/session-store.interface.js';
import { AppError } from '../../core/errors/app-error.js';
import { SessionUtils } from './session-utils.js';
import type {
  StreamSessionEventsRequest,
  SessionEvent,
} from '../types/session-stream.types.js';

/**
 * Session streaming operations
 * @nist au-3 "Content of audit records"
 */
export class SessionStream {
  constructor(
    private logger: pino.Logger,
    private sessionStore: SessionStore
  ) {}

  /**
   * Stream session events
   * @nist au-3 "Content of audit records"
   */
  streamSessionEvents(
    call: grpc.ServerWritableStream<StreamSessionEventsRequest, SessionEvent>
  ): void {
    try {
      const { user_id, session_ids, event_types } = call.request;

      // Check access permission
      const metadata = call.metadata;
      const userId = metadata.get('user-id')?.[0] ?? '';
      const rolesStr = metadata.get('user-roles')?.[0] ?? '';
      const roles = rolesStr !== '' ? rolesStr.split(',') : [];
      
      if (roles.includes('admin') !== true && user_id !== userId) {
        call.emit('error', new AppError('Access denied', 403));
        return;
      }

      // Set up event listener
      const eventHandler = this.createEventHandler(user_id, session_ids, event_types, call);

      // Subscribe to events
      this.sessionStore.on('sessionEvent', eventHandler);

      // Clean up on stream end
      call.on('cancelled', () => {
        this.sessionStore.off('sessionEvent', eventHandler);
      });

      call.on('error', () => {
        this.sessionStore.off('sessionEvent', eventHandler);
      });
    } catch (error) {
      this.logger.error('Error in streamSessionEvents:', error);
      call.emit('error', error);
    }
  }

  private createEventHandler(
    userId: string,
    sessionIds: string[],
    eventTypes: string[],
    call: grpc.ServerWritableStream<StreamSessionEventsRequest, SessionEvent>
  ) {
    return (event: SessionEvent): void => {
      if (!this.shouldIncludeEvent(event, userId, sessionIds, eventTypes)) {
        return;
      }

      this.writeEventToStream(event, call);
    };
  }

  private shouldIncludeEvent(
    event: SessionEvent,
    userId: string,
    sessionIds: string[],
    eventTypes: string[]
  ): boolean {
    if (userId !== undefined && userId !== '' && event.user_id !== userId) {
      return false;
    }
    if (sessionIds !== undefined && sessionIds.length > 0 && !sessionIds.includes(event.session_id)) {
      return false;
    }
    if (eventTypes !== undefined && eventTypes.length > 0 && !eventTypes.includes(event.type)) {
      return false;
    }
    return true;
  }

  private writeEventToStream(
    event: SessionEvent,
    call: grpc.ServerWritableStream<StreamSessionEventsRequest, SessionEvent>
  ): void {
    call.write({
      id: uuidv4(),
      type: event.type,
      session_id: event.sessionId,
      user_id: event.userId,
      timestamp: new Date().toISOString(),
      data: event.data ?? {},
      session: event.session ? SessionUtils.mapSessionToProto(event.session) : undefined,
    });
  }

}