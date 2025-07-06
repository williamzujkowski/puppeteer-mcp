# Puppeteer Actions Reference

## Overview

The Puppeteer Actions system provides a comprehensive set of browser automation capabilities through
a unified, type-safe interface. All actions are executed within authenticated browser contexts with
enterprise-focused security controls.

### Architecture

```typescript
interface BrowserAction {
  action: ActionType;
  params: ActionParams;
  timeout?: number;
}
```

Actions are processed through:

1. **Security Validation**: Input sanitization and XSS prevention
2. **Authorization**: Session-based access control
3. **Execution**: Action-specific handlers with error recovery
4. **Monitoring**: Performance timing and audit logging

## Action Types

### Navigation Actions

#### navigate

Navigate to a specified URL with optional wait conditions.

```typescript
{
  action: "navigate",
  params: {
    url: "https://example.com",
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2",
    timeout?: 30000
  }
}
```

#### goBack / goForward

Navigate browser history.

```typescript
{
  action: "goBack" | "goForward",
  params: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2",
    timeout?: 30000
  }
}
```

#### reload

Reload the current page.

```typescript
{
  action: "reload",
  params: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2",
    timeout?: 30000
  }
}
```

### Interaction Actions

#### click

Click an element using CSS selector or coordinates.

```typescript
{
  action: "click",
  params: {
    selector?: string,
    x?: number,
    y?: number,
    button?: "left" | "right" | "middle",
    clickCount?: number,
    delay?: number
  }
}
```

#### type

Type text into an input field.

```typescript
{
  action: "type",
  params: {
    selector: string,
    text: string,
    delay?: number,  // Delay between keystrokes
    clear?: boolean  // Clear field before typing
  }
}
```

#### select

Select option(s) from a dropdown.

```typescript
{
  action: "select",
  params: {
    selector: string,
    values: string[]  // Option values to select
  }
}
```

#### upload

Upload files to a file input.

```typescript
{
  action: "upload",
  params: {
    selector: string,
    files: string[]  // File paths to upload
  }
}
```

#### hover / focus / blur

Mouse and focus interactions.

```typescript
{
  action: "hover" | "focus" | "blur",
  params: {
    selector: string
  }
}
```

### Content Actions

#### evaluate

Execute JavaScript in the page context.

```typescript
{
  action: "evaluate",
  params: {
    script: string,
    args?: any[]  // Arguments to pass to script
  }
}
```

**Security**: Scripts are validated for dangerous keywords (eval, Function constructor, etc.) before
execution.

#### screenshot

Capture page screenshot.

```typescript
{
  action: "screenshot",
  params: {
    fullPage?: boolean,
    clip?: { x: number, y: number, width: number, height: number },
    quality?: number,     // JPEG quality (0-100)
    type?: "jpeg" | "png",
    encoding?: "base64" | "binary"
  }
}
```

#### pdf

Generate PDF from page.

```typescript
{
  action: "pdf",
  params: {
    format?: "Letter" | "Legal" | "A4" | "A3",
    landscape?: boolean,
    scale?: number,
    displayHeaderFooter?: boolean,
    margin?: { top: string, bottom: string, left: string, right: string },
    printBackground?: boolean
  }
}
```

#### content

Get page HTML content.

```typescript
{
  action: "content",
  params: {}  // No parameters required
}
```

### Utility Actions

#### wait

Wait for various conditions.

```typescript
{
  action: "wait",
  params: {
    selector?: string,    // Wait for selector
    timeout?: number,     // Wait for timeout
    visible?: boolean,    // Wait for visibility
    hidden?: boolean,     // Wait for hidden
    function?: string     // Wait for JS function to return true
  }
}
```

#### scroll

Scroll page or element.

```typescript
{
  action: "scroll",
  params: {
    x?: number,
    y?: number,
    selector?: string,    // Element to scroll
    behavior?: "auto" | "smooth"
  }
}
```

#### keyboard

Send keyboard events.

```typescript
{
  action: "keyboard",
  params: {
    type: "press" | "down" | "up",
    key: string,          // Key name (e.g., "Enter", "Escape")
    text?: string         // For typing text
  }
}
```

#### mouse

Send mouse events.

```typescript
{
  action: "mouse",
  params: {
    type: "move" | "down" | "up" | "click",
    x: number,
    y: number,
    button?: "left" | "right" | "middle"
  }
}
```

#### cookies

Manage browser cookies.

