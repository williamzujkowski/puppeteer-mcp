/**
 * Simple acceptance test to verify basic MCP functionality
 * @module tests/acceptance/basic/simple
 */

import { describe, it, expect } from '@jest/globals';
import { createMCPClient, createMCPSession, cleanupMCPSession, mcpNavigate, mcpGetContent } from '../utils/mcp-client.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('Simple MCP Test', () => {
  it('should create session, navigate, get content, and cleanup', async () => {
    let mcpClient: MCPTestClient | undefined;
    let sessionInfo: MCPSessionInfo | undefined;
    
    try {
      // Step 1: Create MCP client
      console.warn('Creating MCP client...');
      mcpClient = await createMCPClient();
      expect(mcpClient).toBeDefined();
      expect(mcpClient.client).toBeDefined();
      
      // Step 2: Create session
      console.warn('Creating session...');
      sessionInfo = await createMCPSession(mcpClient.client);
      expect(sessionInfo).toBeDefined();
      expect(sessionInfo.sessionId).toBeTruthy();
      expect(sessionInfo.contextId).toBeTruthy();
      
      // Step 3: Navigate to a simple page
      console.warn('Navigating to example.com...');
      await mcpNavigate(mcpClient.client, sessionInfo.contextId, 'https://example.com');
      
      // Step 4: Get page content
      console.warn('Getting page content...');
      const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
      expect(content).toBeTruthy();
      expect(content).toContain('Example Domain');
      
      console.warn('Test completed successfully!');
    } finally {
      // Cleanup
      if (sessionInfo && mcpClient) {
        console.warn('Cleaning up session...');
        await cleanupMCPSession(mcpClient.client, sessionInfo);
      }
      
      if (mcpClient) {
        console.warn('Cleaning up MCP client...');
        await mcpClient.cleanup();
      }
    }
  }, 30000); // 30 second timeout for the entire test
});