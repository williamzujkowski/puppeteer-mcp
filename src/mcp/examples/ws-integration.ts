/**
 * WebSocket Integration Example
 * @module mcp/examples/ws-integration
 * @description Example of using the WebSocket adapter with MCP
 */

import { pino } from 'pino';
import { WebSocketAdapter } from '../adapters/ws-adapter.js';
import { WSConnectionManager } from '../../ws/connection-manager.js';
import { WSSubscriptionManager } from '../../ws/subscription-manager.js';
import type { AuthParams, MCPResponse } from '../adapters/adapter.interface.js';

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

// Initialize WebSocket infrastructure
const connectionManager = new WSConnectionManager(logger);
const subscriptionManager = new WSSubscriptionManager(logger, connectionManager);

// Create WebSocket adapter
const wsAdapter = new WebSocketAdapter(logger, connectionManager, subscriptionManager);

/**
 * Example: Subscribe to session updates
 */
async function subscribeToSessionUpdates(): Promise<void> {
  try {
    // Subscribe to session updates for a specific user
    const response = await wsAdapter.executeRequest({
      operation: {
        type: 'subscribe',
        topic: 'sessions.user123',
        filters: {
          status: 'active',
          lastActivity: { $gte: new Date(Date.now() - 3600000).toISOString() },
        },
        duration: 300000, // 5 minutes
      },
      auth: {
        type: 'jwt',
        credentials: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      } as AuthParams,
      sessionId: 'user123-session',
    });

    // console.log('Subscription created:', response);

    // Get subscription ID from metadata
    const subscriptionId = response.metadata?.subscriptionId as string;

    // Handle streaming updates
    if (subscriptionId) {
      const stream = wsAdapter.createStreamingResponse(subscriptionId);
      
      // console.log('Listening for updates...');
      
      for await (const update of stream) {
        // console.log('Received update:', update);
        
        // Process the update
        JSON.parse(update.content[0]?.text as string);
        // const data = JSON.parse(update.content[0]?.text as string);
        // console.log('Session data:', data);
        
        // Break after 10 updates for this example
        if (Math.random() > 0.9) {break;}
      }
    }
  } catch (error) {
    // console.error('Subscription error:', error);
  }
}

/**
 * Example: Send a message through WebSocket
 */
async function sendWebSocketMessage(): Promise<void> {
  try {
    await wsAdapter.executeRequest({
      operation: {
        type: 'send',
        topic: '/api/context/execute',
        event: 'execute_command',
        data: {
          sessionId: 'user123-session',
          contextId: 'ctx-456',
          command: 'analyze_data',
          parameters: {
            dataset: 'sales_2024',
            metrics: ['revenue', 'growth'],
          },
        },
        timeout: 10000,
      },
      auth: {
        type: 'apikey',
        credentials: 'sk-1234567890abcdef',
      } as AuthParams,
      sessionId: 'user123-session',
    });

    // console.log('Message sent');
  } catch (error) {
    // console.error('Send error:', error);
  }
}

/**
 * Example: Broadcast an event
 */
async function broadcastSystemEvent(): Promise<void> {
  try {
    await wsAdapter.executeRequest({
      operation: {
        type: 'broadcast',
        topic: 'system.maintenance',
        event: 'scheduled_maintenance',
        data: {
          scheduledAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
          duration: 7200000, // 2 hours
          affectedServices: ['api', 'websocket'],
          message: 'Scheduled maintenance for system upgrade',
        },
      },
      auth: {
        type: 'jwt',
        credentials: 'admin-token',
      } as AuthParams,
      sessionId: 'admin-session',
    });

    // console.log('Broadcast sent:', response);
  } catch (error) {
    // console.error('Broadcast error:', error);
  }
}

/**
 * Example: Manage multiple subscriptions
 */
