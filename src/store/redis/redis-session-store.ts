/**
 * Main Redis session store class
 * @module store/redis/redis-session-store
 * @nist au-3 "Audit logging for session operations"
 * @nist sc-28 "Protection of information at rest"
 * @nist ac-12 "Session termination"
 */

import type { Session, SessionData } from '../../types/session.js';
import type { SessionStore } from '../session-store.interface.js';
import type { StoreLogger, HealthCheckResult } from './types.js';
import { InMemorySessionStore } from '../in-memory-session-store.js';
import { RedisClientManager } from './redis-client.js';
import { SessionOperations } from './session-operations.js';
import { SessionExpiryManager } from './session-expiry.js';
import { SessionIndexing } from './session-indexing.js';
import { RedisHealthMonitor } from './redis-health.js';
import { RedisMetricsCollector } from './redis-metrics.js';
import { pino } from 'pino';

/**
 * Redis implementation of SessionStore with comprehensive features
 */
export class RedisSessionStore implements SessionStore {
  private logger: StoreLogger;
  private fallbackStore: InMemorySessionStore;
  private clientManager: RedisClientManager;
  private sessionOps: SessionOperations;
  private expiryManager: SessionExpiryManager;
  private indexing: SessionIndexing;
  private healthMonitor: RedisHealthMonitor;
  private metricsCollector: RedisMetricsCollector;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(logger?: pino.Logger) {
    this.logger = logger ?? pino({ level: 'info' });
    this.fallbackStore = new InMemorySessionStore(logger);

    // Initialize managers
    this.clientManager = new RedisClientManager(this.logger, this.fallbackStore);
    this.sessionOps = new SessionOperations(this.logger);
    this.expiryManager = new SessionExpiryManager(this.logger);
    this.indexing = new SessionIndexing(this.logger);
    this.healthMonitor = new RedisHealthMonitor(this.logger);
    this.metricsCollector = new RedisMetricsCollector(this.logger);

    // Start cleanup interval for expired sessions
    this.startCleanupInterval();
  }

  /**
   * Create a new session
   */
  async create(data: SessionData): Promise<string> {
    return this.metricsCollector.monitorOperation('create', async () => {
      return this.clientManager.executeWithFallback(
        async (client) => this.sessionOps.createSession(client, data),
        async (fallback) => fallback.create(data),
      );
    });
  }

  /**
   * Get session by ID
   */
  async get(id: string): Promise<Session | null> {
    return this.metricsCollector.monitorOperation('get', async () => {
      return this.clientManager.executeWithFallback(
        async (client) => this.sessionOps.getSession(client, id),
        async (fallback) => fallback.get(id),
      );
    });
  }

  /**
   * Update session data
   */
  async update(id: string, data: Partial<SessionData>): Promise<Session | null> {
    return this.metricsCollector.monitorOperation('update', async () => {
      return this.clientManager.executeWithFallback(
        async (client) => this.sessionOps.updateSession(client, id, data),
        async (fallback) => fallback.update(id, data),
      );
    });
  }

  /**
   * Delete session
   */
  async delete(id: string): Promise<boolean> {
    return this.metricsCollector.monitorOperation('delete', async () => {
      return this.clientManager.executeWithFallback(
        async (client) => this.sessionOps.deleteSession(client, id),
        async (fallback) => fallback.delete(id),
      );
    });
  }

  /**
   * Delete expired sessions
   */
  async deleteExpired(): Promise<number> {
    return this.metricsCollector.monitorOperation('deleteExpired', async () => {
      return this.clientManager.executeWithFallback(
        async (client) => this.expiryManager.cleanupExpiredUserSessions(client),
        async (fallback) => fallback.deleteExpired(),
      );
    });
  }

  /**
   * Get sessions by user ID
   */
  async getByUserId(userId: string): Promise<Session[]> {
    return this.metricsCollector.monitorOperation('getByUserId', async () => {
      return this.clientManager.executeWithFallback(
        async (client) => this.sessionOps.getSessionsByUserId(client, userId),
        async (fallback) => fallback.getByUserId(userId),
      );
    });
  }

  /**
   * Check if session exists
   */
  async exists(id: string): Promise<boolean> {
    return this.metricsCollector.monitorOperation('exists', async () => {
      return this.clientManager.executeWithFallback(
        async (client) => this.sessionOps.sessionExists(client, id),
        async (fallback) => fallback.exists(id),
      );
    });
  }

  /**
   * Touch session (update last accessed time)
   */
  async touch(id: string): Promise<boolean> {
    return this.metricsCollector.monitorOperation('touch', async () => {
      return this.clientManager.executeWithFallback(
        async (client) => this.sessionOps.touchSession(client, id),
        async (fallback) => fallback.touch(id),
      );
    });
  }

  /**
   * Clear all sessions
   */
  async clear(): Promise<void> {
    return this.metricsCollector.monitorOperation('clear', async () => {
      return this.clientManager.executeWithFallback(
        async (client) => this.sessionOps.clearAllSessions(client),
        async (fallback) => fallback.clear(),
      );
    });
  }

  /**
   * Health check for the session store
   */
  async healthCheck(): Promise<HealthCheckResult> {
    return this.healthMonitor.performHealthCheck();
  }

  /**
   * Get performance metrics
   */
  async getMetrics() {
    return this.metricsCollector.getCurrentMetrics();
  }

  /**
   * Search sessions with advanced options
   */
  async searchSessions(query: {
    userId?: string;
    pattern?: string;
    limit?: number;
    offset?: number;
  }): Promise<Session[]> {
    return this.metricsCollector.monitorOperation('search', async () => {
      return this.clientManager.executeWithFallback(
        async (client) => this.indexing.searchSessions(client, query),
        async () => {
          // Fallback search would be limited for in-memory store
          if (query.userId) {
            return this.fallbackStore.getByUserId(query.userId);
          }
          return [];
        },
      );
    });
  }

  /**
   * Get session statistics
   */
  async getSessionStats() {
    return this.clientManager.executeWithFallback(
      async (client) => this.indexing.getSessionStats(client),
      async () => ({
        total: 0,
        active: 0,
        expired: 0,
        byUser: {},
      }),
    );
  }

  /**
   * Destroy the session store and clean up resources
   */
  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    await this.fallbackStore.destroy();
    this.logger.info('Redis session store destroyed');
  }

  /**
   * Start cleanup interval for expired sessions
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      void this.deleteExpired().catch((error) => {
        this.logger.error({ error }, 'Failed to clean up expired sessions');
      });
    }, 60000); // Run every minute

    // Make sure the interval doesn't keep the process alive
    this.cleanupInterval.unref();
  }
}
