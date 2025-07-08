/**
 * MCP client utilities for acceptance tests
 * @module tests/acceptance/utils/mcp-client
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { TEST_CONFIG } from './test-config.js';
import path from 'path';

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
  // Use process.cwd() as the base since tests run from project root
  const mcpServerPath = path.resolve(process.cwd(), 'dist/mcp/start-mcp.js');
  
  // Create client transport using stdio - it will spawn the server process
  const transport = new StdioClientTransport({
    command: 'node',
    args: [mcpServerPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      MCP_TRANSPORT: 'stdio',
    },
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

  const cleanup = async (): Promise<void> => {
    try {
      await client.close();
    } catch (error) {
      console.warn('Error closing MCP client:', error);
    }
    
    // The transport should handle closing the server process
    try {
      await transport.close();
    } catch (error) {
      console.warn('Error closing MCP transport:', error);
    }
  };

  return { client, cleanup };
}

/**
 * Create a browser session through MCP
 */
export async function createMCPSession(client: Client): Promise<MCPSessionInfo> {
  // Create session using demo credentials
  const sessionResult = await client.callTool({
    name: 'create-session',
    arguments: {
      username: 'demo',
      password: 'demo123!',
      duration: 3600, // 1 hour
    },
  });

  if (!sessionResult.content?.[0]?.text) {
    throw new Error('Failed to create session');
  }

  const sessionData = JSON.parse(sessionResult.content[0].text);
  const sessionId = sessionData.sessionId;

  // Create browser context
  const contextResult = await client.callTool({
    name: 'create-browser-context',
    arguments: {
      sessionId,
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
  
  // Check for error in response
  if (contextData.error) {
    throw new Error(`Failed to create browser context: ${contextData.error}`);
  }
  
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
    name: 'execute-in-context',
    arguments: {
      contextId,
      command: 'navigate',
      parameters: {
        url,
      },
    },
  });

  if (!result.content?.[0]?.text) {
    throw new Error('Navigation failed');
  }

  const data = JSON.parse(result.content[0].text);
  // Check for error response format
  if (data.error) {
    throw new Error(`Navigation failed: ${data.error}`);
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
    name: 'execute-in-context',
    arguments: {
      contextId,
      command: 'click',
      parameters: {
        selector,
      },
    },
  });

  const resultText = result.content?.[0]?.text;
  if (!resultText) {
    throw new Error('Click failed');
  }

  const data = JSON.parse(resultText) as { error?: string };
  if (data.error) {
    throw new Error(`Click failed: ${data.error}`);
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
    name: 'execute-in-context',
    arguments: {
      contextId,
      command: 'type',
      parameters: {
        selector,
        text,
      },
    },
  });

  const resultText = result.content?.[0]?.text;
  if (!resultText) {
    throw new Error('Type failed');
  }

  const data = JSON.parse(resultText) as { error?: string };
  if (data.error) {
    throw new Error(`Type failed: ${data.error}`);
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
    name: 'execute-in-context',
    arguments: {
      contextId,
      command: 'getContent',
      parameters: {
        selector,
      },
    },
  });

  const resultText = result.content?.[0]?.text;
  if (!resultText) {
    throw new Error('Get content failed');
  }

  const data = JSON.parse(resultText) as { error?: string; success?: boolean; data?: string };
  if (data.error) {
    throw new Error(`Get content failed: ${data.error}`);
  }

  // The content is returned in the data field from the execute-in-context response
  return data.data ?? '';
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
    name: 'execute-in-context',
    arguments: {
      contextId,
      command: 'waitForSelector',
      parameters: {
        selector,
        timeout: timeout ?? TEST_CONFIG.timeout,
      },
    },
  });

  const resultText = result.content?.[0]?.text;
  if (!resultText) {
    throw new Error('Wait for selector failed');
  }

  const data = JSON.parse(resultText) as { error?: string };
  if (data.error) {
    throw new Error(`Wait for selector failed: ${data.error}`);
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
    name: 'execute-in-context',
    arguments: {
      contextId,
      command: 'screenshot',
      parameters: {
        filename,
      },
    },
  });

  const resultText = result.content?.[0]?.text;
  if (!resultText) {
    throw new Error('Screenshot failed');
  }

  const data = JSON.parse(resultText) as { error?: string; filename?: string };
  if (data.error) {
    throw new Error(`Screenshot failed: ${data.error}`);
  }

  return data.filename ?? '';
}

/**
 * Clean up MCP session and context
 */
export async function cleanupMCPSession(
  client: Client,
  sessionInfo: MCPSessionInfo
): Promise<void> {
  // The enhanced delete-session operation now properly cleans up all associated resources
  // including contexts and pages, so we just need to delete the session
  
  try {
    // Delete session - this will cascade cleanup to all contexts and pages
    const result = await client.callTool({
      name: 'delete-session',
      arguments: {
        sessionId: sessionInfo.sessionId,
      },
    });
    
    if (result.content?.[0]?.text) {
      const response = JSON.parse(result.content[0].text);
      if (response.success) {
        console.warn(`Session ${sessionInfo.sessionId} cleaned up successfully`);
      }
    }
  } catch (error) {
    console.warn('Error deleting session:', error);
  }
}