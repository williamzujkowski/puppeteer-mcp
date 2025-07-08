/**
 * MCP client utilities for acceptance tests
 * @module tests/acceptance/utils/mcp-client
 */

import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { TEST_CONFIG } from './test-config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MCPTestClient {
  client: Client;
  cleanup: () => Promise<void>;
}

export interface MCPSessionInfo {
  sessionId: string;
  contextId: string;
}

/**
 * Create an MCP client connected to the puppeteer-mcp server
 */
export async function createMCPClient(): Promise<MCPTestClient> {
  // Path to the built MCP server
  const mcpServerPath = path.resolve(__dirname, '../../../dist/mcp/start-mcp.js');
  
  // Start the MCP server as a child process
  const serverProcess: ChildProcess = spawn('node', [mcpServerPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
    },
  });

  if (!serverProcess.stdin || !serverProcess.stdout) {
    throw new Error('Failed to start MCP server process');
  }

  // Create client transport using stdio
  const transport = new StdioClientTransport({
    stdin: serverProcess.stdin,
    stdout: serverProcess.stdout,
  });

  // Create and connect client
  const client = new Client(
    {
      name: 'puppeteer-mcp-acceptance-test',
      version: '1.0.14',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  await client.connect(transport);

  const cleanup = async () => {
    try {
      await client.close();
    } catch (error) {
      console.warn('Error closing MCP client:', error);
    }
    
    try {
      serverProcess.kill('SIGTERM');
      
      // Give process time to exit gracefully
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);
        
        serverProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    } catch (error) {
      console.warn('Error killing MCP server process:', error);
    }
  };

  return { client, cleanup };
}

/**
 * Create a browser session through MCP
 */
export async function createMCPSession(client: Client): Promise<MCPSessionInfo> {
  // Create session
  const sessionResult = await client.callTool({
    name: 'createSession',
    arguments: {
      username: 'test-user',
      password: 'test-password',
      duration: 3600, // 1 hour
    },
  });

  if (!sessionResult.content?.[0]?.text) {
    throw new Error('Failed to create session');
  }

  const sessionData = JSON.parse(sessionResult.content[0].text);
  const sessionId = sessionData.id;

  // Create browser context
  const contextResult = await client.callTool({
    name: 'createContext',
    arguments: {
      sessionId,
      type: 'puppeteer',
      options: {
        headless: TEST_CONFIG.headless,
        viewport: TEST_CONFIG.viewport,
        slowMo: TEST_CONFIG.slowMo,
      },
    },
  });

  if (!contextResult.content?.[0]?.text) {
    throw new Error('Failed to create browser context');
  }

  const contextData = JSON.parse(contextResult.content[0].text);
  const contextId = contextData.contextId;

  return { sessionId, contextId };
}

/**
 * Navigate to a URL using MCP
 */
export async function mcpNavigate(
  client: Client,
  contextId: string,
  url: string
): Promise<void> {
  const result = await client.callTool({
    name: 'navigate',
    arguments: {
      contextId,
      url,
    },
  });

  if (!result.content?.[0]?.text) {
    throw new Error('Navigation failed');
  }

  const data = JSON.parse(result.content[0].text);
  if (!data.success) {
    throw new Error(`Navigation failed: ${data.error || 'Unknown error'}`);
  }
}

/**
 * Click an element using MCP
 */
export async function mcpClick(
  client: Client,
  contextId: string,
  selector: string
): Promise<void> {
  const result = await client.callTool({
    name: 'click',
    arguments: {
      contextId,
      selector,
    },
  });

  const resultText = result.content?.[0]?.text;
  if (!resultText) {
    throw new Error('Click failed');
  }

  const data = JSON.parse(resultText) as { success: boolean; error?: string };
  if (!data.success) {
    throw new Error(`Click failed: ${data.error ?? 'Unknown error'}`);
  }
}

/**
 * Type text into an element using MCP
 */
export async function mcpType(
  client: Client,
  contextId: string,
  selector: string,
  text: string
): Promise<void> {
  const result = await client.callTool({
    name: 'type',
    arguments: {
      contextId,
      selector,
      text,
    },
  });

  const resultText = result.content?.[0]?.text;
  if (!resultText) {
    throw new Error('Type failed');
  }

  const data = JSON.parse(resultText) as { success: boolean; error?: string };
  if (!data.success) {
    throw new Error(`Type failed: ${data.error ?? 'Unknown error'}`);
  }
}

/**
 * Get page content using MCP
 */
export async function mcpGetContent(
  client: Client,
  contextId: string,
  selector?: string
): Promise<string> {
  const result = await client.callTool({
    name: 'getContent',
    arguments: {
      contextId,
      selector,
    },
  });

  const resultText = result.content?.[0]?.text;
  if (!resultText) {
    throw new Error('Get content failed');
  }

  const data = JSON.parse(resultText) as { success: boolean; error?: string; content: string };
  if (!data.success) {
    throw new Error(`Get content failed: ${data.error ?? 'Unknown error'}`);
  }

  return data.content;
}

/**
 * Wait for selector using MCP
 */
export async function mcpWaitForSelector(
  client: Client,
  contextId: string,
  selector: string,
  timeout?: number
): Promise<void> {
  const result = await client.callTool({
    name: 'waitForSelector',
    arguments: {
      contextId,
      selector,
      timeout: timeout || TEST_CONFIG.timeout,
    },
  });

  const resultText = result.content?.[0]?.text;
  if (!resultText) {
    throw new Error('Wait for selector failed');
  }

  const data = JSON.parse(resultText) as { success: boolean; error?: string };
  if (!data.success) {
    throw new Error(`Wait for selector failed: ${data.error ?? 'Unknown error'}`);
  }
}

/**
 * Take a screenshot using MCP
 */
export async function mcpScreenshot(
  client: Client,
  contextId: string,
  filename?: string
): Promise<string> {
  const result = await client.callTool({
    name: 'screenshot',
    arguments: {
      contextId,
      filename,
    },
  });

  const resultText = result.content?.[0]?.text;
  if (!resultText) {
    throw new Error('Screenshot failed');
  }

  const data = JSON.parse(resultText) as { success: boolean; error?: string; filename: string };
  if (!data.success) {
    throw new Error(`Screenshot failed: ${data.error ?? 'Unknown error'}`);
  }

  return data.filename;
}

/**
 * Clean up MCP session and context
 */
export async function cleanupMCPSession(
  client: Client,
  sessionInfo: MCPSessionInfo
): Promise<void> {
  try {
    // Close context first
    await client.callTool({
      name: 'closeContext',
      arguments: {
        contextId: sessionInfo.contextId,
      },
    });
  } catch (error) {
    console.warn('Error closing context:', error);
  }

  try {
    // Close session
    await client.callTool({
      name: 'closeSession',
      arguments: {
        sessionId: sessionInfo.sessionId,
      },
    });
  } catch (error) {
    console.warn('Error closing session:', error);
  }
}