async function manageMultipleSubscriptions(): Promise<void> {
  const subscriptions: Array<{ id: string; topic: string }> = [];

  try {
    // Subscribe to multiple topics
    const topics = [
      'contexts.updates',
      'sessions.events',
      'system.alerts',
    ];

    for (const topic of topics) {
      const response = await wsAdapter.executeRequest({
        operation: {
          type: 'subscribe',
          topic,
        },
        auth: {
          type: 'jwt',
          credentials: 'user-token',
        } as AuthParams,
        sessionId: 'multi-sub-session',
      });

      const subscriptionId = response.metadata?.subscriptionId as string;
      subscriptions.push({ id: subscriptionId, topic });
      
      // console.log(`Subscribed to ${topic} with ID ${subscriptionId}`);
    }

    // Wait for some time
    await new Promise<void>(resolve => { setTimeout(resolve, 30000); });

    // Unsubscribe from all topics
    for (const { topic } of subscriptions) {
      await wsAdapter.executeRequest({
        operation: {
          type: 'unsubscribe',
          topic,
        },
        sessionId: 'multi-sub-session',
      });
      
      // console.log(`Unsubscribed from ${topic}`);
    }
  } catch (error) {
    // console.error('Subscription management error:', error);
  }
}

/**
 * Example: Get WebSocket capabilities
 */
async function checkCapabilities(): Promise<void> {
  await wsAdapter.getCapabilities();
  // console.log('WebSocket Adapter Capabilities:');
  // console.log(JSON.stringify(capabilities, null, 2));

  await wsAdapter.listEndpoints();
  // console.log('\nAvailable Endpoints:');
  // console.log(endpoints.content[0]?.text);
}

/**
 * Example: Error handling and reconnection
 */
async function handleConnectionErrors(): Promise<void> {
  let retryCount = 0;
  const maxRetries = 3;

  async function attemptConnection(): Promise<MCPResponse | null> {
    try {
      return await wsAdapter.executeRequest({
        operation: {
          type: 'subscribe',
          topic: 'sessions.heartbeat',
        },
        auth: {
          type: 'jwt',
          credentials: 'user-token',
        } as AuthParams,
        sessionId: 'error-handling-session',
      });
    } catch (error) {
      if (error instanceof Error) {
        // console.error(`Connection attempt ${retryCount + 1} failed:`, error.message);
        
        if (error.message.includes('CONNECTION_CLOSED') && retryCount < maxRetries) {
          retryCount++;
          // console.log(`Retrying in ${retryCount * 2} seconds...`);
          await new Promise<void>(resolve => { setTimeout(resolve, retryCount * 2000); });
          return attemptConnection();
        }
      }
      throw error;
    }
  }

  try {
    const response = await attemptConnection();
    if (response) {
      // console.log('Successfully connected after', retryCount, 'retries');
    }
  } catch (error) {
    // console.error('Failed to establish connection after', maxRetries, 'attempts');
  }
}

// Run examples
async function runExamples(): Promise<void> {
  // console.log('=== WebSocket Adapter Examples ===\n');

  // Check capabilities first
  await checkCapabilities();
  // console.log('\n---\n');

  // Note: These examples assume a running WebSocket server
  // In a real implementation, you would need to integrate with your actual WebSocket infrastructure

  // console.log('Note: The following examples require a running WebSocket server.');
  // console.log('They will fail with "NOT_IMPLEMENTED" error in this standalone example.\n');

  // Try to run examples (will fail without actual WebSocket server)
  try {
    await sendWebSocketMessage();
  } catch (error) {
    // console.log('Expected error (no WebSocket server):', (error as Error).message);
  }

  // console.log('\n---\n');

  // console.log('Example code demonstrates:');
  // console.log('1. Subscribing to real-time updates');
  // console.log('2. Sending messages through WebSocket');
  // console.log('3. Broadcasting events to subscribers');
  // console.log('4. Managing multiple subscriptions');
  // console.log('5. Error handling and reconnection logic');
  // console.log('6. Streaming response handling');
}

// Run the examples
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(() => {/* error already handled */});
}

export {
  subscribeToSessionUpdates,
  sendWebSocketMessage,
  broadcastSystemEvent,
  manageMultipleSubscriptions,
  checkCapabilities,
  handleConnectionErrors,
};