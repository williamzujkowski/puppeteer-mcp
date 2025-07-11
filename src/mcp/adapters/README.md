# MCP Protocol Adapters

This directory contains protocol adapters that allow the MCP (Model Context Protocol) server to
communicate with different transport protocols.

## REST Adapter

The REST adapter enables MCP to execute REST API calls through the existing Express application.

### Features

- **Multi-Modal Authentication**: Supports JWT, API key, and session-based authentication
- **Full HTTP Method Support**: GET, POST, PUT, PATCH, DELETE
- **Request Transformation**: Converts MCP requests to Express-compatible format
- **Response Transformation**: Converts Express responses to MCP format
- **Error Handling**: Comprehensive error handling with proper status codes
- **Security Logging**: Full audit trail with NIST compliance tags

### Usage

```typescript
import { createApp } from '../../server.js';
import { createMCPServer } from '../server.js';

// Create Express app with all routes
const app = createApp();

// Create MCP server with REST adapter
const mcpServer = createMCPServer(app);

// Start MCP server
await mcpServer.start();
```

### MCP Tool Call Format

```json
{
  "name": "execute-api",
  "arguments": {
    "protocol": "rest",
    "operation": {
      "method": "GET",
      "endpoint": "/api/v1/sessions",
      "headers": {
        "x-custom-header": "value"
      },
      "query": {
        "limit": "10",
        "status": "active"
      }
    },
    "auth": {
      "type": "jwt",
      "credentials": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

### Authentication Types

1. **JWT Authentication**

   ```json
   {
     "type": "jwt",
     "credentials": "Bearer token here"
   }
   ```

2. **API Key Authentication**

   ```json
   {
     "type": "apikey",
     "credentials": "pk_test_123456789"
   }
   ```

3. **Session Authentication**
   ```json
   {
     "type": "session",
     "credentials": "session-id-here"
   }
   ```

### Response Format

All responses follow the MCP response format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "JSON stringified response body"
    }
  ],
  "metadata": {
    "status": 200,
    "headers": {
      "content-type": "application/json"
    },
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "mcp-rest-1234567890-abc123"
  }
}
```

### Error Handling

Errors are transformed into a standardized format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"error\":{\"message\":\"Error message\",\"status\":400,\"details\":{},\"timestamp\":\"2024-01-01T00:00:00.000Z\",\"requestId\":\"mcp-rest-1234567890-abc123\"}}"
    }
  ],
  "metadata": {
    "status": 400,
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "mcp-rest-1234567890-abc123"
  }
}
```

### Architecture

The REST adapter is split into multiple modules for maintainability:

- **rest-adapter.ts**: Main adapter implementation
- **rest-auth-helper.ts**: Authentication handling logic
- **rest-response-transformer.ts**: Response transformation utilities
- **adapter.interface.ts**: Common interfaces for all protocol adapters

### Security Compliance

All security-critical functions are tagged with NIST controls:

- `@nist ac-3`: Access enforcement
- `@nist au-3`: Content of audit records
- `@nist ia-2`: Identification and authentication
- `@nist ia-5`: Authenticator management
- `@nist au-10`: Non-repudiation

## gRPC Adapter

The gRPC adapter enables MCP to execute gRPC service calls through the existing gRPC server.

### Features

- **Multi-Modal Authentication**: Supports JWT, API key, and session-based authentication via
  metadata
- **Unary and Streaming RPCs**: Full support for both unary and server-streaming calls
- **Metadata Handling**: Proper gRPC metadata transformation for authentication and tracing
- **Error Mapping**: Comprehensive gRPC status code to HTTP status code mapping
- **Service Discovery**: Lists available services and methods
- **Security Compliance**: Full NIST control tagging

### Usage

```typescript
import { createGrpcServer } from '../../grpc/server.js';
import { GrpcAdapter } from '../adapters/grpc-adapter.js';

// Create gRPC server
const grpcServer = createGrpcServer(logger, sessionStore);

// Create gRPC adapter
const adapter = new GrpcAdapter(grpcServer);

