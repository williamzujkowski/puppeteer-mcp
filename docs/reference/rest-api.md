# REST API Reference

## Overview

The Puppeteer MCP platform provides a comprehensive REST API for browser automation, session
management, and context control. All endpoints follow RESTful conventions and return JSON responses.

## Base URL

```
https://api.example.com/api/v1
```

- **Protocol**: HTTPS required in production
- **Version**: `v1` (current stable version)
- **Content-Type**: `application/json`

## Authentication

The API supports two authentication methods:

### JWT Bearer Token

Include the JWT access token in the Authorization header:

```http
Authorization: Bearer <access_token>
```

### API Key

Include the API key in the X-API-Key header:

```http
X-API-Key: <api_key>
```

## Common Response Format

All successful responses follow this structure:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

## Endpoints

### Health Check

#### GET /health

Basic health check endpoint. No authentication required.

**Response**

```json
{
  "status": "ok",
  "timestamp": "2025-01-03T12:00:00.000Z",
  "uptime": 1234.567,
  "environment": "production",
  "version": "1.0.0"
}
```

#### GET /health/live

Kubernetes liveness probe endpoint.

**Response**

```json
{
  "status": "alive"
}
```

#### GET /health/ready

Kubernetes readiness probe endpoint.

**Response**

```json
{
  "status": "ready",
  "checks": {
    "server": true
  }
}
```

### Session Management

#### POST /v1/sessions/refresh

Refresh an access token using a refresh token.

**Request Body**

```json
{
  "refreshToken": "string",
  "accessToken": "string (optional)"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "new_refresh_token",
    "expiresIn": 3600
  }
}
```

#### POST /v1/sessions/revoke

Revoke a refresh token (logout).

**Request Body**

```json
{
  "refreshToken": "string"
}
```

**Response**

```json
{
  "success": true,
  "message": "Token revoked successfully"
}
```

#### GET /v1/sessions/current

Get current session information. Requires authentication.

**Response**

```json
{
  "success": true,
  "data": {
    "id": "session_123",
    "userId": "user_456",
    "username": "john.doe",
    "roles": ["user"],
    "createdAt": "2025-01-03T10:00:00.000Z",
    "expiresAt": "2025-01-03T14:00:00.000Z",
    "lastAccessedAt": "2025-01-03T12:00:00.000Z"
  }
}
```

#### GET /v1/sessions/my-sessions

Get all sessions for the current user. Requires authentication.

**Response**

```json
{
  "success": true,
  "data": [
    {
      "id": "session_123",
      "createdAt": "2025-01-03T10:00:00.000Z",
      "expiresAt": "2025-01-03T14:00:00.000Z",
      "lastAccessedAt": "2025-01-03T12:00:00.000Z",
      "isCurrent": true
    }
  ]
}
```

#### DELETE /v1/sessions/:sessionId

Terminate a specific session. Requires authentication.

**Parameters**

- `sessionId` (string): Session ID to terminate

**Response**

```json
{
  "success": true,
  "message": "Session terminated successfully"
}
```

#### DELETE /v1/sessions/all

Terminate all sessions for the current user except the current one. Requires authentication.

**Response**

```json
{
  "success": true,
  "message": "Terminated 3 sessions",
  "data": {
    "deletedCount": 3
  }
}
```

### Browser Context Management

#### POST /v1/contexts

Create a new browser context. Requires authentication.

**Request Body**

```json
{
  "name": "string",
  "viewport": {
    "width": 1920,
    "height": 1080
  },
  "userAgent": "string (optional)",
  "locale": "en-US (optional)",
  "timezone": "America/New_York (optional)",
  "geolocation": {
    "latitude": 0,
    "longitude": 0,
    "accuracy": 100
  },
  "permissions": ["geolocation", "notifications"],
  "extraHTTPHeaders": {
    "X-Custom-Header": "value"
  },
  "offline": false,
  "httpCredentials": {
    "username": "string",
    "password": "string"
  },
  "colorScheme": "light",
  "reducedMotion": "no-preference",
  "javaScriptEnabled": true,
  "bypassCSP": false,
  "ignoreHTTPSErrors": false,
  "createPage": true
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "context_789",
    "userId": "user_456",
    "name": "Test Browser",
    "config": { ... },
    "createdAt": "2025-01-03T12:00:00.000Z",
    "lastUsedAt": "2025-01-03T12:00:00.000Z",
    "page": {
      "id": "page_101",
      "url": "about:blank",
      "title": "",
      "createdAt": "2025-01-03T12:00:00.000Z"
    }
  }
}
```

#### GET /v1/contexts

List all contexts for the current user. Requires authentication.

**Response**

```json
{
  "success": true,
  "data": [
    {
      "id": "context_789",
      "name": "Test Browser",
      "createdAt": "2025-01-03T12:00:00.000Z",
      "lastUsedAt": "2025-01-03T12:00:00.000Z"
    }
  ]
}
```

#### GET /v1/contexts/:contextId

Get a specific context. Requires authentication.

**Parameters**

- `contextId` (string): Context ID

**Response**

