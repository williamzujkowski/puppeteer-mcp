# Comprehensive Functional Testing Strategy for puppeteer-mcp

## Overview

This document outlines a comprehensive functional testing strategy for the puppeteer-mcp project, covering all MCP tools, browser automation commands, resources, and cross-protocol functionality. The strategy ensures every user-facing function works reliably across all supported protocols.

## 1. MCP Tool Testing Matrix

### 1.1 create-session Tool

#### Valid Input Test Cases
```typescript
// Test Case 1: Basic session creation
{
  input: {
    username: "testuser",
    password: "testpass123"
  },
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        sessionId: /^[a-f0-9-]{36}$/,
        userId: /^[a-f0-9-]{36}$/,
        expiresAt: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        roles: ["user"]
      })
    }]
  }
}

// Test Case 2: Session with custom duration
{
  input: {
    username: "testuser",
    password: "testpass123",
    duration: 7200 // 2 hours
  },
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        sessionId: /^[a-f0-9-]{36}$/,
        expiresAt: /* timestamp 2 hours from now */
      })
    }]
  }
}
```

#### Invalid Input Test Cases
```typescript
// Test Case 1: Missing username
{
  input: { password: "testpass123" },
  expectedError: {
    code: "INVALID_REQUEST",
    message: "Username is required"
  }
}

// Test Case 2: Invalid credentials
{
  input: { username: "invalid", password: "wrong" },
  expectedError: {
    code: "AUTHENTICATION_FAILED",
    message: "Invalid credentials"
  }
}

// Test Case 3: Invalid duration
{
  input: { username: "testuser", password: "testpass123", duration: -1 },
  expectedError: {
    code: "INVALID_DURATION",
    message: "Duration must be positive"
  }
}
```

#### Edge Cases and Boundary Conditions
- Maximum duration: 86400 seconds (24 hours)
- Minimum username length: 3 characters
- Maximum username length: 50 characters
- Special characters in username/password
- Concurrent session creation limits

### 1.2 list-sessions Tool

#### Valid Input Test Cases
```typescript
// Test Case 1: List all sessions (no filter)
{
  input: {},
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        sessions: [/* array of session objects */],
        total: /* number */
      })
    }]
  }
}

// Test Case 2: List sessions for specific user
{
  input: { userId: "user-123" },
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        sessions: [/* filtered sessions */],
        total: /* count */
      })
    }]
  }
}
```

#### Invalid Input Test Cases
```typescript
// Test Case 1: Invalid userId format
{
  input: { userId: "invalid!@#" },
  expectedError: {
    code: "INVALID_USER_ID",
    message: "Invalid user ID format"
  }
}
```

### 1.3 delete-session Tool

#### Valid Input Test Cases
```typescript
// Test Case 1: Delete existing session
{
  input: { sessionId: "valid-session-id" },
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        message: "Session deleted successfully"
      })
    }]
  }
}
```

#### Invalid Input Test Cases
```typescript
// Test Case 1: Missing sessionId
{
  input: {},
  expectedError: {
    code: "INVALID_REQUEST",
    message: "Session ID is required"
  }
}

// Test Case 2: Non-existent session
{
  input: { sessionId: "non-existent-id" },
  expectedError: {
    code: "SESSION_NOT_FOUND",
    message: "Session not found"
  }
}
```

### 1.4 create-browser-context Tool

#### Valid Input Test Cases
```typescript
// Test Case 1: Basic context creation
{
  input: { sessionId: "valid-session-id" },
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        contextId: /^[a-f0-9-]{36}$/,
        sessionId: "valid-session-id",
        createdAt: /^\d{4}-\d{2}-\d{2}T/
      })
    }]
  }
}

// Test Case 2: Context with custom options
{
  input: {
    sessionId: "valid-session-id",
    options: {
      headless: false,
      viewport: { width: 1920, height: 1080 }
    }
  },
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        contextId: /^[a-f0-9-]{36}$/,
        config: {
          headless: false,
          viewport: { width: 1920, height: 1080 }
        }
      })
    }]
  }
}
```

