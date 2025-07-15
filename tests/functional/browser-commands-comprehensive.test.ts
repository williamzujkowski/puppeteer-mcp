/**
 * Comprehensive Browser Commands Functional Tests
 * @module tests/functional/browser-commands-comprehensive
 * @description Complete functional test suite for all browser automation commands
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MCPServer, createMCPServer } from '../../src/mcp/server.js';
import type { ToolResponse } from '../../src/mcp/types/tool-types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getTestTargets } from '../acceptance/utils/reliable-test-config.js';
import { TestDataUrls } from '../utils/test-data-urls.js';
import { setupTestLogging } from '../utils/log-suppressor.js';

/**
 * Mock MCP client for testing
 */
class MockMCPClient {
  private server: MCPServer;
  private mockTransport: any;

  constructor(server: MCPServer) {
    this.server = server;
    this.setupMockTransport();
  }

  private setupMockTransport(): void {
    // Mock the transport to intercept tool calls
    this.mockTransport = {
      send: jest.fn(),
      close: jest.fn(),
    };
  }

  async callTool(name: string, args: any): Promise<ToolResponse> {
    // Directly call the server's executeTool method
    const result = await (this.server as any).executeTool(name, args);

    // Check if result is already a ToolResponse (e.g., from execute-in-context)
    if (result && typeof result === 'object' && result.content && Array.isArray(result.content)) {
      return result as ToolResponse;
    }

    // Convert raw result to ToolResponse format
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };
  }
}

