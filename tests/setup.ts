// Global test setup for all tests
import { jest } from '@jest/globals';
import { mkdirSync } from 'fs';
import { cleanupLoggers } from '../src/utils/logger.js';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Changed from 'silent' to match schema validation

// Define __dirname for ES modules compatibility in Jest
// Since this is the setup file, we can use process.cwd() as a base
// The actual __dirname will be defined within each module using the conditional check
(global as unknown as { __dirname: string }).__dirname = process.cwd();

// Ensure logs directory exists for tests
try {
  mkdirSync('logs/audit', { recursive: true });
} catch {
  // Directory might already exist, ignore error
}

// Mock timers for consistent testing
beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Global test utilities
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveBeenCalledWithMatch(expected: unknown): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHaveBeenCalledWithMatch(received: jest.Mock, expected: unknown) {
    const calls = received.mock.calls;
    const pass = calls.some((call) => {
      const arg = call[0];
      // Check if all properties in expected exist in the argument
      const expectedObj = expected as Record<string, unknown>;
      for (const key in expectedObj) {
        if (Object.prototype.hasOwnProperty.call(expectedObj, key)) {
          const argObj = arg as Record<string, unknown>;
          if (
            argObj !== null &&
            typeof argObj === 'object' &&
            Object.prototype.hasOwnProperty.call(argObj, key) &&
            Object.prototype.hasOwnProperty.call(expectedObj, key)
          ) {
            const expectedValue = Object.prototype.hasOwnProperty.call(expectedObj, key)
              ? expectedObj[key] // eslint-disable-line security/detect-object-injection
              : undefined;

            const argValue = Object.prototype.hasOwnProperty.call(argObj, key)
              ? argObj[key] // eslint-disable-line security/detect-object-injection
              : undefined;
            if (expectedValue !== argValue) {
              return false;
            }
          }
        }
      }
      return true;
    });

    if (pass) {
      return {
        message: () =>
          `expected mock not to have been called with match ${JSON.stringify(expected)}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected mock to have been called with match ${JSON.stringify(expected)}`,
        pass: false,
      };
    }
  },
});

// Timeout for async operations
jest.setTimeout(5000);

// Suppress console during tests unless explicitly needed
const originalConsole = {
  log: console.log, // eslint-disable-line no-console
  info: console.info, // eslint-disable-line no-console
  warn: console.warn,
  error: console.error,
};

beforeAll(() => {
  // eslint-disable-next-line no-console
  console.log = jest.fn();
  // eslint-disable-next-line no-console
  console.info = jest.fn();

  console.warn = jest.fn();

  console.error = jest.fn();
});

afterAll(async () => {
  // eslint-disable-next-line no-console
  console.log = originalConsole.log;
  // eslint-disable-next-line no-console
  console.info = originalConsole.info;

  console.warn = originalConsole.warn;

  console.error = originalConsole.error;

  // Clean up all session store instances
  const { InMemorySessionStore } = await import('../src/store/in-memory-session-store.js');
  await InMemorySessionStore.cleanupAll();

  // Clean up loggers
  await cleanupLoggers();
});
