/**
 * gRPC Session operations coordinator
 * @module grpc/services/session-operations
 * @nist ac-2 "Account management"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import type { SessionStore } from '../../store/session-store.interface.js';
import { SessionCrud } from './session-crud.js';
import { SessionList } from './session-list.js';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionRequest,
  GetSessionResponse,
  UpdateSessionRequest,
  UpdateSessionResponse,
  DeleteSessionRequest,
  DeleteSessionResponse,
  ListSessionsRequest,
  ListSessionsResponse,
} from '../types/session.types.js';

/**
 * Session operations coordinator
 * @nist ac-2 "Account management"
 * @nist ac-3 "Access enforcement"
 */
export class SessionOperations {
  private crud: SessionCrud;
  private list: SessionList;

  constructor(
    logger: pino.Logger,
    sessionStore: SessionStore
  ) {
    this.crud = new SessionCrud(logger, sessionStore);
    this.list = new SessionList(logger, sessionStore);
  }

  /**
   * Create a new session
   * @nist ac-2 "Account management"
   * @nist au-3 "Content of audit records"
   * @evidence code, test
   */
  createSession(
    call: grpc.ServerUnaryCall<CreateSessionRequest, CreateSessionResponse>,
    callback: grpc.sendUnaryData<CreateSessionResponse>
  ): void {
    void this.crud.createSession(call, callback);
  }

  /**
   * Get session details
   * @nist ac-3 "Access enforcement"
   */
  getSession(
    call: grpc.ServerUnaryCall<GetSessionRequest, GetSessionResponse>,
    callback: grpc.sendUnaryData<GetSessionResponse>
  ): void {
    void this.crud.getSession(call, callback);
  }

  /**
   * Update session data
   * @nist ac-2 "Account management"
   * @nist au-3 "Content of audit records"
   */
  updateSession(
    call: grpc.ServerUnaryCall<UpdateSessionRequest, UpdateSessionResponse>,
    callback: grpc.sendUnaryData<UpdateSessionResponse>
  ): void {
    void this.crud.updateSession(call, callback);
  }

  /**
   * Delete a session
   * @nist ac-2 "Account management"
   * @nist au-3 "Content of audit records"
   */
  deleteSession(
    call: grpc.ServerUnaryCall<DeleteSessionRequest, DeleteSessionResponse>,
    callback: grpc.sendUnaryData<DeleteSessionResponse>
  ): void {
    void this.crud.deleteSession(call, callback);
  }

  /**
   * List sessions with filtering
   * @nist ac-3 "Access enforcement"
   */
  listSessions(
    call: grpc.ServerUnaryCall<ListSessionsRequest, ListSessionsResponse>,
    callback: grpc.sendUnaryData<ListSessionsResponse>
  ): void {
    void this.list.listSessions(call, callback);
  }

  /**
   * Batch get sessions
   * @nist ac-3 "Access enforcement"
   */
  batchGetSessions(
    call: grpc.ServerUnaryCall<ListSessionsRequest, ListSessionsResponse>,
    callback: grpc.sendUnaryData<ListSessionsResponse>
  ): void {
    void this.list.batchGetSessions(call, callback);
  }
}