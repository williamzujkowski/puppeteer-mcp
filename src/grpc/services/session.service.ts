/**
 * gRPC Session service implementation
 * @module grpc/services/session
 * @nist ac-2 "Account management"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import { pino } from 'pino';
import type { SessionStore } from '../../store/session-store.interface.js';
import { SessionOperations } from './session-operations.js';
import { SessionAuth } from './session-auth.js';
import { SessionStream } from './session-stream.js';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionRequest,
  GetSessionResponse,
  UpdateSessionRequest,
  UpdateSessionResponse,
  DeleteSessionRequest,
  DeleteSessionResponse,
  RefreshSessionRequest,
  RefreshSessionResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  ValidateSessionRequest,
  ValidateSessionResponse,
} from '../types/session.types.js';
import type {
  StreamSessionEventsRequest,
  SessionEvent,
} from '../types/session-stream.types.js';

/**
 * Session service implementation
 * @nist ac-2 "Account management"
 * @nist ac-3 "Access enforcement"
 */
export class SessionServiceImpl {
  private operations: SessionOperations;
  private auth: SessionAuth;
  private stream: SessionStream;

  constructor(
    logger: pino.Logger,
    sessionStore: SessionStore
  ) {
    this.operations = new SessionOperations(logger, sessionStore);
    this.auth = new SessionAuth(logger, sessionStore);
    this.stream = new SessionStream(logger, sessionStore);
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
    this.operations.createSession(call, callback);
  }

  /**
   * Get session details
   * @nist ac-3 "Access enforcement"
   */
  getSession(
    call: grpc.ServerUnaryCall<GetSessionRequest, GetSessionResponse>,
    callback: grpc.sendUnaryData<GetSessionResponse>
  ): void {
    this.operations.getSession(call, callback);
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
    this.operations.updateSession(call, callback);
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
    this.operations.deleteSession(call, callback);
  }

  /**
   * List sessions with filtering
   * @nist ac-3 "Access enforcement"
   */
  listSessions(
    call: grpc.ServerUnaryCall<ListSessionsRequest, ListSessionsResponse>,
    callback: grpc.sendUnaryData<ListSessionsResponse>
  ): void {
    this.operations.listSessions(call, callback);
  }

  /**
   * Batch get sessions
   * @nist ac-3 "Access enforcement"
   */
  batchGetSessions(
    call: grpc.ServerUnaryCall<ListSessionsRequest, ListSessionsResponse>,
    callback: grpc.sendUnaryData<ListSessionsResponse>
  ): void {
    this.operations.batchGetSessions(call, callback);
  }

  /**
   * Stream session events
   * @nist au-3 "Content of audit records"
   */
  streamSessionEvents(
    call: grpc.ServerWritableStream<StreamSessionEventsRequest, SessionEvent>
  ): void {
    return this.stream.streamSessionEvents(call);
  }

  /**
   * Refresh session token
   * @nist ia-2 "Identification and authentication"
   * @nist au-3 "Content of audit records"
   */
  refreshSession(
    call: grpc.ServerUnaryCall<RefreshSessionRequest, RefreshSessionResponse>,
    callback: grpc.sendUnaryData<RefreshSessionResponse>
  ): void {
    void this.auth.refreshSession(call, callback);
  }

  /**
   * Validate session
   * @nist ia-2 "Identification and authentication"
   */
  validateSession(
    call: grpc.ServerUnaryCall<ValidateSessionRequest, ValidateSessionResponse>,
    callback: grpc.sendUnaryData<ValidateSessionResponse>
  ): void {
    void this.auth.validateSession(call, callback);
  }
}