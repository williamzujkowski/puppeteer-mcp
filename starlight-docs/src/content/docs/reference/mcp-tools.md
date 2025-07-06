---
title: MCP Tools Reference
description: ## Overview
---

# MCP Tools Reference

## Overview

The Model Context Protocol (MCP) provides a standardized interface for AI agents and LLMs to
interact with the browser automation platform. This integration enables seamless orchestration of
API calls and browser operations across all supported protocols (REST, gRPC, WebSocket).

## Protocol Architecture

### Transport Support

- **stdio**: Command-line interface for local AI agents
- **HTTP/WebSocket**: Network transport for distributed AI systems
- **Authentication Bridge**: Unified auth across all MCP operations
- **Protocol Adapters**: Automatic translation to REST/gRPC/WebSocket

### Integration Points

```typescript
// MCP Server initialization
const server = new MCPServer({
  transport: 'stdio' | 'http',
  auth: { jwt: true, apiKey: true },
  protocols: ['rest', 'grpc', 'websocket'],
});
```

## Available Tools

### 1. execute-api

Execute API operations across any protocol layer.

**Parameters:**

```json
{
  "protocol": "rest" | "grpc" | "websocket",
  "method": "string",
  "endpoint": "string",
  "params": "object",
  "headers": "object"
}
```

**Example:**

```json
{
  "tool": "execute-api",
  "arguments": {
    "protocol": "rest",
    "method": "POST",
    "endpoint": "/api/v1/sessions",
    "params": {
      "name": "ai-session",
      "ttl": 3600
    }
  }
}
```

### 2. manage-session

Create, update, or delete browser automation sessions.

**Parameters:**

```json
{
  "action": "create" | "update" | "delete" | "get",
  "sessionId": "string (for update/delete/get)",
  "data": {
    "name": "string",
    "ttl": "number",
    "metadata": "object"
  }
}
```

### 3. create-browser-context

Initialize a new browser context for automation.

**Parameters:**

```json
{
  "name": "string",
  "viewport": {
    "width": "number",
    "height": "number"
  },
  "userAgent": "string",
  "locale": "string",
  "timezone": "string"
}
```

### 4. execute-browser-action

Perform browser automation actions within a context.

**Parameters:**

```json
{
  "contextId": "string",
  "action": "navigate" | "click" | "type" | "screenshot" | "evaluate" | "wait",
  "params": {
    "url": "string (for navigate)",
    "selector": "string (for click/type)",
    "text": "string (for type)",
    "script": "string (for evaluate)",
    "timeout": "number (for wait)"
  }
}
```

**Supported Actions:**

- **Navigation**: `navigate`, `goBack`, `goForward`, `reload`
- **Interaction**: `click`, `type`, `select`, `upload`, `hover`, `focus`, `blur`
- **Content**: `evaluate`, `screenshot`, `pdf`, `content`
- **Utility**: `wait`, `scroll`, `keyboard`, `mouse`, `cookies`

### 5. get-browser-info

Retrieve information about active browser contexts.

**Parameters:**

```json
{
  "contextId": "string (optional)",
  "includeMetrics": "boolean"
}
```

## Resources

### 1. api-catalog

Access the complete API catalog with schemas and examples.

**Schema:**

```json
{
  "endpoints": [
    {
      "path": "string",
      "method": "string",
      "description": "string",
      "parameters": "object",
      "response": "object"
    }
  ]
}
```

### 2. health-status

Monitor system health and resource utilization.

**Schema:**

```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "uptime": "number",
  "resources": {
    "browserPool": {
      "active": "number",
      "idle": "number",
      "queued": "number"
    },
    "memory": {
      "used": "number",
      "limit": "number"
    }
  }
}
```

### 3. browser-automation-catalog

Access available browser automation capabilities.

**Schema:**

```json
{
  "actions": [
    {
      "name": "string",
      "parameters": "object",
      "security": ["string"],
      "performance": {
        "p95": "number",
        "timeout": "number"
      }
    }
  ]
}
```

## Authentication & Session Management

### JWT Authentication

```json
{
  "tool": "execute-api",
  "arguments": {
    "protocol": "rest",
    "method": "POST",
    "endpoint": "/api/v1/auth/login",
    "params": {
      "username": "ai-agent",
      "password": "secure-password"
    }
  }
}
```

