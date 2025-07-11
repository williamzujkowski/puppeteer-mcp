/**
 * Main server entry point for the MCP API platform
 * @module server
 * @nist cm-7 "Least functionality"
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist si-10 "Information input validation"
 */

import { config } from './core/config.js';
import { startServer } from './server/index.js';

/**
 * Start the HTTP/WebSocket/gRPC server
 */
export async function startHTTPServer(): Promise<void> {
  const result = await startServer();

  if (!result.success) {
    console.error('Failed to start server:', result.error?.message);

    // Give logger a chance to flush before exit
    setTimeout(() => {
      process.exit(1);
    }, 100);
  }
}

// Start server if not in test environment and not in MCP mode
if (
  config.NODE_ENV !== 'test' &&
  process.env.NODE_ENV !== 'test' &&
  process.env.JEST_WORKER_ID === undefined &&
  process.env.MCP_TRANSPORT === undefined
) {
  void startHTTPServer();
}

// Re-export for testing compatibility
export { createApp } from './server/http-server.js';

// Create instances for legacy exports
import { createLogger, createSessionStore, createBrowserPool } from './server/service-registry.js';

const logger = createLogger();
export const sessionStore = createSessionStore(logger);
export const browserPool = createBrowserPool();
