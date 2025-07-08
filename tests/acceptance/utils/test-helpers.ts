/**
 * Common test helpers and utilities
 * @module tests/acceptance/utils/test-helpers
 */

import { TEST_CONFIG } from './test-config.js';
import axios, { AxiosResponse } from 'axios';

/**
 * Retry a function with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = TEST_CONFIG.retries,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
      });
    }
  }
  
  if (!lastError) {
    throw Object.assign(new Error('Retry operation failed without error'), { code: 'RETRY_FAILED' });
  }
  throw lastError;
}

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
  condition: () => Promise<boolean> | boolean,
  timeout: number = TEST_CONFIG.timeout,
  interval: number = 500
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, interval);
    });
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Make HTTP request with retry logic
 */
export async function makeRequest(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    data?: unknown;
    timeout?: number;
  } = {}
): Promise<AxiosResponse> {
  return retryOperation(async () => {
    return axios({
      url,
      method: options.method ?? 'GET',
      headers: {
        'User-Agent': 'puppeteer-mcp-acceptance-test/1.0.14',
        ...options.headers,
      },
      data: options.data,
      timeout: options.timeout ?? 10000,
      validateStatus: () => true, // Don't throw on HTTP error status
    });
  });
}

/**
 * Validate that a URL is accessible
 */
export async function validateUrl(url: string): Promise<boolean> {
  try {
    const response = await makeRequest(url, { method: 'GET' });
    return response.status >= 200 && response.status < 400;
  } catch (error) {
    console.warn(`URL validation failed for ${url}:`, error);
    return false;
  }
}

/**
 * Generate test data
 */
export const TestData = {
  randomString: (length: number = 10): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  },
  
  randomEmail: (): string => {
    return `test-${TestData.randomString(8)}@example.com`;
  },
  
  randomPhone: (): string => {
    return `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
  },
  
  futureDate: (daysFromNow: number = 30): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }
};

/**
 * Performance measurement utilities
 */
export class PerformanceTracker {
  private startTime: number;
  private checkpoints: Map<string, number> = new Map();
  
  constructor() {
    this.startTime = Date.now();
  }
  
  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now() - this.startTime);
  }
  
  getElapsed(): number {
    return Date.now() - this.startTime;
  }
  
  getCheckpoint(name: string): number | undefined {
    return this.checkpoints.get(name);
  }
  
  getAllCheckpoints(): Record<string, number> {
    return Object.fromEntries(this.checkpoints);
  }
  
  getReport(): string {
    const total = this.getElapsed();
    const checkpoints = this.getAllCheckpoints();
    
    let report = `Total time: ${total}ms\n`;
    for (const [name, time] of Object.entries(checkpoints)) {
      report += `${name}: ${time}ms\n`;
    }
    
    return report;
  }
}

/**
 * Screenshot helpers
 */
export const ScreenshotHelpers = {
  getTimestampedFilename: (prefix: string = 'screenshot'): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}-${timestamp}.png`;
  },
  
  getFailureScreenshotPath: (testName: string): string => {
    const sanitized = testName.replace(/[^a-zA-Z0-9-_]/g, '-');
    return `failure-${sanitized}-${Date.now()}.png`;
  }
};

/**
 * Assertion helpers
 */
export const AssertionHelpers = {
  containsText: (content: string, expectedText: string): void => {
    if (!content.includes(expectedText)) {
      throw new Error(`Expected content to contain "${expectedText}", but it didn't. Content: ${content.substring(0, 200)}...`);
    }
  },
  
  matchesPattern: (content: string, pattern: RegExp): void => {
    if (!pattern.test(content)) {
      throw new Error(`Expected content to match pattern ${pattern}, but it didn't. Content: ${content.substring(0, 200)}...`);
    }
  },
  
  isValidUrl: (url: string): void => {
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
  },
  
  isValidEmail: (email: string): void => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      throw new Error(`Invalid email format: ${email}`);
    }
  },
  
  responseCodeInRange: (code: number, min: number = 200, max: number = 299): void => {
    if (code < min || code > max) {
      throw new Error(`Expected response code to be between ${min} and ${max}, but got ${code}`);
    }
  }
};

/**
 * Environment helpers
 */
export const EnvironmentHelpers = {
  isCI: (): boolean => {
    return Boolean(process.env.CI);
  },
  
  getTestTimeout: (base: number = TEST_CONFIG.timeout): number => {
    // Increase timeout in CI environments
    return EnvironmentHelpers.isCI() ? base * 2 : base;
  },
  
  shouldSkipFlaky: (): boolean => {
    return EnvironmentHelpers.isCI() && process.env.SKIP_FLAKY_TESTS === 'true';
  }
};