---
title: gRPC API Reference
description: 'Overview of the gRPC API services and usage'
---

# gRPC API Reference

## Overview

The Puppeteer MCP platform provides a comprehensive gRPC API for browser automation, session
management, and context execution. The API follows Protocol Buffers v3 specification and implements
enterprise-focused security with NIST compliance.

## Connection Details

### Server Configuration

```bash
# Default connection
localhost:50051

# Environment variables
GRPC_PORT=50051
GRPC_HOST=0.0.0.0
GRPC_MAX_MESSAGE_SIZE=4194304  # 4MB
GRPC_KEEPALIVE_TIME=120000      # 2 minutes
```

### TLS Configuration (Production)

```typescript
// Client with TLS
const credentials = grpc.credentials.createSsl(
  rootCert, // CA certificate
  clientKey, // Client private key
  clientCert, // Client certificate
);
```

## Authentication

The gRPC API supports three authentication methods via metadata headers:

### 1. JWT Bearer Token

```typescript
const metadata = new grpc.Metadata();
metadata.add('authorization', 'Bearer ' + jwtToken);
```

### 2. API Key

```typescript
const metadata = new grpc.Metadata();
metadata.add('x-api-key', apiKey);
```

### 3. Session ID

```typescript
const metadata = new grpc.Metadata();
metadata.add('x-session-id', sessionId);
```

## Services

### SessionService

Manages user sessions across all protocols with comprehensive CRUD operations.

#### CreateSession

Creates a new authenticated session.

```protobuf
rpc CreateSession(CreateSessionRequest) returns (CreateSessionResponse);

message CreateSessionRequest {
  string user_id = 1;
  string username = 2;
  repeated string roles = 3;
  map<string, string> data = 4;
  map<string, string> metadata = 5;
  int32 ttl_seconds = 6;
}

message CreateSessionResponse {
  Session session = 1;
  string access_token = 2;
  string refresh_token = 3;
}
```

**TypeScript Example:**

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

// Load proto
const packageDefinition = protoLoader.loadSync('proto/control.proto');
const proto = grpc.loadPackageDefinition(packageDefinition);
const SessionService = proto.mcp.control.v1.SessionService;

// Create client
const client = new SessionService('localhost:50051', grpc.credentials.createInsecure());

// Create session
client.createSession(
  {
    user_id: 'user-123',
    username: 'john.doe',
    roles: ['user', 'admin'],
    metadata: {
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0',
    },
    ttl_seconds: 3600,
  },
  (error, response) => {
    if (error) {
      console.error('Error:', error);
      return;
    }
    console.log('Session:', response.session);
    console.log('Access Token:', response.access_token);
  },
);
```

#### StreamSessionEvents

Real-time session event streaming for monitoring and auditing.

```protobuf
rpc StreamSessionEvents(StreamSessionEventsRequest)
  returns (stream SessionEvent);

enum SessionEventType {
  SESSION_EVENT_TYPE_CREATED = 1;
  SESSION_EVENT_TYPE_UPDATED = 2;
  SESSION_EVENT_TYPE_DELETED = 3;
  SESSION_EVENT_TYPE_EXPIRED = 4;
  SESSION_EVENT_TYPE_ACCESSED = 5;
  SESSION_EVENT_TYPE_REFRESHED = 6;
}
```

**TypeScript Streaming Example:**

```typescript
// Stream session events
const call = client.streamSessionEvents({
  user_id: 'user-123',
  event_types: ['SESSION_EVENT_TYPE_CREATED', 'SESSION_EVENT_TYPE_UPDATED'],
});

call.on('data', (event) => {
  console.log('Event:', event.type);
  console.log('Session:', event.session_id);
  console.log('Timestamp:', event.timestamp);
});

call.on('error', (error) => {
  console.error('Stream error:', error);
});

call.on('end', () => {
  console.log('Stream ended');
});
```

### ContextService

Manages execution contexts including browser automation, shell commands, and containerized
environments.

#### CreateContext

Creates a new execution context for browser automation or command execution.

```protobuf
rpc CreateContext(CreateContextRequest) returns (CreateContextResponse);

enum ContextType {
  CONTEXT_TYPE_BROWSER = 1;
  CONTEXT_TYPE_SHELL = 2;
  CONTEXT_TYPE_DOCKER = 3;
  CONTEXT_TYPE_KUBERNETES = 4;
}
```

**Browser Context Example:**

```typescript
// Create browser context
const metadata = new grpc.Metadata();
metadata.add('authorization', 'Bearer ' + token);

client.createContext(
  {
    session_id: sessionId,
    name: 'e2e-test-browser',
    type: 'CONTEXT_TYPE_BROWSER',
    config: {
      headless: 'true',
      viewport_width: '1920',
      viewport_height: '1080',
    },
    metadata: {
      test_suite: 'checkout-flow',
      environment: 'staging',
    },
  },
  metadata,
  (error, response) => {
    if (error) {
      console.error('Error:', error);
      return;
    }
    console.log('Context ID:', response.context.id);
    console.log('Status:', response.context.status);
  },
);
```

#### ExecuteCommand

Executes commands within a context with support for browser actions.

```protobuf
rpc ExecuteCommand(ExecuteCommandRequest) returns (ExecuteCommandResponse);

