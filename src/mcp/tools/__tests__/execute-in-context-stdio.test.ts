/**
 * Execute in context stdio mode tests
 * @module mcp/tools/__tests__/execute-in-context-stdio.test
 */

// Test for execute-in-context stdio mode
import { ExecuteInContextTool } from '../execute-in-context.js';
import { SessionTools } from '../session-tools.js';
import { BrowserContextTool } from '../browser-context.js';
import { InMemorySessionStore } from '../../../store/in-memory-session-store.js';
import { MCPAuthBridge } from '../../auth/mcp-auth.js';
import { createLogger } from '../../../utils/logger.js';
import { getBrowserExecutor } from '../browser-executor.js';
import type { ExecuteInContextArgs, CreateSessionArgs, CreateBrowserContextArgs } from '../../types/tool-types.js';

const logger = createLogger('test:execute-in-context-stdio');

describe('Execute In Context - STDIO Mode', () => {
  let executeInContextTool: ExecuteInContextTool;
  let sessionTools: SessionTools;
  let browserContextTool: BrowserContextTool;
  let sessionStore: InMemorySessionStore;
  let authBridge: MCPAuthBridge;
  let sessionId: string;
  let contextId: string;

  beforeEach(async () => {
    // Initialize dependencies
    sessionStore = new InMemorySessionStore(logger);
    authBridge = new MCPAuthBridge(sessionStore, logger);
    
    // Create tools WITHOUT REST adapter (simulating stdio mode)
    executeInContextTool = new ExecuteInContextTool(undefined);
    sessionTools = new SessionTools(sessionStore);
    browserContextTool = new BrowserContextTool(authBridge);

    // Create a session first
    const createSessionArgs: CreateSessionArgs = {
      username: 'testuser',
      metadata: {
        source: 'mcp-test',
      },
    };

    const sessionResult = await sessionTools.createSession(createSessionArgs);
    const sessionData = JSON.parse(sessionResult.content[0].text);
    sessionId = sessionData.sessionId;

    // Create a browser context
    const createContextArgs: CreateBrowserContextArgs = {
      sessionId,
      name: 'test-context',
      options: {
        viewport: { width: 1280, height: 720 },
      },
    };

    const contextResult = await browserContextTool.createBrowserContext(createContextArgs);
    const contextData = JSON.parse(contextResult.content[0].text);
    contextId = contextData.contextId;
  });

  afterEach(async () => {
    // Cleanup
    const browserExecutor = getBrowserExecutor();
    await browserExecutor.cleanup();
    
    // Clean up session
    if (sessionId) {
      await sessionTools.deleteSession({ sessionId });
    }
  });

  it('should execute navigate command without REST adapter', async () => {
    const args: ExecuteInContextArgs = {
      contextId,
      command: 'navigate',
      parameters: {
        url: 'https://example.com',
      },
      sessionId,
    };

    const result = await executeInContextTool.execute(args);
    
    expect(result).toBeDefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('duration');
  });

  it('should handle click command without REST adapter', async () => {
    const args: ExecuteInContextArgs = {
      contextId,
      command: 'click',
      parameters: {
        selector: 'button#submit',
      },
      sessionId,
    };

    const result = await executeInContextTool.execute(args);
    
    expect(result).toBeDefined();
    expect(result.content).toHaveLength(1);
    
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty('success');
  });

  it('should handle type command without REST adapter', async () => {
    const args: ExecuteInContextArgs = {
      contextId,
      command: 'type',
      parameters: {
        selector: 'input[name="search"]',
        text: 'test query',
      },
      sessionId,
    };

    const result = await executeInContextTool.execute(args);
    
    expect(result).toBeDefined();
    expect(result.content).toHaveLength(1);
    
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty('success');
  });

  it('should handle screenshot command without REST adapter', async () => {
    const args: ExecuteInContextArgs = {
      contextId,
      command: 'screenshot',
      parameters: {
        fullPage: true,
      },
      sessionId,
    };

    const result = await executeInContextTool.execute(args);
    
    expect(result).toBeDefined();
    expect(result.content).toHaveLength(1);
    
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty('success');
  });

  it('should handle evaluate command without REST adapter', async () => {
    const args: ExecuteInContextArgs = {
      contextId,
      command: 'evaluate',
      parameters: {
        code: 'document.title',
      },
      sessionId,
    };

    const result = await executeInContextTool.execute(args);
    
    expect(result).toBeDefined();
    expect(result.content).toHaveLength(1);
    
    const data = JSON.parse(result.content[0].text);
    expect(data).toHaveProperty('success');
  });

  it('should handle invalid context ID', async () => {
    const args: ExecuteInContextArgs = {
      contextId: 'invalid-context-id',
      command: 'navigate',
      parameters: {
        url: 'https://example.com',
      },
      sessionId,
    };

    const result = await executeInContextTool.execute(args);
    
    expect(result).toBeDefined();
    expect(result.content).toHaveLength(1);
    
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Context not found');
  });

  it('should handle missing command', async () => {
    const args: ExecuteInContextArgs = {
      contextId,
      command: '',
      parameters: {},
      sessionId,
    };

    const result = await executeInContextTool.execute(args);
    
    expect(result).toBeDefined();
    expect(result.content).toHaveLength(1);
    
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('INVALID_COMMAND');
  });

  it('should handle missing context ID', async () => {
    const args: ExecuteInContextArgs = {
      contextId: '',
      command: 'navigate',
      parameters: {
        url: 'https://example.com',
      },
      sessionId,
    };

    const result = await executeInContextTool.execute(args);
    
    expect(result).toBeDefined();
    expect(result.content).toHaveLength(1);
    
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBeDefined();
    expect(data.code).toBe('INVALID_CONTEXT_ID');
  });

  it('should execute multiple commands in sequence', async () => {
    // Navigate first
    const navigateArgs: ExecuteInContextArgs = {
      contextId,
      command: 'navigate',
      parameters: {
        url: 'https://example.com',
      },
      sessionId,
    };

    const navResult = await executeInContextTool.execute(navigateArgs);
    const navData = JSON.parse(navResult.content[0].text);
    expect(navData.success).toBeDefined();

    // Then wait
    const waitArgs: ExecuteInContextArgs = {
      contextId,
      command: 'wait',
      parameters: {
        duration: 1000,
      },
      sessionId,
    };

    const waitResult = await executeInContextTool.execute(waitArgs);
    const waitData = JSON.parse(waitResult.content[0].text);
    expect(waitData.success).toBeDefined();

    // Then take screenshot
    const screenshotArgs: ExecuteInContextArgs = {
      contextId,
      command: 'screenshot',
      parameters: {
        fullPage: false,
      },
      sessionId,
    };

    const screenshotResult = await executeInContextTool.execute(screenshotArgs);
    const screenshotData = JSON.parse(screenshotResult.content[0].text);
    expect(screenshotData.success).toBeDefined();
  });
});