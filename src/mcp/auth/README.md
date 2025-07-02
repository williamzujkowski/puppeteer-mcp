# MCP Authentication Bridge

The MCP Authentication Bridge provides unified authentication for MCP (Model Context Protocol) requests across different authentication methods.

## Features

- **Multi-Modal Authentication**: Supports JWT tokens, API keys, and session-based authentication
- **Unified Interface**: Single API for all authentication methods
- **Permission Mapping**: Maps MCP tools to required permissions
- **NIST Compliance**: Implements NIST 800-53r5 security controls
- **Comprehensive Logging**: Security event logging for all authentication attempts

## Usage

### Basic Authentication

```typescript
import { mcpAuthBridge } from './mcp/auth/index.js';

// JWT Authentication
const jwtAuth = await mcpAuthBridge.authenticate({
  type: 'jwt',
  credentials: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
});

// API Key Authentication
const apiKeyAuth = await mcpAuthBridge.authenticate({
  type: 'apikey',
  credentials: 'mcp_1234567890abcdef...'
});

// Session Authentication
const sessionAuth = await mcpAuthBridge.authenticate({
  type: 'session',
  credentials: 'session-uuid-here'
});
```

### Extracting Credentials

The bridge can automatically extract credentials from various sources:

```typescript
// From HTTP headers
const creds = mcpAuthBridge.extractCredentials({
  headers: {
    'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});

// From query parameters
const creds = mcpAuthBridge.extractCredentials({
  query: {
    apikey: 'mcp_1234567890abcdef...'
  }
});

// From WebSocket metadata
const creds = mcpAuthBridge.extractCredentials({
  metadata: {
    auth: {
      type: 'jwt',
      credentials: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    }
  }
});
```

### Tool Permission Checking

```typescript
const authContext = await mcpAuthBridge.authenticate(credentials);

// Check if user has permission for a tool
if (mcpAuthBridge.hasToolPermission(authContext, 'navigate')) {
  // User can use the navigate tool
}

// Require permission (throws if not authorized)
await mcpAuthBridge.requireToolPermission(authContext, 'navigate');
```

## MCP Tool Permissions

The following permissions are mapped to MCP tools:

### Browser Control Tools
- `navigate` → `context:execute`
- `click` → `context:execute`
- `type` → `context:execute`
- `scroll` → `context:execute`
- `waitForSelector` → `context:execute`
- `evaluate` → `context:execute`

### Page Information Tools
- `screenshot` → `context:read`
- `getTitle` → `context:read`
- `getUrl` → `context:read`
- `getContent` → `context:read`
- `getCookies` → `context:read`

### Session Management Tools
- `createSession` → `session:create`
- `closeSession` → `session:delete`
- `listSessions` → `session:list`

### Context Management Tools
- `createContext` → `context:create`
- `getContext` → `context:read`
- `updateContext` → `context:update`
- `deleteContext` → `context:delete`
- `listContexts` → `context:list`

## Integration Example

```typescript
import { MCPServer } from '@modelcontextprotocol/sdk';
import { mcpAuthBridge } from './mcp/auth/index.js';

const server = new MCPServer({
  name: 'puppeteer-mcp',
  version: '1.0.0'
});

// Add authentication to tool handlers
server.setRequestHandler('navigate', async (request, context) => {
  // Extract credentials from request context
  const credentials = mcpAuthBridge.extractCredentials({
    headers: context.headers,
    metadata: context.metadata
  });
  
  // Authenticate the request
  const authContext = await mcpAuthBridge.authenticate(credentials);
  
  // Check permissions
  await mcpAuthBridge.requireToolPermission(authContext, 'navigate');
  
  // Tool implementation...
});
```

## Security Considerations

1. **JWT Tokens**: Must be valid and not expired. Uses HS256 algorithm by default.
2. **API Keys**: Stored as hashes, never in plain text. Support expiration and revocation.
3. **Sessions**: Automatically cleaned up when expired. Support touch to extend lifetime.
4. **Audit Logging**: All authentication attempts are logged for security compliance.

## Error Handling

The bridge throws `AppError` with appropriate HTTP status codes:
- `401`: Authentication failed (invalid credentials, expired tokens)
- `403`: Authorization failed (insufficient permissions)
- `400`: Invalid authentication type or malformed request