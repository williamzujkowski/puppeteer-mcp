---
title: WebSocket API Reference
description: > Purpose: Real-time bidirectional communication protocol for browser automation and session
---

# WebSocket API Reference

> **Purpose**: Real-time bidirectional communication protocol for browser automation and session
> management  
> **Version**: 1.0.10  
> **Status**: Beta - Seeking Production Feedback  
> **Created**: 2025-07-04  
> **Reviewed**: 2025-07-04

## Overview

The WebSocket API provides real-time, bidirectional communication for browser automation operations.
It supports multiple authentication methods, topic-based subscriptions, and structured message
envelopes for reliable communication.

## Connection Establishment

### WebSocket URL

```
ws://localhost:3000/ws
wss://example.com/ws  # Production with TLS
```

### Connection Lifecycle

1. **Initial Connection**: Client establishes WebSocket connection
2. **Authentication**: Client sends AUTH message within 30 seconds
3. **Active Session**: Authenticated connection for bidirectional communication
4. **Heartbeat**: Periodic PING/PONG to maintain connection
5. **Graceful Disconnect**: Client sends DISCONNECT or connection timeout

### Client Options

```typescript
interface WSClientOptions {
  url: string; // WebSocket endpoint URL
  token?: string; // JWT access token
  apiKey?: string; // API key for long-lived auth
  reconnect?: boolean; // Auto-reconnect on disconnect
  reconnectInterval?: number; // Milliseconds between reconnect attempts
  maxReconnectAttempts?: number; // Maximum reconnection attempts
  heartbeatInterval?: number; // Milliseconds between heartbeats
  requestTimeout?: number; // Request timeout in milliseconds
}
```

## Authentication

### Authentication Flow

```
Client                          Server
  |                               |
  |-------- Connect ------------->|
  |                               |
  |<------ Connection Open -------|
  |                               |
  |-------- AUTH Message -------->|
  |                               |
  |<----- AUTH_SUCCESS/ERROR -----|
  |                               |
```

### JWT Authentication

```json
{
  "type": "auth",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-07-04T10:00:00Z",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### API Key Authentication

```json
{
  "type": "auth",
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2025-07-04T10:00:00Z",
  "data": {
    "apiKey": "ak_live_1234567890abcdef"
  }
}
```

### Authentication Success Response

```json
{
  "type": "auth_success",
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2025-07-04T10:00:01Z",
  "data": {
    "userId": "user123",
    "sessionId": "session456",
    "roles": ["user", "admin"],
    "permissions": ["read", "write", "execute"],
    "scopes": ["contexts:*", "sessions:*"]
  }
}
```

### Authentication Error Response

```json
{
  "type": "auth_error",
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2025-07-04T10:00:01Z",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid token or API key"
  }
}
```

## Message Format

### Base Message Envelope

All messages follow a consistent envelope structure:

```typescript
interface WSBaseMessage {
  type: WSMessageType; // Message type enum
  id?: string; // UUID for request/response correlation
  timestamp: string; // ISO 8601 timestamp
}
```

### Message Types

```typescript
enum WSMessageType {
  // Connection management
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  PING = 'ping',
  PONG = 'pong',

  // Authentication
  AUTH = 'auth',
  AUTH_SUCCESS = 'auth_success',
  AUTH_ERROR = 'auth_error',

  // Data messages
  REQUEST = 'request',
  RESPONSE = 'response',
  EVENT = 'event',
  ERROR = 'error',

