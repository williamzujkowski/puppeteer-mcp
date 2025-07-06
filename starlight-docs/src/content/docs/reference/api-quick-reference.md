---
title: API Quick Reference
description: ## Authentication
---

# API Quick Reference

## Authentication

### JWT Authentication

```bash
# Login
POST /api/v1/auth/login
{"username": "user", "password": "pass"}
→ {"accessToken": "jwt...", "refreshToken": "jwt..."}

# Use token
Authorization: Bearer <accessToken>
```

### API Key Authentication

```bash
# Create key
POST /api/v1/apikeys
{"name": "my-key", "scopes": ["read:session"]}
→ {"key": "pk_live_...", "id": "key-123"}

# Use key
X-API-Key: pk_live_...
```

## REST API

### Sessions

```bash
POST   /api/v1/sessions          # Create session
GET    /api/v1/sessions          # List sessions
GET    /api/v1/sessions/{id}     # Get session
DELETE /api/v1/sessions/{id}     # Delete session
```

### Contexts (Browser)

```bash
POST   /api/v1/contexts          # Create browser context
POST   /api/v1/contexts/{id}/execute  # Execute browser action
DELETE /api/v1/contexts/{id}     # Close browser
```

### Example: Browser Automation

```bash
# Create context
POST /api/v1/contexts
{"name": "test", "viewport": {"width": 1920, "height": 1080}}

# Navigate
POST /api/v1/contexts/{id}/execute
{"action": "navigate", "params": {"url": "https://example.com"}}

# Screenshot
POST /api/v1/contexts/{id}/execute
{"action": "screenshot", "params": {"fullPage": true}}
```

## gRPC API

### Service Methods

```protobuf
// SessionService
CreateSession(CreateSessionRequest) → Session
GetSession(GetSessionRequest) → Session
ListSessions(ListSessionsRequest) → ListSessionsResponse
DeleteSession(DeleteSessionRequest) → Empty

// ContextService
CreateContext(CreateContextRequest) → Context
ExecuteCommand(ExecuteCommandRequest) → ExecuteCommandResponse
StreamEvents(StreamEventsRequest) → stream Event
```

### Example Call

```javascript
// Create session
const session = await client.createSession({
  name: 'test-session',
  metadata: { user: 'john' },
});

// Execute browser action
const result = await client.executeCommand({
  contextId: 'ctx-123',
  command: {
    action: 'click',
    params: { selector: '#button' },
  },
});
```

## WebSocket API

### Connection

```javascript
// Connect with JWT
ws://localhost:3000/ws?token=<jwt>

// Connect with API key
ws://localhost:3000/ws
→ {"type": "auth", "apiKey": "pk_live_..."}
```

### Message Format

```json
{
  "id": "msg-123",
  "type": "execute",
  "version": "1.0",
  "payload": {
    "contextId": "ctx-123",
    "action": "type",
    "params": { "selector": "#input", "text": "hello" }
  }
}
```

### Common Messages

```json
// Subscribe to events
{"type": "subscribe", "topic": "context:ctx-123"}

// Execute action
{"type": "execute", "payload": {...}}

// Heartbeat
{"type": "ping"}
→ {"type": "pong"}
```

## MCP (Model Context Protocol)

### Tools

```json
// execute-api
{
  "tool": "execute-api",
  "arguments": {
    "method": "POST",
    "path": "/api/v1/contexts",
    "body": {"name": "browser-1"}
  }
}

// execute-in-context
{
  "tool": "execute-in-context",
  "arguments": {
    "contextId": "ctx-123",
    "command": "screenshot",
    "parameters": {"fullPage": true}
  }
}
```

### Resources

```json
// List available APIs
{"resource": "api-catalog"}

// Get health status
{"resource": "health-status"}
```

## Status Codes

### Success

- `200 OK` - Request succeeded
- `201 Created` - Resource created
- `204 No Content` - Deletion succeeded

### Client Errors

- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid auth
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limited

### Server Errors

- `500 Internal Server Error` - Server fault
- `503 Service Unavailable` - Temporary outage

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [{ "field": "url", "message": "Invalid URL format" }]
  }
}
```

## Rate Limits

### Default Limits

- **Anonymous**: 10 req/min
- **Authenticated**: 100 req/min
- **API Key**: Based on plan (100-10000 req/min)

### Headers

```bash
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Browser Actions

### Navigation

- `navigate` - Go to URL
- `goBack` - Browser back
- `goForward` - Browser forward
- `reload` - Refresh page

### Interaction

- `click` - Click element
- `type` - Type text
- `select` - Select dropdown
- `hover` - Hover element

### Content

- `screenshot` - Capture screenshot
- `evaluate` - Run JavaScript
- `content` - Get page HTML

### Common Parameters

```json
// Click action
{"selector": "#button", "timeout": 5000}

// Type action
{"selector": "#input", "text": "hello", "delay": 100}

// Screenshot
{"fullPage": true, "type": "png"}
```

## Quick Tips

1. **Always authenticate** - All endpoints except `/health` require auth
2. **Use appropriate protocol** - REST for CRUD, WebSocket for real-time, gRPC for performance
3. **Handle rate limits** - Implement exponential backoff
4. **Validate inputs** - Server validates, but client validation saves requests
5. **Monitor health** - Check `/api/v1/health` for system status
