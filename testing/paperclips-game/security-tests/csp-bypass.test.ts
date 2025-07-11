import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import puppeteer, { Browser, Page } from 'puppeteer';

describe('Content Security Policy (CSP) Bypass Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('CSP Bypass Prevention', () => {
    it('should enforce CSP headers', async () => {
      // Set up CSP monitoring
      const cspViolations: any[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
          cspViolations.push(msg.text());
        }
      });

      // Navigate to page
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Get CSP headers
      const response = await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');
      const headers = response?.headers();
      const cspHeader =
        headers?.['content-security-policy'] || headers?.['Content-Security-Policy'];

      // Check if CSP is present
      if (cspHeader) {
        expect(cspHeader).toBeDefined();

        // Verify important CSP directives
        const importantDirectives = [
          'default-src',
          'script-src',
          'style-src',
          'img-src',
          'connect-src',
          'frame-src',
          'object-src',
        ];

        for (const directive of importantDirectives) {
          // Check if directive exists and isn't too permissive
          if (cspHeader.includes(directive)) {
            expect(cspHeader).not.toContain(`${directive} *`);
            expect(cspHeader).not.toContain(`${directive} 'unsafe-inline' 'unsafe-eval'`);
          }
        }
      }
    });

    it('should prevent inline script execution with CSP', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const inlineScriptTests = [
        // Direct inline scripts
        '<script>alert(1)</script>',
        '<script>eval("alert(1)")</script>',
        '<script>Function("alert(1)")()</script>',
        '<script>setTimeout("alert(1)", 0)</script>',
        '<script>setInterval("alert(1)", 1000)</script>',
        '<script>setImmediate("alert(1)")</script>',

        // Event handlers
        '<img src=x onerror="alert(1)">',
        '<body onload="alert(1)">',
        '<div onclick="alert(1)">Click me</div>',
        '<input onfocus="alert(1)" autofocus>',
        '<svg onload="alert(1)">',
        '<iframe onload="alert(1)">',
        '<object onload="alert(1)">',
        '<embed onload="alert(1)">',
        '<marquee onstart="alert(1)">',
        '<details open ontoggle="alert(1)">',

        // JavaScript URLs
        '<a href="javascript:alert(1)">Click</a>',
        '<iframe src="javascript:alert(1)">',
        '<form action="javascript:alert(1)">',
        '<object data="javascript:alert(1)">',
        '<embed src="javascript:alert(1)">',
        '<img src="javascript:alert(1)">',

        // Data URLs with scripts
        '<script src="data:text/javascript,alert(1)"></script>',
        '<iframe src="data:text/html,<script>alert(1)</script>">',
        '<object data="data:text/html,<script>alert(1)</script>">',

        // Style-based execution
        '<style>body{background:url("javascript:alert(1)")}</style>',
        '<link rel="stylesheet" href="javascript:alert(1)">',
        '<style>@import "javascript:alert(1)";</style>',
        '<div style="background:url(\'javascript:alert(1)\')">',
        '<div style="behavior:url(#default#time2)" onbegin="alert(1)">',

        // Meta refresh
        '<meta http-equiv="refresh" content="0; url=javascript:alert(1)">',
        '<meta http-equiv="refresh" content="0; url=data:text/html,<script>alert(1)</script>">',
      ];

      for (const payload of inlineScriptTests) {
        // Inject payload
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

        // With proper CSP, inline scripts should be blocked
        expect(alertFired).toBe(false);

        // Clean up
        await page.evaluate(() => {
          document.body.lastElementChild?.remove();
        });
      }
    });

    it('should prevent CSP nonce/hash bypass', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Try to extract and reuse nonces
      const nonceBypassAttempts = await page.evaluate(() => {
        const results = [];

        // Look for script tags with nonces
        const scripts = document.querySelectorAll('script[nonce]');
        scripts.forEach((script) => {
          const nonce = script.getAttribute('nonce');
          if (nonce) {
            // Try to create new script with stolen nonce
            const newScript = document.createElement('script');
            newScript.setAttribute('nonce', nonce);
            newScript.textContent = 'window.nonceBypassSuccess = true;';
            document.body.appendChild(newScript);
            results.push({ nonce, success: window.nonceBypassSuccess === true });
          }
        });

        // Try to access nonce via JavaScript
        scripts.forEach((script) => {
          const jsNonce = script.nonce;
          if (jsNonce) {
            results.push({ jsNonce, accessible: true });
          }
        });

        return results;
      });

      // Nonces should not be accessible or reusable
      for (const attempt of nonceBypassAttempts) {
        if (attempt.nonce) {
          expect(attempt.success).toBe(false);
        }
        if (attempt.jsNonce) {
          expect(attempt.accessible).toBe(false);
        }
      }
    });

    it('should prevent CSP bypass via JSONP endpoints', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const jsonpEndpoints = [
        'https://api.github.com/users/test?callback=alert',
        'https://www.google.com/complete/search?client=hp&q=test&callback=alert',
        'https://suggestqueries.google.com/complete/search?client=firefox&q=test&callback=alert',
        'https://api.twitter.com/1/statuses/user_timeline.json?screen_name=test&callback=alert',
        'https://graph.facebook.com/test?callback=alert',
        'https://api.instagram.com/v1/tags/test/media/recent?callback=alert',
        'https://api.flickr.com/services/rest/?method=flickr.test.echo&format=json&jsoncallback=alert',
      ];

      for (const endpoint of jsonpEndpoints) {
        const scriptInjected = await page.evaluate((url) => {
          const script = document.createElement('script');
          script.src = url;
          document.body.appendChild(script);
          return true;
        }, endpoint);

        expect(scriptInjected).toBe(true);

        // Check if alert was called
        const alertFired = await new Promise((resolve) => {
          page.once('dialog', () => resolve(true));
          setTimeout(() => resolve(false), 1000);
        });

        // CSP should block JSONP execution
        expect(alertFired).toBe(false);

        // Clean up
        await page.evaluate(() => {
          const scripts = document.querySelectorAll('script[src*="callback=alert"]');
          scripts.forEach((s) => s.remove());
        });
      }
    });

    it('should prevent CSP bypass via base tag manipulation', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const baseTagPayloads = [
        '<base href="http://evil.com/">',
        '<base href="//evil.com/">',
        '<base href="data:text/html,<script>alert(1)</script>#">',
        '<base href="javascript:alert(1)//">',
        '<base target="_blank" href="http://evil.com/">',
        '<base href="http://evil.com/"><script src="app.js"></script>',
      ];

      for (const payload of baseTagPayloads) {
        // Inject base tag
        await page.evaluate((html) => {
          const div = document.createElement('div');
          div.innerHTML = html;
          document.head.appendChild(div.firstElementChild!);
        }, payload);

        // Try to load relative resources
        await page.evaluate(() => {
          const script = document.createElement('script');
          script.src = 'test.js';
          document.body.appendChild(script);
        });

        // Check if resources loaded from evil domain
        const requests = await page.evaluate(() => {
          return performance
            .getEntriesByType('resource')
            .map((r) => r.name)
            .filter((url) => url.includes('evil.com'));
        });

        expect(requests.length).toBe(0);

        // Clean up
        await page.evaluate(() => {
          document.querySelector('base')?.remove();
        });
      }
    });

    it('should prevent CSP bypass via DOM clobbering', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const domClobberingTests = [
        // Clobber window properties
        () =>
          page.evaluate(() => {
            const form = document.createElement('form');
            form.setAttribute('name', 'location');
            form.setAttribute('action', 'javascript:alert(1)');
            document.body.appendChild(form);
          }),

        // Clobber document properties
        () =>
          page.evaluate(() => {
            const img = document.createElement('img');
            img.setAttribute('name', 'cookie');
            img.setAttribute('src', 'javascript:alert(document.cookie)');
            document.body.appendChild(img);
          }),

        // Clobber element properties
        () =>
          page.evaluate(() => {
            const input = document.createElement('input');
            input.setAttribute('id', 'innerHTML');
            input.setAttribute('value', '<img src=x onerror=alert(1)>');
            document.body.appendChild(input);
          }),

        // Clobber global functions
        () =>
          page.evaluate(() => {
            const a = document.createElement('a');
            a.setAttribute('id', 'eval');
            a.setAttribute('href', 'javascript:alert(1)');
            document.body.appendChild(a);
          }),
      ];

      for (const test of domClobberingTests) {
        await test();

        // Check for successful exploitation
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
    });

    it('should prevent CSP bypass via SVG', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const svgPayloads = [
        '<svg><script>alert(1)</script></svg>',
        '<svg><script href="data:text/javascript,alert(1)"></script></svg>',
        '<svg><script xlink:href="data:text/javascript,alert(1)"></script></svg>',
        '<svg><image href="x" onerror="alert(1)"></image></svg>',
        '<svg><animate attributeName="onload" to="alert(1)"></animate></svg>',
        '<svg><set attributeName="onmouseover" to="alert(1)"></set></svg>',
        '<svg><handler xmlns="http://www.w3.org/1999/xhtml" type="text/javascript">alert(1)</handler></svg>',
        '<svg><foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject></svg>',
        '<svg><use href="data:image/svg+xml,<svg id=x xmlns=http://www.w3.org/2000/svg><script>alert(1)</script></svg>#x"></use></svg>',
        '<svg><animate attributeName="href" values="javascript:alert(1)"></animate><a><text>click</text></a></svg>',
      ];

      for (const payload of svgPayloads) {
        await page.evaluate((svg) => {
          const div = document.createElement('div');
          div.innerHTML = svg;
          document.body.appendChild(div);
        }, payload);

        const alertFired = await new Promise((resolve) => {
          page.once('dialog', () => resolve(true));
          setTimeout(() => resolve(false), 500);
        });

        expect(alertFired).toBe(false);

        await page.evaluate(() => {
          document.body.lastElementChild?.remove();
        });
      }
    });

    it('should prevent CSP bypass via Web Workers', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const workerBypassTests = [
        // Blob URL worker
        async () => {
          const result = await page.evaluate(() => {
            try {
              const blob = new Blob(['postMessage("bypassed")'], {
                type: 'application/javascript',
              });
              const worker = new Worker(URL.createObjectURL(blob));
              return new Promise((resolve) => {
                worker.onmessage = (e) => resolve(e.data);
                setTimeout(() => resolve('blocked'), 1000);
              });
            } catch (e) {
              return 'error';
            }
          });
          expect(result).not.toBe('bypassed');
        },

        // Data URL worker
        async () => {
          const result = await page.evaluate(() => {
            try {
              const worker = new Worker('data:text/javascript,postMessage("bypassed")');
              return new Promise((resolve) => {
                worker.onmessage = (e) => resolve(e.data);
                setTimeout(() => resolve('blocked'), 1000);
              });
            } catch (e) {
              return 'error';
            }
          });
          expect(result).not.toBe('bypassed');
        },

        // SharedWorker bypass
        async () => {
          const result = await page.evaluate(() => {
            try {
              const blob = new Blob(['onconnect = e => e.ports[0].postMessage("bypassed")'], {
                type: 'application/javascript',
              });
              const worker = new SharedWorker(URL.createObjectURL(blob));
              return new Promise((resolve) => {
                worker.port.onmessage = (e) => resolve(e.data);
                worker.port.start();
                setTimeout(() => resolve('blocked'), 1000);
              });
            } catch (e) {
              return 'error';
            }
          });
          expect(result).not.toBe('bypassed');
        },
      ];

      for (const test of workerBypassTests) {
        await test();
      }
    });

    it('should prevent CSP bypass via CSS injection', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const cssInjectionPayloads = [
        // CSS expressions (IE legacy)
        '<style>body{width:expression(alert(1))}</style>',
        '<div style="width:expression(alert(1))">',

        // CSS JavaScript URLs
        '<style>body{background:url("javascript:alert(1)")}</style>',
        '<div style="background:url(\'javascript:alert(1)\')">',

        // CSS imports
        '<style>@import "javascript:alert(1)";</style>',
        '<style>@import url("data:text/css,body{background:url(\'javascript:alert(1)\')}");</style>',

        // CSS behaviors (IE legacy)
        '<style>body{behavior:url(#default#time2)}</style>',
        '<div style="behavior:url(\'javascript:alert(1)\')">',

        // CSS attribute selectors with JavaScript
        '<style>a[href^="javascript:alert"]{color:red}</style><a href="javascript:alert(1)">',

        // CSS generated content
        '<style>body:before{content:url("javascript:alert(1)")}</style>',
        '<style>body:after{content:attr(onload)}</style>',
      ];

      for (const payload of cssInjectionPayloads) {
        await page.evaluate((css) => {
          const div = document.createElement('div');
          div.innerHTML = css;
          document.body.appendChild(div);
        }, payload);

        const alertFired = await new Promise((resolve) => {
          page.once('dialog', () => resolve(true));
          setTimeout(() => resolve(false), 500);
        });

        expect(alertFired).toBe(false);

        await page.evaluate(() => {
          document.body.lastElementChild?.remove();
        });
      }
    });

    it('should prevent CSP bypass via trusted types', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Check if Trusted Types are enforced
      const trustedTypesEnabled = await page.evaluate(() => {
        return typeof window.trustedTypes !== 'undefined';
      });

      if (trustedTypesEnabled) {
        const trustedTypesBypassTests = [
          // Direct innerHTML assignment
          async () => {
            const result = await page.evaluate(() => {
              try {
                const div = document.createElement('div');
                div.innerHTML = '<img src=x onerror=alert(1)>';
                return 'allowed';
              } catch (e) {
                return 'blocked';
              }
            });
            expect(result).toBe('blocked');
          },

          // Script text assignment
          async () => {
            const result = await page.evaluate(() => {
              try {
                const script = document.createElement('script');
                script.text = 'alert(1)';
                document.body.appendChild(script);
                return 'allowed';
              } catch (e) {
                return 'blocked';
              }
            });
            expect(result).toBe('blocked');
          },

          // Document.write
          async () => {
            const result = await page.evaluate(() => {
              try {
                document.write('<script>alert(1)</script>');
                return 'allowed';
              } catch (e) {
                return 'blocked';
              }
            });
            expect(result).toBe('blocked');
          },
        ];

        for (const test of trustedTypesBypassTests) {
          await test();
        }
      }
    });
  });
});
