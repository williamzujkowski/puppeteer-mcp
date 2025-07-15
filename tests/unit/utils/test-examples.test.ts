/**
 * Example test file demonstrating testing best practices
 * @module tests/unit/utils/test-examples
 */

import { jest } from '@jest/globals';
import {
  createMockRequest,
  createMockResponse,
  createTestToken,
  delay,
  measureTime,
  expectRejection,
} from '../../utils/test-helpers.js';

describe('Testing Best Practices Examples', () => {
  describe('Async Operations', () => {
    it('should handle async operations correctly', async () => {
      const asyncOperation = async (): Promise<string> => {
        await delay(10);
        return 'result';
      };

      const result = await asyncOperation();
      expect(result).toBe('result');
    });

    it('should measure execution time', async () => {
      const slowFunction = async (): Promise<number> => {
        await delay(50);
        return 42;
      };

      const { result, duration } = await measureTime(slowFunction);

      expect(result).toBe(42);
      expect(duration).toBeGreaterThan(40);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should test promise rejections', async () => {
      const failingOperation = (): Promise<void> => {
        return Promise.reject(new Error('Operation failed'));
      };

      await expectRejection(failingOperation(), {
        message: 'Operation failed',
      });
    });

    it('should handle errors with custom properties', async () => {
      const operationWithCustomError = (): Promise<void> => {
        const error = new Error('Validation failed') as Error & {
          code: string;
          statusCode: number;
        };
        error.code = 'VALIDATION_ERROR';
        error.statusCode = 400;
        return Promise.reject(error);
      };

      await expectRejection(operationWithCustomError(), {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      });
    });
  });

  describe('Mock Testing', () => {
    it('should use mock request and response', () => {
      createMockRequest({
        body: { username: 'testuser' },
        headers: { 'content-type': 'application/json' },
        params: { id: '123' },
      });

      const res = createMockResponse();

      // Simulate handler logic
      const statusResult = res.status(200);
      statusResult.json({ success: true });

      // Test that methods were called correctly
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should test JWT token creation', () => {
      const token = createTestToken({
        userId: 'custom-id',
        roles: ['admin'],
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('Custom Matchers', () => {
    it('should use custom matchers', () => {
      const value = 50;
      expect(value).toBeWithinRange(40, 60);

      const randomValue = Math.floor(Math.random() * 10) + 45;
      expect(randomValue).toBeWithinRange(45, 55);
    });

    it('should test mock calls with partial matching', () => {
      const mockFunction = jest.fn();

      mockFunction({ id: 1, name: 'Test', extra: 'data' });
      mockFunction({ id: 2, name: 'Another', extra: 'info' });

      expect(mockFunction).toHaveBeenCalledWithMatch({ name: 'Test' });
      expect(mockFunction).toHaveBeenCalledWithMatch({ id: 2 });
    });
  });

  describe('Parameterized Tests', () => {
    const testCases = [
      { input: 0, expected: 'zero' },
      { input: 1, expected: 'positive' },
      { input: -1, expected: 'negative' },
    ];

    test.each(testCases)('should classify $input as $expected', ({ input, expected }) => {
      const classify = (n: number): string => {
        if (n === 0) {
          return 'zero';
        }
        return n > 0 ? 'positive' : 'negative';
      };

      expect(classify(input)).toBe(expected);
    });
  });

  describe('Spy and Mock Functions', () => {
    it('should spy on console methods', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const logMessage = (msg: string): void => {
        console.log(`Message: ${msg}`);
      };

      logMessage('test');

      expect(consoleSpy).toHaveBeenCalledWith('Message: test');

      consoleSpy.mockRestore();
    });

    it('should mock module dependencies', async () => {
      const mockModule = {
        getData: jest.fn().mockResolvedValue({ id: 1, value: 'test' }),
        saveData: jest.fn().mockResolvedValue(true),
      };

      // Example of using mocked module
      const useModule = async (): Promise<boolean> => {
        const data = await mockModule.getData();
        return mockModule.saveData(data);
      };

      await expect(useModule()).resolves.toBe(true);
      expect(mockModule.getData).toHaveBeenCalled();
    });
  });

  describe('Snapshot Testing', () => {
    it('should match object snapshot', () => {
      const config = {
        name: 'test-app',
        version: '1.0.0',
        settings: {
          timeout: 5000,
          retries: 3,
          features: ['feature1', 'feature2'],
        },
      };

      expect(config).toMatchInlineSnapshot(`
        {
          "name": "test-app",
          "settings": {
            "features": [
              "feature1",
              "feature2",
            ],
            "retries": 3,
            "timeout": 5000,
          },
          "version": "1.0.0",
        }
      `);
    });
  });

  describe('Performance Testing', () => {
    it('should complete within performance budget', async () => {
      const performanceTest = async (): Promise<void> => {
        const operations = Array(100)
          .fill(null)
          .map((_, i) => Promise.resolve(i * 2));

        const start = performance.now();
        await Promise.all(operations);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(50); // Should complete within 50ms
      };

      await performanceTest();
    });
  });
});
