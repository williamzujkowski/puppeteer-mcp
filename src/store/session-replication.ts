/**
 * Session replication and synchronization features
 * @module store/session-replication
 * @nist sc-28 "Protection of information at rest"
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist au-3 "Audit logging for replication operations"
 * 
 * This file re-exports the modular replication implementation
 */

export * from './replication/index.js';