#### Invalid Input Test Cases
```typescript
// Test Case 1: Invalid session
{
  input: { sessionId: "invalid-session" },
  expectedError: {
    code: "SESSION_NOT_FOUND",
    message: "Invalid or expired session"
  }
}

// Test Case 2: Invalid viewport dimensions
{
  input: {
    sessionId: "valid-session-id",
    options: { viewport: { width: -1, height: 1080 } }
  },
  expectedError: {
    code: "INVALID_VIEWPORT",
    message: "Invalid viewport dimensions"
  }
}
```

### 1.5 list-browser-contexts Tool

#### Valid Input Test Cases
```typescript
// Test Case 1: List contexts for session
{
  input: { sessionId: "valid-session-id" },
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        contexts: [/* array of context objects */],
        total: /* number */
      })
    }]
  }
}
```

### 1.6 close-browser-context Tool

#### Valid Input Test Cases
```typescript
// Test Case 1: Close existing context
{
  input: {
    contextId: "valid-context-id",
    sessionId: "valid-session-id"
  },
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        message: "Context closed successfully"
      })
    }]
  }
}
```

### 1.7 execute-in-context Tool

#### Valid Input Test Cases
```typescript
// Test Case 1: Navigate command
{
  input: {
    contextId: "valid-context-id",
    command: "navigate",
    parameters: { url: "https://example.com" }
  },
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        data: { currentUrl: "https://example.com" }
      })
    }]
  }
}
```

#### Invalid Input Test Cases
```typescript
// Test Case 1: Unknown command
{
  input: {
    contextId: "valid-context-id",
    command: "invalid-command"
  },
  expectedError: {
    code: "UNKNOWN_COMMAND",
    message: "Unknown command: invalid-command"
  }
}
```

### 1.8 execute-api Tool

#### Valid Input Test Cases
```typescript
// Test Case 1: REST API call
{
  input: {
    protocol: "rest",
    operation: {
      method: "GET",
      endpoint: "/v1/health"
    }
  },
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        status: "healthy",
        timestamp: /^\d{4}-\d{2}-\d{2}T/
      })
    }]
  }
}

// Test Case 2: gRPC call
{
  input: {
    protocol: "grpc",
    operation: {
      service: "HealthService",
      method: "Check",
      request: {}
    }
  },
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        status: "SERVING"
      })
    }]
  }
}

// Test Case 3: WebSocket operation
{
  input: {
    protocol: "websocket",
    operation: {
      action: "subscribe",
      topic: "session-updates"
    }
  },
  expected: {
    content: [{
      type: "text",
      text: JSON.stringify({
        subscribed: true,
        topic: "session-updates"
      })
    }]
  }
}
```

## 2. Browser Automation Command Testing

### 2.1 Navigation Commands

#### navigate Command
```typescript
// Test cases for navigate command
const navigateTests = [
  {
    name: "Basic navigation",
    command: "navigate",
    parameters: { url: "https://example.com" },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.currentUrl).toBe("https://example.com");
    }
  },
  {
    name: "Navigation with wait condition",
    command: "navigate",
    parameters: {
      url: "https://example.com",
      waitUntil: "networkidle0"
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.loadTime).toBeLessThan(30000);
    }
  },
  {
    name: "Navigation with custom headers",
    command: "navigate",
    parameters: {
      url: "https://httpbin.org/headers",
      headers: { "X-Custom-Header": "test-value" }
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.response).toContain("X-Custom-Header");
    }
  }
];
```

#### goBack/goForward Commands
```typescript
const historyTests = [
  {
    name: "Navigate back in history",
    setup: async (context) => {
      await executeCommand(context, "navigate", { url: "https://example.com" });
      await executeCommand(context, "navigate", { url: "https://example.org" });
    },
    command: "goBack",
    parameters: {},
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.currentUrl).toBe("https://example.com");
    }
  },
  {
    name: "Navigate forward in history",
    setup: async (context) => {
      await executeCommand(context, "navigate", { url: "https://example.com" });
      await executeCommand(context, "navigate", { url: "https://example.org" });
      await executeCommand(context, "goBack", {});
    },
    command: "goForward",
    parameters: {},
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.currentUrl).toBe("https://example.org");
    }
  }
];
```

