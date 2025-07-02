/**
 * WebSocket Server Integration Example
 * @module mcp/examples/ws-server-integration
 * @description Shows how to integrate the WebSocket adapter with the actual WebSocket server
 * @nist ac-3 "Access enforcement"
 * @nist ia-2 "Identification and authentication"
 */

import { pino } from 'pino';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { WebSocketAdapter } from '../adapters/ws-adapter.js';
import { WSConnectionManager } from '../../ws/connection-manager.js';
import { WSSubscriptionManager } from '../../ws/subscription-manager.js';
import { WSMessageHandler } from '../../ws/message-handler.js';
import { WSAuthHandler } from '../../ws/auth-handler.js';
import { WSApiKeyAuthHandler } from '../../ws/auth-handler-apikey.js';
import { WSContextHandler } from '../../ws/context-handler.js';
import { WSRequestProcessor } from '../../ws/request-processor.js';
import { InMemorySessionStore } from '../../store/in-memory-session-store.js';
import type { MCPResponse } from '../adapters/adapter.interface.js';

// Initialize logger
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

/**
 * Create integrated WebSocket server with MCP adapter
 */
export function createIntegratedWebSocketServer(port: number = 8080): {
  server: WebSocketServer;
  adapter: WebSocketAdapter;
  connectionManager: WSConnectionManager;
} {
  // Create HTTP server
  const httpServer = createServer();

  // Initialize WebSocket infrastructure
  const connectionManager = new WSConnectionManager(logger);
  const subscriptionManager = new WSSubscriptionManager(logger, connectionManager);
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer });

  // Create session store
  const sessionStore = new InMemorySessionStore(logger);
  
  // Set up authentication handlers
  const authHandler = new WSAuthHandler(logger, sessionStore);
  const apiKeyAuthHandler = new WSApiKeyAuthHandler(logger, sessionStore);
  
  // Create message handler  
  const messageHandler = new WSMessageHandler(logger, sessionStore, connectionManager, authHandler);
  
  // Set up other handlers
  const contextHandler = new WSContextHandler();
  const requestProcessor = new WSRequestProcessor(logger, sessionStore, connectionManager, authHandler);
  
  // Note: In a real integration, you would wire these handlers to the WebSocket server
  // This example focuses on showing the adapter integration
  void authHandler;
  void apiKeyAuthHandler;
  void messageHandler;
  void contextHandler;
  void requestProcessor;

  // Create MCP adapter
  const adapter = new WebSocketAdapter(logger, connectionManager, subscriptionManager);

  // Extend adapter to work with actual WebSocket connections
  extendAdapterForServer(adapter, wss, connectionManager);

  // Handle WebSocket connections
  wss.on('connection', (ws, req) => {
    const connectionId = req.headers['x-connection-id'] as string || `conn-${Date.now()}`;
    
    // Add connection to manager
    connectionManager.addConnection(connectionId, ws, {
      id: connectionId,
      authenticated: false,
      subscriptions: new Set(),
      lastActivity: new Date(),
    });

    // Handle messages through the message handler
    ws.on('message', (data) => {
      let message: string;
      if (typeof data === 'string') {
        message = data;
      } else if (Buffer.isBuffer(data)) {
        message = data.toString('utf8');
      } else if (data instanceof ArrayBuffer) {
        message = Buffer.from(data).toString('utf8');
      } else if (Array.isArray(data)) {
        message = Buffer.concat(data.map(d => Buffer.isBuffer(d) ? d : Buffer.from(d))).toString('utf8');
      } else {
        message = String(data);
      }
      messageHandler.handleMessage(ws, connectionId, message);
    });

    // Handle disconnection
    ws.on('close', () => {
      connectionManager.removeConnection(connectionId);
      logger.info(`Connection ${connectionId} closed`);
    });

    // Send connection acknowledgment
    ws.send(JSON.stringify({
      type: 'connect',
      id: connectionId,
      timestamp: new Date().toISOString(),
    }));
  });

  // Start HTTP server
  httpServer.listen(port, () => {
    logger.info(`WebSocket server listening on port ${port}`);
  });

  return { server: wss, adapter, connectionManager };
}

/**
 * Extend the MCP adapter to work with real WebSocket connections
 */
function extendAdapterForServer(
  adapter: WebSocketAdapter,
  wss: WebSocketServer, // Used in production, example simplified for clarity
  connectionManager: WSConnectionManager
): void {
  void wss; // Would be used in production for connection management
  
  // Override the createWebSocketConnection method to use existing connections
  (adapter as any).createWebSocketConnection = function(connectionId?: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      if (connectionId) {
        // Try to get existing connection
        const existingWs = connectionManager.getWebSocket(connectionId);
        if (existingWs) {
          resolve(existingWs);
          return;
        }
      }

      // For new connections, we need to wait for a client to connect
      // In a real implementation, you might want to:
      // 1. Return an existing idle connection from a pool
      // 2. Create a new internal connection
      // 3. Throw an error indicating that external connections are required
      
      reject(new Error(
        'WebSocket connections must be established externally. ' +
        'Use the WebSocket server directly or provide a valid connectionId.'
      ));
    });
  };

  // Add method to execute MCP requests for existing connections
  (adapter as any).executeForConnection = async function(
    connectionId: string,
    operation: unknown
  ): Promise<MCPResponse> {
    const connectionState = connectionManager.getConnectionState(connectionId);
    if (!connectionState) {
      throw new Error('Connection not found');
    }

    // Use 'this' with proper typing context
    const response = await this.executeRequest({
      operation,
      sessionId: connectionId,
      auth: connectionState.authenticated ? {
        type: 'session' as const,
        credentials: connectionState.sessionId ?? '',
      } : undefined,
    }) as MCPResponse;
    
    return response;
  };
}

/**
 * Example usage of the integrated server
 */
function runExample(): void {
  const { server, adapter, connectionManager } = createIntegratedWebSocketServer(8080);

  // Example: Handle MCP requests from existing WebSocket connections
  connectionManager.getAllConnections().forEach(({ connectionId, state }) => {
    if (state.authenticated) {
      // Execute MCP operations for authenticated connections
      void adapter.executeRequest({
        operation: {
          type: 'subscribe',
          topic: 'system.status',
        },
        sessionId: connectionId,
      }).then(response => {
        logger.info('Subscription created for connection', { connectionId, response });
      }).catch(error => {
        logger.error('Failed to create subscription', { connectionId, error });
      });
    }
  });

  // Example: Broadcast system events through MCP
  setInterval(() => {
    void (async () => {
      try {
        await adapter.executeRequest({
          operation: {
            type: 'broadcast',
            topic: 'system.status',
            event: 'heartbeat',
            data: {
              timestamp: new Date().toISOString(),
              connections: connectionManager.getStats(),
            },
          },
          sessionId: 'system',
        });
      } catch (error) {
        logger.error('Failed to broadcast heartbeat', error);
      }
    })();
  }, 30000); // Every 30 seconds

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('Shutting down WebSocket server...');
    server.close(() => {
      logger.info('WebSocket server closed');
      process.exit(0);
    });
  });
}

// Run example if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runExample();
  } catch (error) {
    console.error('Failed to run example:', error);
  }
}

export { extendAdapterForServer };