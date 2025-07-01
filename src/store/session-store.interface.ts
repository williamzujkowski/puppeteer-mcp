/**
 * Session store interface
 * @module store/session-store.interface
 */

import type { Session, SessionData } from '../types/session.js';

/**
 * Interface for session storage implementations
 */
export interface SessionStore {
  /**
   * Create a new session
   * @param data - Session data
   * @returns Session ID
   */
  create(data: SessionData): Promise<string>;

  /**
   * Get a session by ID
   * @param id - Session ID
   * @returns Session or null if not found
   */
  get(id: string): Promise<Session | null>;

  /**
   * Update a session
   * @param id - Session ID
   * @param data - Partial session data to update
   * @returns Updated session or null if not found
   */
  update(id: string, data: Partial<SessionData>): Promise<Session | null>;

  /**
   * Delete a session
   * @param id - Session ID
   * @returns True if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Delete all expired sessions
   * @returns Number of sessions deleted
   */
  deleteExpired(): Promise<number>;

  /**
   * Get all sessions for a user
   * @param userId - User ID
   * @returns Array of sessions
   */
  getByUserId(userId: string): Promise<Session[]>;

  /**
   * Check if a session exists
   * @param id - Session ID
   * @returns True if exists, false otherwise
   */
  exists(id: string): Promise<boolean>;

  /**
   * Update last accessed time
   * @param id - Session ID
   * @returns True if updated, false if not found
   */
  touch(id: string): Promise<boolean>;
}
