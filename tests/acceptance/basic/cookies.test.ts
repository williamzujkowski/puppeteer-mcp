/**
 * Cookie management acceptance tests
 * @module tests/acceptance/basic/cookies
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import {
  createMCPClient,
  createMCPSession,
  cleanupMCPSession,
  mcpNavigate,
  mcpCookie,
} from '../utils/mcp-client.js';
import { TEST_TARGETS, TEST_CONFIG } from '../utils/test-config.js';
import {
  retryOperation,
  validateUrl,
  PerformanceTracker,
  AssertionHelpers,
} from '../utils/test-helpers.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('Cookie Management Tests', () => {
  let mcpClient: MCPTestClient;
  let sessionInfo: MCPSessionInfo;

  beforeAll(async () => {
    // Validate test targets are accessible
    const targetsToValidate = [
      TEST_TARGETS.apis.httpbin + 'cookies',
      TEST_TARGETS.testing.theInternet,
    ];

    for (const url of targetsToValidate) {
      const isAccessible = await validateUrl(url);
      if (!isAccessible) {
        console.warn(`Warning: Test target ${url} is not accessible`);
      }
    }

    mcpClient = await createMCPClient();
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    if (mcpClient !== null) {
      await mcpClient.cleanup();
    }
  });

  beforeEach(async () => {
    sessionInfo = await createMCPSession(mcpClient.client);
  }, TEST_CONFIG.timeout);

  afterEach(async () => {
    if (sessionInfo !== null) {
      await cleanupMCPSession(mcpClient.client, sessionInfo);
    }
  });

  describe('Basic Cookie Operations', () => {
    it(
      'should set and retrieve cookies',
      async () => {
        const performance = new PerformanceTracker();

        await retryOperation(async () => {
          // Navigate to httpbin cookies endpoint
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );
          performance.checkpoint('navigation');

          // Clear any existing cookies first
          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');
          performance.checkpoint('clear_existing');

          // Set a simple session cookie
          const testCookie = {
            name: 'test_session',
            value: 'session_value_123',
            path: '/',
          };

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [testCookie]);
          performance.checkpoint('set_cookie');

          // Retrieve cookies
          const cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          performance.checkpoint('get_cookies');

          // Verify cookie was set
          expect(cookies).toBeTruthy();
          expect(Array.isArray(cookies)).toBe(true);

          const foundCookie = cookies.find((c: any) => c.name === 'test_session');
          expect(foundCookie).toBeTruthy();
          expect(foundCookie.value).toBe('session_value_123');
          expect(foundCookie.path).toBe('/');

          // Performance assertion
          expect(performance.getCheckpoint('navigation')).toBeLessThan(10000);

          console.warn('Cookie performance:', performance.getReport());
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle persistent cookies with expiration',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          // Clear existing cookies
          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');

          // Set a persistent cookie with expiration (1 hour from now)
          const expiryTime = Math.floor(Date.now() / 1000) + 3600;
          const persistentCookie = {
            name: 'persistent_test',
            value: 'persistent_value_456',
            path: '/',
            expires: expiryTime,
          };

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [persistentCookie]);

          // Retrieve and verify
          const cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          const foundCookie = cookies.find((c: any) => c.name === 'persistent_test');

          expect(foundCookie).toBeTruthy();
          expect(foundCookie.value).toBe('persistent_value_456');
          expect(foundCookie.expires).toBeGreaterThan(Date.now() / 1000);
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should delete specific cookies',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          // Clear and set multiple cookies
          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');

          const cookies = [
            { name: 'cookie1', value: 'value1', path: '/' },
            { name: 'cookie2', value: 'value2', path: '/' },
            { name: 'cookie3', value: 'value3', path: '/' },
          ];

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', cookies);

          // Verify all cookies are set
          let allCookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          expect(allCookies.length).toBeGreaterThanOrEqual(3);

          // Delete specific cookie
          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'delete', [
            { name: 'cookie2', path: '/' },
          ]);

          // Verify cookie was deleted
          allCookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          const deletedCookie = allCookies.find((c: any) => c.name === 'cookie2');
          expect(deletedCookie).toBeFalsy();

          // Verify other cookies still exist
          const cookie1 = allCookies.find((c: any) => c.name === 'cookie1');
          const cookie3 = allCookies.find((c: any) => c.name === 'cookie3');
          expect(cookie1).toBeTruthy();
          expect(cookie3).toBeTruthy();
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should clear all cookies',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          // Set multiple cookies
          const cookies = [
            { name: 'clear_test1', value: 'value1', path: '/' },
            { name: 'clear_test2', value: 'value2', path: '/' },
            { name: 'clear_test3', value: 'value3', path: '/' },
          ];

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', cookies);

          // Verify cookies are set
          let allCookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          expect(allCookies.length).toBeGreaterThanOrEqual(3);

          // Clear all cookies
          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');

          // Verify all cookies are cleared
          allCookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          expect(allCookies.length).toBe(0);
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Cookie Attributes', () => {
    it(
      'should handle secure and httpOnly cookies',
      async () => {
        await retryOperation(async () => {
          // Note: For secure cookies to work, we need HTTPS
          await mcpNavigate(mcpClient.client, sessionInfo.contextId, 'https://httpbin.org/cookies');

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');

          // Set secure and httpOnly cookie
          const secureCookie = {
            name: 'secure_test',
            value: 'secure_value',
            path: '/',
            secure: true,
            httpOnly: true,
          };

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [secureCookie]);

          // Retrieve and verify attributes
          const cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          const foundCookie = cookies.find((c: any) => c.name === 'secure_test');

          expect(foundCookie).toBeTruthy();
          expect(foundCookie.value).toBe('secure_value');
          expect(foundCookie.secure).toBe(true);
          expect(foundCookie.httpOnly).toBe(true);
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle SameSite cookie attribute',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');

          // Test different SameSite values
          const sameSiteCookies = [
            {
              name: 'samesite_strict',
              value: 'strict_value',
              path: '/',
              sameSite: 'Strict' as const,
            },
            {
              name: 'samesite_lax',
              value: 'lax_value',
              path: '/',
              sameSite: 'Lax' as const,
            },
            {
              name: 'samesite_none',
              value: 'none_value',
              path: '/',
              sameSite: 'None' as const,
              secure: true, // Required for SameSite=None
            },
          ];

          // Note: We'll test each individually as some may fail based on context
          for (const cookie of sameSiteCookies) {
            try {
              await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [cookie]);

              const cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
              const foundCookie = cookies.find((c: any) => c.name === cookie.name);

              if (foundCookie) {
                expect(foundCookie.value).toBe(cookie.value);
                expect(foundCookie.sameSite).toBe(cookie.sameSite);
              }
            } catch (error) {
              // Some SameSite settings may not be supported in all contexts
              console.warn(`SameSite ${cookie.sameSite} cookie test failed:`, error);
            }
          }
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle domain and path restrictions',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');

          // Set cookie with specific domain and path
          const domainCookie = {
            name: 'domain_test',
            value: 'domain_value',
            domain: 'httpbin.org',
            path: '/cookies',
          };

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [domainCookie]);

          // Retrieve and verify
          const cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          const foundCookie = cookies.find((c: any) => c.name === 'domain_test');

          expect(foundCookie).toBeTruthy();
          expect(foundCookie.value).toBe('domain_value');
          expect(foundCookie.domain).toMatch(/httpbin\.org/);
          expect(foundCookie.path).toBe('/cookies');
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Cross-Domain Cookie Behavior', () => {
    it(
      'should isolate cookies between different domains',
      async () => {
        await retryOperation(async () => {
          // Set cookies on httpbin.org
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');

          const httpbinCookie = {
            name: 'httpbin_cookie',
            value: 'httpbin_value',
            path: '/',
          };

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [httpbinCookie]);

          let cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          expect(cookies.find((c: any) => c.name === 'httpbin_cookie')).toBeTruthy();

          // Navigate to different domain
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.testing.theInternet,
          );

          // Cookies from httpbin should not be accessible
          cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          expect(cookies.find((c: any) => c.name === 'httpbin_cookie')).toBeFalsy();

          // Set cookie on the-internet domain
          const theInternetCookie = {
            name: 'theinternet_cookie',
            value: 'theinternet_value',
            path: '/',
          };

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [theInternetCookie]);

          cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          expect(cookies.find((c: any) => c.name === 'theinternet_cookie')).toBeTruthy();

          // Navigate back to httpbin
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          // Original httpbin cookie should still be there
          cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          expect(cookies.find((c: any) => c.name === 'httpbin_cookie')).toBeTruthy();
          expect(cookies.find((c: any) => c.name === 'theinternet_cookie')).toBeFalsy();
        });
      },
      TEST_CONFIG.timeout * 2,
    );
  });

  describe('Cookie Size and Name Limits', () => {
    it(
      'should handle normal sized cookies',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');

          // Create cookie with reasonably large value (under 4KB limit)
          const largeValue = 'x'.repeat(1000); // 1KB value
          const largeCookie = {
            name: 'large_cookie',
            value: largeValue,
            path: '/',
          };

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [largeCookie]);

          // Retrieve and verify
          const cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          const foundCookie = cookies.find((c: any) => c.name === 'large_cookie');

          expect(foundCookie).toBeTruthy();
          expect(foundCookie.value).toBe(largeValue);
          expect(foundCookie.value.length).toBe(1000);
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle special characters in cookie names and values',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');

          // Test various valid cookie names and values
          const specialCookies = [
            {
              name: 'test-cookie-1',
              value: 'value with spaces',
              path: '/',
            },
            {
              name: 'test_cookie_2',
              value: 'value-with-dashes',
              path: '/',
            },
            {
              name: 'testCookie3',
              value: 'valueWithNumbers123',
              path: '/',
            },
          ];

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', specialCookies);

          // Retrieve and verify
          const cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');

          for (const expectedCookie of specialCookies) {
            const foundCookie = cookies.find((c: any) => c.name === expectedCookie.name);
            expect(foundCookie).toBeTruthy();
            expect(foundCookie.value).toBe(expectedCookie.value);
          }
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Cookie Expiration Handling', () => {
    it(
      'should handle expired cookies',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');

          // Set a cookie that expires in the past (should be immediately removed)
          const expiredCookie = {
            name: 'expired_cookie',
            value: 'expired_value',
            path: '/',
            expires: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
          };

          // Setting an expired cookie should work but it may not appear in get
          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [expiredCookie]);

          // Retrieve cookies - expired cookie should not be present
          const cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          const foundCookie = cookies.find((c: any) => c.name === 'expired_cookie');

          // Expired cookies typically don't appear in the cookie list
          expect(foundCookie).toBeFalsy();
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should handle future expiration dates',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');

          // Set cookie with far future expiration
          const futureTime = Math.floor(Date.now() / 1000) + 365 * 24 * 3600; // 1 year from now
          const futureCookie = {
            name: 'future_cookie',
            value: 'future_value',
            path: '/',
            expires: futureTime,
          };

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [futureCookie]);

          // Retrieve and verify
          const cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          const foundCookie = cookies.find((c: any) => c.name === 'future_cookie');

          expect(foundCookie).toBeTruthy();
          expect(foundCookie.value).toBe('future_value');
          expect(foundCookie.expires).toBeGreaterThan(Date.now() / 1000);
        });
      },
      TEST_CONFIG.timeout,
    );
  });

  describe('Error Handling', () => {
    it(
      'should handle invalid cookie operations gracefully',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          // Try to set cookie with invalid data
          try {
            await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [
              { name: '', value: 'invalid' }, // Empty name should fail
            ]);
            // If it doesn't throw, that's also acceptable behavior
          } catch (error) {
            expect(error).toBeTruthy();
            AssertionHelpers.containsText(String(error), 'name');
          }

          // Try to delete non-existent cookie (should not throw)
          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'delete', [
            { name: 'non_existent_cookie', path: '/' },
          ]);

          // Get cookies should always work
          const cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          expect(Array.isArray(cookies)).toBe(true);
        });
      },
      TEST_CONFIG.timeout,
    );

    it(
      'should recover from cookie errors',
      async () => {
        await retryOperation(async () => {
          await mcpNavigate(
            mcpClient.client,
            sessionInfo.contextId,
            TEST_TARGETS.apis.httpbin + 'cookies',
          );

          // Clear cookies to ensure clean state
          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'clear');

          // Try problematic operation
          try {
            await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [
              { name: 'test', value: 'value', domain: 'invalid-domain' },
            ]);
          } catch {
            // Expected to potentially fail
          }

          // Should still be able to perform valid operations
          const validCookie = {
            name: 'recovery_test',
            value: 'recovery_value',
            path: '/',
          };

          await mcpCookie(mcpClient.client, sessionInfo.contextId, 'set', [validCookie]);

          const cookies = await mcpCookie(mcpClient.client, sessionInfo.contextId, 'get');
          const foundCookie = cookies.find((c: any) => c.name === 'recovery_test');
          expect(foundCookie).toBeTruthy();
          expect(foundCookie.value).toBe('recovery_value');
        });
      },
      TEST_CONFIG.timeout,
    );
  });
});
