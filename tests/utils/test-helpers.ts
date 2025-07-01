/**
 * Test utilities and helpers
 * @module tests/utils/test-helpers
 */

import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { SessionData } from '../../src/types/session.js';

/**
 * Creates a mock Express request object
 */
export function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    method: 'GET',
    url: '/',
    path: '/',
    get: jest.fn((header: string) => overrides.headers?.[header.toLowerCase()]),
    header: jest.fn((header: string) => overrides.headers?.[header.toLowerCase()]),
    ...overrides,
  } as unknown as Request;
}

/**
 * Creates a mock Express response object
 */
export function createMockResponse(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
}

/**
 * Creates a mock Express next function
 */
export function createMockNext(): NextFunction {
  return jest.fn() as unknown as NextFunction;
}

/**
 * Creates a test JWT token
 */
export function createTestToken(
  payload: Record<string, unknown> = {},
  secret: string = process.env.JWT_SECRET ?? 'test-secret',
  expiresIn: string = '1h',
): string {
  return jwt.sign(
    {
      sub: 'test-user-id',
      username: 'testuser',
      roles: ['user'],
      ...payload,
    },
    secret,
    { expiresIn },
  );
}

/**
 * Creates test session data
 */
export function createTestSessionData(overrides: Partial<SessionData> = {}): SessionData {
  return {
    userId: 'test-user-id',
    username: 'testuser',
    roles: ['user'],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    ...overrides,
  };
}

/**
 * Waits for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise<void>((resolve) => { setTimeout(resolve, interval); });
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Creates a delay promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => { setTimeout(resolve, ms); });
}

/**
 * Executes a function and returns its result along with execution time
 */
export async function measureTime<T>(
  fn: () => T | Promise<T>,
): Promise<{ result: T; duration: number }> {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1_000_000; // Convert to milliseconds

  return { result, duration };
}

/**
 * Creates a test error
 */
export function createTestError(
  message: string = 'Test error',
  code: string = 'TEST_ERROR',
  statusCode: number = 500,
): Error & { code?: string; statusCode?: number } {
  const error = new Error(message) as Error & { code?: string; statusCode?: number };
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

/**
 * Asserts that a promise rejects with specific error
 */
export async function expectRejection(
  promise: Promise<unknown>,
  expectedError?: { message?: string; code?: string; statusCode?: number },
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject');
  } catch (error: unknown) {
    if (expectedError && error instanceof Error) {
      const err = error as Error & { code?: string; statusCode?: number };
      if (expectedError.message !== undefined) {
        expect(err.message).toBe(expectedError.message);
      }
      if (expectedError.code !== undefined) {
        expect(err.code).toBe(expectedError.code);
      }
      if (expectedError.statusCode !== undefined) {
        expect(err.statusCode).toBe(expectedError.statusCode);
      }
    }
  }
}

/**
 * Mock logger for testing
 */
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
  child: jest.fn(() => mockLogger),
};