#### reload Command
```typescript
const reloadTests = [
  {
    name: "Reload page",
    setup: async (context) => {
      await executeCommand(context, "navigate", { url: "https://example.com" });
    },
    command: "reload",
    parameters: {},
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.reloaded).toBe(true);
    }
  }
];
```

### 2.2 Interaction Commands

#### click Command
```typescript
const clickTests = [
  {
    name: "Basic click",
    command: "click",
    parameters: { selector: "button#submit" },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.clicked).toBe(true);
    }
  },
  {
    name: "Right click",
    command: "click",
    parameters: {
      selector: "div#context-menu-target",
      button: "right"
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.contextMenuOpened).toBe(true);
    }
  },
  {
    name: "Double click",
    command: "click",
    parameters: {
      selector: "div#double-click-target",
      clickCount: 2
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.doubleClicked).toBe(true);
    }
  },
  {
    name: "Click with offset",
    command: "click",
    parameters: {
      selector: "canvas#drawing-area",
      offsetX: 100,
      offsetY: 50
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.clickPosition).toEqual({ x: 100, y: 50 });
    }
  }
];
```

#### type Command
```typescript
const typeTests = [
  {
    name: "Type in input field",
    command: "type",
    parameters: {
      selector: "input#username",
      text: "testuser123"
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.typedText).toBe("testuser123");
    }
  },
  {
    name: "Type with delay",
    command: "type",
    parameters: {
      selector: "input#search",
      text: "slow typing",
      delay: 100
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(1000); // 11 chars * 100ms
    }
  },
  {
    name: "Clear and type",
    command: "type",
    parameters: {
      selector: "input#email",
      text: "new@email.com",
      clearFirst: true
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.fieldValue).toBe("new@email.com");
    }
  }
];
```

#### select Command
```typescript
const selectTests = [
  {
    name: "Select single option",
    command: "select",
    parameters: {
      selector: "select#country",
      values: ["US"]
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.selectedValues).toEqual(["US"]);
    }
  },
  {
    name: "Select multiple options",
    command: "select",
    parameters: {
      selector: "select#languages",
      values: ["en", "es", "fr"]
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.selectedValues).toEqual(["en", "es", "fr"]);
    }
  }
];
```

#### upload Command
```typescript
const uploadTests = [
  {
    name: "Upload single file",
    command: "upload",
    parameters: {
      selector: "input[type=file]",
      filePaths: ["/tmp/test-file.txt"]
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.uploadedFiles).toHaveLength(1);
    }
  },
  {
    name: "Upload multiple files",
    command: "upload",
    parameters: {
      selector: "input[type=file][multiple]",
      filePaths: ["/tmp/file1.txt", "/tmp/file2.txt"]
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.uploadedFiles).toHaveLength(2);
    }
  }
];
```

#### hover Command
```typescript
const hoverTests = [
  {
    name: "Hover over element",
    command: "hover",
    parameters: { selector: "div#tooltip-trigger" },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.tooltipVisible).toBe(true);
    }
  }
];
```

#### focus/blur Commands
```typescript
const focusBlurTests = [
  {
    name: "Focus on input",
    command: "focus",
    parameters: { selector: "input#search" },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.focused).toBe(true);
    }
  },
  {
    name: "Blur from input",
    command: "blur",
    parameters: { selector: "input#search" },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.blurred).toBe(true);
    }
  }
];
```

### 2.3 Content Commands

#### evaluate Command
```typescript
const evaluateTests = [
  {
    name: "Execute simple JavaScript",
    command: "evaluate",
    parameters: {
      code: "document.title"
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(typeof result.data.result).toBe("string");
    }
  },
  {
    name: "Execute function with arguments",
    command: "evaluate",
    parameters: {
      code: "(a, b) => a + b",
      args: [5, 3]
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.result).toBe(8);
    }
  },
  {
    name: "Execute async function",
    command: "evaluate",
    parameters: {
      code: "async () => { await new Promise(r => setTimeout(r, 100)); return 'done'; }"
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.result).toBe("done");
    }
  }
];
```

