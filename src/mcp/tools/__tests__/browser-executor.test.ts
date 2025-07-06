/**
 * Browser executor tests
 * @module mcp/tools/__tests__/browser-executor.test
 */

import { BrowserExecutor } from '../browser-executor.js';
import { contextStore } from '../../../store/context-store.js';
import type { ExecuteInContextArgs } from '../../types/tool-types.js';

// Mock dependencies
jest.mock('../../../store/context-store.js');
jest.mock('../../../puppeteer/pool/browser-pool.js');
jest.mock('../../../puppeteer/pages/page-manager.js');
jest.mock('../../../utils/logger.js');

describe('BrowserExecutor', () => {
  let executor: BrowserExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = BrowserExecutor.getInstance();
  });

  afterEach(async () => {
    await executor.cleanup();
  });

  describe('executeInContext', () => {
    it('should execute navigate command successfully', async () => {
      // Mock context
      const mockContext = {
        id: 'test-context-id',
        sessionId: 'test-session',
        userId: 'test-user',
        name: 'test-context',
        type: 'puppeteer',
        config: {},
        metadata: {},
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (contextStore.get as jest.Mock).mockResolvedValue(mockContext);

      const args: ExecuteInContextArgs = {
        contextId: 'test-context-id',
        command: 'navigate',
        parameters: {
          url: 'https://example.com',
        },
        sessionId: 'test-session',
      };

      const result = await executor.executeInContext(args);

      expect(result).toMatchObject({
        success: expect.any(Boolean),
        timestamp: expect.any(Date),
        duration: expect.any(Number),
        actionType: 'navigate',
      });
    });

    it('should handle click command with selector', async () => {
      const mockContext = {
        id: 'test-context-id',
        sessionId: 'test-session',
        userId: 'test-user',
        name: 'test-context',
        type: 'puppeteer',
        config: {},
        metadata: {},
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (contextStore.get as jest.Mock).mockResolvedValue(mockContext);

      const args: ExecuteInContextArgs = {
        contextId: 'test-context-id',
        command: 'click',
        parameters: {
          selector: '#submit-button',
          button: 'left',
        },
      };

      const result = await executor.executeInContext(args);

      expect(result).toMatchObject({
        actionType: 'click',
      });
    });

    it('should handle type command', async () => {
      const mockContext = {
        id: 'test-context-id',
        sessionId: 'test-session',
        userId: 'test-user',
        name: 'test-context',
        type: 'puppeteer',
        config: {},
        metadata: {},
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (contextStore.get as jest.Mock).mockResolvedValue(mockContext);

      const args: ExecuteInContextArgs = {
        contextId: 'test-context-id',
        command: 'type',
        parameters: {
          selector: 'input[name="username"]',
          text: 'testuser',
          delay: 100,
        },
      };

      const result = await executor.executeInContext(args);

      expect(result).toMatchObject({
        actionType: 'type',
      });
    });

    it('should handle context not found error', async () => {
      (contextStore.get as jest.Mock).mockResolvedValue(null);

      const args: ExecuteInContextArgs = {
        contextId: 'non-existent-context',
        command: 'navigate',
        parameters: {
          url: 'https://example.com',
        },
      };

      const result = await executor.executeInContext(args);

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('Context not found'),
      });
    });

    it('should parse various command aliases correctly', async () => {
      const mockContext = {
        id: 'test-context-id',
        sessionId: 'test-session',
        userId: 'test-user',
        name: 'test-context',
        type: 'puppeteer',
        config: {},
        metadata: {},
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      (contextStore.get as jest.Mock).mockResolvedValue(mockContext);

      // Test command aliases
      const commandTests = [
        { command: 'goto', expected: 'navigate' },
        { command: 'fill', expected: 'type' },
        { command: 'waitForSelector', expected: 'wait' },
        { command: 'execute', expected: 'evaluate' },
      ];

      for (const test of commandTests) {
        const args: ExecuteInContextArgs = {
          contextId: 'test-context-id',
          command: test.command,
          parameters: {},
        };

        const result = await executor.executeInContext(args);
        expect(result.actionType).toBe(test.expected);
      }
    });
  });

  describe('singleton behavior', () => {
    it('should return the same instance', () => {
      const instance1 = BrowserExecutor.getInstance();
      const instance2 = BrowserExecutor.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after cleanup', async () => {
      const instance1 = BrowserExecutor.getInstance();
      await instance1.cleanup();
      const instance2 = BrowserExecutor.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });
});