# WebSocket Adapter for MCP

The WebSocket adapter enables real-time, bidirectional communication through the Model Context Protocol (MCP). It provides subscription management, event broadcasting, and streaming capabilities while maintaining the same security and authentication standards as other protocol adapters.

## Features

- **Real-time Communication**: Subscribe to topics and receive live updates
- **Bidirectional Messaging**: Send requests and receive responses asynchronously
- **Event Broadcasting**: Broadcast events to all subscribers of a topic
- **Multi-Modal Authentication**: Supports JWT tokens and API keys
- **Streaming Support**: Stream responses for long-running operations
- **Automatic Cleanup**: Manages subscription lifecycles and connection state
- **NIST Compliance**: Comprehensive security controls and audit logging

## Usage

### Basic Setup

```typescript
import { WebSocketAdapter } from '@mcp/adapters/ws-adapter.js';
import { WSConnectionManager } from '@ws/connection-manager.js';
import { WSSubscriptionManager } from '@ws/subscription-manager.js';

// Initialize dependencies
const connectionManager = new WSConnectionManager(logger);
const subscriptionManager = new WSSubscriptionManager(logger, connectionManager);

// Create adapter
const wsAdapter = new WebSocketAdapter(logger, connectionManager, subscriptionManager);
```

### Operations

#### Subscribe to Topics

```typescript
const response = await wsAdapter.executeRequest({
  operation: {
    type: 'subscribe',
    topic: 'sessions.updates',
    filters: { status: 'active' },
    duration: 300000, // 5 minutes
  },
  auth: {
    type: 'jwt',
    credentials: 'your-jwt-token',
  },
  sessionId: 'user-session-123',
});

// Stream updates
const subscriptionId = response.metadata?.subscriptionId;
const stream = wsAdapter.createStreamingResponse(subscriptionId);

for await (const update of stream) {
  console.log('Received update:', update);
}
```

#### Send Messages

```typescript
const response = await wsAdapter.executeRequest({
  operation: {
    type: 'send',
    topic: '/api/commands',
    event: 'execute',
    data: { command: 'analyze', params: { dataset: 'sales' } },
    timeout: 10000,
  },
  auth: {
    type: 'apikey',
    credentials: 'sk-your-api-key',
  },
});
```

#### Broadcast Events

```typescript
await wsAdapter.executeRequest({
  operation: {
    type: 'broadcast',
    topic: 'system.alerts',
    event: 'maintenance',
    data: {
      message: 'Scheduled maintenance in 1 hour',
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    },
  },
  auth: {
    type: 'jwt',
    credentials: 'admin-token',
  },
});
```

#### Unsubscribe

```typescript
await wsAdapter.executeRequest({
  operation: {
    type: 'unsubscribe',
    topic: 'sessions.updates',
  },
  sessionId: 'user-session-123',
});
```

## Authentication

The adapter supports two authentication methods:

### JWT Authentication
```typescript
auth: {
  type: 'jwt',
  credentials: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
}
```

### API Key Authentication
```typescript
auth: {
  type: 'apikey',
  credentials: 'sk-1234567890abcdef',
}
```

## Subscription Topics

Common subscription topics include:

- `sessions.*` - Session lifecycle events
- `contexts.*` - Context execution updates
- `system.*` - System-wide events (requires admin)
- `user.{userId}.*` - User-specific events

## Error Handling

The adapter provides structured error responses:

```typescript
try {
  await wsAdapter.executeRequest({ /* ... */ });
} catch (error) {
  if (error instanceof AppError) {
    console.error(`Error ${error.statusCode}: ${error.message}`);
  }
}
```

## Integration with WebSocket Server

To integrate with your existing WebSocket infrastructure:

```typescript
import { extendAdapterForServer } from '@mcp/examples/ws-server-integration.js';

// Extend adapter to work with your WebSocket server
extendAdapterForServer(adapter, wss, connectionManager);

// Execute MCP operations for existing connections
const response = await adapter.executeForConnection(connectionId, {
  type: 'subscribe',
  topic: 'updates',
});
```

## Security Considerations

- All operations require authentication (except health checks)
- Topic subscriptions are validated against user permissions
- All security events are logged for audit compliance
- Connections are automatically cleaned up on timeout
- Rate limiting is applied per connection

## Performance

- Subscriptions use efficient event emitters
- Messages are buffered for streaming responses
- Automatic cleanup prevents memory leaks
- Heartbeat mechanism maintains connection health

## Testing

Run the WebSocket adapter tests:

```bash
npm test -- src/mcp/adapters/ws-adapter.test.ts
```

## Examples

See the examples directory for complete integration examples:

- `ws-integration.ts` - Basic usage examples
- `ws-server-integration.ts` - Server integration example