#### screenshot Command
```typescript
const screenshotTests = [
  {
    name: "Full page screenshot",
    command: "screenshot",
    parameters: { fullPage: true },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.screenshot).toMatch(/^data:image\/png;base64,/);
    }
  },
  {
    name: "Element screenshot",
    command: "screenshot",
    parameters: {
      selector: "div#content",
      format: "jpeg",
      quality: 80
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.screenshot).toMatch(/^data:image\/jpeg;base64,/);
    }
  }
];
```

#### pdf Command
```typescript
const pdfTests = [
  {
    name: "Generate PDF",
    command: "pdf",
    parameters: {
      format: "A4",
      printBackground: true
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.pdf).toMatch(/^data:application\/pdf;base64,/);
    }
  },
  {
    name: "PDF with custom margins",
    command: "pdf",
    parameters: {
      margin: {
        top: "1in",
        bottom: "1in",
        left: "0.5in",
        right: "0.5in"
      }
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.pageCount).toBeGreaterThan(0);
    }
  }
];
```

#### content Command
```typescript
const contentTests = [
  {
    name: "Get page content",
    command: "content",
    parameters: {},
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.html).toContain("<html");
    }
  },
  {
    name: "Get element content",
    command: "content",
    parameters: { selector: "div#main-content" },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.html).not.toContain("<html");
    }
  }
];
```

### 2.4 Utility Commands

#### wait Command
```typescript
const waitTests = [
  {
    name: "Wait for timeout",
    command: "wait",
    parameters: { duration: 1000 },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(1000);
    }
  },
  {
    name: "Wait for selector",
    command: "wait",
    parameters: {
      selector: "div#dynamic-content",
      timeout: 5000
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.elementFound).toBe(true);
    }
  },
  {
    name: "Wait for function",
    command: "wait",
    parameters: {
      function: "() => document.querySelector('#loading').style.display === 'none'",
      timeout: 10000
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.conditionMet).toBe(true);
    }
  }
];
```

#### scroll Command
```typescript
const scrollTests = [
  {
    name: "Scroll down",
    command: "scroll",
    parameters: {
      direction: "down",
      distance: 500
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.scrollPosition.y).toBeGreaterThan(0);
    }
  },
  {
    name: "Scroll to element",
    command: "scroll",
    parameters: {
      selector: "#footer",
      toElement: true
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.elementInView).toBe(true);
    }
  },
  {
    name: "Smooth scroll",
    command: "scroll",
    parameters: {
      x: 0,
      y: 1000,
      smooth: true,
      duration: 500
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(500);
    }
  }
];
```

#### keyboard Command
```typescript
const keyboardTests = [
  {
    name: "Press key",
    command: "keyboard",
    parameters: {
      key: "Enter",
      action: "press"
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.keyPressed).toBe("Enter");
    }
  },
  {
    name: "Key combination",
    command: "keyboard",
    parameters: {
      key: "a",
      action: "press",
      modifiers: ["Control"]
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.allSelected).toBe(true);
    }
  }
];
```

#### mouse Command
```typescript
const mouseTests = [
  {
    name: "Move mouse",
    command: "mouse",
    parameters: {
      action: "move",
      x: 100,
      y: 200
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.position).toEqual({ x: 100, y: 200 });
    }
  },
  {
    name: "Mouse wheel",
    command: "mouse",
    parameters: {
      action: "wheel",
      deltaY: 100
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.scrolled).toBe(true);
    }
  }
];
```

#### cookie Command
```typescript
const cookieTests = [
  {
    name: "Set cookie",
    command: "cookie",
    parameters: {
      operation: "set",
      cookies: [{
        name: "test_cookie",
        value: "test_value",
        domain: ".example.com",
        path: "/",
        httpOnly: true,
        secure: true
      }]
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.cookiesSet).toBe(1);
    }
  },
  {
    name: "Get cookies",
    command: "cookie",
    parameters: {
      operation: "get"
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.cookies)).toBe(true);
    }
  },
  {
    name: "Delete cookie",
    command: "cookie",
    parameters: {
      operation: "delete",
      names: ["test_cookie"]
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.cookiesDeleted).toBe(1);
    }
  },
  {
    name: "Clear all cookies",
    command: "cookie",
    parameters: {
      operation: "clear"
    },
    validation: async (result) => {
      expect(result.success).toBe(true);
      expect(result.data.allCookiesCleared).toBe(true);
    }
  }
];
```