```json
{
  "success": true,
  "data": {
    "id": "context_789",
    "userId": "user_456",
    "name": "Test Browser",
    "config": { ... },
    "createdAt": "2025-01-03T12:00:00.000Z",
    "lastUsedAt": "2025-01-03T12:00:00.000Z",
    "pages": [
      {
        "id": "page_101",
        "url": "https://example.com",
        "title": "Example Domain"
      }
    ]
  }
}
```

#### PATCH /v1/contexts/:contextId

Update a context configuration. Requires authentication.

**Parameters**

- `contextId` (string): Context ID

**Request Body** (partial update)

```json
{
  "name": "Updated Browser Name",
  "viewport": {
    "width": 1366,
    "height": 768
  }
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "context_789",
    "name": "Updated Browser Name",
    "config": { ... }
  }
}
```

#### DELETE /v1/contexts/:contextId

Delete a context and close all associated pages. Requires authentication.

**Parameters**

- `contextId` (string): Context ID

**Response**

```json
{
  "success": true,
  "message": "Context deleted successfully"
}
```

### Browser Actions

#### POST /v1/contexts/:contextId/execute

Execute a browser action in a context. Requires authentication.

**Parameters**

- `contextId` (string): Context ID

**Request Body**

The request body varies based on the action type. Common structure:

```json
{
  "type": "action_type",
  "pageId": "page_101",
  "timeout": 30000,
  ...action_specific_params
}
```

**Action Types**

1. **navigate** - Navigate to a URL

```json
{
  "type": "navigate",
  "pageId": "page_101",
  "url": "https://example.com",
  "waitUntil": "networkidle0"
}
```

2. **click** - Click an element

```json
{
  "type": "click",
  "pageId": "page_101",
  "selector": "#submit-button",
  "clickCount": 1,
  "button": "left"
}
```

3. **type** - Type text into an input

```json
{
  "type": "type",
  "pageId": "page_101",
  "selector": "input[name='username']",
  "text": "john.doe",
  "delay": 100,
  "clearFirst": true
}
```

4. **screenshot** - Take a screenshot

```json
{
  "type": "screenshot",
  "pageId": "page_101",
  "fullPage": true,
  "format": "png",
  "quality": 90
}
```

5. **evaluate** - Execute JavaScript

```json
{
  "type": "evaluate",
  "pageId": "page_101",
  "function": "() => document.title",
  "args": []
}
```

6. **wait** - Wait for conditions

```json
{
  "type": "wait",
  "pageId": "page_101",
  "waitType": "selector",
  "selector": ".loaded",
  "duration": 5000
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "success": true,
    "actionType": "navigate",
    "data": { ... },
    "duration": 1234,
    "timestamp": "2025-01-03T12:00:00.000Z",
    "contextId": "context_789",
    "executedAt": "2025-01-03T12:00:00.000Z"
  }
}
```

#### GET /v1/contexts/:contextId/metrics

Get execution metrics for a context. Requires authentication.

**Parameters**

- `contextId` (string): Context ID

**Response**

```json
{
  "success": true,
  "data": {
    "contextId": "context_789",
    "totalActions": 42,
    "successfulActions": 40,
    "failedActions": 2,
    "averageDuration": 523.5,
    "actionTypeBreakdown": {
      "navigate": 10,
      "click": 15,
      "type": 8,
      "screenshot": 5,
      "evaluate": 4
    }
  }
}
```

### Page Management

#### GET /v1/contexts/:contextId/pages

List all pages in a context. Requires authentication.

**Parameters**

- `contextId` (string): Context ID

**Response**

```json
{
  "success": true,
  "data": [
    {
      "id": "page_101",
      "contextId": "context_789",
      "url": "https://example.com",
      "title": "Example Domain",
      "viewport": {
        "width": 1920,
        "height": 1080
      },
      "createdAt": "2025-01-03T12:00:00.000Z",
      "lastNavigatedAt": "2025-01-03T12:05:00.000Z"
    }
  ]
}
```

#### POST /v1/contexts/:contextId/pages

Create a new page in a context. Requires authentication.

**Parameters**

- `contextId` (string): Context ID

**Request Body**

```json
{
  "url": "https://example.com (optional)",
  "viewport": {
    "width": 1920,
    "height": 1080
  }
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "page_102",
    "contextId": "context_789",
    "url": "about:blank",
    "title": "",
    "createdAt": "2025-01-03T12:10:00.000Z"
  }
}
```

### API Key Management

#### POST /v1/api-keys

Create a new API key. Requires authentication.

**Request Body**

```json
{
  "name": "Production API Key",
  "roles": ["user"],
  "scopes": ["contexts:read", "contexts:write"],
  "expiresIn": 2592000000,
  "metadata": {
    "environment": "production"
  }
}
```

**Response**

```json
{
  "apiKey": {
    "id": "key_abc123",
    "name": "Production API Key",
    "prefix": "pk_live_",
    "roles": ["user"],
    "scopes": ["contexts:read", "contexts:write"],
    "createdAt": "2025-01-03T12:00:00.000Z",
    "expiresAt": "2025-02-02T12:00:00.000Z"
  },
  "plainTextKey": "pk_live_abcdef123456789",
  "warning": "Save this key securely. It will not be shown again."
}
```