```typescript
{
  action: "cookies",
  params: {
    operation: "get" | "set" | "delete",
    cookies?: Array<{
      name: string,
      value?: string,
      domain?: string,
      path?: string,
      expires?: number,
      httpOnly?: boolean,
      secure?: boolean,
      sameSite?: "Strict" | "Lax" | "None"
    }>
  }
}
```

## Common Patterns

### Form Submission

```typescript
// Fill and submit a login form
const actions = [
  { action: 'navigate', params: { url: 'https://example.com/login' } },
  { action: 'type', params: { selector: '#username', text: 'user@example.com' } },
  { action: 'type', params: { selector: '#password', text: 'password' } },
  { action: 'click', params: { selector: '#submit-button' } },
  { action: 'wait', params: { selector: '.dashboard', timeout: 5000 } },
];
```

### Data Extraction

```typescript
// Extract text from multiple elements
const extractAction = {
  action: 'evaluate',
  params: {
    script: `
      Array.from(document.querySelectorAll('.item'))
        .map(el => ({
          title: el.querySelector('.title')?.textContent,
          price: el.querySelector('.price')?.textContent
        }))
    `,
  },
};
```

### Visual Testing

```typescript
// Capture screenshots at different viewport sizes
const viewports = [
  { width: 1920, height: 1080 }, // Desktop
  { width: 768, height: 1024 }, // Tablet
  { width: 375, height: 667 }, // Mobile
];

for (const viewport of viewports) {
  // Set viewport (via context configuration)
  await executeAction({
    action: 'screenshot',
    params: {
      fullPage: true,
      type: 'png',
    },
  });
}
```

## Error Handling

### Action Validation Errors

- **Invalid selector**: Element not found within timeout
- **Invalid URL**: Malformed or disallowed protocol
- **Script validation failure**: Dangerous JavaScript detected
- **File not found**: Upload file path doesn't exist

### Timeout Handling

All actions support configurable timeouts:

- Default: 30 seconds for navigation, 5 seconds for interactions
- Maximum: 120 seconds
- Timeout errors include action context for debugging

### Recovery Strategies

```typescript
// Retry pattern with exponential backoff
const retryAction = async (action: BrowserAction, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await executeAction(action);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};
```

## Performance Considerations

### Action Batching

Execute multiple actions in sequence to minimize round-trips:

```typescript
// Batch related actions
const batchedActions = [
  { action: 'navigate', params: { url: 'https://example.com' } },
  { action: 'wait', params: { selector: '.content' } },
  { action: 'screenshot', params: { fullPage: true } },
];
```

### Resource Usage

- **Screenshots**: Large full-page screenshots can consume significant memory
- **PDFs**: Complex pages may take longer to render
- **Evaluate**: Minimize script complexity for better performance
- **Navigation**: Use appropriate `waitUntil` conditions

### Best Practices

1. **Use specific selectors**: ID selectors are fastest, avoid complex CSS
2. **Set appropriate timeouts**: Don't use excessive timeouts
3. **Validate inputs client-side**: Reduce server round-trips
4. **Monitor action duration**: Track performance metrics
5. **Clean up resources**: Close contexts when done

### Performance Metrics

Actions automatically collect:

- Execution duration
- Success/failure rates
- Timeout occurrences
- Resource consumption

## Security Considerations

### Input Validation

All actions undergo strict validation:

- URL allowlist for navigation
- Script sanitization for evaluate
- Path validation for uploads
- Selector injection prevention

### Access Control

- Session-based authorization required
- Action-level permissions
- Audit logging for compliance
- Rate limiting per session

### NIST Compliance

```typescript
/**
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 * @nist sc-18 "Mobile code"
 */
```

## API Integration

### REST API

```bash
POST /api/v1/contexts/{contextId}/execute
Content-Type: application/json
Authorization: Bearer {token}

{
  "action": "navigate",
  "params": {
    "url": "https://example.com"
  }
}
```

### MCP Tool

```json
{
  "tool": "execute-in-context",
  "arguments": {
    "contextId": "ctx-123",
    "command": "screenshot",
    "parameters": { "fullPage": true }
  }
}
```

### WebSocket

```json
{
  "type": "context.execute",
  "contextId": "ctx-123",
  "action": {
    "action": "click",
    "params": { "selector": "#button" }
  }
}
```

---

For more information, see:

- [Session Management](../architecture/session-management.md)
- [Security Architecture](../architecture/security.md)
- [REST API Reference](./rest-api.md)
