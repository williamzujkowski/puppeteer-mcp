# Browser Action Executor

The Browser Action Executor provides a secure, type-safe, and comprehensive system for executing
browser automation actions through the Puppeteer integration. It supports all common browser
operations with enterprise-grade security, validation, and audit logging.

## Overview

The action executor implements the `ActionExecutor` interface and provides:

- **Security-First Design**: All inputs are validated and sanitized according to NIST standards
- **Type Safety**: Full TypeScript support with strict type checking
- **Comprehensive Logging**: Detailed audit trails for all actions
- **Error Recovery**: Automatic retry logic with exponential backoff
- **Batch Operations**: Support for parallel and sequential action execution
- **Performance Monitoring**: Timing and metrics collection for all actions

## Supported Actions

### Navigation Actions

- `navigate` - Navigate to URL with security validation
- `goBack` - Navigate to previous page
- `goForward` - Navigate to next page
- `reload` - Reload current page

### Interaction Actions

- `click` - Click on elements with safety checks
- `type` - Type text with input sanitization
- `select` - Select options from dropdowns
- `hover` - Hover over elements
- `focus` - Focus on elements
- `blur` - Remove focus from elements

### Content Actions

- `screenshot` - Capture page or element screenshots
- `pdf` - Generate PDF documents
- `getContent` - Get page HTML content
- `getTitle` - Get page title
- `getUrl` - Get current URL
- `getElementText` - Extract text from elements

### Input Actions

- `keyboard` - Keyboard input and shortcuts
- `mouse` - Mouse movements and clicks
- `upload` - File upload with validation
- `scroll` - Page and element scrolling

### Evaluation Actions

- `evaluate` - Execute JavaScript with security restrictions
- `wait` - Wait for elements, navigation, or conditions

### State Management

- `cookie` - Cookie management operations

## Security Features

### Input Validation

All actions undergo strict validation:

- URL validation prevents malicious redirects
- Selector sanitization prevents XSS attacks
- JavaScript code analysis blocks dangerous operations
- File upload validation restricts file types and sizes

### NIST Compliance

The action executor implements multiple NIST controls:

- **SI-10**: Information input validation
- **AC-3**: Access enforcement
- **AC-4**: Information flow enforcement
- **AU-3**: Content of audit records

### Security Restrictions

- No `eval()` or dynamic code execution
- Restricted file system access
- URL protocol validation (HTTP/HTTPS only)
- Path traversal prevention
- Content Security Policy enforcement

## Usage

### Basic Action Execution

```typescript
import { BrowserActionExecutor } from '../puppeteer/actions';

const executor = new BrowserActionExecutor(pageManager);

const action = {
  type: 'navigate',
  pageId: 'page-123',
  url: 'https://example.com',
  timeout: 30000,
};

const context = {
  sessionId: 'session-456',
  contextId: 'context-789',
  userId: 'user-abc',
};

const result = await executor.execute(action, context);
```

### Batch Execution

```typescript
const actions = [
  { type: 'navigate', pageId: 'page-123', url: 'https://example.com' },
  { type: 'click', pageId: 'page-123', selector: '#submit-button' },
  { type: 'screenshot', pageId: 'page-123', fullPage: true },
];

const results = await executor.executeBatch(actions, context, {
  parallel: false,
  stopOnError: true,
});
```

### Custom Action Handlers

```typescript
// Register custom action handler
executor.registerHandler('custom-action', async (action, page, context) => {
  // Custom implementation
  return {
    success: true,
    actionType: 'custom-action',
    data: { result: 'success' },
    duration: 100,
    timestamp: new Date(),
  };
});
```

## Validation

### Action Validation

All actions are validated before execution:

```typescript
const validationResult = await executor.validate(action, context);
if (!validationResult.valid) {
  console.error('Validation errors:', validationResult.errors);
}
```

### Security Validation

JavaScript code and URLs undergo security analysis:

```typescript
import { validateJavaScriptCode, sanitizeUrl } from '../puppeteer/actions';

// Validate JavaScript
try {
  validateJavaScriptCode('document.title');
} catch (error) {
  console.error('Unsafe JavaScript:', error.message);
}

// Sanitize URL
const safeUrl = sanitizeUrl('https://example.com');
```

## Error Handling

### Retry Logic

Actions automatically retry on failure with exponential backoff:

- Maximum 3 retry attempts
- Exponential backoff (1s, 2s, 4s)
- Configurable timeout per action

### Error Types

- **ValidationError**: Input validation failures
- **SecurityError**: Security policy violations
- **TimeoutError**: Action timeout exceeded
- **PageNotFoundError**: Page instance not available
- **NetworkError**: Network-related failures

## Monitoring and Metrics

### Action History

Track execution history per context:

```typescript
const history = await executor.getHistory(context, {
  limit: 100,
  actionTypes: ['navigate', 'click'],
  startDate: new Date('2024-01-01'),
});
```

### Performance Metrics

Get execution metrics:

```typescript
const metrics = await executor.getMetrics(context);
console.log('Average duration:', metrics.averageDuration);
console.log('Success rate:', metrics.successfulActions / metrics.totalActions);
```

## Configuration

### Validation Settings

- Maximum JavaScript code length: 50,000 characters
- Maximum file upload size: 10MB
- Maximum batch size: 100 actions
- Maximum timeout: 5 minutes

### Security Settings

- Allowed file extensions for upload
- Blocked JavaScript keywords
- URL protocol restrictions
- Path traversal prevention

## Integration

### REST API Integration

The action executor is integrated with the REST API through context handlers:

```http
POST /v1/contexts/{contextId}/execute
{
  "type": "navigate",
  "pageId": "page-123",
  "url": "https://example.com"
}
```

### WebSocket Integration

Real-time action execution through WebSocket connections with the same validation and security.

### gRPC Integration

High-performance action execution through gRPC services with streaming support.

## Testing

Comprehensive test suite covers:

- Action validation
- Security restrictions
- Error handling
- Retry logic
- Batch operations
- Performance metrics

Run tests:

```bash
npm test -- src/puppeteer/actions/
```

## Development

### Adding New Actions

1. Define action interface in `interfaces/action-executor.interface.ts`
2. Add validation schema in `validation.ts`
3. Create handler in `handlers/` directory
4. Register handler in `action-executor.ts`
5. Add comprehensive tests

### Security Considerations

- Always validate inputs before processing
- Sanitize user-provided data
- Log security events for audit trails
- Follow principle of least privilege
- Implement defense in depth

## Architecture

```
src/puppeteer/actions/
├── action-executor.ts          # Main executor implementation
├── validation.ts               # Input validation and sanitization
├── handlers/                   # Action-specific handlers
│   ├── navigation.ts          # Navigation actions
│   ├── interaction.ts         # User interaction actions
│   ├── content.ts             # Content retrieval actions
│   ├── evaluation.ts          # JavaScript evaluation
│   ├── keyboard.ts            # Keyboard input
│   ├── mouse.ts               # Mouse actions
│   ├── upload.ts              # File upload
│   ├── cookies.ts             # Cookie management
│   └── scroll.ts              # Scrolling actions
└── index.ts                   # Public API exports
```

The action executor serves as the central orchestrator, delegating to specialized handlers while
maintaining consistent security, validation, and audit logging across all operations.
