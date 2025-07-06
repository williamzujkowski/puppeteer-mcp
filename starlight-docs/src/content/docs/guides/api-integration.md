---
title: API Integration Guide
description:
  'This guide provides comprehensive instructions for integrating with the Puppeteer MCP platform'
---

# API Integration Guide

This guide provides comprehensive instructions for integrating with the Puppeteer MCP platform
through its four protocol interfaces: REST, gRPC, WebSocket, and Model Context Protocol (MCP). Each
protocol offers unique advantages for different use cases.

## Protocol Comparison

### REST API

- **Best for**: Traditional HTTP clients, web applications, simple integrations
- **Advantages**: Widely supported, simple to implement, stateless, HTTP/2 support
- **Authentication**: JWT Bearer tokens or API keys via headers
- **Response format**: JSON
- **Use cases**: CRUD operations, one-off requests, RESTful applications

### gRPC

- **Best for**: Microservices, high-performance applications, type-safe clients
- **Advantages**: Binary protocol, streaming support, auto-generated clients, lower latency
- **Authentication**: JWT or API keys via metadata
- **Response format**: Protocol Buffers
- **Use cases**: Real-time data streaming, microservice communication, performance-critical apps

### WebSocket

- **Best for**: Real-time applications, event-driven architectures, live updates
- **Advantages**: Bidirectional communication, low latency, persistent connections
- **Authentication**: JWT or API keys during handshake
- **Response format**: JSON message envelopes
- **Use cases**: Live browser events, real-time notifications, collaborative features

### Model Context Protocol (MCP)

- **Best for**: AI agents, LLMs, automated workflows
- **Advantages**: AI-native interface, tool discovery, semantic understanding
- **Authentication**: Unified auth bridge supporting JWT/API keys
- **Response format**: MCP protocol messages
- **Use cases**: AI-driven automation, intelligent agents, LLM integration

## Authentication Setup

### JWT Authentication

#### REST API

```bash
# Login to get tokens
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "pass"}'

# Use access token
curl -H "Authorization: Bearer <access_token>" \
  http://localhost:3000/api/v1/sessions
```

#### gRPC

```javascript
const metadata = new grpc.Metadata();
metadata.set('authorization', `Bearer ${accessToken}`);
client.listSessions({}, metadata, callback);
```

#### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000');
ws.on('open', () => {
  ws.send(
    JSON.stringify({
      type: 'auth',
      token: accessToken,
    }),
  );
});
```

#### MCP

```javascript
// MCP handles auth transparently via the auth bridge
const client = new MCPClient({
  auth: { token: accessToken },
});
```

### API Key Authentication

#### REST API

```bash
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/v1/sessions
```

#### gRPC

```javascript
const metadata = new grpc.Metadata();
metadata.set('x-api-key', apiKey);
client.listSessions({}, metadata, callback);
```

#### WebSocket

```javascript
ws.send(
  JSON.stringify({
    type: 'auth',
    apiKey: apiKey,
  }),
);
```

#### MCP

```javascript
const client = new MCPClient({
  auth: { apiKey: apiKey },
});
```

## Session Management Best Practices

### 1. Session Creation

Always create a session before performing operations:

```javascript
// REST
const session = await fetch('/api/v1/sessions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ name: 'my-session' }),
}).then((r) => r.json());

// Use session.id for subsequent operations
```

### 2. Context Management

Create contexts within sessions for browser automation:

```javascript
// Create context with browser settings
const context = await createContext(sessionId, {
  name: 'browser-context',
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0...',
});
```

### 3. Session Lifecycle

- Sessions expire after inactivity (configurable)
- Always clean up sessions when done
- Use refresh tokens for long-running operations
- Monitor session health via health endpoints

### 4. Error Handling

```javascript
try {
  const result = await executeAction(contextId, action);
} catch (error) {
  if (error.code === 401) {
    // Refresh token and retry
    await refreshAuth();
    return retry();
  }
  // Handle other errors
}
```

## Example Workflows

### Web Scraping Workflow

```javascript
// 1. Create session
const session = await createSession('scraper-session');

// 2. Create browser context
const context = await createContext(session.id, {
  name: 'scraper',
  viewport: { width: 1280, height: 720 },
});

// 3. Navigate to target
await executeAction(context.id, {
  action: 'navigate',
  params: { url: 'https://example.com' },
});

// 4. Extract data
const content = await executeAction(context.id, {
  action: 'evaluate',
  params: {
    script: 'document.querySelector(".content").innerText',
  },
});

// 5. Cleanup
await deleteContext(context.id);
await deleteSession(session.id);
```

### Real-time Monitoring

```javascript
// WebSocket for live updates
ws.on('authenticated', () => {
  // Subscribe to browser events
  ws.send(
    JSON.stringify({
      type: 'subscribe',
      topic: 'browser.events',
      contextId: contextId,
    }),
  );
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'browser.event') {
    console.log('Browser event:', msg.event);
  }
});
```

### AI-Driven Automation

```javascript
// Using MCP for intelligent automation
const response = await mcp.callTool('execute-in-context', {
  contextId: contextId,
  command: 'screenshot',
  parameters: { fullPage: true },
});

// AI can chain operations based on results
if (needsScroll(response)) {
  await mcp.callTool('execute-in-context', {
    contextId: contextId,
    command: 'scroll',
    parameters: { direction: 'down' },
  });
}
```

## Protocol Selection Guidance

### Choose REST when:

- Building traditional web applications
- Need simple, stateless operations
- Working with standard HTTP tooling
- Require broad client compatibility

### Choose gRPC when:

- Building microservices architecture
- Need high performance and low latency
- Want type-safe client generation
- Require streaming capabilities

### Choose WebSocket when:

- Building real-time applications
- Need bidirectional communication
- Want live browser event updates
- Require persistent connections

### Choose MCP when:

- Integrating with AI/LLM systems
- Building intelligent automation
- Need semantic tool discovery
- Want unified multi-protocol access

## Security Considerations

1. **Always use HTTPS/WSS in production**
2. **Rotate API keys regularly**
3. **Implement rate limiting per session**
4. **Validate all browser action inputs**
5. **Use short-lived JWT tokens**
6. **Enable audit logging for compliance**
7. **Implement proper CORS policies**
8. **Sanitize JavaScript execution**

## Performance Tips

1. **Reuse sessions** for multiple operations
2. **Use browser pooling** to reduce startup time
3. **Batch operations** when possible
4. **Monitor resource usage** via health endpoints
5. **Implement proper timeout** handling
6. **Use streaming** for large responses
7. **Cache authentication** tokens appropriately

## Next Steps

- Review the [API Quick Reference](/reference/api-quick-reference) for endpoint details
- Explore [Browser Automation Guide](/guides/browser-automation) for Puppeteer features
- Check [MCP Usage Examples](/guides/mcp-usage-examples) for AI integration patterns
- See [Security Documentation](/security) for compliance requirements
