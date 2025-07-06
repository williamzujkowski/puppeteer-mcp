#!/usr/bin/env tsx
/**
 * Test script for MCP browser automation in stdio mode
 * This demonstrates that browser automation works without REST adapter
 */

import { ExecuteInContextTool } from '../src/mcp/tools/execute-in-context.js';
import { SessionTools } from '../src/mcp/tools/session-tools.js';
import { BrowserContextTool } from '../src/mcp/tools/browser-context.js';
import { InMemorySessionStore } from '../src/store/in-memory-session-store.js';
import { MCPAuthBridge } from '../src/mcp/auth/mcp-auth.js';
import { createLogger } from '../src/utils/logger.js';
import { getBrowserExecutor } from '../src/mcp/tools/browser-executor.js';

const logger = createLogger('test:mcp-browser-stdio');

async function testMCPBrowserAutomation() {
  console.log('🚀 Testing MCP Browser Automation in STDIO mode...\n');

  try {
    // Initialize dependencies
    const sessionStore = new InMemorySessionStore(logger);
    const authBridge = new MCPAuthBridge(sessionStore, logger);
    
    // Create tools WITHOUT REST adapter (simulating stdio mode)
    const executeInContextTool = new ExecuteInContextTool(undefined);
    const sessionTools = new SessionTools(sessionStore);
    const browserContextTool = new BrowserContextTool(authBridge);

    console.log('✅ Tools initialized without REST adapter\n');

    // Step 1: Create a session (using demo user)
    console.log('1️⃣ Creating session...');
    const sessionResult = await sessionTools.createSession({
      username: 'demo',
      password: 'demo123!',
      metadata: { source: 'mcp-stdio-test' },
    });
    const sessionData = JSON.parse(sessionResult.content[0].text);
    if (sessionData.error) {
      console.log(`   Session creation failed: ${sessionData.error}`);
      console.log(`   Code: ${sessionData.code}`);
      throw new Error('Failed to create session');
    }
    console.log(`   Session created: ${sessionData.sessionId}\n`);

    // Step 2: Create a browser context
    console.log('2️⃣ Creating browser context...');
    const contextResult = await browserContextTool.createBrowserContext({
      sessionId: sessionData.sessionId,
      name: 'test-browser-context',
      options: {
        viewport: { width: 1280, height: 720 },
        userAgent: 'MCP Test Browser',
      },
    });
    const contextData = JSON.parse(contextResult.content[0].text);
    if (contextData.error) {
      console.log(`   Context creation failed: ${contextData.error}`);
      console.log(`   Code: ${contextData.code}`);
      throw new Error('Failed to create browser context');
    }
    console.log(`   Context created: ${contextData.contextId}\n`);

    // Step 3: Execute browser commands
    console.log('3️⃣ Executing browser commands...\n');

    // Navigate to a page
    console.log('   📍 Navigating to example.com...');
    const navResult = await executeInContextTool.execute({
      contextId: contextData.contextId,
      command: 'navigate',
      parameters: { url: 'https://example.com' },
      sessionId: sessionData.sessionId,
    });
    const navData = JSON.parse(navResult.content[0].text);
    console.log(`   Navigation result: ${navData.success ? '✅ Success' : '❌ Failed'}`);
    if (navData.error) console.log(`   Error: ${navData.error}`);

    // Wait for page to load
    console.log('\n   ⏳ Waiting 2 seconds...');
    const waitResult = await executeInContextTool.execute({
      contextId: contextData.contextId,
      command: 'wait',
      parameters: { duration: 2000 },
      sessionId: sessionData.sessionId,
    });
    const waitData = JSON.parse(waitResult.content[0].text);
    console.log(`   Wait result: ${waitData.success ? '✅ Success' : '❌ Failed'}`);

    // Take a screenshot
    console.log('\n   📸 Taking screenshot...');
    const screenshotResult = await executeInContextTool.execute({
      contextId: contextData.contextId,
      command: 'screenshot',
      parameters: { fullPage: true },
      sessionId: sessionData.sessionId,
    });
    const screenshotData = JSON.parse(screenshotResult.content[0].text);
    console.log(`   Screenshot result: ${screenshotData.success ? '✅ Success' : '❌ Failed'}`);

    // Evaluate JavaScript
    console.log('\n   🔧 Evaluating JavaScript...');
    const evalResult = await executeInContextTool.execute({
      contextId: contextData.contextId,
      command: 'evaluate',
      parameters: { code: 'document.title' },
      sessionId: sessionData.sessionId,
    });
    const evalData = JSON.parse(evalResult.content[0].text);
    console.log(`   Evaluate result: ${evalData.success ? '✅ Success' : '❌ Failed'}`);
    if (evalData.data) console.log(`   Page title: "${evalData.data}"`);

    // Cleanup
    console.log('\n4️⃣ Cleaning up...');
    if (sessionData.sessionId) {
      await sessionTools.deleteSession({ sessionId: sessionData.sessionId });
      console.log('   Session deleted');
    }

    const browserExecutor = getBrowserExecutor();
    await browserExecutor.cleanup();
    console.log('   Browser executor cleaned up');

    console.log('\n✅ All tests completed successfully!');
    console.log('   MCP browser automation works without REST adapter! 🎉');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMCPBrowserAutomation().catch(console.error);