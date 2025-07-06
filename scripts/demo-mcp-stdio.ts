#!/usr/bin/env tsx
/**
 * Demo script showing MCP browser automation works in stdio mode
 * Run with: npx tsx scripts/demo-mcp-stdio.ts
 */

import { ExecuteInContextTool } from '../src/mcp/tools/execute-in-context.js';
import { SessionTools } from '../src/mcp/tools/session-tools.js';
import { BrowserContextTool } from '../src/mcp/tools/browser-context.js';
import { InMemorySessionStore } from '../src/store/in-memory-session-store.js';
import { MCPAuthBridge } from '../src/mcp/auth/mcp-auth.js';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger('demo:mcp-stdio');

async function runDemo() {
  // Initialize without REST adapter (simulating stdio mode)
  const sessionStore = new InMemorySessionStore(logger);
  const authBridge = new MCPAuthBridge(sessionStore, logger);
  
  const executeInContextTool = new ExecuteInContextTool(undefined); // No REST adapter
  const sessionTools = new SessionTools(sessionStore);
  const browserContextTool = new BrowserContextTool(authBridge);

  // Create session
  const sessionResult = await sessionTools.createSession({
    username: 'demo',
    password: 'demo123!',
  });
  const { sessionId } = JSON.parse(sessionResult.content[0].text);
  console.log(`✅ Session created: ${sessionId}`);

  // Create browser context
  const contextResult = await browserContextTool.createBrowserContext({
    sessionId,
    name: 'demo-context',
  });
  const { contextId } = JSON.parse(contextResult.content[0].text);
  console.log(`✅ Context created: ${contextId}`);

  // Navigate to a page
  const navResult = await executeInContextTool.execute({
    contextId,
    command: 'navigate',
    parameters: { url: 'https://example.com' },
    sessionId,
  });
  const navData = JSON.parse(navResult.content[0].text);
  console.log(`✅ Navigation: ${navData.success ? 'Success' : 'Failed'}`);

  // Take a screenshot
  const screenshotResult = await executeInContextTool.execute({
    contextId,
    command: 'screenshot',
    parameters: { fullPage: true },
    sessionId,
  });
  const screenshotData = JSON.parse(screenshotResult.content[0].text);
  console.log(`✅ Screenshot: ${screenshotData.success ? 'Success' : 'Failed'}`);

  console.log('\n🎉 MCP browser automation works without REST adapter!');
  
  // Quick exit to avoid timeout
  process.exit(0);
}

runDemo().catch(console.error);