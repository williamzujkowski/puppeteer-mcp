# MCP Integration Usage Examples

This document demonstrates how LLMs will interact with your multi-protocol API platform through the
MCP integration.

## Example 1: Simple API Query

### LLM Prompt

"Get all active sessions for user 'john.doe@example.com'"

### MCP Tool Call

```json
{
  "tool": "execute-api",
  "arguments": {
    "protocol": "rest",
    "operation": {
      "method": "GET",
      "endpoint": "/api/v1/sessions",
      "params": {
        "userId": "john.doe@example.com"
      }
    },
    "auth": {
      "type": "apikey",
      "credentials": "sk-..."
    }
  }
}
```

### Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "[{\"id\":\"session-123\",\"userId\":\"john.doe@example.com\",\"createdAt\":\"2024-01-01T10:00:00Z\",\"status\":\"active\"}]"
    }
  ]
}
```

## Example 2: Complex Workflow - Web Scraping

### LLM Prompt

"I need to scrape product prices from https://example-shop.com/products. Create a browser session,
navigate to the page, and extract all prices."

### Step 1: Create Session

```json
{
  "tool": "create-session",
  "arguments": {
    "username": "scraper-bot",
    "password": "secure-password"
  }
}
```

### Step 2: Create Browser Context

```json
{
  "tool": "create-browser-context",
  "arguments": {
    "sessionId": "session-456",
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

### Step 3: Navigate to Page

```json
{
  "tool": "execute-in-context",
  "arguments": {
    "contextId": "context-789",
    "command": "navigate",
    "parameters": {
      "url": "https://example-shop.com/products",
      "waitUntil": "networkidle2"
    }
  }
}
```

### Step 4: Extract Prices

```json
{
  "tool": "execute-in-context",
  "arguments": {
    "contextId": "context-789",
    "command": "evaluate",
    "parameters": {
      "script": "Array.from(document.querySelectorAll('.price')).map(el => el.textContent)"
    }
  }
}
```

## Example 3: Real-time Monitoring

### LLM Prompt

"Monitor all context updates for the next 5 minutes and alert me if any context fails"

### MCP Tool Calls

#### Subscribe to Updates

```json
{
  "tool": "execute-api",
  "arguments": {
    "protocol": "websocket",
    "operation": {
      "action": "subscribe",
      "topic": "context-updates",
      "filter": {
        "status": "failed"
      },
      "duration": 300000
    },
    "auth": {
      "type": "jwt",
      "credentials": "eyJ..."
    }
  }
}
```

#### Process Updates (LLM handles streaming responses)

```javascript
// LLM receives real-time updates:
{
  "type": "context-update",
  "contextId": "context-abc",
  "status": "failed",
  "error": "Navigation timeout",
  "timestamp": "2024-01-01T10:05:23Z"
}
```

## Example 4: Multi-Protocol Orchestration

### LLM Prompt

"Create a workflow that: 1) Creates a user session via REST, 2) Starts a browser context via
gRPC, 3) Monitors the context via WebSocket"

### LLM Orchestration

```python
# LLM generates this workflow:

# Step 1: REST API - Create Session
session = await mcp.call_tool("execute-api", {
  "protocol": "rest",
  "operation": {
    "method": "POST",
    "endpoint": "/api/v1/sessions",
    "body": {
      "username": "workflow-user",
      "metadata": {"purpose": "automated-testing"}
    }
  }
})

# Step 2: gRPC - Create Context
context = await mcp.call_tool("execute-api", {
  "protocol": "grpc",
  "operation": {
    "service": "ContextService",
    "method": "CreateContext",
    "request": {
      "sessionId": session.id,
      "type": "puppeteer",
      "config": {"headless": true}
    }
  }
})

# Step 3: WebSocket - Monitor
subscription = await mcp.call_tool("execute-api", {
  "protocol": "websocket",
  "operation": {
    "action": "subscribe",
    "topic": "context-updates",
    "filter": {"contextId": context.id}
  }
})
```

## Example 5: API Discovery and Learning

### LLM Prompt

"What APIs are available for session management?"

### MCP Resource Query

```json
{
  "resource": "api://catalog"
}
```

### LLM Processes Catalog

```json
{
  "rest": {
    "endpoints": [
      {
        "path": "/sessions",
        "methods": ["GET", "POST", "DELETE"],
        "description": "Session management"
      }
    ]
  },
  "grpc": {
    "services": [
      {
        "name": "SessionService",
        "methods": ["CreateSession", "GetSession", "DeleteSession", "ListSessions"]
      }
    ]
  }
}
```

### LLM Follow-up

"Show me the schema for creating a session via gRPC"

```json
{
  "resource": "api://schemas/SessionService/CreateSession"
}
```

## Example 6: Error Handling and Recovery

### Scenario: LLM encounters an error

```json
{
  "tool": "execute-in-context",
  "arguments": {
    "contextId": "expired-context",
    "command": "navigate",
    "parameters": { "url": "https://example.com" }
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "CONTEXT_NOT_FOUND",
    "message": "Context expired-context not found or has expired"
  }
}
```

### LLM Recovery Strategy

1. Check if session is still valid
2. Create new context if needed
3. Retry the operation

```json
{
  "tool": "create-browser-context",
  "arguments": {
    "sessionId": "session-456",
    "options": { "headless": true }
  }
}
```

## Example 7: Batch Operations

### LLM Prompt

"Check the status of 10 different URLs and return which ones are accessible"

### LLM Generates Parallel Execution

```javascript
const urls = [
  'https://site1.com',
  'https://site2.com',
  // ... 8 more URLs
];

const contexts = await Promise.all(
  urls.map(async (url, index) => {
    const ctx = await mcp.call_tool('create-browser-context', {
      sessionId: sessionId,
      options: { name: `checker-${index}` },
    });
    return ctx.contextId;
  }),
);

const results = await Promise.all(
  contexts.map(async (contextId, index) => {
    try {
      const response = await mcp.call_tool('execute-in-context', {
        contextId: contextId,
        command: 'navigate',
        parameters: {
          url: urls[index],
          timeout: 5000,
        },
      });
      return { url: urls[index], status: 'accessible' };
    } catch (error) {
      return { url: urls[index], status: 'failed', error: error.message };
    }
  }),
);
```

## Security Examples

### Example 8: Permission-based Access

#### Scenario 1: Limited Permissions

```json
{
  "tool": "execute-api",
  "arguments": {
    "protocol": "rest",
    "operation": {
      "method": "DELETE",
      "endpoint": "/api/v1/sessions/all"
    },
    "auth": {
      "type": "apikey",
      "credentials": "sk-readonly-key"
    }
  }
}
```

**Response:**

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "API key lacks 'session:delete' permission"
  }
}
```

#### Scenario 2: Scoped Access

```json
{
  "tool": "list-sessions",
  "arguments": {
    "userId": "other-user@example.com"
  },
  "auth": {
    "type": "jwt",
    "credentials": "user-specific-token"
  }
}
```

**Response:**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Cannot list sessions for other users"
  }
}
```