## 3. Resource Testing

### 3.1 API Catalog Resource

```typescript
const apiCatalogTests = [
  {
    name: "Read API catalog",
    resource: "api://catalog",
    validation: async (result) => {
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("api://catalog");
      expect(result.contents[0].mimeType).toBe("application/json");
      
      const catalog = JSON.parse(result.contents[0].text);
      expect(catalog.rest).toBeDefined();
      expect(catalog.grpc).toBeDefined();
      expect(catalog.websocket).toBeDefined();
      
      // Validate REST endpoints
      expect(catalog.rest.endpoints).toBeInstanceOf(Array);
      expect(catalog.rest.endpoints.length).toBeGreaterThan(0);
      
      // Validate gRPC services
      expect(catalog.grpc.services).toBeInstanceOf(Array);
      expect(catalog.grpc.services).toContainEqual(
        expect.objectContaining({
          name: "SessionService",
          methods: expect.arrayContaining(["CreateSession", "GetSession"])
        })
      );
      
      // Validate WebSocket topics
      expect(catalog.websocket.topics).toBeInstanceOf(Array);
      expect(catalog.websocket.topics).toContainEqual(
        expect.objectContaining({
          name: "session-updates"
        })
      );
    }
  }
];
```

### 3.2 System Health Resource

```typescript
const healthResourceTests = [
  {
    name: "Read system health",
    resource: "api://health",
    validation: async (result) => {
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe("api://health");
      expect(result.contents[0].mimeType).toBe("application/json");
      
      const health = JSON.parse(result.contents[0].text);
      expect(health.status).toBe("healthy");
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.services).toEqual({
        rest: "operational",
        grpc: "operational",
        websocket: "operational",
        mcp: "operational"
      });
      expect(health.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  }
];
```

## 4. Cross-Protocol Functionality Testing

### 4.1 Session Management Across Protocols

```typescript
const crossProtocolSessionTests = [
  {
    name: "Create session via MCP, verify via REST",
    test: async () => {
      // Create session via MCP
      const mcpResult = await mcpClient.callTool("create-session", {
        username: "testuser",
        password: "testpass"
      });
      const sessionData = JSON.parse(mcpResult.content[0].text);
      
      // Verify via REST
      const restResult = await fetch(`/api/v1/sessions/${sessionData.sessionId}`, {
        headers: { Authorization: `Bearer ${sessionData.token}` }
      });
      expect(restResult.status).toBe(200);
      
      // Verify via gRPC
      const grpcResult = await grpcClient.GetSession({
        sessionId: sessionData.sessionId
      });
      expect(grpcResult.sessionId).toBe(sessionData.sessionId);
      
      // Verify via WebSocket
      const wsMessage = await wsClient.send({
        type: "session.get",
        sessionId: sessionData.sessionId
      });
      expect(wsMessage.data.sessionId).toBe(sessionData.sessionId);
    }
  },
  
  {
    name: "Delete session via REST, verify across all protocols",
    test: async () => {
      // Create session first
      const session = await createTestSession();
      
      // Delete via REST
      await fetch(`/api/v1/sessions/${session.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.token}` }
      });
      
      // Verify deletion via MCP
      const mcpResult = await mcpClient.callTool("list-sessions", {});
      const sessions = JSON.parse(mcpResult.content[0].text);
      expect(sessions.sessions).not.toContainEqual(
        expect.objectContaining({ id: session.id })
      );
      
      // Verify via gRPC (should throw NOT_FOUND)
      await expect(
        grpcClient.GetSession({ sessionId: session.id })
      ).rejects.toThrow("NOT_FOUND");
      
      // Verify via WebSocket
      const wsMessage = await wsClient.send({
        type: "session.get",
        sessionId: session.id
      });
      expect(wsMessage.error).toBe("SESSION_NOT_FOUND");
    }
  }
];
```

### 4.2 Browser Context Operations Across Protocols

