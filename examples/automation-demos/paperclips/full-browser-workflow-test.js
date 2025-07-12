#!/usr/bin/env node

/**
 * Comprehensive End-to-End Browser Navigation Test
 * Tests the complete puppeteer-mcp workflow for the paperclips game
 */

// Using native fetch (Node.js 18+)
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { createTestSession } from './setup-session.js';

const SERVER_URL = 'http://localhost:8443';
const PAPERCLIPS_URL = 'https://williamzujkowski.github.io/paperclips/index2.html';
const RESULTS_DIR = path.join(process.cwd(), 'testing', 'paperclips-game', 'results');

class FullBrowserWorkflowTest {
  constructor() {
    this.results = {
      startTime: new Date().toISOString(),
      serverConnectivity: false,
      sessionCreation: false,
      contextCreation: false,
      pageNavigation: false,
      pageLoading: false,
      pageInteraction: false,
      screenshotCapture: false,
      contentExtraction: false,
      issues: [],
      successes: [],
      performance: {},
      screenshots: [],
      htmlContent: null,
      gameElements: [],
      error: null,
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix =
      type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);

    if (type === 'error') {
      this.results.issues.push({ timestamp, message, type });
    } else if (type === 'success') {
      this.results.successes.push({ timestamp, message, type });
    }
  }

