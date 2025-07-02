# MCP Session Management

This document describes the session management implementation in the MCP (Model Context Protocol) server.

## Overview

The MCP server provides comprehensive session management tools that integrate with the existing authentication system. Sessions are created using username/password authentication and can be used for subsequent API operations across all protocols (REST, gRPC, WebSocket).

## Features

- **User Authentication**: Authenticate users with username/password credentials
- **Session Creation**: Create time-limited sessions with JWT tokens
- **Session Listing**: List active sessions for a specific user
- **Session Deletion**: Manually delete sessions before expiration
- **Browser Context Creation**: Create Puppeteer browser contexts with authenticated sessions
- **Multi-Protocol Support**: Use sessions across REST, gRPC, and WebSocket protocols

## Security Features

- **NIST Compliance**: All authentication operations are tagged with NIST security controls
- **Audit Logging**: All authentication attempts and session operations are logged
- **Password Hashing**: Passwords are hashed using SHA-256 (production should use bcrypt/argon2)
- **Token Generation**: Sessions include both access and refresh JWT tokens
- **Permission Enforcement**: Role-based access control (RBAC) with granular permissions
- **Session Expiration**: Configurable session duration with automatic cleanup

## Available Tools

### 1. create-session

Creates a new authenticated session.

**Input Schema:**
```json
{
  "username": "string (required)",
  "password": "string (required)",
  "duration": "number (optional, seconds, default: 3600)"
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "userId": "uuid",
  "username": "string",
  "roles": ["string"],
  "createdAt": "ISO 8601 datetime",
  "expiresAt": "ISO 8601 datetime",
  "tokens": {
    "accessToken": "JWT string",
    "refreshToken": "JWT string",
    "expiresIn": "number (seconds)"
  }
}
```

**Error Response:**
```json
{
  "error": "string",
  "code": "INVALID_CREDENTIALS | AUTH_FAILED"
}
```

### 2. list-sessions

Lists active sessions for a specific user.

**Input Schema:**
```json
{
  "userId": "string (optional)"
}
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "userId": "uuid",
      "username": "string",
      "roles": ["string"],
      "createdAt": "ISO 8601 datetime",
      "expiresAt": "ISO 8601 datetime",
      "lastAccessedAt": "ISO 8601 datetime",
      "metadata": {}
    }
  ],
  "count": "number"
}
```

### 3. delete-session

Deletes an active session.

**Input Schema:**
```json
{
  "sessionId": "string (required)"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "string",
  "message": "Session deleted successfully"
}
```

**Error Response:**
```json
{
  "error": "string",
  "code": "INVALID_SESSION_ID | SESSION_NOT_FOUND | DELETE_FAILED"
}
```

### 4. create-browser-context

Creates a Puppeteer browser context using an authenticated session.

**Input Schema:**
```json
{
  "sessionId": "string (required)",
  "name": "string (optional)",
  "options": {
    "headless": "boolean (optional)",
    "viewport": {
      "width": "number (optional)",
      "height": "number (optional)"
    }
  }
}
```

**Response:**
```json
{
  "contextId": "uuid",
  "name": "string",
  "type": "puppeteer",
  "status": "active",
  "createdAt": "ISO 8601 datetime"
}
```

## Demo Users

The system includes three demo users for testing:

### Admin User
- **Username**: admin
- **Password**: admin123!
- **Roles**: ['admin', 'user']
- **Description**: Full administrative permissions

### Demo User
- **Username**: demo
- **Password**: demo123!
- **Roles**: ['user']
- **Description**: Standard user permissions

### Viewer User
- **Username**: viewer
- **Password**: viewer123!
- **Roles**: ['viewer']
- **Description**: Read-only permissions

## Usage Examples

### Creating a Session

```javascript
// MCP tool call
{
  "tool": "create-session",
  "arguments": {
    "username": "demo",
    "password": "demo123!",
    "duration": 7200  // 2 hours
  }
}
```

### Using Session for API Calls

```javascript
// Use session with execute-api tool
{
  "tool": "execute-api",
  "arguments": {
    "protocol": "rest",
    "operation": {
      "method": "GET",
      "endpoint": "/api/v1/contexts"
    },
    "auth": {
      "type": "session",
      "credentials": "session-uuid-here"
    }
  }
}
```

### Authentication Flow

1. **Login**: Create session with username/password
2. **Receive Tokens**: Get session ID and JWT tokens
3. **Use Session**: Include session ID in subsequent operations
4. **Auto-Expiration**: Sessions expire after the specified duration
5. **Manual Cleanup**: Delete session when done (optional)

## Implementation Details

### Session Store

Sessions are stored in an in-memory store (`InMemorySessionStore`) with the following features:
- Automatic cleanup of expired sessions (runs every minute)
- User-based session tracking
- Audit logging for all operations
- Touch mechanism to update last accessed time

### Authentication Bridge

The `MCPAuthBridge` provides unified authentication across different methods:
- JWT token verification
- API key verification
- Session-based authentication
- Permission checking for MCP tools

### Security Logging

All authentication events are logged with appropriate NIST tags:
- `@nist ia-2`: Identification and authentication
- `@nist ac-3`: Access enforcement
- `@nist au-3`: Content of audit records
- `@nist ia-5`: Authenticator management

### Error Handling

The implementation includes comprehensive error handling:
- Input validation using Zod schemas
- Detailed error messages with error codes
- Security event logging for failures
- Graceful handling of edge cases

## Production Considerations

1. **Password Hashing**: Replace SHA-256 with bcrypt or argon2
2. **Session Storage**: Use Redis or similar for distributed systems
3. **Rate Limiting**: Implement rate limiting on authentication endpoints
4. **Token Rotation**: Implement automatic token rotation
5. **Multi-Factor Authentication**: Add MFA support for enhanced security
6. **Session Monitoring**: Implement real-time session monitoring
7. **Compliance Reporting**: Generate NIST compliance reports

## Testing

The implementation includes comprehensive unit tests covering:
- Valid and invalid authentication
- Session lifecycle management
- Permission enforcement
- Error scenarios
- Full authentication workflow

Run tests with:
```bash
npm test src/mcp/server.test.ts
```

## Future Enhancements

1. **OAuth2/OIDC Support**: Integration with external identity providers
2. **Session Persistence**: Database-backed session storage
3. **Session Analytics**: Track session usage patterns
4. **Geolocation Tracking**: Log session locations for security
5. **Device Fingerprinting**: Enhanced security through device tracking
6. **Session Sharing**: Allow session delegation between users
7. **Batch Operations**: Bulk session management operations