```typescript
const crossProtocolContextTests = [
  {
    name: "Create context via gRPC, execute via MCP",
    test: async () => {
      // Create session
      const session = await createTestSession();
      
      // Create context via gRPC
      const grpcContext = await grpcClient.CreateContext({
        sessionId: session.id,
        options: { headless: true }
      });
      
      // Execute command via MCP
      const mcpResult = await mcpClient.callTool("execute-in-context", {
        contextId: grpcContext.contextId,
        command: "navigate",
        parameters: { url: "https://example.com" }
      });
      
      const result = JSON.parse(mcpResult.content[0].text);
      expect(result.success).toBe(true);
      expect(result.data.currentUrl).toBe("https://example.com");
      
      // Verify state via REST
      const restResult = await fetch(`/api/v1/contexts/${grpcContext.contextId}`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const contextData = await restResult.json();
      expect(contextData.lastAction).toBe("navigate");
    }
  }
];
```

### 4.3 Real-time Updates Across Protocols

```typescript
const realtimeUpdateTests = [
  {
    name: "WebSocket notifications for MCP actions",
    test: async () => {
      const session = await createTestSession();
      
      // Subscribe to WebSocket updates
      const updates = [];
      await wsClient.subscribe("context-updates", (update) => {
        updates.push(update);
      });
      
      // Create context via MCP
      const mcpContext = await mcpClient.callTool("create-browser-context", {
        sessionId: session.id
      });
      
      // Wait for WebSocket notification
      await waitFor(() => updates.length > 0);
      
      expect(updates[0]).toEqual({
        type: "context.created",
        contextId: JSON.parse(mcpContext.content[0].text).contextId,
        sessionId: session.id
      });
    }
  }
];
```

## 5. Test Automation Framework

### 5.1 Framework Architecture

```typescript
// tests/framework/TestRunner.ts
export class CrossProtocolTestRunner {
  private mcpClient: MCPTestClient;
  private restClient: RestTestClient;
  private grpcClient: GrpcTestClient;
  private wsClient: WebSocketTestClient;
  
  constructor(config: TestConfig) {
    this.mcpClient = new MCPTestClient(config.mcp);
    this.restClient = new RestTestClient(config.rest);
    this.grpcClient = new GrpcTestClient(config.grpc);
    this.wsClient = new WebSocketTestClient(config.websocket);
  }
  
  async runTestSuite(suite: TestSuite): Promise<TestResults> {
    const results: TestResults = {
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      duration: 0
    };
    
    const startTime = Date.now();
    
    for (const test of suite.tests) {
      try {
        await this.setup(test);
        await test.execute(this.getClients());
        await test.validate();
        results.passed++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          test: test.name,
          error: error.message,
          stack: error.stack
        });
      } finally {
        await this.cleanup(test);
      }
    }
    
    results.duration = Date.now() - startTime;
    return results;
  }
}
```

### 5.2 Test Client Implementations

```typescript
// tests/framework/clients/MCPTestClient.ts
export class MCPTestClient {
  private server: MCPServer;
  private transport: StdioClientTransport;
  
  async callTool(name: string, args: any): Promise<ToolResponse> {
    const response = await this.transport.request({
      method: "tools/call",
      params: { name, arguments: args }
    });
    return response.result;
  }
  
  async readResource(uri: string): Promise<ResourceResponse> {
    const response = await this.transport.request({
      method: "resources/read",
      params: { uri }
    });
    return response.result;
  }
}

// tests/framework/clients/RestTestClient.ts
export class RestTestClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  
  async request(options: RequestOptions): Promise<Response> {
    const url = `${this.baseUrl}${options.path}`;
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: { ...this.defaultHeaders, ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    
    if (!response.ok && !options.expectError) {
      throw new Error(`REST request failed: ${response.status} ${response.statusText}`);
    }
    
    return response;
  }
}
```

### 5.3 Test Data Generators

```typescript
// tests/framework/generators/TestDataGenerator.ts
export class TestDataGenerator {
  static generateUser(): TestUser {
    return {
      username: `testuser_${Date.now()}`,
      password: "TestPass123!",
      email: `test_${Date.now()}@example.com`,
      roles: ["user"]
    };
  }
  
  static generateBrowserContext(): ContextConfig {
    return {
      headless: true,
      viewport: {
        width: 1920,
        height: 1080
      },
      userAgent: "TestRunner/1.0"
    };
  }
  
  static generateTestFile(size: number = 1024): Buffer {
    return Buffer.alloc(size, "test content");
  }
}
```