  async makeRequest(endpoint, method = 'GET', body = null, headers = {}) {
    const startTime = Date.now();
    try {
      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : null,
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      const responseTime = Date.now() - startTime;
      this.results.performance[endpoint] = responseTime;

      return {
        status: response.status,
        ok: response.ok,
        data,
        headers: Object.fromEntries(response.headers.entries()),
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.results.performance[endpoint] = responseTime;

      return {
        status: 0,
        ok: false,
        error: error.message,
        responseTime,
      };
    }
  }

  async ensureResultsDirectory() {
    try {
      await fs.mkdir(RESULTS_DIR, { recursive: true });
    } catch (error) {
      this.log(`Failed to create results directory: ${error.message}`, 'error');
    }
  }

  async saveScreenshot(screenshotData, filename) {
    try {
      const filepath = path.join(RESULTS_DIR, filename);
      const buffer = Buffer.from(screenshotData, 'base64');
      await fs.writeFile(filepath, buffer);
      this.results.screenshots.push({
        filename,
        filepath,
        size: buffer.length,
        timestamp: new Date().toISOString(),
      });
      this.log(`Screenshot saved: ${filename} (${buffer.length} bytes)`, 'success');
      return filepath;
    } catch (error) {
      this.log(`Failed to save screenshot: ${error.message}`, 'error');
      return null;
    }
  }

  async saveHtmlContent(htmlContent) {
    try {
      const filename = `paperclips-page-${Date.now()}.html`;
      const filepath = path.join(RESULTS_DIR, filename);
      await fs.writeFile(filepath, htmlContent);
      this.results.htmlContent = {
        filename,
        filepath,
        size: htmlContent.length,
        timestamp: new Date().toISOString(),
      };
      this.log(`HTML content saved: ${filename} (${htmlContent.length} characters)`, 'success');
    } catch (error) {
      this.log(`Failed to save HTML content: ${error.message}`, 'error');
    }
  }

  async testServerConnectivity() {
    this.log('Testing server connectivity...', 'info');

    const health = await this.makeRequest('/health');
    if (health.ok) {
      this.results.serverConnectivity = true;
      this.log('Server is running and responsive', 'success');
    } else {
      this.results.serverConnectivity = false;
      this.log(
        `Server health check failed: ${health.status} - ${JSON.stringify(health.data)}`,
        'error',
      );
      throw new Error('Server is not available');
    }
  }

  async createAuthenticatedSession() {
    this.log('Creating authenticated session...', 'info');

    try {
      // This may fail if called from a different context than the server
      // In that case, we'll use the API approach
      const sessionData = await createTestSession();
      this.results.sessionCreation = true;
      this.log('Session created successfully', 'success');
      return sessionData;
    } catch (error) {
      this.log(`Direct session creation failed: ${error.message}`, 'warning');

      // Try API approach (may fail due to authentication requirements)
      const response = await this.makeRequest('/api/v1/sessions', 'POST', {
        userId: crypto.randomUUID(),
        username: 'paperclips-test-user',
        roles: ['user'],
      });

      if (response.ok) {
        this.results.sessionCreation = true;
        this.log('Session created via API', 'success');
        return response.data;
      } else {
        this.results.sessionCreation = false;
        this.log(
          `API session creation failed: ${response.status} - ${JSON.stringify(response.data)}`,
          'error',
        );
        throw new Error('Could not create authenticated session');
      }
    }
  }

  async createBrowserContext(accessToken) {
    this.log('Creating browser context...', 'info');

    const response = await this.makeRequest(
      '/api/v1/contexts',
      'POST',
      {
        createPage: true,
        options: {
          viewport: {
            width: 1920,
            height: 1080,
          },
          userAgent:
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      },
      {
        Authorization: `Bearer ${accessToken}`,
      },
    );

    if (response.ok) {
      this.results.contextCreation = true;
      this.log(`Browser context created: ${response.data.contextId}`, 'success');
      return response.data.contextId;
    } else {
      this.results.contextCreation = false;
      this.log(
        `Context creation failed: ${response.status} - ${JSON.stringify(response.data)}`,
        'error',
      );
      throw new Error('Could not create browser context');
    }
  }

  async navigateToPage(contextId, accessToken) {
    this.log(`Navigating to ${PAPERCLIPS_URL}...`, 'info');

    const response = await this.makeRequest(
      `/api/v1/contexts/${contextId}/navigate`,
      'POST',
      {
        url: PAPERCLIPS_URL,
        options: {
          waitUntil: 'networkidle2',
          timeout: 30000,
        },
      },
      {
        Authorization: `Bearer ${accessToken}`,
      },
    );

    if (response.ok) {
      this.results.pageNavigation = true;
      this.log('Page navigation successful', 'success');
      return response.data;
    } else {
      this.results.pageNavigation = false;
      this.log(
        `Page navigation failed: ${response.status} - ${JSON.stringify(response.data)}`,
        'error',
      );
      throw new Error('Could not navigate to page');
    }
  }

  async verifyPageLoading(contextId, accessToken) {
    this.log('Verifying page loading...', 'info');

    // Get page title
    const titleResponse = await this.makeRequest(
      `/api/v1/contexts/${contextId}/evaluate`,
      'POST',
      {
        script: 'document.title',
      },
      {
        Authorization: `Bearer ${accessToken}`,
      },
    );

    if (titleResponse.ok) {
      const title = titleResponse.data.result;
      this.log(`Page title: ${title}`, 'info');

      if (title && title.toLowerCase().includes('paperclips')) {
        this.results.pageLoading = true;
        this.log('Page loaded correctly (title contains "paperclips")', 'success');
      } else {
        this.log(`Page may not have loaded correctly - unexpected title: ${title}`, 'warning');
      }
    } else {
      this.log(`Could not get page title: ${titleResponse.status}`, 'error');
    }

    // Get page URL
    const urlResponse = await this.makeRequest(
      `/api/v1/contexts/${contextId}/evaluate`,
      'POST',
      {
        script: 'window.location.href',
      },
      {
        Authorization: `Bearer ${accessToken}`,
      },
    );

    if (urlResponse.ok) {
      const currentUrl = urlResponse.data.result;
      this.log(`Current URL: ${currentUrl}`, 'info');

      if (currentUrl === PAPERCLIPS_URL) {
        this.results.pageLoading = true;
        this.log('URL verification successful', 'success');
      } else {
        this.log(`URL mismatch - expected: ${PAPERCLIPS_URL}, got: ${currentUrl}`, 'warning');
      }
    }
  }

  async captureScreenshot(contextId, accessToken) {
    this.log('Capturing screenshot...', 'info');

    const response = await this.makeRequest(
      `/api/v1/contexts/${contextId}/screenshot`,
      'POST',
      {
        options: {
          fullPage: true,
          type: 'png',
        },
      },
      {
        Authorization: `Bearer ${accessToken}`,
      },
    );

    if (response.ok) {
      this.results.screenshotCapture = true;
      const filename = `paperclips-screenshot-${Date.now()}.png`;
      await this.saveScreenshot(response.data.screenshot, filename);
      this.log('Screenshot captured successfully', 'success');
      return response.data.screenshot;
    } else {
      this.results.screenshotCapture = false;
      this.log(
        `Screenshot capture failed: ${response.status} - ${JSON.stringify(response.data)}`,
        'error',
      );
    }
  }

  async extractPageContent(contextId, accessToken) {
    this.log('Extracting page content...', 'info');

    const response = await this.makeRequest(`/api/v1/contexts/${contextId}/content`, 'GET', null, {
      Authorization: `Bearer ${accessToken}`,
    });

    if (response.ok) {
      this.results.contentExtraction = true;
      const content = response.data.content;
      this.log(`Page content extracted: ${content.length} characters`, 'success');

      await this.saveHtmlContent(content);

      // Analyze game elements
      await this.analyzeGameElements(contextId, accessToken);

      return content;
    } else {
      this.results.contentExtraction = false;
      this.log(
        `Content extraction failed: ${response.status} - ${JSON.stringify(response.data)}`,
        'error',
      );
    }
  }

  async analyzeGameElements(contextId, accessToken) {
    this.log('Analyzing game elements...', 'info');

    const gameElementChecks = [
      {
        name: 'Paperclip Button',
        selector:
          'button[id*="paperclip"], input[type="button"][value*="paperclip"], #btnMakePaperclip',
        script:
          'document.querySelector(\'button[id*="paperclip"], input[type="button"][value*="paperclip"], #btnMakePaperclip\')',
      },
      {
        name: 'Paperclip Counter',
        selector: '[id*="clip"], [id*="count"]',
        script: 'document.querySelector(\'[id*="clip"], [id*="count"]\')',
      },
      {
        name: 'Game Title',
        selector: 'h1, h2, title',
        script: "document.querySelector('h1, h2')?.textContent || document.title",
      },
      {
        name: 'Wire Input',
        selector: 'input[type="number"], input[id*="wire"]',
        script: 'document.querySelector(\'input[type="number"], input[id*="wire"]\')',
      },
    ];

    for (const check of gameElementChecks) {
      const response = await this.makeRequest(
        `/api/v1/contexts/${contextId}/evaluate`,
        'POST',
        {
          script: check.script,
        },
        {
          Authorization: `Bearer ${accessToken}`,
        },
      );

      if (response.ok && response.data.result) {
        this.results.gameElements.push({
          name: check.name,
          found: true,
          element: response.data.result,
        });
        this.log(`Game element found: ${check.name}`, 'success');
      } else {
        this.results.gameElements.push({
          name: check.name,
          found: false,
        });
        this.log(`Game element not found: ${check.name}`, 'warning');
      }
    }
  }

  async testPageInteraction(contextId, accessToken) {
    this.log('Testing page interactions...', 'info');

    // Try to find and click the paperclip button
    const clickResponse = await this.makeRequest(
      `/api/v1/contexts/${contextId}/evaluate`,
      'POST',
      {
        script: `
        // Try multiple possible selectors for the paperclip button
        const selectors = [
          'button[id*="paperclip"]',
          'input[type="button"][value*="paperclip"]',
          '#btnMakePaperclip',
          'button:contains("Make Paperclip")',
          'input[value="Make Paperclip"]'
        ];
        
        let button = null;
        for (const selector of selectors) {
          button = document.querySelector(selector);
          if (button) break;
        }
        
        if (button) {
          const initialText = button.textContent || button.value;
          button.click();
          return {
            success: true,
            buttonText: initialText,
            buttonId: button.id,
            buttonType: button.tagName
          };
        } else {
          return {
            success: false,
            message: 'No paperclip button found'
          };
        }
      `,
      },
      {
        Authorization: `Bearer ${accessToken}`,
      },
    );

    if (clickResponse.ok) {
      const result = clickResponse.data.result;
      if (result.success) {
        this.results.pageInteraction = true;
        this.log(`Successfully clicked paperclip button: ${result.buttonText}`, 'success');

        // Wait a moment and take another screenshot to see changes
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await this.captureScreenshot(contextId, accessToken);
      } else {
        this.results.pageInteraction = false;
        this.log(`Page interaction failed: ${result.message}`, 'error');
      }
    } else {
      this.results.pageInteraction = false;
      this.log(`Page interaction request failed: ${clickResponse.status}`, 'error');
    }
  }

  async cleanupContext(contextId, accessToken) {
    this.log('Cleaning up browser context...', 'info');

    const response = await this.makeRequest(`/api/v1/contexts/${contextId}`, 'DELETE', null, {
      Authorization: `Bearer ${accessToken}`,
    });

    if (response.ok) {
      this.log('Browser context cleaned up successfully', 'success');
    } else {
      this.log(`Context cleanup failed: ${response.status}`, 'warning');
    }
  }

  async saveTestResults() {
    this.log('Saving test results...', 'info');

    this.results.endTime = new Date().toISOString();
    this.results.duration = new Date(this.results.endTime) - new Date(this.results.startTime);

    const filename = `test-results-${Date.now()}.json`;
    const filepath = path.join(RESULTS_DIR, filename);

    try {
      await fs.writeFile(filepath, JSON.stringify(this.results, null, 2));
      this.log(`Test results saved: ${filename}`, 'success');
    } catch (error) {
      this.log(`Failed to save test results: ${error.message}`, 'error');
    }
  }

  async runFullWorkflowTest() {
    this.log('Starting full browser navigation workflow test...', 'info');

    await this.ensureResultsDirectory();

    let contextId = null;
    let accessToken = null;

    try {
      // Step 1: Test server connectivity
      await this.testServerConnectivity();

      // Step 2: Create authenticated session
      const sessionData = await this.createAuthenticatedSession();
      accessToken = sessionData.accessToken;

      // Step 3: Create browser context
      contextId = await this.createBrowserContext(accessToken);

      // Step 4: Navigate to paperclips game
      await this.navigateToPage(contextId, accessToken);

      // Step 5: Verify page loading
      await this.verifyPageLoading(contextId, accessToken);

      // Step 6: Capture initial screenshot
      await this.captureScreenshot(contextId, accessToken);

      // Step 7: Extract page content
      await this.extractPageContent(contextId, accessToken);

      // Step 8: Test page interactions
      await this.testPageInteraction(contextId, accessToken);

      this.log('Full workflow test completed successfully!', 'success');
    } catch (error) {
      this.results.error = error.message;
      this.log(`Workflow test failed: ${error.message}`, 'error');
    } finally {
      // Cleanup
      if (contextId && accessToken) {
        await this.cleanupContext(contextId, accessToken);
      }

      await this.saveTestResults();
    }

    // Print summary
    this.printSummary();
  }

  printSummary() {
    console.log('\n=== FULL BROWSER WORKFLOW TEST SUMMARY ===');
    console.log(`Test Duration: ${this.results.duration}ms`);
    console.log(`Screenshots Captured: ${this.results.screenshots.length}`);
    console.log(
      `Game Elements Found: ${this.results.gameElements.filter((e) => e.found).length}/${this.results.gameElements.length}`,
    );
    console.log('\nTest Results:');
    console.log(`✅ Server Connectivity: ${this.results.serverConnectivity ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Session Creation: ${this.results.sessionCreation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Context Creation: ${this.results.contextCreation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Page Navigation: ${this.results.pageNavigation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Page Loading: ${this.results.pageLoading ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Screenshot Capture: ${this.results.screenshotCapture ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Content Extraction: ${this.results.contentExtraction ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Page Interaction: ${this.results.pageInteraction ? 'PASS' : 'FAIL'}`);

    if (this.results.gameElements.length > 0) {
      console.log('\nGame Elements Analysis:');
      this.results.gameElements.forEach((element) => {
        console.log(`  ${element.found ? '✅' : '❌'} ${element.name}`);
      });
    }

    if (this.results.issues.length > 0) {
      console.log('\nIssues Encountered:');
      this.results.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.message}`);
      });
    }

    console.log('\nPerformance Metrics:');
    Object.entries(this.results.performance).forEach(([endpoint, time]) => {
      console.log(`  ${endpoint}: ${time}ms`);
    });

    console.log(`\nResults saved to: ${RESULTS_DIR}`);
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new FullBrowserWorkflowTest();
  test.runFullWorkflowTest().catch(console.error);
}

export { FullBrowserWorkflowTest };