message ExecuteCommandRequest {
  string context_id = 1;
  string command = 2;
  repeated string args = 3;
  map<string, string> env = 4;
  string working_dir = 5;
  int32 timeout_seconds = 6;
}
```

**Browser Action Example:**

```typescript
// Navigate to URL
client.executeCommand(
  {
    context_id: contextId,
    command: 'navigate',
    args: ['https://example.com'],
    timeout_seconds: 30,
  },
  metadata,
  (error, response) => {
    if (!error && response.exit_code === 0) {
      console.log('Navigation successful');
    }
  },
);

// Take screenshot
client.executeCommand(
  {
    context_id: contextId,
    command: 'screenshot',
    args: ['--full-page'],
    env: {
      SCREENSHOT_PATH: '/tmp/screenshot.png',
    },
  },
  metadata,
  (error, response) => {
    console.log('Screenshot saved:', response.stdout);
  },
);
```

#### StreamCommand

Streams command output in real-time for long-running operations.

```typescript
// Stream browser events
const stream = client.streamCommand(
  {
    context_id: contextId,
    command: 'monitor',
    args: ['--events', 'console,network,error'],
  },
  metadata,
);

stream.on('data', (output) => {
  if (output.stdout) {
    console.log('Output:', output.stdout);
  }
  if (output.stderr) {
    console.error('Error:', output.stderr);
  }
  if (output.exit_code !== undefined) {
    console.log('Command finished with code:', output.exit_code);
  }
});
```

### HealthService

Monitors service health and availability.

```protobuf
service HealthService {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);
  rpc Watch(HealthCheckRequest) returns (stream HealthCheckResponse);
}
```

**Health Check Example:**

```typescript
const healthClient = new HealthService('localhost:50051', grpc.credentials.createInsecure());

// One-time health check
healthClient.check({ service: '' }, (error, response) => {
  if (!error && response.status === 'SERVING') {
    console.log('Service is healthy');
  }
});

// Watch health status
const healthStream = healthClient.watch({ service: '' });
healthStream.on('data', (response) => {
  console.log('Health status:', response.status);
  console.log('Metadata:', response.metadata);
});
```

## Error Handling

gRPC errors follow standard status codes with additional metadata:

```typescript
client.getSession({ session_id: 'invalid' }, metadata, (error, response) => {
  if (error) {
    console.error('Code:', error.code); // grpc.status code
    console.error('Message:', error.message); // Error description
    console.error('Details:', error.metadata); // Additional context

    switch (error.code) {
      case grpc.status.UNAUTHENTICATED:
        // Handle authentication error
        break;
      case grpc.status.NOT_FOUND:
        // Handle not found
        break;
      case grpc.status.INVALID_ARGUMENT:
        // Handle validation error
        break;
    }
  }
});
```

## Advanced Patterns

### Interceptors

Add custom interceptors for logging, retry, or modification:

```typescript
const interceptor = (options, nextCall) => {
  return new grpc.InterceptingCall(nextCall(options), {
    sendMessage: (message, next) => {
      console.log('Sending:', message);
      next(message);
    },
    receiveMessage: (message, next) => {
      console.log('Received:', message);
      next(message);
    },
  });
};

const client = new SessionService('localhost:50051', grpc.credentials.createInsecure(), {
  interceptors: [interceptor],
});
```

### Connection Pooling

```typescript
// Channel options for connection pooling
const channelOptions = {
  'grpc.max_connection_idle_ms': 300000,
  'grpc.max_connection_age_ms': 600000,
  'grpc.client_idle_timeout_ms': 300000,
  'grpc.http2.max_pings_without_data': 0,
};

const client = new SessionService(
  'localhost:50051',
  grpc.credentials.createInsecure(),
  channelOptions,
);
```

### Deadline and Timeout

```typescript
// Set deadline for call
const deadline = new Date();
deadline.setSeconds(deadline.getSeconds() + 30);

client.createSession(request, metadata, { deadline }, (error, response) => {
  if (error && error.code === grpc.status.DEADLINE_EXCEEDED) {
    console.error('Request timed out');
  }
});
```

## Security Compliance

All gRPC services implement NIST security controls:

- **AC-3**: Access enforcement via authentication interceptor
- **AU-3**: Comprehensive audit logging for all operations
- **IA-2**: Multi-factor authentication support
- **SC-8**: TLS encryption for transport security
- **SI-10**: Input validation on all requests

## Performance Considerations

- **Message Size**: Default 4MB limit, configurable via GRPC_MAX_MESSAGE_SIZE
- **Keepalive**: 2-minute keepalive prevents connection drops
- **Streaming**: Use for real-time updates and large data transfers
- **Connection Reuse**: Clients should reuse connections for efficiency
- **Compression**: Enable gzip compression for large payloads

## Related Documentation

- [REST API Reference](/puppeteer-mcp/reference/rest-api.md)
- [WebSocket API Reference](/puppeteer-mcp/reference/websocket-api.md)
- [Security Architecture](/puppeteer-mcp/architecture/security.md)
- [Browser Automation Guide](/puppeteer-mcp/guides/browser-automation.md)
