/**
 * Session statistics management
 * @module ws/websocket/session/statistics-manager
 * @nist au-4 "Audit storage capacity"
 * @nist si-4 "Information system monitoring"
 */

import type { SessionInfo, SessionStats } from './types.js';
import type { SessionStateManager } from './state-manager.js';
import type { SessionEventEmitter } from './event-emitter.js';
import type { pino } from 'pino';

/**
 * Extended statistics
 */
export interface ExtendedSessionStats extends SessionStats {
  averageSessionDuration: number;
  peakConcurrentSessions: number;
  sessionCreationRate: number;
  sessionTerminationRate: number;
  topUsers: Array<{ userId: string; sessionCount: number; totalDuration: number }>;
}

/**
 * Manages session statistics and metrics
 * @nist si-4 "Information system monitoring"
 */
export class SessionStatisticsManager {
  private sessionMetrics: Map<string, {
    createdAt: number;
    terminatedAt?: number;
    userId: string;
  }> = new Map();
  
  private peakConcurrentSessions = 0;
  private sessionCreationTimes: number[] = [];
  private sessionTerminationTimes: number[] = [];

  constructor(
    private readonly logger: pino.Logger,
    private readonly stateManager: SessionStateManager,
    private readonly eventEmitter: SessionEventEmitter,
  ) {
    this.setupEventListeners();
  }

  /**
   * Get basic session statistics
   */
  getSessionStats(): SessionStats {
    const sessions = this.stateManager.getAllSessions();
    const now = Date.now();
    
    const activeSessions = sessions.filter(
      session => session.state !== 'terminated',
    );

    const totalConnections = sessions.reduce(
      (sum, session) => sum + session.connectionIds.size,
      0,
    );

    const averageConnections = sessions.length > 0 
      ? totalConnections / sessions.length 
      : 0;

    const sessionsPerUser = this.calculateSessionsPerUser(sessions);
    const sessionsByState = this.stateManager.getSessionCountByState();

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      totalUsers: sessionsPerUser.length,
      averageConnectionsPerSession: averageConnections,
      sessionsPerUser,
      sessionsByState,
    };
  }

  /**
   * Get extended statistics
   */
  getExtendedStats(): ExtendedSessionStats {
    const basicStats = this.getSessionStats();
    const now = Date.now();

    // Calculate average session duration
    const completedSessions = Array.from(this.sessionMetrics.values())
      .filter(m => m.terminatedAt);
    
    const averageSessionDuration = completedSessions.length > 0
      ? completedSessions.reduce((sum, m) => sum + (m.terminatedAt! - m.createdAt), 0) / completedSessions.length
      : 0;

    // Calculate rates (per minute)
    const oneMinuteAgo = now - 60000;
    const recentCreations = this.sessionCreationTimes.filter(t => t > oneMinuteAgo).length;
    const recentTerminations = this.sessionTerminationTimes.filter(t => t > oneMinuteAgo).length;

    // Calculate top users
    const userMetrics = this.calculateUserMetrics();
    const topUsers = Array.from(userMetrics.entries())
      .map(([userId, metrics]) => ({
        userId,
        sessionCount: metrics.sessionCount,
        totalDuration: metrics.totalDuration,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount)
      .slice(0, 10);

    return {
      ...basicStats,
      averageSessionDuration,
      peakConcurrentSessions: this.peakConcurrentSessions,
      sessionCreationRate: recentCreations,
      sessionTerminationRate: recentTerminations,
      topUsers,
    };
  }

  /**
   * Export statistics for reporting
   */
  exportStatistics(): Record<string, unknown> {
    const stats = this.getExtendedStats();
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalSessions: stats.totalSessions,
        activeSessions: stats.activeSessions,
        totalUsers: stats.totalUsers,
      },
      metrics: {
        averageConnectionsPerSession: stats.averageConnectionsPerSession,
        averageSessionDuration: stats.averageSessionDuration,
        peakConcurrentSessions: stats.peakConcurrentSessions,
      },
      rates: {
        sessionCreationRate: stats.sessionCreationRate,
        sessionTerminationRate: stats.sessionTerminationRate,
      },
      distribution: {
        sessionsByState: stats.sessionsByState,
        topUsers: stats.topUsers,
      },
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.sessionMetrics.clear();
    this.sessionCreationTimes = [];
    this.sessionTerminationTimes = [];
    this.peakConcurrentSessions = 0;
    
    this.logger.info('Session statistics reset');
  }

  /**
   * Clean up old metrics
   */
  cleanupOldMetrics(maxAge: number = 86400000): void { // Default 24 hours
    const now = Date.now();
    const cutoff = now - maxAge;

    // Clean up session metrics
    for (const [sessionId, metrics] of this.sessionMetrics.entries()) {
      if (metrics.terminatedAt && metrics.terminatedAt < cutoff) {
        this.sessionMetrics.delete(sessionId);
      }
    }

    // Clean up timing arrays
    this.sessionCreationTimes = this.sessionCreationTimes.filter(t => t > cutoff);
    this.sessionTerminationTimes = this.sessionTerminationTimes.filter(t => t > cutoff);

    this.logger.debug('Cleaned up old session metrics', {
      remainingMetrics: this.sessionMetrics.size,
    });
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    this.eventEmitter.on('session:created', (session) => {
      const now = Date.now();
      this.sessionMetrics.set(session.sessionId, {
        createdAt: now,
        userId: session.userId,
      });
      this.sessionCreationTimes.push(now);
      this.updatePeakSessions();
    });

    this.eventEmitter.on('session:terminated', (session) => {
      const now = Date.now();
      const metrics = this.sessionMetrics.get(session.sessionId);
      if (metrics) {
        metrics.terminatedAt = now;
      }
      this.sessionTerminationTimes.push(now);
    });
  }

  /**
   * Update peak concurrent sessions
   */
  private updatePeakSessions(): void {
    const currentActive = this.stateManager.getAllSessions()
      .filter(s => s.state !== 'terminated').length;
    
    if (currentActive > this.peakConcurrentSessions) {
      this.peakConcurrentSessions = currentActive;
      this.logger.info('New peak concurrent sessions', { peak: this.peakConcurrentSessions });
    }
  }

  /**
   * Calculate sessions per user
   */
  private calculateSessionsPerUser(sessions: SessionInfo[]): Array<{ userId: string; sessionCount: number }> {
    const userSessionCounts = new Map<string, number>();
    
    for (const session of sessions) {
      const count = userSessionCounts.get(session.userId) ?? 0;
      userSessionCounts.set(session.userId, count + 1);
    }

    return Array.from(userSessionCounts.entries())
      .map(([userId, sessionCount]) => ({ userId, sessionCount }))
      .sort((a, b) => b.sessionCount - a.sessionCount);
  }

  /**
   * Calculate user metrics
   */
  private calculateUserMetrics(): Map<string, { sessionCount: number; totalDuration: number }> {
    const userMetrics = new Map<string, { sessionCount: number; totalDuration: number }>();

    for (const metrics of this.sessionMetrics.values()) {
      const user = userMetrics.get(metrics.userId) ?? { sessionCount: 0, totalDuration: 0 };
      user.sessionCount++;
      
      if (metrics.terminatedAt) {
        user.totalDuration += metrics.terminatedAt - metrics.createdAt;
      }
      
      userMetrics.set(metrics.userId, user);
    }

    return userMetrics;
  }
}