### 5.4 Validation Utilities

```typescript
// tests/framework/validators/ResponseValidator.ts
export class ResponseValidator {
  static validateMCPToolResponse(response: ToolResponse, schema: any) {
    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.content[0].type).toBe("text");
    
    const data = JSON.parse(response.content[0].text);
    validateSchema(data, schema);
  }
  
  static validateRESTResponse(response: Response, expectedStatus: number, schema?: any) {
    expect(response.status).toBe(expectedStatus);
    
    if (schema && response.status === 200) {
      const data = await response.json();
      validateSchema(data, schema);
    }
  }
  
  static validateGRPCResponse(response: any, expectedFields: string[]) {
    for (const field of expectedFields) {
      expect(response).toHaveProperty(field);
    }
  }
}
```

### 5.5 Test Report Generator

```typescript
// tests/framework/reporters/TestReporter.ts
export class TestReporter {
  generateReport(results: TestResults[]): TestReport {
    const report: TestReport = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      suites: [],
      failures: [],
      timestamp: new Date().toISOString()
    };
    
    for (const suite of results) {
      report.summary.total += suite.passed + suite.failed + suite.skipped;
      report.summary.passed += suite.passed;
      report.summary.failed += suite.failed;
      report.summary.skipped += suite.skipped;
      report.summary.duration += suite.duration;
      
      if (suite.errors.length > 0) {
        report.failures.push(...suite.errors);
      }
    }
    
    return report;
  }
  
  async saveReport(report: TestReport, format: "json" | "html" | "junit") {
    switch (format) {
      case "json":
        await fs.writeFile("test-report.json", JSON.stringify(report, null, 2));
        break;
      case "html":
        await this.generateHTMLReport(report);
        break;
      case "junit":
        await this.generateJUnitReport(report);
        break;
    }
  }
}
```

### 5.6 Continuous Integration Configuration

```yaml
# .github/workflows/functional-tests.yml
name: Functional Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 */6 * * *' # Run every 6 hours

jobs:
  functional-tests:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        test-suite:
          - mcp-tools
          - browser-commands
          - cross-protocol
          - resources
          - performance
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build project
        run: npm run build
        
      - name: Start services
        run: |
          npm run start:all &
          sleep 10 # Wait for services to start
          
      - name: Run functional tests
        run: npm run test:functional -- --suite=${{ matrix.test-suite }}
        
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results-${{ matrix.test-suite }}
          path: |
            test-report.json
            test-report.html
            screenshots/
            
      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const report = require('./test-report.json');
            const comment = `## Functional Test Results - ${{ matrix.test-suite }}
            
            ✅ Passed: ${report.summary.passed}
            ❌ Failed: ${report.summary.failed}
            ⏭️ Skipped: ${report.summary.skipped}
            ⏱️ Duration: ${report.summary.duration}ms
            
            ${report.failures.length > 0 ? '### Failures\n' + report.failures.map(f => `- ${f.test}: ${f.error}`).join('\n') : ''}`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### 5.7 Performance Testing Integration

```typescript
// tests/performance/PerformanceTests.ts
export class PerformanceTestSuite {
  async runPerformanceTests(): Promise<PerformanceResults> {
    const results: PerformanceResults = {
      scenarios: []
    };
    
    // Test MCP tool response times
    const mcpPerf = await this.testMCPPerformance();
    results.scenarios.push(mcpPerf);
    
    // Test browser automation performance
    const browserPerf = await this.testBrowserPerformance();
    results.scenarios.push(browserPerf);
    
    // Test cross-protocol latency
    const crossProtocolPerf = await this.testCrossProtocolLatency();
    results.scenarios.push(crossProtocolPerf);
    
    return results;
  }
  
