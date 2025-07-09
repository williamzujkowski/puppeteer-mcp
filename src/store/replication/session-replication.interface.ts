/**
 * Session replication manager interface
 * @module store/replication/session-replication.interface
 */

import type { ReplicationEvents } from './types.js';

/**
 * Type-safe event emitter interface for SessionReplicationManager
 */
export interface SessionReplicationManagerEvents {
  on<K extends keyof ReplicationEvents>(
    event: K,
    listener: ReplicationEvents[K]
  ): this;
  
  emit<K extends keyof ReplicationEvents>(
    event: K,
    ...args: Parameters<ReplicationEvents[K]>
  ): boolean;
}