/**
 * Session persistence management
 * @module ws/websocket/session/persistence-manager
 * @nist ac-3 "Access enforcement"
 * @nist cp-9 "Information system backup"
 */

import type { SessionStore } from '../../../store/session-store.interface.js';
import type { SessionInfo, SessionPersistenceData } from './types.js';
import type { SessionEventEmitter } from './event-emitter.js';
import type { pino } from 'pino';

/**
 * Manages session persistence and recovery
 * @nist cp-9 "Information system backup"
 */
export class SessionPersistenceManager {
  private persistenceQueue: Map<string, SessionInfo> = new Map();
  private persistenceInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly logger: pino.Logger,
    private readonly sessionStore: SessionStore,
    private readonly eventEmitter: SessionEventEmitter,
    private readonly options: {
      persistSessions: boolean;
      batchSize?: number;
      flushInterval?: number;
    },
  ) {}

  /**
   * Start persistence management
   */
  start(): void {
    if (!this.options.persistSessions) {
      this.logger.info('Session persistence disabled');
      return;
    }

    this.logger.info('Starting session persistence management', {
      batchSize: this.options.batchSize ?? 10,
      flushInterval: this.options.flushInterval ?? 5000,
    });

    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Stop persistence management
   */
  async stop(): Promise<void> {
    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval);
      this.persistenceInterval = null;
    }

    // Flush any pending sessions
    await this.flushPendingSessions();
  }

  /**
   * Queue session for persistence
   */
  async queueSession(session: SessionInfo): Promise<void> {
    if (!this.options.persistSessions) return;

    this.persistenceQueue.set(session.sessionId, session);

    // Check if we should flush immediately
    if (this.persistenceQueue.size >= (this.options.batchSize ?? 10)) {
      await this.flushPendingSessions();
    }
  }

  /**
   * Persist session immediately
   */
  async persistSession(session: SessionInfo): Promise<void> {
    if (!this.options.persistSessions) return;

    try {
      const persistenceData = this.convertToPersistenceData(session);
      
      await this.sessionStore.updateSession(session.sessionId, {
        userId: session.userId,
        roles: session.roles ?? [],
        permissions: session.permissions ?? [],
        scopes: session.scopes ?? [],
        metadata: {
          ...session.metadata,
          wsConnections: Array.from(session.connectionIds),
          lastActivity: session.lastActivity.toISOString(),
          state: session.state,
        },
      });

      this.logger.debug('Session persisted', { sessionId: session.sessionId });
    } catch (error) {
      this.logger.error('Failed to persist session', {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      this.eventEmitter.emit('persistence:error', session.sessionId, error as Error);
    }
  }

  /**
   * Remove session from persistence
   */
  async removeSession(sessionId: string): Promise<void> {
    if (!this.options.persistSessions) return;

    try {
      await this.sessionStore.deleteSession(sessionId);
      this.persistenceQueue.delete(sessionId);
      
      this.logger.debug('Session removed from persistence', { sessionId });
    } catch (error) {
      this.logger.error('Failed to remove session from persistence', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Load sessions from persistence
   */
  async loadSessions(): Promise<SessionInfo[]> {
    if (!this.options.persistSessions) return [];

    try {
      const sessions = await this.sessionStore.getAllSessions();
      const loadedSessions: SessionInfo[] = [];

      for (const [sessionId, sessionData] of Object.entries(sessions)) {
        const session = this.convertFromPersistenceData({
          sessionId,
          userId: sessionData.userId,
          connectionIds: (sessionData.metadata?.wsConnections as string[]) ?? [],
          createdAt: sessionData.createdAt.toISOString(),
          lastActivity: (sessionData.metadata?.lastActivity as string) ?? sessionData.lastActivity.toISOString(),
          roles: sessionData.roles,
          permissions: sessionData.permissions,
          scopes: sessionData.scopes,
          metadata: sessionData.metadata,
          state: (sessionData.metadata?.state as string) ?? 'active',
        } as SessionPersistenceData);

        loadedSessions.push(session);
      }

      this.logger.info(`Loaded ${loadedSessions.length} sessions from persistence`);
      return loadedSessions;
    } catch (error) {
      this.logger.error('Failed to load sessions from persistence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Flush pending sessions to persistence
   */
  private async flushPendingSessions(): Promise<void> {
    if (this.persistenceQueue.size === 0) return;

    const sessions = Array.from(this.persistenceQueue.values());
    this.persistenceQueue.clear();

    const batchSize = this.options.batchSize ?? 10;
    for (let i = 0; i < sessions.length; i += batchSize) {
      const batch = sessions.slice(i, i + batchSize);
      await Promise.all(batch.map(session => this.persistSession(session)));
    }

    this.logger.debug(`Flushed ${sessions.length} sessions to persistence`);
  }

  /**
   * Start periodic flush
   */
  private startPeriodicFlush(): void {
    const interval = this.options.flushInterval ?? 5000; // Default 5 seconds
    this.persistenceInterval = setInterval(async () => {
      await this.flushPendingSessions();
    }, interval);
  }

  /**
   * Convert session to persistence data
   */
  private convertToPersistenceData(session: SessionInfo): SessionPersistenceData {
    return {
      sessionId: session.sessionId,
      userId: session.userId,
      connectionIds: Array.from(session.connectionIds),
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      roles: session.roles,
      permissions: session.permissions,
      scopes: session.scopes,
      metadata: session.metadata,
      state: session.state,
    };
  }

  /**
   * Convert persistence data to session
   */
  private convertFromPersistenceData(data: SessionPersistenceData): SessionInfo {
    return {
      sessionId: data.sessionId,
      userId: data.userId,
      connectionIds: new Set(data.connectionIds),
      createdAt: new Date(data.createdAt),
      lastActivity: new Date(data.lastActivity),
      roles: data.roles,
      permissions: data.permissions,
      scopes: data.scopes,
      metadata: data.metadata,
      state: data.state,
    };
  }
}