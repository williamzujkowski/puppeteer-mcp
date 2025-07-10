/**
 * WebSocket server implementation - Legacy wrapper for modular structure
 * @module ws/server
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @deprecated Use the modular WebSocket server from './websocket/' instead
 */

// Types were previously imported but are not used in this re-export file

// Re-export from the new modular structure
export { WSServer, createWebSocketServer } from './websocket/index.js';

// Re-export types for backward compatibility
export type { WSServerOptions } from './websocket/types.js';