// Execute a unary call
const response = await adapter.executeRequest({
  operation: {
    service: 'SessionService',
    method: 'CreateSession',
    request: { name: 'Test Session' },
  },
  auth: {
    type: 'jwt',
    credentials: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
});
```

### MCP Tool Call Format

#### Unary Call

```json
{
  "name": "execute-api",
  "arguments": {
    "protocol": "grpc",
    "operation": {
      "service": "SessionService",
      "method": "CreateSession",
      "request": {
        "name": "My Session",
        "metadata": {
          "browser": "Chrome"
        }
      }
    },
    "auth": {
      "type": "jwt",
      "credentials": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

#### Streaming Call

```json
{
  "name": "execute-api",
  "arguments": {
    "protocol": "grpc",
    "operation": {
      "service": "SessionService",
      "method": "StreamSessionEvents",
      "request": {
        "sessionId": "session-123",
        "eventTypes": ["created", "updated"]
      },
      "streaming": true
    },
    "auth": {
      "type": "session",
      "credentials": "session-123"
    }
  }
}
```

### Available Services

1. **SessionService**
   - CreateSession (unary)
   - GetSession (unary)
   - UpdateSession (unary)
   - DeleteSession (unary)
   - ListSessions (unary)
   - BatchGetSessions (unary)
   - StreamSessionEvents (server-streaming)
   - RefreshSession (unary)
   - ValidateSession (unary)

2. **ContextService**
   - CreateContext (unary)
   - GetContext (unary)
   - UpdateContext (unary)
   - DeleteContext (unary)
   - ListContexts (unary)
   - StreamContextEvents (server-streaming)
   - ExecuteCommand (unary)
   - StreamCommand (server-streaming)

3. **HealthService**
   - Check (unary)
   - Watch (server-streaming)

### Response Format

#### Unary Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "JSON stringified response",
      "data": { "id": "123", "name": "Session Name" }
    }
  ],
  "metadata": {
    "requestId": "mcp-grpc-1234567890-abc123",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "protocol": "grpc",
    "service": "SessionService",
    "method": "CreateSession",
    "streaming": false
  }
}
```

#### Streaming Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "JSON stringified event 1",
      "data": { "type": "created", "sessionId": "123" }
    },
    {
      "type": "text",
      "text": "JSON stringified event 2",
      "data": { "type": "updated", "sessionId": "123" }
    }
  ],
  "metadata": {
    "requestId": "mcp-grpc-1234567890-abc123",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "protocol": "grpc",
    "service": "SessionService",
    "method": "StreamSessionEvents",
    "streaming": true,
    "itemCount": 2
  }
}
```

### Error Handling

gRPC errors are properly mapped to HTTP status codes:

| gRPC Status         | HTTP Status | Description              |
| ------------------- | ----------- | ------------------------ |
| OK                  | 200         | Success                  |
| CANCELLED           | 499         | Client cancelled request |
| INVALID_ARGUMENT    | 400         | Bad request              |
| NOT_FOUND           | 404         | Resource not found       |
| ALREADY_EXISTS      | 409         | Conflict                 |
| PERMISSION_DENIED   | 403         | Forbidden                |
| UNAUTHENTICATED     | 401         | Unauthorized             |
| RESOURCE_EXHAUSTED  | 429         | Too many requests        |
| FAILED_PRECONDITION | 412         | Precondition failed      |
| INTERNAL            | 500         | Internal server error    |
| UNAVAILABLE         | 503         | Service unavailable      |

### Security Compliance

All security-critical functions are tagged with NIST controls:

- `@nist ac-3`: Access enforcement
- `@nist au-3`: Content of audit records
- `@nist ia-2`: Identification and authentication
- `@nist sc-8`: Transmission confidentiality and integrity
- `@nist cm-7`: Least functionality
- `@nist si-10`: Information input validation
- `@nist si-11`: Error handling

## Future Adapters

### WebSocket Adapter (Coming Soon)

Will enable MCP to interact with WebSocket connections for real-time communication.

## Contributing

When adding new adapters:

1. Implement the `ProtocolAdapter` interface
2. Add appropriate NIST compliance tags
3. Include comprehensive error handling
4. Add unit and integration tests
5. Update this documentation
