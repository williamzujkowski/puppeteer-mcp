/**
 * Shared types and interfaces for session replication
 * @module store/replication/types
 * @nist sc-28 "Protection of information at rest"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import type { SessionStore } from '../session-store.interface.js';
import type { Session } from '../../types/session.js';

/**
 * Replication event types
 */
export interface ReplicationEvents {
  'session:created': (session: Session) => void;
  'session:updated': (session: Session) => void;
  'session:deleted': (sessionId: string) => void;
  'session:touched': (sessionId: string) => void;
  'sync:started': () => void;
  'sync:completed': (stats: SyncStats) => void;
  'sync:failed': (error: Error) => void;
  'replica:connected': (replicaId: string) => void;
  'replica:disconnected': (replicaId: string) => void;
  'replica:error': (replicaId: string, error: Error) => void;
}

/**
 * Synchronization statistics
 */
export interface SyncStats {
  startTime: number;
  endTime: number;
  duration: number;
  syncedSessions: number;
  failedSessions: number;
  skippedSessions: number;
  conflicts: number;
  errors: Array<{
    sessionId: string;
    error: string;
  }>;
}

/**
 * Replication configuration
 */
export interface ReplicationConfig {
  /**
   * Replication mode
   */
  mode: 'master-slave' | 'master-master' | 'active-passive';
  
  /**
   * Sync interval in milliseconds
   */
  syncInterval: number;
  
  /**
   * Batch size for synchronization
   */
  batchSize: number;
  
  /**
   * Conflict resolution strategy
   */
  conflictResolution: 'last-write-wins' | 'oldest-wins' | 'manual';
  
  /**
   * Whether to sync deletions
   */
  syncDeletions: boolean;
  
  /**
   * Whether to sync expired sessions
   */
  syncExpired: boolean;
  
  /**
   * Maximum retry attempts for failed operations
   */
  maxRetries: number;
  
  /**
   * Retry delay in milliseconds
   */
  retryDelay: number;
}

/**
 * Replica store information
 */
export interface ReplicaInfo {
  id: string;
  store: SessionStore;
  isActive: boolean;
  lastSync: Date | null;
  syncErrors: number;
  config: Partial<ReplicationConfig>;
}

/**
 * Replication operation types
 */
export type ReplicationOperation = 'create' | 'update' | 'delete' | 'touch';

/**
 * Replication metrics data
 */
export interface ReplicationMetricsData {
  operationType: ReplicationOperation;
  replicaId: string;
  sessionId?: string;
  success: boolean;
  duration: number;
  error?: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  available: boolean;
  error?: string;
}

/**
 * Replica health status
 */
export interface ReplicaHealthStatus {
  id: string;
  available: boolean;
  lastSync: Date | null;
  syncErrors: number;
  error?: string;
}

/**
 * Sync batch result
 */
export interface SyncBatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  conflicts: number;
  errors: Array<{ sessionId: string; error: string }>;
}

/**
 * Default replication configuration
 */
export const DEFAULT_REPLICATION_CONFIG: ReplicationConfig = {
  mode: 'master-slave',
  syncInterval: 30000, // 30 seconds
  batchSize: 100,
  conflictResolution: 'last-write-wins',
  syncDeletions: true,
  syncExpired: false,
  maxRetries: 3,
  retryDelay: 1000
};