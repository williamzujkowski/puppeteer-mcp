# Quick Reference

Fast access to essential information for Puppeteer MCP developers and users.

## Reference Sheets

### [API Cheatsheet](api-cheatsheet.md)

Quick API reference for all protocols:

- REST endpoints summary
- WebSocket events
- gRPC methods
- Common parameters
- Response formats

### [Common Patterns](common-patterns.md)

Frequently used code patterns:

- Authentication flows
- Session management
- Error handling
- Browser automation
- Resource cleanup

### [Environment Variables](env-vars.md)

Complete environment configuration:

- Required variables
- Optional settings
- Default values
- Security considerations
- Performance tuning

### [Error Codes](error-codes.md)

Comprehensive error reference:

- Error code meanings
- Common causes
- Resolution steps
- Prevention tips
- Troubleshooting guide

### [MCP Tools Summary](mcp-tools-summary.md)

Model Context Protocol tools:

- Available tools list
- Parameter reference
- Usage examples
- Integration patterns
- Best practices

## Quick Links

### Most Used References

- 🚀 [REST API Endpoints](api-cheatsheet.md#rest-api)
- 🔧 [Environment Setup](env-vars.md#required-variables)
- ❌ [Common Errors](error-codes.md#common-errors)
- 🤖 [MCP Tools](mcp-tools-summary.md#tool-list)

### By Protocol

- **REST**: [Endpoints](api-cheatsheet.md#rest-api) | [Authentication](common-patterns.md#rest-auth)
- **WebSocket**: [Events](api-cheatsheet.md#websocket-events) |
  [Connection](common-patterns.md#ws-connection)
- **gRPC**: [Services](api-cheatsheet.md#grpc-services) |
  [Client Setup](common-patterns.md#grpc-setup)
- **MCP**: [Tools](mcp-tools-summary.md) | [Integration](common-patterns.md#mcp-integration)

## Common Tasks Quick Reference

### Starting a Session

```javascript
// REST
POST /api/sessions
{ "options": { "headless": true } }

// WebSocket
ws.send({ type: 'create_session', options: { headless: true } })

// gRPC
client.createSession({ options: { headless: true } })

// MCP
puppeteer_create_session({ headless: true })
```

### Navigating to URL

```javascript
// REST
POST /api/sessions/:id/navigate
{ "url": "https://example.com" }

// WebSocket
ws.send({ type: 'navigate', sessionId, url: 'https://example.com' })

// gRPC
client.navigate({ sessionId, url: 'https://example.com' })

// MCP
puppeteer_navigate({ sessionId, url: 'https://example.com' })
```

### Taking Screenshot

```javascript
// REST
POST /api/sessions/:id/screenshot
{ "fullPage": true }

// WebSocket
ws.send({ type: 'screenshot', sessionId, fullPage: true })

// gRPC
client.screenshot({ sessionId, fullPage: true })

// MCP
puppeteer_screenshot({ sessionId, fullPage: true })
```

## Error Quick Reference

### Common HTTP Status Codes

- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid auth)
- `404` - Not Found (session/resource not found)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Common Error Codes

- `SESSION_NOT_FOUND` - Invalid session ID
- `BROWSER_ERROR` - Puppeteer operation failed
- `TIMEOUT_ERROR` - Operation timed out
- `VALIDATION_ERROR` - Invalid input parameters
- `AUTH_ERROR` - Authentication failed

## Environment Variables Quick Reference

### Essential Variables

```bash
# Required
NODE_ENV=production
PORT=3000
JWT_SECRET=your-secret-key

# Recommended
SESSION_TIMEOUT=300000
MAX_SESSIONS=10
RATE_LIMIT=100
```

### Security Variables

```bash
# Authentication
JWT_EXPIRES_IN=1h
API_KEY_HEADER=x-api-key

# Security Headers
CORS_ORIGIN=https://example.com
CSP_POLICY=default-src 'self'
```

## Performance Quick Tips

### Session Management

- Keep sessions alive with regular actions
- Close sessions when done
- Reuse sessions when possible
- Monitor resource usage

### Browser Optimization

- Use headless mode in production
- Disable unnecessary features
- Implement proper timeouts
- Clean up resources

## Debugging Quick Reference

### Enable Debug Logging

```bash
DEBUG=* npm run dev              # All debug
DEBUG=puppeteer:* npm run dev    # Puppeteer only
DEBUG=mcp:* npm run dev          # MCP only
```

### Common Debug Commands

```bash
npm run typecheck    # Check TypeScript
npm run lint        # Run ESLint
npm test           # Run tests
npm run build      # Build project
```

## Protocol Comparison

| Feature         | REST | WebSocket | gRPC | MCP |
| --------------- | ---- | --------- | ---- | --- |
| Real-time       | ❌   | ✅        | ❌   | ❌  |
| Streaming       | ❌   | ✅        | ✅   | ❌  |
| Type Safety     | ❌   | ❌        | ✅   | ✅  |
| Browser Support | ✅   | ✅        | ❌   | ❌  |
| AI Integration  | ❌   | ❌        | ❌   | ✅  |

## Need More Detail?

- 📚 [Full API Reference](../reference/)
- 🎯 [User Guides](../guides/)
- 🏗️ [Architecture Docs](../architecture/)
- 🔧 [Development Guide](../development/)

---

**Pro Tip**: Bookmark this page for quick access to essential information during development!
