/**
 * WebSocket server fix for Express/WebSocket integration
 * @module server/websocket-fix
 * @description Ensures WebSocket upgrade requests bypass Express middleware
 */

import type { Application } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Setup WebSocket bypass middleware to prevent Express from handling WebSocket upgrade requests
 * This must be added BEFORE other Express routes and middleware
 */
export function setupWebSocketBypass(app: Application, wsPath: string = '/ws'): void {
  // Add middleware to skip Express for WebSocket upgrade requests
  app.use((req, res, next) => {
    // Check if this is a WebSocket upgrade request
    if (req.headers.upgrade === 'websocket' && req.url === wsPath) {
      // Mark that Express should not handle this request
      // The WebSocket server will handle it via the HTTP server's 'upgrade' event
      (res as any).websocket = true;

      // End the middleware chain - don't call next()
      // This prevents the 404 handler from catching WebSocket requests
      return;
    }

    // For all other requests, continue with Express middleware
    next();
  });
}

/**
 * Verify WebSocket path is properly configured
 */
export function verifyWebSocketPath(wsPath: string): void {
  if (!wsPath || typeof wsPath !== 'string') {
    throw new Error('WebSocket path must be a non-empty string');
  }

  if (!wsPath.startsWith('/')) {
    throw new Error('WebSocket path must start with /');
  }
}
