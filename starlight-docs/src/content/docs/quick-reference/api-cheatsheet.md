---
title: API Cheatsheet
description: 'Quick reference for REST API endpoints and usage'
---

# API Cheatsheet

## REST API

```bash
# Authentication
curl -X POST http://localhost:8443/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"pass"}'

# Create Session
curl -X POST http://localhost:8443/api/sessions \
  -H "Authorization: Bearer TOKEN" \
  -d '{"viewport":{"width":1280,"height":720}}'

# Navigate
curl -X POST http://localhost:8443/api/sessions/{id}/navigate \
  -H "Authorization: Bearer TOKEN" \
  -d '{"url":"https://example.com"}'

# Take Screenshot
curl -X POST http://localhost:8443/api/sessions/{id}/screenshot \
  -H "Authorization: Bearer TOKEN"

# Execute Script
curl -X POST http://localhost:8443/api/sessions/{id}/execute \
  -H "Authorization: Bearer TOKEN" \
  -d '{"script":"document.title"}'

# Close Session
curl -X DELETE http://localhost:8443/api/sessions/{id} \
  -H "Authorization: Bearer TOKEN"
```

## WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8443');

// Auth
ws.send(
  JSON.stringify({
    type: 'auth',
    token: 'YOUR_TOKEN',
  }),
);

// Commands
ws.send(
  JSON.stringify({
    type: 'navigate',
    sessionId: 'SESSION_ID',
    url: 'https://example.com',
  }),
);

ws.send(
  JSON.stringify({
    type: 'screenshot',
    sessionId: 'SESSION_ID',
  }),
);
```

## gRPC

```javascript
// Create session
const { sessionId } = await client.CreateSession({
  config: { viewport: { width: 1280, height: 720 } },
});

// Navigate
await client.Navigate({
  sessionId,
  url: 'https://example.com',
});

// Screenshot
const { data } = await client.TakeScreenshot({ sessionId });
```

## MCP Tools

```javascript
// Navigate
await useTool('puppeteer_navigate', {
  url: 'https://example.com',
  sessionId: 'SESSION_ID',
});

// Click
await useTool('puppeteer_click', {
  selector: 'button.submit',
  sessionId: 'SESSION_ID',
});

// Type
await useTool('puppeteer_type', {
  selector: 'input[name="email"]',
  text: 'user@example.com',
  sessionId: 'SESSION_ID',
});
```
