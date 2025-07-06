---
title: API Reference
description: Complete API reference documentation for Puppeteer MCP's multi-protocol interfaces.
---

# API Reference

Complete API reference documentation for Puppeteer MCP's multi-protocol interfaces.

## Available APIs

### [REST API](/puppeteer-mcp/rest-api.md)

RESTful HTTP API for browser automation:

- Session management endpoints
- Browser action endpoints
- Authentication methods
- Response formats
- Error codes

### [gRPC API](/puppeteer-mcp/grpc-api.md)

High-performance gRPC service:

- Protocol buffer definitions
- Service methods
- Streaming capabilities
- Client examples
- Performance considerations

### [WebSocket API](/puppeteer-mcp/websocket-api.md)

Real-time WebSocket interface:

- Connection management
- Message protocols
- Event subscriptions
- Bidirectional communication
- Connection lifecycle

### [MCP Tools](/puppeteer-mcp/mcp-tools.md)

Model Context Protocol tools for AI assistants:

- Available tools listing
- Parameter specifications
- Response formats
- Integration patterns
- Claude Desktop usage

### [Puppeteer Actions](/puppeteer-mcp/puppeteer-actions.md)

Comprehensive Puppeteer action reference:

- Navigation methods
- Interaction methods
- Content methods
- Wait strategies
- Advanced options

## Quick Links

### By Protocol

- **HTTP/REST**: Standard web API - [REST API](/puppeteer-mcp/rest-api.md)
- **gRPC**: High-performance RPC - [gRPC API](/puppeteer-mcp/grpc-api.md)
- **WebSocket**: Real-time events - [WebSocket API](/puppeteer-mcp/websocket-api.md)
- **MCP**: AI integration - [MCP Tools](/puppeteer-mcp/mcp-tools.md)

### By Function

- **Session Management**: Create, list, and close browser sessions
- **Page Navigation**: Navigate, reload, and manage history
- **Element Interaction**: Click, type, select, and fill forms
- **Content Extraction**: Screenshot, PDF, and JavaScript evaluation
- **Synchronization**: Wait for elements and navigation

## API Comparison

| Feature              | REST | WebSocket | gRPC | MCP  |
| -------------------- | ---- | --------- | ---- | ---- |
| Request/Response     | ✅   | ✅        | ✅   | ✅   |
| Streaming            | ❌   | ✅        | ✅   | ❌   |
| Binary Data          | ✅   | ✅        | ✅   | ✅   |
| Easy Integration     | ✅   | ✅        | ⚠️   | ✅   |
| Performance          | Good | Good      | Best | Good |
| AI Assistant Support | ❌   | ❌        | ❌   | ✅   |

## Authentication

All APIs use the same authentication token:

```bash
# REST API
Authorization: Bearer YOUR_TOKEN

# WebSocket
{ "type": "auth", "token": "YOUR_TOKEN" }

# gRPC (metadata)
authorization: Bearer YOUR_TOKEN

# MCP (environment)
PUPPETEER_MCP_AUTH_TOKEN=YOUR_TOKEN
```

## Common Patterns

### Session Lifecycle

```javascript
// 1. Create session
const session = await createSession({ baseUrl: 'https://example.com' });

// 2. Perform actions
await navigate(session.id, { url: '/page' });
await click(session.id, { selector: '#button' });

// 3. Get results
const content = await getContent(session.id);

// 4. Clean up
await closeSession(session.id);
```

### Error Handling

```javascript
try {
  const result = await browserAction(sessionId, params);
} catch (error) {
  if (error.code === 'SESSION_NOT_FOUND') {
    // Handle missing session
  } else if (error.code === 'TIMEOUT') {
    // Handle timeout
  }
}
```

## Response Formats

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "metadata": {
    "timestamp": "2025-01-05T10:00:00Z",
    "duration": 123
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error context
    }
  }
}
```

## Rate Limits

Default limits per authentication token:

| API       | Limit         | Window     |
| --------- | ------------- | ---------- |
| REST      | 100 requests  | 15 minutes |
| WebSocket | 1000 messages | 15 minutes |
| gRPC      | 1000 calls    | 15 minutes |
| MCP       | No limit      | -          |

## Quick Start Examples

### REST API

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"baseUrl": "https://example.com"}'
```

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000');
ws.send(JSON.stringify({ type: 'auth', token: 'YOUR_TOKEN' }));
```

### gRPC

```javascript
const client = new BrowserAutomation('localhost:50051', credentials);
const session = await client.createSession({ baseUrl: 'https://example.com' });
```

### MCP

```
Claude: "Navigate to example.com and take a screenshot"
```

## API Selection Guide

Choose the right API for your use case:

- **REST API**: Best for simple integrations, one-off requests
- **WebSocket**: Best for real-time updates, event streaming
- **gRPC**: Best for high-performance, microservices
- **MCP**: Best for AI assistants, natural language control
