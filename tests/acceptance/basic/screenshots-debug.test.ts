/**
 * Debug screenshot functionality
 * @module tests/acceptance/basic/screenshots-debug
 */

import { describe, it, expect } from '@jest/globals';
import {
  createMCPClient,
  createMCPSession,
  cleanupMCPSession,
  mcpNavigate,
} from '../utils/mcp-client.js';
import { getTestTargets } from '../utils/reliable-test-config.js';
const TEST_TARGETS = getTestTargets();
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('Screenshot Debug Test', () => {
  it('should debug screenshot command response', async () => {
    let mcpClient: MCPTestClient | undefined;
    let sessionInfo: MCPSessionInfo | undefined;

    try {
      mcpClient = await createMCPClient();
      sessionInfo = await createMCPSession(mcpClient.client);

      // Navigate to a simple page
      await mcpNavigate(mcpClient.client, sessionInfo.contextId, TEST_TARGETS.testing.theInternet);

      // Wait a bit for page to load
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 2000);
      });

      // Call screenshot command directly to see raw response
      const result = await mcpClient.client.callTool({
        name: 'execute-in-context',
        arguments: {
          contextId: sessionInfo.contextId,
          command: 'screenshot',
          parameters: {
            filename: 'debug-test.png',
          },
        },
      });

      const resultText = result.content?.[0]?.text;

      // Use expect to show the values in output
      expect(result.content).toBeDefined();
      expect(resultText).toBeDefined();

      if (resultText) {
        try {
          const data = JSON.parse(resultText);
          // This will show the parsed data in the test output
          expect(data).toEqual(expect.any(Object));

          // Check what properties the response has
          if (data.error) {
            throw new Error(`Screenshot command failed: ${data.error}`);
          }

          // Log the structure
          const keys = Object.keys(data);
          expect(keys.length).toBeGreaterThan(0);

          // Check for common response fields
          const hasFilename = 'filename' in data;
          const hasData = 'data' in data;
          const hasPath = 'path' in data;
          const hasSuccess = 'success' in data;

          console.warn(
            `Response structure: hasFilename=${hasFilename}, hasData=${hasData}, hasPath=${hasPath}, hasSuccess=${hasSuccess}`,
          );
          console.warn(`Keys: ${JSON.stringify(keys)}`);
          console.warn(`Full response: ${JSON.stringify(data)}`);
        } catch (error) {
          throw new Error(`Failed to parse JSON response: ${error}. Raw text: ${resultText}`);
        }
      } else {
        throw new Error('No text content in response');
      }
    } finally {
      if (sessionInfo && mcpClient) {
        await cleanupMCPSession(mcpClient.client, sessionInfo);
      }
      if (mcpClient) {
        await mcpClient.cleanup();
      }
    }
  }, 30000);
});