  // Subscriptions
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  SUBSCRIPTION_UPDATE = 'subscription_update',
}
```

## Request/Response Pattern

### Request Message

```json
{
  "type": "request",
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "timestamp": "2025-07-04T10:00:02Z",
  "method": "POST",
  "path": "/api/v1/contexts/ctx123/execute",
  "data": {
    "action": "navigate",
    "params": {
      "url": "https://example.com"
    }
  },
  "headers": {
    "x-request-id": "req123"
  }
}
```

### Response Message

```json
{
  "type": "response",
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "timestamp": "2025-07-04T10:00:03Z",
  "status": 200,
  "data": {
    "success": true,
    "result": {
      "pageId": "page123",
      "title": "Example Domain"
    }
  }
}
```

### Error Response

```json
{
  "type": "response",
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "timestamp": "2025-07-04T10:00:03Z",
  "status": 404,
  "error": {
    "code": "CONTEXT_NOT_FOUND",
    "message": "Context ctx123 not found",
    "details": {
      "contextId": "ctx123"
    }
  }
}
```

## Subscription Patterns

### Subscribe to Topic

```json
{
  "type": "subscribe",
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "timestamp": "2025-07-04T10:00:04Z",
  "topic": "browser.events",
  "filters": {
    "contextId": "ctx123",
    "eventType": ["navigation", "console"]
  }
}
```

### Subscription Update

```json
{
  "type": "subscription_update",
  "timestamp": "2025-07-04T10:00:05Z",
  "topic": "browser.events",
  "data": {
    "eventType": "navigation",
    "contextId": "ctx123",
    "url": "https://example.com/page2",
    "timestamp": "2025-07-04T10:00:05Z"
  }
}
```

### Unsubscribe from Topic

```json
{
  "type": "unsubscribe",
  "id": "550e8400-e29b-41d4-a716-446655440004",
  "timestamp": "2025-07-04T10:00:06Z",
  "topic": "browser.events"
}
```

### Available Topics

- `browser.events` - Browser automation events (navigation, console, errors)
- `session.updates` - Session lifecycle events
- `context.updates` - Context state changes
- `performance.metrics` - Real-time performance data
- `security.alerts` - Security-related events

## Event Messages

### Browser Event

```json
{
  "type": "event",
  "timestamp": "2025-07-04T10:00:07Z",
  "event": "browser.navigation",
  "data": {
    "contextId": "ctx123",
    "pageId": "page123",
    "url": "https://example.com/success",
    "title": "Success Page",
    "loadTime": 1234
  }
}
```

### Console Event

```json
{
  "type": "event",
  "timestamp": "2025-07-04T10:00:08Z",
  "event": "browser.console",
  "data": {
    "contextId": "ctx123",
    "pageId": "page123",
    "level": "error",
    "message": "Uncaught TypeError: Cannot read property 'x' of undefined",
    "source": "app.js:42"
  }
}
```

## Error Handling

### Error Codes

| Code                 | Description                       | Retry              |
| -------------------- | --------------------------------- | ------------------ |
| `UNAUTHORIZED`       | Missing or invalid authentication | No                 |
| `FORBIDDEN`          | Insufficient permissions          | No                 |
| `INVALID_MESSAGE`    | Malformed message format          | No                 |
| `RATE_LIMITED`       | Too many requests                 | Yes (with backoff) |
| `INTERNAL_ERROR`     | Server error                      | Yes                |
| `CONTEXT_NOT_FOUND`  | Referenced context doesn't exist  | No                 |
| `SUBSCRIPTION_ERROR` | Failed to process subscription    | Yes                |

### Error Message

```json
{
  "type": "error",
  "timestamp": "2025-07-04T10:00:09Z",
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 100,
      "window": "1m",
      "retryAfter": 45
    }
  }
}
```

## Heartbeat & Connection Health

### Ping Message

```json
{
  "type": "ping",
  "timestamp": "2025-07-04T10:00:10Z"
}
```

### Pong Response

```json
{
  "type": "pong",
  "timestamp": "2025-07-04T10:00:10Z"
}
```

## Reconnection Strategy

### Automatic Reconnection

```javascript
// Example reconnection logic
const reconnect = async () => {
  let attempts = 0;
  const maxAttempts = 5;
  const baseDelay = 1000;

  while (attempts < maxAttempts) {
    try {
      await connect();
      await authenticate();
      await resubscribe();
      break;
    } catch (error) {
      attempts++;
      const delay = baseDelay * Math.pow(2, attempts);
      await sleep(delay);
    }
  }
};
```

### Connection State Management

```typescript
interface WSConnectionState {
  id: string; // Connection UUID
  authenticated: boolean; // Auth status
  userId?: string; // Authenticated user
  sessionId?: string; // Session identifier
  roles?: string[]; // User roles
  permissions?: string[]; // Granted permissions
  scopes?: string[]; // API scopes
  subscriptions: Set<string>; // Active subscriptions
  lastActivity: Date; // Last message timestamp
  metadata?: Record<string, unknown>;
}
```

## Security Considerations

- **Authentication Required**: All data operations require authentication
- **Rate Limiting**: Per-connection rate limits apply
- **Input Validation**: All messages validated with Zod schemas
- **Permission Checks**: Topic subscriptions require appropriate permissions
- **Audit Logging**: All security events logged per NIST requirements
- **Connection Timeout**: Idle connections closed after 5 minutes

## Performance Guidelines

- **Message Size**: Maximum 1MB per message
- **Batch Operations**: Group multiple requests when possible
- **Compression**: Enable WebSocket compression for large payloads
- **Heartbeat Interval**: Default 30 seconds, adjust for network conditions
- **Request Timeout**: Default 30 seconds for request/response pattern

## Example: Complete Session Flow

```javascript
// 1. Connect and authenticate
ws.send({
  type: 'auth',
  id: generateId(),
  data: { token: accessToken },
});

// 2. Subscribe to browser events
ws.send({
  type: 'subscribe',
  id: generateId(),
  topic: 'browser.events',
  filters: { contextId: 'ctx123' },
});

// 3. Execute browser action
ws.send({
  type: 'request',
  id: generateId(),
  method: 'POST',
  path: '/api/v1/contexts/ctx123/execute',
  data: {
    action: 'screenshot',
    params: { fullPage: true },
  },
});

// 4. Handle responses and events
ws.on('message', (data) => {
  const message = JSON.parse(data);
  switch (message.type) {
    case 'response':
      handleResponse(message);
      break;
    case 'subscription_update':
      handleEvent(message);
      break;
    case 'error':
      handleError(message);
      break;
  }
});
```

---

_Reference: [WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455) |
[NIST 800-53r5](https://csrc.nist.gov/projects/risk-management/sp800-53-controls)_
