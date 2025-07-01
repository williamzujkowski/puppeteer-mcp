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
    _sessionStore: SessionStore
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
      const userIdValue = metadata.get('user-id')?.[0];
      const userId = typeof userIdValue === 'string' ? userIdValue : '';
      const rolesValue = metadata.get('user-roles')?.[0];
      const rolesStr = typeof rolesValue === 'string' ? rolesValue : '';
      const roles = rolesStr !== '' ? rolesStr.split(',') : [];
      
      if (roles.includes('admin') !== true && user_id !== userId) {
        call.emit('error', new AppError('Access denied', 403));
        return;
      }

      // Set up event listener
      // const eventHandler = this.createEventHandler(user_id ?? '', session_ids ?? [], event_types ?? [], call);

      // TODO: Implement event streaming when SessionStore supports events
      // this.sessionStore.on('sessionEvent', eventHandler);

      // TODO: Clean up event listeners when SessionStore supports events
      // call.on('cancelled', () => {
      //   this.sessionStore.off('sessionEvent', eventHandler);
      // });

      // call.on('error', () => {
      //   this.sessionStore.off('sessionEvent', eventHandler);
      // });
      
      // For now, just end the stream after a delay
      setTimeout(() => {
        call.end();
      }, 1000);
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
      session_id: event.session_id ?? '',
      user_id: event.user_id ?? '',
      timestamp: new Date().toISOString(),
      data: event.data ?? {},
      session: event.session ? SessionUtils.mapSessionToProto({
        id: event.session.id,
        data: {
          userId: event.session.user_id,
          username: event.session.username,
          roles: event.session.roles,
          createdAt: event.session.created_at,
          expiresAt: event.session.expires_at,
          metadata: event.session.data,
        },
        lastAccessedAt: event.session.last_accessed_at,
      }) : undefined,
    });
  }

}