#### GET /v1/api-keys

List all API keys for the current user. Requires authentication.

**Query Parameters**

- `active` (string): Filter by active status ("true" or "false")

**Response**

```json
{
  "apiKeys": [
    {
      "id": "key_abc123",
      "name": "Production API Key",
      "prefix": "pk_live_",
      "roles": ["user"],
      "scopes": ["contexts:read", "contexts:write"],
      "active": true,
      "createdAt": "2025-01-03T12:00:00.000Z",
      "lastUsedAt": "2025-01-03T13:00:00.000Z",
      "expiresAt": "2025-02-02T12:00:00.000Z"
    }
  ]
}
```

#### GET /v1/api-keys/:id

Get details of a specific API key. Requires authentication.

**Parameters**

- `id` (string): API key ID

**Response**

```json
{
  "apiKey": {
    "id": "key_abc123",
    "name": "Production API Key",
    "prefix": "pk_live_",
    "roles": ["user"],
    "scopes": ["contexts:read", "contexts:write"],
    "active": true,
    "createdAt": "2025-01-03T12:00:00.000Z",
    "lastUsedAt": "2025-01-03T13:00:00.000Z",
    "expiresAt": "2025-02-02T12:00:00.000Z",
    "metadata": {
      "environment": "production"
    }
  }
}
```

#### DELETE /v1/api-keys/:id

Revoke an API key. Requires authentication.

**Parameters**

- `id` (string): API key ID

**Response**

```json
{
  "message": "API key revoked successfully",
  "apiKey": {
    "id": "key_abc123",
    "name": "Production API Key",
    "revokedAt": "2025-01-03T14:00:00.000Z"
  }
}
```

## Error Codes

| Code                  | HTTP Status | Description                       |
| --------------------- | ----------- | --------------------------------- |
| `UNAUTHORIZED`        | 401         | Missing or invalid authentication |
| `FORBIDDEN`           | 403         | Insufficient permissions          |
| `NOT_FOUND`           | 404         | Resource not found                |
| `VALIDATION_ERROR`    | 400         | Invalid request parameters        |
| `RATE_LIMIT_EXCEEDED` | 429         | Too many requests                 |
| `INTERNAL_ERROR`      | 500         | Server error                      |
| `SERVICE_UNAVAILABLE` | 503         | Browser pool unavailable          |

## Rate Limiting

Default rate limits:

- **General endpoints**: 100 requests per 15 minutes
- **Browser actions**: 30 requests per minute
- **API key creation**: 10 requests per hour

Rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704283200
```

## Pagination

List endpoints support pagination through query parameters:

- `limit` (number): Number of items per page (default: 20, max: 100)
- `offset` (number): Number of items to skip (default: 0)
- `sort` (string): Sort field (e.g., "createdAt", "-name" for descending)

Example:

```
GET /v1/contexts?limit=10&offset=20&sort=-createdAt
```

## Filtering

List endpoints support filtering through query parameters:

- `filter[field]`: Filter by field value
- `filter[field][$gt]`: Greater than
- `filter[field][$lt]`: Less than
- `filter[field][$in]`: In array of values

Example:

```
GET /v1/contexts?filter[name]=Production&filter[createdAt][$gt]=2025-01-01
```

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

```
GET /api/v1/openapi.json
```

Interactive documentation (Swagger UI) is available at:

```
GET /api/v1/docs
```

## Complete Workflow Examples

### Browser Automation Workflow

```bash
# 1. Create a context
curl -X POST https://api.example.com/api/v1/contexts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E2E Test Browser",
    "viewport": {"width": 1920, "height": 1080}
  }'

# 2. Navigate to a URL
curl -X POST https://api.example.com/api/v1/contexts/context_789/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "navigate",
    "pageId": "page_101",
    "url": "https://example.com"
  }'

# 3. Take a screenshot
curl -X POST https://api.example.com/api/v1/contexts/context_789/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "screenshot",
    "pageId": "page_101",
    "fullPage": true
  }'

# 4. Clean up
curl -X DELETE https://api.example.com/api/v1/contexts/context_789 \
  -H "Authorization: Bearer $TOKEN"
```

### API Key Authentication Flow

```bash
# 1. Create an API key (using JWT auth)
curl -X POST https://api.example.com/api/v1/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Pipeline",
    "roles": ["automation"],
    "expiresIn": 7776000000
  }'

# 2. Use the API key
curl -X GET https://api.example.com/api/v1/contexts \
  -H "X-API-Key: pk_live_abcdef123456789"
```

## Security Considerations

1. **TLS Required**: All production API calls must use HTTPS
2. **Token Rotation**: Access tokens expire after 1 hour
3. **API Key Storage**: Store API keys securely, they cannot be retrieved after creation
4. **IP Allowlisting**: Configure IP restrictions for API keys in production
5. **Audit Logging**: All API actions are logged for security compliance

## SDK Support

Official SDKs are available for:

- Node.js/TypeScript
- Python
- Go
- Java

See individual SDK documentation for language-specific examples and best practices.
