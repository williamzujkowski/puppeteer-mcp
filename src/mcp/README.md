# Model Context Protocol (MCP) Integration

This directory contains the MCP server implementation that enables AI agents and LLMs to interact with the multi-protocol API platform.

## Overview

The MCP integration provides a standardized interface for LLMs to:
- Execute API calls across REST, gRPC, and WebSocket protocols
- Manage sessions and authentication
- Create and control browser contexts
- Execute commands in browser contexts
- Discover available APIs and their schemas

## Architecture

```
MCP Server
├── Transport Layer (stdio/HTTP)
├── Protocol Adapters
│   ├── REST Adapter → Express Routes
│   ├── gRPC Adapter → gRPC Services  
│   └── WebSocket Adapter → WS Handlers
├── Tools
│   ├── execute-api
│   ├── create-session
│   ├── list-sessions
│   ├── delete-session
│   ├── create-browser-context
│   └── execute-in-context
└── Resources
    ├── api://catalog
    └── api://health
```

## Running the MCP Server

### Standalone Mode (stdio transport)

```bash
# Run with stdio transport (default)
node dist/mcp/start-mcp.js

# Or with TypeScript
npx tsx src/mcp/start-mcp.ts
```

### HTTP Transport Mode

```bash
# Run with HTTP transport
MCP_TRANSPORT=http MCP_HTTP_PORT=3001 node dist/mcp/start-mcp.js
```

### Integrated with Main Application

```typescript
import { createMCPServer } from './mcp/server.js';
import { createApp } from './server.js';
import { createGrpcServer } from './grpc/server.js';

// Create all protocol servers
const app = createApp();
const grpcServer = createGrpcServer();

// Create and start MCP server
const mcpServer = createMCPServer({ app, grpcServer });
await mcpServer.start();
```

## Available Tools

### 1. execute-api
Execute API calls across any protocol.

```json
{
  "tool": "execute-api",
  "arguments": {
    "protocol": "rest",
    "operation": {
      "method": "GET",
      "endpoint": "/api/v1/sessions"
    },
    "auth": {
      "type": "jwt",
      "credentials": "eyJ..."
    }
  }
}
```

### 2. create-session
Create a new authenticated session.

```json
{
  "tool": "create-session",
  "arguments": {
    "username": "user@example.com",
    "password": "password",
    "duration": 3600
  }
}
```

### 3. list-sessions
List active sessions for a user.

```json
{
  "tool": "list-sessions",
  "arguments": {
    "userId": "user@example.com"
  }
}
```

### 4. delete-session
Delete an active session.

```json
{
  "tool": "delete-session",
  "arguments": {
    "sessionId": "session-123"
  }
}
```

### 5. create-browser-context
Create a Puppeteer browser context.

```json
{
  "tool": "create-browser-context",
  "arguments": {
    "sessionId": "session-123",
    "options": {
      "headless": true,
      "viewport": {
        "width": 1920,
        "height": 1080
      }
    }
  }
}
```

### 6. execute-in-context
Execute commands in a browser context.

```json
{
  "tool": "execute-in-context",
  "arguments": {
    "contextId": "context-456",
    "command": "navigate",
    "parameters": {
      "url": "https://example.com"
    }
  }
}
```

## Available Resources

### api://catalog
Returns a complete catalog of available APIs across all protocols.

### api://health
Returns current system health and status information.

## Authentication

The MCP server supports three authentication methods:

1. **JWT Tokens**: Short-lived access tokens
2. **API Keys**: Long-lived keys with scoped permissions  
3. **Session IDs**: Session-based authentication

## Security

- All security controls from the main platform are enforced
- NIST 800-53r5 compliance is maintained
- All operations are logged for audit purposes
- Permission-based access control for tools

## Examples

See the `examples/` directory for integration examples:
- `rest-integration.ts` - REST API integration
- `grpc-integration.ts` - gRPC service integration
- `ws-integration.ts` - WebSocket integration
- `session-management.ts` - Session management examples

## Testing

Unit tests are located in `tests/unit/mcp/` and integration tests in `tests/integration/mcp/`.

Run tests:
```bash
npm test -- tests/unit/mcp/
```

## Development

When adding new tools:
1. Add tool definition in `server.ts` ListToolsRequestSchema handler
2. Add case in CallToolRequestSchema switch statement
3. Implement the tool method
4. Add unit tests
5. Update this README

## Troubleshooting

- **Transport Issues**: Check MCP_TRANSPORT environment variable
- **Authentication Failures**: Verify credentials and permissions
- **Protocol Adapter Errors**: Ensure all servers are initialized
- **Tool Not Found**: Check tool name matches exactly