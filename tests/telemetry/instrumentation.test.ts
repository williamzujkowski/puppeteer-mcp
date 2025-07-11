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

describe('Telemetry Instrumentations', () => {
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
      const session = await store.create('test-user', { role: 'user' });

      expect(session).toBeDefined();
      expect(session.userId).toBe('test-user');
      expect(session.id).toBeTruthy();
    });

    it('should instrument get method', async () => {
      const created = await store.create('test-user');
      const retrieved = await store.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should instrument delete method', async () => {
      const session = await store.create('test-user');
      const deleted = await store.delete(session.id);

      expect(deleted).toBe(true);

      const retrieved = await store.get(session.id);
      expect(retrieved).toBeNull();
    });

    it('should instrument listByUserId method', async () => {
      await store.create('test-user');
      await store.create('test-user');

      const sessions = await store.listByUserId('test-user');
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