describe('Browser Commands Comprehensive Functional Tests', () => {
  setupTestLogging();

  let mcpServer: MCPServer;
  let mcpClient: MockMCPClient;
  const testSessions: Map<string, any> = new Map();
  const testContexts: Map<string, any> = new Map();
  let primarySessionId: string;
  const TEST_TARGETS = getTestTargets();
  let primaryContextId: string;

  beforeAll(async () => {
    // Create MCP server
    mcpServer = createMCPServer();
    mcpClient = new MockMCPClient(mcpServer);

    // Start the server
    await mcpServer.start();

    // Create a primary session and context for most tests
    const sessionResult = await mcpClient.callTool('create-session', {
      username: 'demo',
      password: 'demo123!',
    });
    const sessionData = JSON.parse(sessionResult.content[0].text);
    primarySessionId = sessionData.sessionId;
    testSessions.set(primarySessionId, sessionData);

    const contextResult = await mcpClient.callTool('create-browser-context', {
      sessionId: primarySessionId,
      options: {
        viewport: { width: 1280, height: 720 },
      },
    });
    const contextData = JSON.parse(contextResult.content[0].text);
    primaryContextId = contextData.contextId;
    testContexts.set(primaryContextId, contextData);
  });

  afterAll(async () => {
    // Cleanup all test resources
    for (const contextId of testContexts.keys()) {
      try {
        await mcpClient.callTool('close-browser-context', {
          contextId,
          sessionId: testContexts.get(contextId).sessionId,
        });
      } catch {
        // Ignore cleanup errors
      }
    }

    for (const sessionId of testSessions.keys()) {
      try {
        await mcpClient.callTool('delete-session', { sessionId });
      } catch {
        // Ignore cleanup errors
      }
    }

    await mcpServer.stop();
  });

  beforeEach(async () => {
    // Navigate to a clean page before each test
    await mcpClient.callTool('execute-in-context', {
      contextId: primaryContextId,
      command: 'navigate',
      parameters: { url: 'about:blank' },
    });
  });

  describe('Navigation Commands', () => {
    describe('navigate', () => {
      it('should navigate to a URL successfully', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'navigate',
          parameters: { url: TestDataUrls.basicPage() },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toBeDefined();
      });

      it('should navigate with different wait options', async () => {
        const waitOptions = ['load', 'domcontentloaded', 'networkidle0', 'networkidle2'];

        for (const waitUntil of waitOptions) {
          const result = await mcpClient.callTool('execute-in-context', {
            contextId: primaryContextId,
            command: 'navigate',
            parameters: {
              url: TestDataUrls.basicPage(),
              waitUntil,
            },
          });

          const executeData = JSON.parse(result.content[0].text);
          expect(executeData.success).toBe(true);
        }
      });

      it('should handle invalid URLs gracefully', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'navigate',
          parameters: { url: 'not-a-valid-url' },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(false);
        expect(executeData.error).toBeDefined();
      });

      it('should handle navigation timeout', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'navigate',
          parameters: {
            url: TestDataUrls.dynamicPage(), // Dynamic content for timeout test
            timeout: 1000, // 1 second timeout
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(false);
        expect(executeData.error).toContain('timeout');
      });
    });
  });

  describe('Interaction Commands', () => {
    describe('click', () => {
      beforeEach(async () => {
        // Navigate to a test page with clickable elements
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'navigate',
          parameters: { url: TestDataUrls.basicPage() },
        });
      });

      it('should click an element by selector', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'click',
          parameters: { selector: 'a' },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
      });

      it('should handle click with options', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'click',
          parameters: {
            selector: 'a',
            button: 'right',
            clickCount: 2,
            delay: 100,
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
      });

      it('should fail when element not found', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'click',
          parameters: { selector: '#non-existent-element' },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(false);
        expect(executeData.error).toContain('not found');
      });
    });

    describe('type', () => {
      it('should type text into an input field', async () => {
        // First navigate to a page with an input
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `
              document.body.innerHTML = '<input id="test-input" type="text" />';
            `,
          },
        });

        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'type',
          parameters: {
            selector: '#test-input',
            text: 'Hello, World!',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);

        // Verify the text was typed
        const verifyResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: 'document.querySelector("#test-input").value',
          },
        });

        const verifyData = JSON.parse(verifyResult.content[0].text);
        expect(verifyData.data).toBe('Hello, World!');
      });

      it('should type with delay between keystrokes', async () => {
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `document.body.innerHTML = '<input id="test-input" type="text" />';`,
          },
        });

        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'type',
          parameters: {
            selector: '#test-input',
            text: 'Slow typing',
            delay: 50,
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
      });
    });

    describe('select', () => {
      beforeEach(async () => {
        // Create a select element
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `
              document.body.innerHTML = \`
                <select id="test-select">
                  <option value="option1">Option 1</option>
                  <option value="option2">Option 2</option>
                  <option value="option3">Option 3</option>
                </select>
              \`;
            `,
          },
        });
      });

      it('should select an option by value', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'select',
          parameters: {
            selector: '#test-select',
            values: ['option2'],
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);

        // Verify selection
        const verifyResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: 'document.querySelector("#test-select").value',
          },
        });

        const verifyData = JSON.parse(verifyResult.content[0].text);
        expect(verifyData.data).toBe('option2');
      });

      it('should handle multiple selections', async () => {
        // Create multi-select
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `
              document.body.innerHTML = \`
                <select id="test-multi-select" multiple>
                  <option value="option1">Option 1</option>
                  <option value="option2">Option 2</option>
                  <option value="option3">Option 3</option>
                </select>
              \`;
            `,
          },
        });

        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'select',
          parameters: {
            selector: '#test-multi-select',
            values: ['option1', 'option3'],
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
      });
    });

    describe('upload', () => {
      it('should upload a file', async () => {
        // Create a file input
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `document.body.innerHTML = '<input id="file-input" type="file" />';`,
          },
        });

        // Create a temporary test file
        const testFilePath = path.join(process.cwd(), 'test-upload.txt');
        await fs.writeFile(testFilePath, 'Test file content');

        try {
          const result = await mcpClient.callTool('execute-in-context', {
            contextId: primaryContextId,
            command: 'upload',
            parameters: {
              selector: '#file-input',
              filePaths: [testFilePath],
            },
          });

          const executeData = JSON.parse(result.content[0].text);
          expect(executeData.success).toBe(true);

          // Verify file was uploaded
          const verifyResult = await mcpClient.callTool('execute-in-context', {
            contextId: primaryContextId,
            command: 'evaluate',
            parameters: {
              code: 'document.querySelector("#file-input").files.length',
            },
          });

          const verifyData = JSON.parse(verifyResult.content[0].text);
          expect(verifyData.data).toBe(1);
        } finally {
          // Clean up test file
          await fs.unlink(testFilePath).catch(() => {});
        }
      });

      it('should handle non-existent file', async () => {
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `document.body.innerHTML = '<input id="file-input" type="file" />';`,
          },
        });

        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'upload',
          parameters: {
            selector: '#file-input',
            filePaths: ['/non/existent/file.txt'],
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(false);
        expect(executeData.error).toBeDefined();
      });
    });

    describe('hover', () => {
      it('should hover over an element', async () => {
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `
              document.body.innerHTML = '<div id="hover-target" style="width: 100px; height: 100px; background: blue;">Hover me</div>';
              document.querySelector('#hover-target').addEventListener('mouseenter', function() {
                this.style.background = 'red';
              });
            `,
          },
        });

        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'hover',
          parameters: { selector: '#hover-target' },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);

        // Verify hover effect
        const verifyResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: 'getComputedStyle(document.querySelector("#hover-target")).backgroundColor',
          },
        });

        const verifyData = JSON.parse(verifyResult.content[0].text);
        expect(verifyData.data).toContain('255'); // Red color
      });
    });

    describe('focus and blur', () => {
      beforeEach(async () => {
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `
              document.body.innerHTML = '<input id="focus-input" type="text" />';
              window.focusEvents = [];
              const input = document.querySelector('#focus-input');
              input.addEventListener('focus', () => window.focusEvents.push('focus'));
              input.addEventListener('blur', () => window.focusEvents.push('blur'));
            `,
          },
        });
      });

      it('should focus an element', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'focus',
          parameters: { selector: '#focus-input' },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);

        // Verify focus event
        const verifyResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: 'window.focusEvents',
          },
        });

        const verifyData = JSON.parse(verifyResult.content[0].text);
        expect(verifyData.data).toContain('focus');
      });

      it('should blur an element', async () => {
        // First focus the element
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'focus',
          parameters: { selector: '#focus-input' },
        });

        // Then blur it
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'blur',
          parameters: { selector: '#focus-input' },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);

        // Verify blur event
        const verifyResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: 'window.focusEvents',
          },
        });

        const verifyData = JSON.parse(verifyResult.content[0].text);
        expect(verifyData.data).toContain('blur');
      });
    });
  });

  describe('Content Commands', () => {
    describe('evaluate', () => {
      it('should evaluate JavaScript code', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: '1 + 2 + 3',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toBe(6);
      });

      it('should evaluate complex expressions', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `
              const obj = { a: 1, b: 2, c: 3 };
              Object.values(obj).reduce((sum, val) => sum + val, 0)
            `,
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toBe(6);
      });

      it('should handle evaluation errors', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: 'throw new Error("Test error")',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(false);
        expect(executeData.error).toContain('Test error');
      });

      it('should pass arguments to evaluation', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: '(a, b) => a + b',
            args: [10, 20],
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toBe(30);
      });
    });

    describe('screenshot', () => {
      beforeEach(async () => {
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'navigate',
          parameters: { url: TestDataUrls.basicPage() },
        });
      });

      it('should take a screenshot', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'screenshot',
          parameters: {},
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toMatch(/^data:image\/png;base64,/);
      });

      it('should take a full page screenshot', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'screenshot',
          parameters: { fullPage: true },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toMatch(/^data:image\/png;base64,/);
      });

      it('should take a screenshot with custom quality', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'screenshot',
          parameters: {
            type: 'jpeg',
            quality: 50,
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toMatch(/^data:image\/jpeg;base64,/);
      });

      it('should take a screenshot of specific element', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'screenshot',
          parameters: {
            selector: 'h1',
            clip: { x: 0, y: 0, width: 200, height: 100 },
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toMatch(/^data:image\/png;base64,/);
      });
    });

    describe('pdf', () => {
      beforeEach(async () => {
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'navigate',
          parameters: { url: TestDataUrls.basicPage() },
        });
      });

      it('should generate a PDF', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'pdf',
          parameters: {},
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toMatch(/^data:application\/pdf;base64,/);
      });

      it('should generate PDF with custom format', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'pdf',
          parameters: {
            format: 'A4',
            landscape: true,
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toMatch(/^data:application\/pdf;base64,/);
      });

      it('should generate PDF with margins', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'pdf',
          parameters: {
            margin: {
              top: '1in',
              right: '1in',
              bottom: '1in',
              left: '1in',
            },
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toMatch(/^data:application\/pdf;base64,/);
      });
    });

    describe('content', () => {
      beforeEach(async () => {
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'navigate',
          parameters: { url: TestDataUrls.basicPage() },
        });
      });

      it('should get page content', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'content',
          parameters: {},
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toContain('<!DOCTYPE');
        expect(executeData.data).toContain('Example Domain');
      });

      it('should get specific element content', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'content',
          parameters: {
            selector: 'h1',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toContain('Example Domain');
      });
    });
  });

  describe('Utility Commands', () => {
    describe('wait', () => {
      it('should wait for a specific time', async () => {
        const startTime = Date.now();
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'wait',
          parameters: { duration: 1000 },
        });
        const endTime = Date.now();

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(endTime - startTime).toBeGreaterThanOrEqual(900); // Allow some margin
      });

      it('should wait for a selector', async () => {
        // Set up delayed element appearance
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `
              setTimeout(() => {
                const div = document.createElement('div');
                div.id = 'delayed-element';
                div.textContent = 'I appeared!';
                document.body.appendChild(div);
              }, 500);
            `,
          },
        });

        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'wait',
          parameters: {
            selector: '#delayed-element',
            timeout: 2000,
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
      });

      it('should timeout when element not found', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'wait',
          parameters: {
            selector: '#will-never-exist',
            timeout: 1000,
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(false);
        expect(executeData.error).toContain('timeout');
      });

      it('should wait for function', async () => {
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `
              window.testValue = false;
              setTimeout(() => { window.testValue = true; }, 500);
            `,
          },
        });

        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'wait',
          parameters: {
            function: 'window.testValue === true',
            timeout: 2000,
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
      });
    });

    describe('scroll', () => {
      beforeEach(async () => {
        // Create a scrollable page
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `
              document.body.style.height = '3000px';
              document.body.innerHTML = '<div id="bottom" style="position: absolute; bottom: 0;">Bottom element</div>';
            `,
          },
        });
      });

      it('should scroll to coordinates', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'scroll',
          parameters: {
            x: 0,
            y: 500,
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);

        // Verify scroll position
        const verifyResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: 'window.scrollY',
          },
        });

        const verifyData = JSON.parse(verifyResult.content[0].text);
        expect(verifyData.data).toBeGreaterThanOrEqual(500);
      });

      it('should scroll to element', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'scroll',
          parameters: {
            selector: '#bottom',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);

        // Verify element is in view
        const verifyResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `
              const elem = document.querySelector('#bottom');
              const rect = elem.getBoundingClientRect();
              rect.top >= 0 && rect.bottom <= window.innerHeight
            `,
          },
        });

        const verifyData = JSON.parse(verifyResult.content[0].text);
        expect(verifyData.data).toBe(true);
      });
    });

    describe('keyboard', () => {
      beforeEach(async () => {
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `
              document.body.innerHTML = '<input id="keyboard-input" type="text" />';
              window.keyEvents = [];
              const input = document.querySelector('#keyboard-input');
              input.addEventListener('keydown', (e) => window.keyEvents.push({ type: 'keydown', key: e.key }));
              input.addEventListener('keyup', (e) => window.keyEvents.push({ type: 'keyup', key: e.key }));
              input.focus();
            `,
          },
        });
      });

      it('should send keyboard keys', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'keyboard',
          parameters: {
            action: 'press',
            key: 'Enter',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);

        // Verify key events
        const verifyResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: 'window.keyEvents',
          },
        });

        const verifyData = JSON.parse(verifyResult.content[0].text);
        expect(verifyData.data).toContainEqual({ type: 'keydown', key: 'Enter' });
        expect(verifyData.data).toContainEqual({ type: 'keyup', key: 'Enter' });
      });

      it('should type text with keyboard', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'keyboard',
          parameters: {
            action: 'type',
            text: 'Hello',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);

        // Verify input value
        const verifyResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: 'document.querySelector("#keyboard-input").value',
          },
        });

        const verifyData = JSON.parse(verifyResult.content[0].text);
        expect(verifyData.data).toBe('Hello');
      });

      it('should handle keyboard shortcuts', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'keyboard',
          parameters: {
            action: 'down',
            key: 'Control',
          },
        });

        expect(JSON.parse(result.content[0].text).success).toBe(true);

        const result2 = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'keyboard',
          parameters: {
            action: 'press',
            key: 'a',
          },
        });

        expect(JSON.parse(result2.content[0].text).success).toBe(true);

        const result3 = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'keyboard',
          parameters: {
            action: 'up',
            key: 'Control',
          },
        });

        expect(JSON.parse(result3.content[0].text).success).toBe(true);
      });
    });

    describe('mouse', () => {
      beforeEach(async () => {
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: `
              document.body.innerHTML = '<div id="mouse-target" style="width: 100px; height: 100px; background: blue;">Mouse target</div>';
              window.mouseEvents = [];
              const target = document.querySelector('#mouse-target');
              ['mousedown', 'mouseup', 'mousemove', 'mouseenter', 'mouseleave'].forEach(event => {
                target.addEventListener(event, (e) => {
                  window.mouseEvents.push({ type: event, x: e.clientX, y: e.clientY });
                });
              });
            `,
          },
        });
      });

      it('should move mouse to coordinates', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'mouse',
          parameters: {
            action: 'move',
            x: 50,
            y: 50,
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
      });

      it('should click with mouse', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'mouse',
          parameters: {
            action: 'click',
            x: 50,
            y: 50,
            button: 'left',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);

        // Verify mouse events
        const verifyResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: {
            code: 'window.mouseEvents.map(e => e.type)',
          },
        });

        const verifyData = JSON.parse(verifyResult.content[0].text);
        expect(verifyData.data).toContain('mousedown');
        expect(verifyData.data).toContain('mouseup');
      });

      it('should perform mouse down and up separately', async () => {
        const downResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'mouse',
          parameters: {
            action: 'down',
            button: 'left',
          },
        });

        expect(JSON.parse(downResult.content[0].text).success).toBe(true);

        const upResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'mouse',
          parameters: {
            action: 'up',
            button: 'left',
          },
        });

        expect(JSON.parse(upResult.content[0].text).success).toBe(true);
      });

      it('should handle mouse wheel', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'mouse',
          parameters: {
            action: 'wheel',
            deltaX: 0,
            deltaY: 100,
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
      });
    });

    describe('cookie', () => {
      beforeEach(async () => {
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'navigate',
          parameters: { url: TestDataUrls.basicPage() },
        });
      });

      it('should set a cookie', async () => {
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'cookie',
          parameters: {
            action: 'set',
            name: 'test-cookie',
            value: 'test-value',
            domain: 'example.com',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
      });

      it('should get cookies', async () => {
        // First set a cookie
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'cookie',
          parameters: {
            action: 'set',
            name: 'test-cookie',
            value: 'test-value',
            domain: 'example.com',
          },
        });

        // Then get all cookies
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'cookie',
          parameters: {
            action: 'get',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toContainEqual(
          expect.objectContaining({
            name: 'test-cookie',
            value: 'test-value',
          }),
        );
      });

      it('should get specific cookie', async () => {
        // First set a cookie
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'cookie',
          parameters: {
            action: 'set',
            name: 'specific-cookie',
            value: 'specific-value',
            domain: 'example.com',
          },
        });

        // Get specific cookie
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'cookie',
          parameters: {
            action: 'get',
            name: 'specific-cookie',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toMatchObject({
          name: 'specific-cookie',
          value: 'specific-value',
        });
      });

      it('should delete a cookie', async () => {
        // First set a cookie
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'cookie',
          parameters: {
            action: 'set',
            name: 'delete-me',
            value: 'temp-value',
            domain: 'example.com',
          },
        });

        // Delete the cookie
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'cookie',
          parameters: {
            action: 'delete',
            name: 'delete-me',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);

        // Verify cookie is deleted
        const verifyResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'cookie',
          parameters: {
            action: 'get',
            name: 'delete-me',
          },
        });

        const verifyData = JSON.parse(verifyResult.content[0].text);
        expect(verifyData.data).toBeNull();
      });

      it('should clear all cookies', async () => {
        // Set multiple cookies
        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'cookie',
          parameters: {
            action: 'set',
            name: 'cookie1',
            value: 'value1',
            domain: 'example.com',
          },
        });

        await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'cookie',
          parameters: {
            action: 'set',
            name: 'cookie2',
            value: 'value2',
            domain: 'example.com',
          },
        });

        // Clear all cookies
        const result = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'cookie',
          parameters: {
            action: 'clear',
          },
        });

        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);

        // Verify all cookies are cleared
        const verifyResult = await mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'cookie',
          parameters: {
            action: 'get',
          },
        });

        const verifyData = JSON.parse(verifyResult.content[0].text);
        expect(verifyData.data).toHaveLength(0);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle command on closed context gracefully', async () => {
      // Create a new context
      const contextResult = await mcpClient.callTool('create-browser-context', {
        sessionId: primarySessionId,
      });
      const tempContextId = JSON.parse(contextResult.content[0].text).contextId;

      // Close the context
      await mcpClient.callTool('close-browser-context', {
        contextId: tempContextId,
        sessionId: primarySessionId,
      });

      // Try to execute command on closed context
      const result = await mcpClient.callTool('execute-in-context', {
        contextId: tempContextId,
        command: 'navigate',
        parameters: { url: TestDataUrls.basicPage() },
      });

      const executeData = JSON.parse(result.content[0].text);
      expect(executeData.success).toBe(false);
      expect(executeData.error).toBeDefined();
    });

    it('should handle invalid command gracefully', async () => {
      const result = await mcpClient.callTool('execute-in-context', {
        contextId: primaryContextId,
        command: 'invalid-command',
        parameters: {},
      });

      const executeData = JSON.parse(result.content[0].text);
      expect(executeData.success).toBe(false);
      expect(executeData.error).toContain('Unknown command');
    });

    it('should handle missing required parameters', async () => {
      const result = await mcpClient.callTool('execute-in-context', {
        contextId: primaryContextId,
        command: 'navigate',
        parameters: {}, // Missing 'url' parameter
      });

      const executeData = JSON.parse(result.content[0].text);
      expect(executeData.success).toBe(false);
      expect(executeData.error).toBeDefined();
    });

    it('should handle concurrent commands on same context', async () => {
      const promises = [
        mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: { code: '1 + 1' },
        }),
        mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: { code: '2 + 2' },
        }),
        mcpClient.callTool('execute-in-context', {
          contextId: primaryContextId,
          command: 'evaluate',
          parameters: { code: '3 + 3' },
        }),
      ];

      const results = await Promise.all(promises);

      // All commands should succeed
      results.forEach((result) => {
        const executeData = JSON.parse(result.content[0].text);
        expect(executeData.success).toBe(true);
        expect(executeData.data).toBeGreaterThan(0);
      });
    });
  });
});
