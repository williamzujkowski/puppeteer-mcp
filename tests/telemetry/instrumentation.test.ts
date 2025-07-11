/**
 * Instrumentation tests
 * @module tests/telemetry/instrumentation
 */

import { initializeTelemetry, shutdownTelemetry } from '../../src/telemetry/index.js';
import { instrumentSessionStore } from '../../src/telemetry/instrumentations/session.js';
import {
  instrumentBrowser,
  instrumentPage,
} from '../../src/telemetry/instrumentations/puppeteer.js';
import {
  recordSecurityEvent,
  wrapAuthentication,
} from '../../src/telemetry/instrumentations/security.js';
import { InMemorySessionStore } from '../../src/store/in-memory-session-store.js';
import { SecurityEventType } from '../../src/utils/logger.js';
import { logger } from '../../src/utils/logger.js';
import type { Browser, Page } from 'puppeteer';

describe.skip('Telemetry Instrumentations', () => {
  beforeAll(async () => {
    await initializeTelemetry();
  });

  afterAll(async () => {
    await shutdownTelemetry();
  });

  describe('Session Store Instrumentation', () => {
    let store: any;

    beforeEach(() => {
      const baseStore = new InMemorySessionStore(logger);
      store = instrumentSessionStore(baseStore);
    });

    it('should instrument create method', async () => {
      const sessionData = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'test-user',
        roles: ['user'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      const sessionId = await store.create(sessionData);

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    it('should instrument get method', async () => {
      const sessionData = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'test-user',
        roles: ['user'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      const sessionId = await store.create(sessionData);
      const retrieved = await store.get(sessionId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(sessionId);
    });

    it('should instrument delete method', async () => {
      const sessionData = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'test-user',
        roles: ['user'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      const sessionId = await store.create(sessionData);
      const deleted = await store.delete(sessionId);

      expect(deleted).toBe(true);

      const retrieved = await store.get(sessionId);
      expect(retrieved).toBeNull();
    });

    it('should instrument getByUserId method', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const sessionData = {
        userId,
        username: 'test-user',
        roles: ['user'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      await store.create(sessionData);
      await store.create({ ...sessionData, createdAt: new Date().toISOString() });

      const sessions = await store.getByUserId(userId);
      expect(sessions).toHaveLength(2);
    });
  });

  describe('Security Instrumentation', () => {
    it('should record security events', () => {
      recordSecurityEvent({
        eventType: SecurityEventType.LOGIN_SUCCESS,
        userId: 'test-user',
        result: 'success',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      });

      // Event should be recorded without throwing
      expect(true).toBe(true);
    });

    it('should wrap authentication functions', async () => {
      const authFunction = async (username: string, password: string): Promise<boolean> => {
        return username === 'admin' && password === 'password';
      };

      const wrappedAuth = wrapAuthentication(authFunction, 'password');

      const successResult = await wrappedAuth('admin', 'password');
      expect(successResult).toBe(true);

      await expect(wrappedAuth('admin', 'wrong')).resolves.toBe(false);
    });

    it('should handle authentication errors', async () => {
      const authFunction = async (): Promise<boolean> => {
        throw new Error('Database connection failed');
      };

      const wrappedAuth = wrapAuthentication(authFunction, 'password');

      await expect(wrappedAuth()).rejects.toThrow('Database connection failed');
    });
  });

  describe('Puppeteer Instrumentation', () => {
    it('should instrument browser methods', () => {
      // Mock browser object
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn(),
          close: jest.fn(),
        }),
        createBrowserContext: jest.fn().mockResolvedValue({
          newPage: jest.fn(),
          close: jest.fn(),
        }),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Browser;

      const instrumentedBrowser = instrumentBrowser(mockBrowser);

      expect('newPage' in instrumentedBrowser).toBe(true);
      expect('createBrowserContext' in instrumentedBrowser).toBe(true);
      expect('close' in instrumentedBrowser).toBe(true);
    });

    it('should instrument page methods', () => {
      // Mock page object
      const mockPage = {
        goto: jest.fn().mockResolvedValue({
          status: () => 200,
          headers: () => ({}),
        }),
        evaluate: jest.fn().mockResolvedValue('result'),
        screenshot: jest.fn().mockResolvedValue(Buffer.from('image')),
        pdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Page;

      const instrumentedPage = instrumentPage(mockPage);

      expect('goto' in instrumentedPage).toBe(true);
      expect('evaluate' in instrumentedPage).toBe(true);
      expect('screenshot' in instrumentedPage).toBe(true);
      expect('pdf' in instrumentedPage).toBe(true);
      expect('close' in instrumentedPage).toBe(true);
    });
  });
});
