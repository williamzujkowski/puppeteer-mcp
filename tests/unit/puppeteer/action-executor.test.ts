/**
 * Tests for Action Executor
 * @module tests/unit/puppeteer/action-executor
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { Page } from 'puppeteer';
import { BrowserActionExecutor } from '../../../src/puppeteer/actions/action-executor.js';
import type {
  ActionContext,
  NavigateAction,
  BrowserAction,
} from '../../../src/puppeteer/interfaces/action-executor.interface.js';

// Mock logger
jest.mock('../../../src/utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  logSecurityEvent: jest.fn(),
  SecurityEventType: {
    COMMAND_EXECUTED: 'COMMAND_EXECUTED',
    VALIDATION_FAILURE: 'VALIDATION_FAILURE',
    ERROR: 'ERROR',
  },
}));

// Mock validation
jest.mock('../../../src/puppeteer/actions/validation.js', () => ({
  validateAction: jest.fn(),
  validateActionBatch: jest.fn(),
}));

// Mock handlers
jest.mock('../../../src/puppeteer/actions/handlers/navigation.js', () => ({
  handleNavigate: jest.fn(),
}));

jest.mock('../../../src/puppeteer/actions/handlers/interaction.js', () => ({
  handleClick: jest.fn(),
  handleType: jest.fn(),
}));

jest.mock('../../../src/puppeteer/actions/handlers/content.js', () => ({
  handleScreenshot: jest.fn(),
}));

describe('BrowserActionExecutor', () => {
  let executor: BrowserActionExecutor;
  let mockPage: Partial<Page>;
  let context: ActionContext;

  beforeEach(() => {
    executor = new BrowserActionExecutor();

    mockPage = {
      url: jest.fn().mockReturnValue('https://example.com'),
      goto: jest.fn(),
      click: jest.fn(),
      type: jest.fn(),
      screenshot: jest.fn(),
    };

    context = {
      sessionId: 'test-session-123',
      contextId: 'test-context-456',
      userId: 'test-user-789',
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default handlers', () => {
      const supportedActions = executor.getSupportedActions();

      expect(supportedActions).toContain('navigate');
      expect(supportedActions).toContain('click');
      expect(supportedActions).toContain('type');
      expect(supportedActions).toContain('screenshot');
      expect(supportedActions.length).toBeGreaterThan(0);
    });
  });

  describe('isActionSupported', () => {
    it('should return true for supported actions', () => {
      expect(executor.isActionSupported('navigate')).toBe(true);
      expect(executor.isActionSupported('click')).toBe(true);
      expect(executor.isActionSupported('type')).toBe(true);
    });

    it('should return false for unsupported actions', () => {
      expect(executor.isActionSupported('unsupported-action')).toBe(false);
      expect(executor.isActionSupported('')).toBe(false);
    });
  });

  describe('registerHandler and unregisterHandler', () => {
    it('should register custom handler', () => {
      const customHandler = jest.fn();

      executor.registerHandler('custom-action', customHandler);

      expect(executor.isActionSupported('custom-action')).toBe(true);
      expect(executor.getSupportedActions()).toContain('custom-action');
    });

    it('should unregister handler', () => {
      const customHandler = jest.fn();

      executor.registerHandler('custom-action', customHandler);
      expect(executor.isActionSupported('custom-action')).toBe(true);

      executor.unregisterHandler('custom-action');
      expect(executor.isActionSupported('custom-action')).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate supported actions', async () => {
      const { validateAction } = await import('../../../src/puppeteer/actions/validation.js');
      (validateAction as jest.jest.MockedFunction<typeof validateAction>).mockReturnValue({
        valid: true,
        errors: [],
      });

      const action: NavigateAction = {
        type: 'navigate',
        pageId: 'test-page-123',
        url: 'https://example.com',
      };

      const result = await executor.validate(action, context);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(validateAction).toHaveBeenCalledWith(action);
    });

    it('should return error for unsupported actions', async () => {
      const action = {
        type: 'unsupported-action',
        pageId: 'test-page-123',
      } as BrowserAction;

      const result = await executor.validate(action, context);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Unsupported action type');
    });

    it('should handle validation errors', async () => {
      const { validateAction } = await import('../../../src/puppeteer/actions/validation.js');
      (validateAction as jest.jest.MockedFunction<typeof validateAction>).mockReturnValue({
        valid: false,
        errors: [{ field: 'url', message: 'Invalid URL format', code: 'INVALID_URL' }],
      });

      const action: NavigateAction = {
        type: 'navigate',
        pageId: 'test-page-123',
        url: 'invalid-url',
      };

      const result = await executor.validate(action, context);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Invalid URL format');
    });
  });

  describe('validateBatch', () => {
    it('should validate multiple actions', async () => {
      const { validateAction } = await import('../../../src/puppeteer/actions/validation.js');
      (validateAction as jest.jest.MockedFunction<typeof validateAction>).mockReturnValue({
        valid: true,
        errors: [],
      });

      const actions: BrowserAction[] = [
        {
          type: 'navigate',
          pageId: 'test-page-123',
          url: 'https://example.com',
        },
        {
          type: 'click',
          pageId: 'test-page-123',
          selector: '#submit-button',
        },
      ];

      const results = await executor.validateBatch(actions, context);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.valid)).toBe(true);
      expect(validateAction).toHaveBeenCalledTimes(2);
    });

    it('should handle batch validation errors', async () => {
      const { validateAction } = await import('../../../src/puppeteer/actions/validation.js');
      (validateAction as jest.jest.MockedFunction<typeof validateAction>).mockReturnValue({
        valid: false,
        errors: [{ message: 'Invalid URL format', field: 'url', code: 'INVALID_URL' }],
      });

      const actions: BrowserAction[] = [
        {
          type: 'navigate',
          pageId: 'test-page-123',
          url: 'https://example.com',
        },
      ];

      const results = await executor.validateBatch(actions, context);

      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors[0].message).toBe('Invalid URL format');
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      // Mock the private getPageInstance method
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!(executor as unknown as { getPageInstance?: unknown }).getPageInstance) {
        (executor as any).getPageInstance = jest.fn().mockResolvedValue(mockPage);
      } else {
        jest.spyOn(executor as any, 'getPageInstance').mockResolvedValue(mockPage);
      }
    });

    it('should execute valid action successfully', async () => {
      const { validateAction } = await import('../../../src/puppeteer/actions/validation.js');
      const { handleNavigate } = await import(
        '../../../src/puppeteer/actions/handlers/navigation.js'
      );

      (validateAction as jest.MockedFunction<typeof validateAction>).mockReturnValue({
        valid: true,
        errors: [],
      });

      (handleNavigate as jest.MockedFunction<typeof handleNavigate>).mockResolvedValue({
        success: true,
        actionType: 'navigate',
        data: { url: 'https://example.com' },
        duration: 100,
        timestamp: new Date(),
      });

      const action: NavigateAction = {
        type: 'navigate',
        pageId: 'test-page-123',
        url: 'https://example.com',
      };

      const result = await executor.execute(action, context);

      expect(result.success).toBe(true);
      expect(result.actionType).toBe('navigate');
      expect(handleNavigate).toHaveBeenCalledWith(action, mockPage, context);
    });

    it('should fail execution for invalid action', async () => {
      const { validateAction } = await import('../../../src/puppeteer/actions/validation.js');

      (validateAction as jest.MockedFunction<typeof validateAction>).mockReturnValue({
        valid: false,
        errors: [{ field: 'url', message: 'Invalid URL', code: 'INVALID_URL' }],
      });

      const action: NavigateAction = {
        type: 'navigate',
        pageId: 'test-page-123',
        url: 'invalid-url',
      };

      const result = await executor.execute(action, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should handle page not found error', async () => {
      const { validateAction } = await import('../../../src/puppeteer/actions/validation.js');

      (validateAction as jest.MockedFunction<typeof validateAction>).mockReturnValue({
        valid: true,
        errors: [],
      });

      // Mock getPageInstance to return null
      jest.spyOn(executor as any, 'getPageInstance').mockResolvedValue(null);

      const action: NavigateAction = {
        type: 'navigate',
        pageId: 'non-existent-page',
        url: 'https://example.com',
      };

      const result = await executor.execute(action, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Page not found');
    });

    it('should handle handler execution errors', async () => {
      const { validateAction } = await import('../../../src/puppeteer/actions/validation.js');
      const { handleNavigate } = await import(
        '../../../src/puppeteer/actions/handlers/navigation.js'
      );

      (validateAction as jest.MockedFunction<typeof validateAction>).mockReturnValue({
        valid: true,
        errors: [],
      });

      (handleNavigate as jest.MockedFunction<typeof handleNavigate>).mockRejectedValue(
        new Error('Navigation failed'),
      );

      const action: NavigateAction = {
        type: 'navigate',
        pageId: 'test-page-123',
        url: 'https://example.com',
      };

      const result = await executor.execute(action, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Navigation failed');
    });
  });

  describe('executeBatch', () => {
    beforeEach(() => {
      // Mock the private getPageInstance method
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!(executor as unknown as { getPageInstance?: unknown }).getPageInstance) {
        (executor as any).getPageInstance = jest.fn().mockResolvedValue(mockPage);
      } else {
        jest.spyOn(executor as any, 'getPageInstance').mockResolvedValue(mockPage);
      }
    });

    it('should execute multiple actions sequentially', async () => {
      const { validateActionBatch } = await import('../../../src/puppeteer/actions/validation.js');
      const { handleNavigate } = await import(
        '../../../src/puppeteer/actions/handlers/navigation.js'
      );
      const { handleClick } = await import(
        '../../../src/puppeteer/actions/handlers/interaction.js'
      );

      (validateActionBatch as jest.MockedFunction<typeof validateActionBatch>).mockReturnValue([
        { valid: true, errors: [] },
        { valid: true, errors: [] },
      ]);

      (handleNavigate as jest.MockedFunction<typeof handleNavigate>).mockResolvedValue({
        success: true,
        actionType: 'navigate',
        data: {},
        duration: 100,
        timestamp: new Date(),
      });

      (handleClick as jest.MockedFunction<typeof handleClick>).mockResolvedValue({
        success: true,
        actionType: 'click',
        data: {},
        duration: 50,
        timestamp: new Date(),
      });

      const actions: BrowserAction[] = [
        {
          type: 'navigate',
          pageId: 'test-page-123',
          url: 'https://example.com',
        },
        {
          type: 'click',
          pageId: 'test-page-123',
          selector: '#submit-button',
        },
      ];

      const results = await executor.executeBatch(actions, context);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should stop on error when stopOnError is true', async () => {
      // Mock the validateActionBatch function
      const { validateActionBatch } = await import('../../../src/puppeteer/actions/validation.js');
      (validateActionBatch as jest.MockedFunction<typeof validateActionBatch>).mockReturnValue([
        { valid: true, errors: [] },
        { valid: true, errors: [] },
      ]);

      // Mock execute method to return specific results
      const executeSpy = jest
        .spyOn(executor, 'execute')
        .mockResolvedValueOnce({
          success: false,
          actionType: 'navigate',
          error: 'Navigation failed',
          duration: 100,
          timestamp: new Date(),
        })
        .mockResolvedValueOnce({
          success: true,
          actionType: 'navigate',
          data: {},
          duration: 100,
          timestamp: new Date(),
        });

      const actions: BrowserAction[] = [
        {
          type: 'navigate',
          pageId: 'test-page-123',
          url: 'https://invalid-url',
        },
        {
          type: 'navigate',
          pageId: 'test-page-123',
          url: 'https://example.com',
        },
      ];

      const results = await executor.executeBatch(actions, context, {
        stopOnError: true,
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(executeSpy).toHaveBeenCalledTimes(1); // Should stop after first error

      executeSpy.mockRestore();
    });

    it('should execute actions in parallel when parallel is true', async () => {
      const { validateActionBatch } = await import('../../../src/puppeteer/actions/validation.js');
      const { handleClick } = await import(
        '../../../src/puppeteer/actions/handlers/interaction.js'
      );

      (validateActionBatch as jest.MockedFunction<typeof validateActionBatch>).mockReturnValue([
        { valid: true, errors: [] },
        { valid: true, errors: [] },
      ]);

      (handleClick as jest.MockedFunction<typeof handleClick>).mockResolvedValue({
        success: true,
        actionType: 'click',
        data: {},
        duration: 50,
        timestamp: new Date(),
      });

      const actions: BrowserAction[] = [
        {
          type: 'click',
          pageId: 'test-page-123',
          selector: '#button1',
        },
        {
          type: 'click',
          pageId: 'test-page-123',
          selector: '#button2',
        },
      ];

      const startTime = Date.now();
      const results = await executor.executeBatch(actions, context, {
        parallel: true,
        maxConcurrency: 2,
      });
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(200);
    });

    it('should reject too many actions', async () => {
      const actions = Array(101).fill({
        type: 'click',
        pageId: 'test-page-123',
        selector: '#button',
      });

      await expect(executor.executeBatch(actions, context)).rejects.toThrow(
        'Too many actions in batch',
      );
    });
  });

  describe('getHistory', () => {
    beforeEach(() => {
      // Mock the private getPageInstance method
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!(executor as unknown as { getPageInstance?: unknown }).getPageInstance) {
        (executor as any).getPageInstance = jest.fn().mockResolvedValue(mockPage);
      } else {
        jest.spyOn(executor as any, 'getPageInstance').mockResolvedValue(mockPage);
      }
    });

    it('should return empty history for new context', async () => {
      const history = await executor.getHistory(context);
      expect(history).toHaveLength(0);
    });

    it('should return action history with filtering', async () => {
      // Execute some actions to populate history
      const { validateAction } = await import('../../../src/puppeteer/actions/validation.js');
      const { handleNavigate } = await import(
        '../../../src/puppeteer/actions/handlers/navigation.js'
      );

      (validateAction as jest.MockedFunction<typeof validateAction>).mockReturnValue({
        valid: true,
        errors: [],
      });

      (handleNavigate as jest.MockedFunction<typeof handleNavigate>).mockResolvedValue({
        success: true,
        actionType: 'navigate',
        data: {},
        duration: 100,
        timestamp: new Date(),
      });

      const action: NavigateAction = {
        type: 'navigate',
        pageId: 'test-page-123',
        url: 'https://example.com',
      };

      await executor.execute(action, context);

      const history = await executor.getHistory(context, {
        actionTypes: ['navigate'],
        limit: 10,
      });

      expect(history).toHaveLength(1);
      expect(history[0].actionType).toBe('navigate');
    });
  });

  describe('getMetrics', () => {
    it('should return empty metrics for new context', async () => {
      const metrics = await executor.getMetrics(context);

      expect(metrics.totalActions).toBe(0);
      expect(metrics.successfulActions).toBe(0);
      expect(metrics.failedActions).toBe(0);
      expect(metrics.averageDuration).toBe(0);
      expect(Object.keys(metrics.actionTypeBreakdown)).toHaveLength(0);
    });
  });

  describe('clearHistory', () => {
    beforeEach(() => {
      // Mock the private getPageInstance method
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (!(executor as unknown as { getPageInstance?: unknown }).getPageInstance) {
        (executor as any).getPageInstance = jest.fn().mockResolvedValue(mockPage);
      } else {
        jest.spyOn(executor as any, 'getPageInstance').mockResolvedValue(mockPage);
      }
    });

    it('should clear all history when no date provided', async () => {
      // Execute an action to populate history
      const { validateAction } = await import('../../../src/puppeteer/actions/validation.js');
      const { handleNavigate } = await import(
        '../../../src/puppeteer/actions/handlers/navigation.js'
      );

      (validateAction as jest.MockedFunction<typeof validateAction>).mockReturnValue({
        valid: true,
        errors: [],
      });

      (handleNavigate as jest.MockedFunction<typeof handleNavigate>).mockResolvedValue({
        success: true,
        actionType: 'navigate',
        data: {},
        duration: 100,
        timestamp: new Date(),
      });

      const action: NavigateAction = {
        type: 'navigate',
        pageId: 'test-page-123',
        url: 'https://example.com',
      };

      await executor.execute(action, context);

      let history = await executor.getHistory(context);
      expect(history).toHaveLength(1);

      await executor.clearHistory(context);

      history = await executor.getHistory(context);
      expect(history).toHaveLength(0);
    });
  });
});
