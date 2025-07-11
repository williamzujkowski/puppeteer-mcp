/**
 * Session state management using State pattern
 * @module ws/websocket/session/state-manager
 * @nist ac-3 "Access enforcement"
 */

import type { SessionInfo, SessionState, SessionCreationOptions } from './types.js';
import { SessionState as States } from './types.js';
import type { pino } from 'pino';

/**
 * State transition rules
 */
const STATE_TRANSITIONS: Record<SessionState, SessionState[]> = {
  [States.CREATING]: [States.ACTIVE],
  [States.ACTIVE]: [States.IDLE, States.EXPIRING, States.TERMINATED],
  [States.IDLE]: [States.ACTIVE, States.EXPIRING, States.TERMINATED],
  [States.EXPIRING]: [States.ACTIVE, States.TERMINATED],
  [States.TERMINATED]: [],
};

/**
 * Manages session state and transitions
 * @nist ac-3 "Access enforcement"
 */
export class SessionStateManager {
  private sessions: Map<string, SessionInfo> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();

  constructor(private readonly logger: pino.Logger) {}

  /**
   * Create new session
   */
  async createSession(
    sessionId: string,
    userId: string,
    connectionId: string,
    options?: SessionCreationOptions,
  ): Promise<SessionInfo> {
    const now = new Date();
    const session: SessionInfo = {
      sessionId,
      userId,
      connectionIds: new Set([connectionId]),
      createdAt: now,
      lastActivity: now,
      roles: options?.roles,
      permissions: options?.permissions,
      scopes: options?.scopes,
      metadata: options?.metadata,
      state: options?.initialState ?? States.CREATING,
    };

    this.sessions.set(sessionId, session);
    this.addUserSession(userId, sessionId);

    // Transition to active state
    await this.transitionState(sessionId, States.ACTIVE);

    return session;
  }

  /**
   * Update session
   */
  updateSession(sessionId: string, updates: Partial<SessionInfo>): SessionInfo | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Apply updates
    if (updates.lastActivity) session.lastActivity = updates.lastActivity;
    if (updates.roles) session.roles = updates.roles;
    if (updates.permissions) session.permissions = updates.permissions;
    if (updates.scopes) session.scopes = updates.scopes;
    if (updates.metadata) {
      session.metadata = { ...session.metadata, ...updates.metadata };
    }

    return session;
  }

  /**
   * Add connection to session
   */
  addConnection(sessionId: string, connectionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.connectionIds.add(connectionId);
    session.lastActivity = new Date();

    // If session was idle, make it active
    if (session.state === States.IDLE) {
      void this.transitionState(sessionId, States.ACTIVE);
    }

    return true;
  }

  /**
   * Remove connection from session
   */
  removeConnection(sessionId: string, connectionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.connectionIds.delete(connectionId);
    session.lastActivity = new Date();

    // If no more connections and session is active, make it idle
    if (session.connectionIds.size === 0 && session.state === States.ACTIVE) {
      void this.transitionState(sessionId, States.IDLE);
    }

    return true;
  }

  /**
   * Remove session
   */
  async removeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Transition to terminated state
    await this.transitionState(sessionId, States.TERMINATED);

    // Remove from user sessions
    this.removeUserSession(session.userId, sessionId);

    // Remove session
    this.sessions.delete(sessionId);
  }

  /**
   * Get session
   */
  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get user sessions
   */
  getUserSessions(userId: string): SessionInfo[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];

    return Array.from(sessionIds)
      .map((id) => this.sessions.get(id))
      .filter((session): session is SessionInfo => session !== undefined);
  }

  /**
   * Transition session state
   */
  transitionState(sessionId: string, newState: SessionState): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const currentState = session.state;
    const allowedTransitions = STATE_TRANSITIONS[currentState];

    if (!allowedTransitions.includes(newState)) {
      this.logger.warn('Invalid state transition', {
        sessionId,
        from: currentState,
        to: newState,
      });
      return false;
    }

    session.state = newState;
    session.lastActivity = new Date();

    this.logger.debug('Session state transition', {
      sessionId,
      from: currentState,
      to: newState,
    });

    return true;
  }

  /**
   * Get session count by state
   */
  getSessionCountByState(): Record<SessionState, number> {
    const counts: Record<SessionState, number> = {
      [States.CREATING]: 0,
      [States.ACTIVE]: 0,
      [States.IDLE]: 0,
      [States.EXPIRING]: 0,
      [States.TERMINATED]: 0,
    };

    for (const session of this.sessions.values()) {
      counts[session.state]++;
    }

    return counts;
  }

  /**
   * Mark sessions as expiring based on timeout
   */
  markExpiringSessions(timeout: number): string[] {
    const now = Date.now();
    const expiringIds: string[] = [];

    for (const session of this.sessions.values()) {
      const sessionAge = now - session.lastActivity.getTime();
      const shouldExpire = sessionAge > timeout * 0.9; // 90% of timeout

      if (
        shouldExpire &&
        session.state !== States.EXPIRING &&
        session.state !== States.TERMINATED
      ) {
        void this.transitionState(session.sessionId, States.EXPIRING);
        expiringIds.push(session.sessionId);
      }
    }

    return expiringIds;
  }

  /**
   * Add user session mapping
   */
  private addUserSession(userId: string, sessionId: string): void {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)?.add(sessionId);
  }

  /**
   * Remove user session mapping
   */
  private removeUserSession(userId: string, sessionId: string): void {
    const userSessions = this.userSessions.get(userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userSessions.delete(userId);
      }
    }
  }
}
