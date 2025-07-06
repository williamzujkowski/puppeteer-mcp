# MCP STDIO Browser Automation Fix

## Problem

The MCP `execute-in-context` tool was failing in stdio mode because it had a hard dependency on the REST adapter, which is not available when running the MCP server in stdio mode (the standard mode for AI assistants).

## Solution

Created a new `BrowserExecutor` class that provides direct browser automation capabilities without requiring the REST adapter. The `execute-in-context` tool now automatically falls back to this direct executor when the REST adapter is not available.

### Key Changes

1. **New BrowserExecutor Class** (`src/mcp/tools/browser-executor.ts`)
   - Singleton pattern for resource management
   - Direct integration with BrowserPool and ActionExecutor
   - Command parsing to convert MCP commands to browser actions
   - Automatic page creation and management per context

2. **Updated ExecuteInContextTool** (`src/mcp/tools/execute-in-context.ts`)
   - Fallback logic: uses REST adapter if available, otherwise uses BrowserExecutor
   - No longer throws error when REST adapter is missing
   - Maintains backward compatibility with existing REST-based implementations

### Supported Commands

The BrowserExecutor supports all common browser automation commands:
- `navigate` / `goto` - Navigate to URLs
- `click` - Click elements
- `type` / `fill` - Enter text in forms
- `screenshot` - Capture page screenshots
- `wait` / `waitForSelector` - Wait for elements or time
- `evaluate` / `execute` - Run JavaScript in page context
- `scroll` - Scroll the page
- `select` - Select dropdown options
- And more...

### Usage Example

```typescript
// In MCP stdio mode (no REST server)
const executeInContextTool = new ExecuteInContextTool(undefined);

// Execute browser commands
const result = await executeInContextTool.execute({
  contextId: 'context-id',
  command: 'navigate',
  parameters: { url: 'https://example.com' },
  sessionId: 'session-id'
});
```

### Testing

Run the demo script to verify the fix:
```bash
npx tsx scripts/demo-mcp-stdio.ts
```

### Architecture Benefits

1. **Decoupled Design**: Browser automation no longer depends on REST server
2. **Resource Efficiency**: Single browser pool shared across all MCP operations
3. **Backward Compatible**: Existing REST-based integrations continue to work
4. **AI-Friendly**: MCP tools now work properly in stdio mode for AI assistants

### Future Improvements

- Add connection pooling for better resource management
- Implement browser context isolation for security
- Add support for browser profiles and extensions
- Enhanced error handling and retry logic