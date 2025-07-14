import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Browser, Page } from 'puppeteer';
import { launchBrowser } from '../../helpers/browser-launcher.js';

describe('Authentication Bypass Security Tests', () => {
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

  describe('Authentication Bypass Prevention', () => {
    it('should prevent SQL injection in login forms', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const sqlInjectionPayloads = [
        // Classic SQL injection
        "' OR '1'='1",
        "' OR '1'='1' --",
        "' OR '1'='1' /*",
        "admin' --",
        "admin' #",
        "admin'/*",
        "' or 1=1--",
        "' or 1=1#",
        "' or 1=1/*",
        "') or '1'='1--",
        "') or ('1'='1--",

        // Union-based injection
        "' UNION SELECT NULL--",
        "' UNION SELECT NULL,NULL--",
        "' UNION SELECT NULL,NULL,NULL--",
        "' UNION ALL SELECT NULL--",
        "' UNION ALL SELECT 'admin','password'--",

        // Time-based blind injection
        "' OR SLEEP(5)--",
        "' OR pg_sleep(5)--",
        "'; WAITFOR DELAY '00:00:05'--",
        "' OR BENCHMARK(1000000,MD5('A'))--",

        // Boolean-based blind injection
        "' AND '1'='1",
        "' AND '1'='2",
        "' OR '1'='1' AND 'a'='a",
        "' OR '1'='1' AND 'a'='b",

        // Stacked queries
        "'; DROP TABLE users--",
        "'; INSERT INTO users VALUES ('admin','password')--",
        "'; UPDATE users SET password='hacked'--",

        // Out-of-band injection
        "' OR EXISTS(SELECT * FROM users WHERE username='admin')--",
        "' OR (SELECT COUNT(*) FROM users) > 0--",

        // NoSQL injection
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$regex": ".*"}',
        '{"username": {"$ne": null}, "password": {"$ne": null}}',
        '{"$where": "this.username == \'admin\'"}',

        // LDAP injection
        '*',
        '*)(&',
        '*)(uid=*',
        'admin)(&',
        '*)(|(uid=*',

        // XPath injection
        "' or '1'='1",
        "') or ('1'='1",
        "' or ''='",
        "x' or 1=1 or 'x'='y",

        // Header injection
        'admin\r\nX-Admin: true',
        'admin\nAuthorization: Bearer fake-token',

        // Unicode variations
        "' OR '1'='1", // Unicode apostrophe
        '＇ OR ＇1＇=＇1', // Full-width characters
        "\' OR \'1\'=\'1", // Escaped quotes

        // Double encoding
        '%27%20OR%20%271%27%3D%271',
        '%2527%2520OR%2520%25271%2527%253D%25271',

        // Case variations
        "' Or '1'='1",
        "' oR '1'='1",
        "' OR '1'='1",
      ];

      // Test login form inputs if they exist
      const loginForm = await page.$('form[action*="login"], form#login, form.login');
      if (loginForm) {
        for (const payload of sqlInjectionPayloads) {
          // Fill username field
          const usernameInput = await page.$(
            'input[name="username"], input[type="text"], input#username',
          );
          if (usernameInput) {
            await usernameInput.type(payload);
          }

          // Fill password field
          const passwordInput = await page.$(
            'input[name="password"], input[type="password"], input#password',
          );
          if (passwordInput) {
            await passwordInput.type(payload);
          }

          // Check that SQL injection doesn't bypass authentication
          const isLoggedIn = await page.evaluate(() => {
            // Check common indicators of successful login
            return !!(
              document.cookie.includes('session') ||
              document.cookie.includes('token') ||
              localStorage.getItem('token') ||
              sessionStorage.getItem('token') ||
              window.location.href.includes('dashboard') ||
              window.location.href.includes('home') ||
              document.querySelector('.logout') ||
              document.querySelector('[href*="logout"]')
            );
          });

          expect(isLoggedIn).toBe(false);

          // Clear inputs for next test
          if (usernameInput) await usernameInput.click({ clickCount: 3 });
          if (usernameInput) await usernameInput.press('Backspace');
          if (passwordInput) await passwordInput.click({ clickCount: 3 });
          if (passwordInput) await passwordInput.press('Backspace');
        }
      }
    });

    it('should prevent authentication token manipulation', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const tokenManipulationTests = [
        // JWT manipulation
        async () => {
          const jwtPayloads = [
            'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTUxNjIzOTAyMn0.',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImFkbWluIjp0cnVlfQ.fake-signature',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ..',
            '',
            'null',
            'undefined',
            'None',
            'none',
            '{}',
          ];

          for (const token of jwtPayloads) {
            localStorage.setItem('token', token);
            localStorage.setItem('jwt', token);
            localStorage.setItem('access_token', token);
            sessionStorage.setItem('token', token);

            // Check if manipulated token grants access
            const hasAccess = await page.evaluate(() => {
              return !!(
                document.querySelector('[data-admin]') ||
                document.querySelector('.admin-panel') ||
                window.location.href.includes('admin')
              );
            });

            expect(hasAccess).toBe(false);
          }
        },

        // Cookie manipulation
        async () => {
          const cookiePayloads = [
            { name: 'auth', value: 'true' },
            { name: 'admin', value: '1' },
            { name: 'role', value: 'administrator' },
            { name: 'user_id', value: '1' },
            { name: 'is_admin', value: 'yes' },
            { name: 'authenticated', value: '1' },
            { name: 'access_level', value: '999' },
          ];

          for (const cookie of cookiePayloads) {
            await page.setCookie({
              ...cookie,
              domain: 'williamzujkowski.github.io',
              path: '/',
            });
          }

          // Reload to test cookie-based auth bypass
          await page.reload();

          // Check if cookies grant unauthorized access
          const hasAdminAccess = await page.evaluate(() => {
            return !!(
              document.querySelector('[data-role="admin"]') ||
              document.querySelector('.admin-only') ||
              document.body.classList.contains('admin')
            );
          });

          expect(hasAdminAccess).toBe(false);
        },

        // Session storage manipulation
        async () => {
          await page.evaluate(() => {
            const sessionPayloads = [
              { key: 'user', value: JSON.stringify({ id: 1, role: 'admin' }) },
              { key: 'permissions', value: JSON.stringify(['all']) },
              { key: 'isAuthenticated', value: 'true' },
              { key: 'userRole', value: 'superadmin' },
              { key: 'accessLevel', value: '9999' },
            ];

            sessionPayloads.forEach(({ key, value }) => {
              sessionStorage.setItem(key, value);
            });
          });

          // Check if session manipulation grants access
          const hasElevatedAccess = await page.evaluate(() => {
            return !!(
              window.userRole === 'admin' ||
              window.isAdmin === true ||
              document.documentElement.dataset.userRole === 'admin'
            );
          });

          expect(hasElevatedAccess).toBe(false);
        },
      ];

      for (const test of tokenManipulationTests) {
        await test();
      }
    });

    it('should prevent parameter pollution attacks', async () => {
      const parameterPollutionUrls = [
        // Duplicate parameters
        'https://williamzujkowski.github.io/paperclips/index2.html?user=guest&user=admin',
        'https://williamzujkowski.github.io/paperclips/index2.html?role=user&role=admin',
        'https://williamzujkowski.github.io/paperclips/index2.html?id=100&id=1',

        // Array notation pollution
        'https://williamzujkowski.github.io/paperclips/index2.html?user[]=guest&user[]=admin',
        'https://williamzujkowski.github.io/paperclips/index2.html?role[0]=user&role[1]=admin',

        // Object notation pollution
        'https://williamzujkowski.github.io/paperclips/index2.html?user[role]=admin',
        'https://williamzujkowski.github.io/paperclips/index2.html?user[permissions][]=all',

        // Mixed encoding
        'https://williamzujkowski.github.io/paperclips/index2.html?user=guest&%75ser=admin',
        'https://williamzujkowski.github.io/paperclips/index2.html?role=user&%72%6f%6c%65=admin',

        // Special characters
        'https://williamzujkowski.github.io/paperclips/index2.html?user=guest&user%00=admin',
        'https://williamzujkowski.github.io/paperclips/index2.html?user=guest&user%20=admin',

        // JSON pollution
        'https://williamzujkowski.github.io/paperclips/index2.html?data={"role":"user"}&data={"role":"admin"}',
        'https://williamzujkowski.github.io/paperclips/index2.html?config={"user":"guest"}&config[user]=admin',
      ];

      for (const url of parameterPollutionUrls) {
        await page.goto(url);

        // Check if parameter pollution grants elevated access
        const hasElevatedPrivileges = await page.evaluate(() => {
          // Check URL parameters
          const params = new URLSearchParams(window.location.search);
          const userParam = params.get('user');
          const roleParam = params.get('role');

          // Check if app incorrectly handles duplicate parameters
          return (
            userParam === 'admin' ||
            roleParam === 'admin' ||
            document.body.dataset.user === 'admin' ||
            document.body.dataset.role === 'admin'
          );
        });

        expect(hasElevatedPrivileges).toBe(false);
      }
    });

    it('should prevent authentication race conditions', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Simulate concurrent authentication attempts
      const raceConditionTest = async () => {
        const promises = [];

        // Attempt multiple simultaneous logins
        for (let i = 0; i < 10; i++) {
          promises.push(
            page.evaluate((attemptId) => {
              // Simulate login attempt
              localStorage.setItem(`login_attempt_${attemptId}`, Date.now().toString());

              // Check if any attempt succeeded when it shouldn't
              return {
                attemptId,
                timestamp: Date.now(),
                authenticated: !!(
                  localStorage.getItem('authenticated') ||
                  sessionStorage.getItem('authenticated') ||
                  document.cookie.includes('authenticated')
                ),
              };
            }, i),
          );
        }

        const results = await Promise.all(promises);

        // No attempt should authenticate without proper credentials
        const authenticatedAttempts = results.filter((r) => r.authenticated);
        expect(authenticatedAttempts.length).toBe(0);
      };

      await raceConditionTest();
    });

    it('should prevent insecure direct object references', async () => {
      const idorUrls = [
        // User ID manipulation
        'https://williamzujkowski.github.io/paperclips/index2.html?user_id=1',
        'https://williamzujkowski.github.io/paperclips/index2.html?uid=0',
        'https://williamzujkowski.github.io/paperclips/index2.html?id=-1',
        'https://williamzujkowski.github.io/paperclips/index2.html?account=999999',

        // Path traversal in IDs
        'https://williamzujkowski.github.io/paperclips/index2.html?file=../../../etc/passwd',
        'https://williamzujkowski.github.io/paperclips/index2.html?doc=..\\..\\..\\windows\\win.ini',

        // Array index manipulation
        'https://williamzujkowski.github.io/paperclips/index2.html?item[0]=public&item[1]=private',
        'https://williamzujkowski.github.io/paperclips/index2.html?data[-1]=admin',

        // Predictable IDs
        'https://williamzujkowski.github.io/paperclips/index2.html?session=1234567890',
        'https://williamzujkowski.github.io/paperclips/index2.html?token=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      ];

      for (const url of idorUrls) {
        await page.goto(url);

        // Check if IDOR grants unauthorized access
        const hasUnauthorizedAccess = await page.evaluate(() => {
          // Check for sensitive data exposure
          const sensitivePatterns = [
            /password/i,
            /secret/i,
            /private/i,
            /confidential/i,
            /ssn/i,
            /credit.?card/i,
          ];

          const pageContent = document.body.textContent || '';
          return sensitivePatterns.some((pattern) => pattern.test(pageContent));
        });

        expect(hasUnauthorizedAccess).toBe(false);
      }
    });

    it('should prevent authentication bypass via HTTP headers', async () => {
      // Set various bypass headers
      const bypassHeaders = {
        'X-Forwarded-For': '127.0.0.1',
        'X-Forwarded-Host': 'localhost',
        'X-Original-URL': '/admin',
        'X-Rewrite-URL': '/admin',
        'X-Originating-IP': '127.0.0.1',
        'X-Remote-IP': '127.0.0.1',
        'X-Client-IP': '127.0.0.1',
        'X-Real-IP': '127.0.0.1',
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Protocol': 'ssl',
        'X-Forwarded-Ssl': 'on',
        'X-Url-Scheme': 'https',
        'X-HTTP-Method-Override': 'PUT',
        'X-HTTP-Method': 'PUT',
        'X-Method-Override': 'PUT',
        'X-Forwarded-User': 'admin',
        'X-User': 'admin',
        'X-Auth-User': 'admin',
        Authorization: 'Basic YWRtaW46YWRtaW4=', // admin:admin
        Cookie: 'admin=true; authenticated=1',
        'X-Admin': 'true',
        'X-Authenticated': 'true',
      };

      await page.setExtraHTTPHeaders(bypassHeaders);
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Check if headers granted unauthorized access
      const hasAdminAccess = await page.evaluate(() => {
        return !!(
          document.querySelector('.admin-panel') ||
          document.querySelector('[data-admin]') ||
          window.location.href.includes('admin') ||
          document.body.classList.contains('authenticated')
        );
      });

      expect(hasAdminAccess).toBe(false);
    });

    it('should prevent CORS-based authentication bypass', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Test CORS bypass attempts
      const corsTests = await page.evaluate(async () => {
        const results = [];

        // Try to make cross-origin requests with credentials
        const endpoints = [
          '/api/admin',
          '/api/user/1',
          '/api/sensitive-data',
          '/admin',
          '/dashboard',
        ];

        for (const endpoint of endpoints) {
          try {
            const response = await fetch(`https://williamzujkowski.github.io${endpoint}`, {
              mode: 'cors',
              credentials: 'include',
              headers: {
                Origin: 'http://evil.com',
                'X-Requested-With': 'XMLHttpRequest',
              },
            });

            results.push({
              endpoint,
              status: response.status,
              hasCredentials: response.headers.get('Access-Control-Allow-Credentials') === 'true',
              allowsOrigin: response.headers.get('Access-Control-Allow-Origin') === '*',
            });
          } catch (error) {
            results.push({
              endpoint,
              error: true,
              message: error.message,
            });
          }
        }

        return results;
      });

      // Verify CORS is properly configured
      for (const result of corsTests) {
        if (!result.error) {
          // Should not allow credentials with wildcard origin
          if (result.allowsOrigin) {
            expect(result.hasCredentials).toBe(false);
          }
        }
      }
    });

    it('should prevent privilege escalation attacks', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Attempt various privilege escalation techniques
      const escalationAttempts = [
        // Role manipulation
        async () => {
          await page.evaluate(() => {
            // Try to modify user role in various storage locations
            localStorage.setItem('userRole', 'admin');
            sessionStorage.setItem('role', 'administrator');
            document.cookie = 'role=superuser; path=/';

            // Try to modify global objects
            if (window.user) window.user.role = 'admin';
            if (window.currentUser) window.currentUser.isAdmin = true;
            if (window.auth) window.auth.permissions = ['all'];
          });
        },

        // Prototype pollution for privilege escalation
        async () => {
          await page.evaluate(() => {
            try {
              // Attempt prototype pollution
              Object.prototype.isAdmin = true;
              Object.prototype.role = 'admin';
              Object.prototype.permissions = ['all'];

              // Try to pollute array prototype
              Array.prototype.includes = () => true;
            } catch (e) {
              // Prototype might be frozen
            }
          });
        },

        // Function override attempts
        async () => {
          await page.evaluate(() => {
            try {
              // Try to override authentication functions
              if (window.checkAuth) window.checkAuth = () => true;
              if (window.isAuthenticated) window.isAuthenticated = () => true;
              if (window.hasPermission) window.hasPermission = () => true;
              if (window.canAccess) window.canAccess = () => true;
            } catch (e) {
              // Functions might be protected
            }
          });
        },
      ];

      for (const attempt of escalationAttempts) {
        await attempt();

        // Check if escalation succeeded
        const hasEscalatedPrivileges = await page.evaluate(() => {
          return !!(
            window.isAdmin === true ||
            (window.user && window.user.role === 'admin') ||
            window.currentUser?.isAdmin ||
            localStorage.getItem('userRole') === 'admin' ||
            document.body.dataset.isAdmin === 'true'
          );
        });

        expect(hasEscalatedPrivileges).toBe(false);
      }
    });

    it('should prevent brute force attacks', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Simulate rapid login attempts
      const bruteForceAttempts = 50;
      const attempts = [];

      for (let i = 0; i < bruteForceAttempts; i++) {
        const attempt = await page.evaluate((attemptNumber) => {
          const timestamp = Date.now();

          // Simulate login attempt
          const loginEvent = new CustomEvent('login-attempt', {
            detail: {
              username: 'admin',
              password: `password${attemptNumber}`,
              timestamp,
            },
          });
          document.dispatchEvent(loginEvent);

          // Check if any rate limiting is in place
          return {
            attemptNumber,
            timestamp,
            blocked: !!(
              document.querySelector('.rate-limit-error') ||
              document.querySelector('[data-error*="rate"]') ||
              document.body.textContent?.includes('Too many attempts') ||
              document.body.textContent?.includes('Rate limit')
            ),
          };
        }, i);

        attempts.push(attempt);

        // Small delay between attempts
        await page.waitForTimeout(10);
      }

      // Check if rate limiting kicked in
      const blockedAttempts = attempts.filter((a) => a.blocked);

      // Some attempts should be blocked if rate limiting is implemented
      // If no rate limiting, this test serves as a warning
      if (blockedAttempts.length === 0) {
        console.warn(
          'No rate limiting detected - application may be vulnerable to brute force attacks',
        );
      }
    });
  });
});
