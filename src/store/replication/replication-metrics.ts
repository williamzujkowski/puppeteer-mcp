/**
 * Metrics collection for session replication
 * @module store/replication/replication-metrics
 * @nist au-3 "Audit logging for replication operations"
 */

import type { ReplicationMetricsData, SyncStats } from './types.js';
import type { Logger } from 'pino';
import { EventEmitter } from 'events';

/**
 * Collects and manages replication metrics
 */
export class ReplicationMetrics extends EventEmitter {
  private readonly logger: Logger;
  private readonly metrics: Map<string, ReplicationMetricsData[]> = new Map();
  private readonly syncHistory: SyncStats[] = [];
  private readonly maxHistorySize = 100;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  /**
   * Record a replication operation
   */
  recordOperation(data: ReplicationMetricsData): void {
    const replicaMetrics = this.metrics.get(data.replicaId) ?? [];
    replicaMetrics.push(data);
    
    // Keep only recent metrics
    if (replicaMetrics.length > this.maxHistorySize) {
      replicaMetrics.shift();
    }
    
    this.metrics.set(data.replicaId, replicaMetrics);
    
    this.logger.debug({
      operationType: data.operationType,
      replicaId: data.replicaId,
      success: data.success,
      duration: data.duration
    }, 'Replication operation recorded');
    
    this.emit('metric:recorded', data);
  }

  /**
   * Record sync completion
   */
  recordSyncCompletion(stats: SyncStats): void {
    this.syncHistory.push(stats);
    
    // Keep only recent history
    if (this.syncHistory.length > this.maxHistorySize) {
      this.syncHistory.shift();
    }
    
    this.logger.info({
      synced: stats.syncedSessions,
      failed: stats.failedSessions,
      duration: stats.duration
    }, 'Sync completed and recorded');
  }

  /**
   * Get metrics for a specific replica
   */
  getReplicaMetrics(replicaId: string): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageDuration: number;
    operationsByType: Record<string, number>;
    recentErrors: Array<{ timestamp: number; error: string }>;
  } {
    const replicaMetrics = this.metrics.get(replicaId) ?? [];
    
    const totalOperations = replicaMetrics.length;
    const successfulOperations = replicaMetrics.filter(m => m.success).length;
    const failedOperations = totalOperations - successfulOperations;
    
    const totalDuration = replicaMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = totalOperations > 0 ? totalDuration / totalOperations : 0;
    
    const operationsByType = new Map<string, number>();
    for (const m of replicaMetrics) {
      const opType = m.operationType;
      operationsByType.set(opType, (operationsByType.get(opType) ?? 0) + 1);
    }
    
    const recentErrors = replicaMetrics
      .filter(m => !m.success && m.error)
      .slice(-10)
      .map((m, index, arr) => ({
        timestamp: Date.now() - (this.maxHistorySize - (arr.length - 1 - index)) * 1000,
        error: m.error ?? 'Unknown error'
      }));
    
    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      averageDuration,
      operationsByType: Object.fromEntries(operationsByType),
      recentErrors
    };
  }

  /**
   * Get overall sync statistics
   */
  getSyncStatistics(): {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    averageDuration: number;
    averageSyncedSessions: number;
    recentSyncs: SyncStats[];
  } {
    const totalSyncs = this.syncHistory.length;
    const successfulSyncs = this.syncHistory.filter(s => s.failedSessions === 0).length;
    const failedSyncs = totalSyncs - successfulSyncs;
    
    const totalDuration = this.syncHistory.reduce((sum, s) => sum + s.duration, 0);
    const averageDuration = totalSyncs > 0 ? totalDuration / totalSyncs : 0;
    
    const totalSyncedSessions = this.syncHistory.reduce((sum, s) => sum + s.syncedSessions, 0);
    const averageSyncedSessions = totalSyncs > 0 ? totalSyncedSessions / totalSyncs : 0;
    
    const recentSyncs = this.syncHistory.slice(-10);
    
    return {
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      averageDuration,
      averageSyncedSessions,
      recentSyncs
    };
  }

  /**
   * Clear metrics for a replica
   */
  clearReplicaMetrics(replicaId: string): void {
    this.metrics.delete(replicaId);
    this.logger.debug({ replicaId }, 'Cleared metrics for replica');
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
    this.syncHistory.length = 0;
    this.logger.debug('Cleared all replication metrics');
  }

  /**
   * Export metrics for monitoring systems
   */
  exportMetrics(): {
    replicas: Record<string, ReturnType<ReplicationMetrics['getReplicaMetrics']>>;
    sync: ReturnType<ReplicationMetrics['getSyncStatistics']>;
  } {
    const replicas = new Map<string, ReturnType<ReplicationMetrics['getReplicaMetrics']>>();
    
    for (const replicaId of this.metrics.keys()) {
      replicas.set(replicaId, this.getReplicaMetrics(replicaId));
    }
    
    return {
      replicas: Object.fromEntries(replicas),
      sync: this.getSyncStatistics()
    };
  }
}