## Advanced Use Cases

### Example 9: AI-Powered Testing

The LLM generates comprehensive API tests:

```javascript
// LLM generates test scenarios
const testScenarios = [
  {
    name: 'Valid session creation',
    tool: 'create-session',
    input: { username: 'test-user', password: 'valid-pass' },
    expectedStatus: 'success',
  },
  {
    name: 'Invalid credentials',
    tool: 'create-session',
    input: { username: 'test-user', password: 'wrong-pass' },
    expectedError: 'INVALID_CREDENTIALS',
  },
  {
    name: 'Session expiration',
    tool: 'execute-api',
    input: {
      protocol: 'rest',
      operation: { method: 'GET', endpoint: '/api/v1/protected' },
      auth: { type: 'session', credentials: 'expired-session-id' },
    },
    expectedError: 'SESSION_EXPIRED',
  },
];

// Execute all tests
for (const scenario of testScenarios) {
  const result = await mcp.call_tool(scenario.tool, scenario.input);
  // LLM validates results against expectations
}
```

### Example 10: Natural Language API Interface

**User**: "I want to see all failed browser contexts from the last hour"

**LLM Translation**:

```json
{
  "tool": "execute-api",
  "arguments": {
    "protocol": "rest",
    "operation": {
      "method": "GET",
      "endpoint": "/api/v1/contexts",
      "params": {
        "status": "failed",
        "since": "2024-01-01T09:00:00Z"
      }
    }
  }
}
```

**LLM Response to User**: "I found 3 failed browser contexts in the last hour:

1. Context 'price-scraper' failed at 09:15 - Navigation timeout
2. Context 'form-filler' failed at 09:32 - Page crash
3. Context 'screenshot-bot' failed at 09:45 - Memory limit exceeded"

## Benefits Summary

1. **Unified Interface**: LLMs interact with all protocols through one consistent interface
2. **Intelligent Orchestration**: LLMs can combine multiple protocols for complex workflows
3. **Self-Discovery**: LLMs can explore and learn about available APIs
4. **Error Recovery**: LLMs can implement sophisticated error handling strategies
5. **Natural Language**: Users interact with APIs using plain language
6. **Security Maintained**: All existing security measures remain in effect
7. **Monitoring & Debugging**: Full audit trail of LLM interactions

This MCP integration transforms your platform into an AI-native API gateway that can be seamlessly
integrated into any LLM-powered application.