  private async testMCPPerformance(): Promise<PerformanceScenario> {
    const scenario: PerformanceScenario = {
      name: "MCP Tool Performance",
      metrics: []
    };
    
    // Test session creation throughput
    const sessionMetric = await this.measureThroughput(
      () => mcpClient.callTool("create-session", { username: "test", password: "test" }),
      { duration: 60000, concurrency: 10 }
    );
    scenario.metrics.push(sessionMetric);
    
    // Test execute-in-context latency
    const executeMetric = await this.measureLatency(
      () => mcpClient.callTool("execute-in-context", {
        contextId: testContext.id,
        command: "evaluate",
        parameters: { code: "1 + 1" }
      }),
      { iterations: 1000 }
    );
    scenario.metrics.push(executeMetric);
    
    return scenario;
  }
}
```

## 6. Test Execution Strategy

### 6.1 Test Prioritization

1. **Critical Path Tests** (P0)
   - Session creation and authentication
   - Basic browser navigation
   - Command execution
   - Resource availability

2. **Core Functionality Tests** (P1)
   - All MCP tools
   - Primary browser commands
   - Cross-protocol consistency
   - Error handling

3. **Extended Functionality Tests** (P2)
   - Advanced browser interactions
   - Performance scenarios
   - Edge cases
   - Concurrent operations

### 6.2 Test Environment Requirements

```typescript
// tests/config/environments.ts
export const testEnvironments = {
  local: {
    mcp: { transport: "stdio" },
    rest: { baseUrl: "http://localhost:3000/api/v1" },
    grpc: { host: "localhost", port: 50051 },
    websocket: { url: "ws://localhost:3000/ws" }
  },
  staging: {
    mcp: { transport: "stdio" },
    rest: { baseUrl: "https://staging.example.com/api/v1" },
    grpc: { host: "staging.example.com", port: 50051 },
    websocket: { url: "wss://staging.example.com/ws" }
  },
  production: {
    // Production testing with limited scope
    mcp: { transport: "stdio" },
    rest: { baseUrl: "https://api.example.com/v1" },
    grpc: { host: "api.example.com", port: 50051 },
    websocket: { url: "wss://api.example.com/ws" }
  }
};
```

### 6.3 Test Data Management

```typescript
// tests/fixtures/TestDataManager.ts
export class TestDataManager {
  private static testUsers: Map<string, TestUser> = new Map();
  private static testSessions: Map<string, TestSession> = new Map();
  private static testContexts: Map<string, TestContext> = new Map();
  
  static async setupTestData(): Promise<void> {
    // Create test users
    for (let i = 0; i < 10; i++) {
      const user = await this.createTestUser(`testuser${i}`);
      this.testUsers.set(user.id, user);
    }
    
    // Create test sessions
    for (const user of this.testUsers.values()) {
      const session = await this.createTestSession(user);
      this.testSessions.set(session.id, session);
    }
  }
  
  static async cleanupTestData(): Promise<void> {
    // Clean up in reverse order
    for (const context of this.testContexts.values()) {
      await this.deleteTestContext(context);
    }
    
    for (const session of this.testSessions.values()) {
      await this.deleteTestSession(session);
    }
    
    for (const user of this.testUsers.values()) {
      await this.deleteTestUser(user);
    }
  }
}
```

## 7. Success Criteria

### 7.1 Functional Coverage
- 100% of MCP tools tested with valid/invalid inputs
- 100% of browser automation commands tested
- All resources validated for structure and content
- Cross-protocol operations verified for consistency

### 7.2 Performance Targets
- MCP tool response time < 100ms (excluding browser operations)
- Browser command execution < 5s for standard operations
- Resource retrieval < 50ms
- Cross-protocol consistency verification < 200ms

### 7.3 Reliability Metrics
- Test suite success rate > 99%
- No flaky tests (< 0.1% intermittent failures)
- All error scenarios properly handled
- Graceful degradation under load

### 7.4 Automation Goals
- 100% automated test execution
- Parallel test execution support
- Automatic retry for transient failures
- Comprehensive test reporting

## Conclusion

This comprehensive functional testing strategy ensures that every user-facing function in the puppeteer-mcp project works reliably across all supported protocols. The strategy covers:

1. Complete MCP tool validation with extensive test cases
2. Thorough browser automation command testing
3. Resource validation and availability checks
4. Cross-protocol functionality verification
5. Automated testing framework with CI/CD integration

The implementation of this strategy will provide confidence in the system's functionality, performance, and reliability, ensuring a high-quality experience for all users of the puppeteer-mcp platform.