### API Key Authentication

```json
{
  "tool": "execute-api",
  "arguments": {
    "protocol": "rest",
    "method": "GET",
    "endpoint": "/api/v1/sessions",
    "headers": {
      "X-API-Key": "your-api-key"
    }
  }
}
```

### Session Lifecycle

1. **Create Session**: Establish authenticated session
2. **Create Context**: Initialize browser automation context
3. **Execute Actions**: Perform browser operations
4. **Cleanup**: Automatic resource cleanup on session end

## AI Integration Examples

### Web Scraping Workflow

```json
// Step 1: Create session
{
  "tool": "manage-session",
  "arguments": {
    "action": "create",
    "data": {
      "name": "scraping-session",
      "ttl": 3600
    }
  }
}

// Step 2: Create browser context
{
  "tool": "create-browser-context",
  "arguments": {
    "name": "scraper",
    "viewport": { "width": 1920, "height": 1080 }
  }
}

// Step 3: Navigate and extract
{
  "tool": "execute-browser-action",
  "arguments": {
    "contextId": "context-123",
    "action": "navigate",
    "params": { "url": "https://example.com" }
  }
}

// Step 4: Extract content
{
  "tool": "execute-browser-action",
  "arguments": {
    "contextId": "context-123",
    "action": "evaluate",
    "params": {
      "script": "document.querySelector('h1').textContent"
    }
  }
}
```

### Visual Testing Workflow

```json
// Capture screenshot
{
  "tool": "execute-browser-action",
  "arguments": {
    "contextId": "context-123",
    "action": "screenshot",
    "params": {
      "fullPage": true,
      "path": "baseline.png"
    }
  }
}

// Compare with baseline
{
  "tool": "execute-api",
  "arguments": {
    "protocol": "rest",
    "method": "POST",
    "endpoint": "/api/v1/visual/compare",
    "params": {
      "baseline": "baseline.png",
      "current": "current.png",
      "threshold": 0.01
    }
  }
}
```

### Performance Monitoring

```json
// Collect Core Web Vitals
{
  "tool": "execute-browser-action",
  "arguments": {
    "contextId": "context-123",
    "action": "evaluate",
    "params": {
      "script": "JSON.stringify(window.performance.timing)"
    }
  }
}
```

## Security Considerations

### Input Validation

All browser actions undergo security validation:

- XSS prevention for JavaScript execution
- URL allowlist enforcement
- Selector sanitization
- Script content analysis

### Access Control

- Session-based authorization required
- Role-based permissions for sensitive actions
- Audit logging for compliance (NIST AU-3)

### Resource Limits

- Maximum 5 concurrent browser instances
- 300-second idle timeout
- Memory usage monitoring
- Request queue management

## Error Handling

### Common Error Codes

- `SESSION_NOT_FOUND`: Invalid or expired session
- `CONTEXT_NOT_FOUND`: Browser context doesn't exist
- `ACTION_TIMEOUT`: Browser action exceeded timeout
- `SECURITY_VIOLATION`: Action blocked by security policy
- `RESOURCE_EXHAUSTED`: Browser pool at capacity

### Retry Strategy

```json
{
  "tool": "execute-browser-action",
  "arguments": {
    "contextId": "context-123",
    "action": "click",
    "params": {
      "selector": "#submit",
      "retry": {
        "attempts": 3,
        "backoff": "exponential"
      }
    }
  }
}
```

## Performance Guidelines

### Optimization Tips

1. **Reuse Contexts**: Maintain contexts across multiple actions
2. **Batch Operations**: Execute multiple actions in sequence
3. **Async Execution**: Leverage parallel execution where possible
4. **Resource Cleanup**: Explicitly close contexts when done

### Performance Metrics

- API response time: < 100ms p95
- Browser action execution: < 5s p95
- Context creation: < 1s p95
- Screenshot capture: < 2s for full page

## Best Practices

1. **Session Management**: Always create sessions with appropriate TTL
2. **Error Recovery**: Implement retry logic for transient failures
3. **Resource Efficiency**: Close browser contexts after use
4. **Security First**: Validate all user inputs before execution
5. **Monitoring**: Track performance metrics and health status

This reference provides comprehensive guidance for AI agents integrating with the browser automation
platform through MCP, enabling sophisticated browser control with enterprise-focused security and
performance.
