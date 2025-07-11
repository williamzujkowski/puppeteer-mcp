/**
 * Redis-backed session store implementation
 * @module store/redis-session-store
 * @nist au-3 "Audit logging for session operations"
 * @nist sc-28 "Protection of information at rest"
 * @nist ac-12 "Session termination"
 */

// Re-export the main Redis session store from the modular implementation
export { RedisSessionStore } from './redis/index.js';
