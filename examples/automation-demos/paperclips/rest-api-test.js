#!/usr/bin/env node

/**
 * REST API Test for Puppeteer MCP Platform
 *
 * This test validates the REST API endpoints for browser automation,
 * focusing on API functionality rather than underlying browser automation.
 *
 * Test Coverage:
 * - Health check endpoints
 * - Authentication and token generation
 * - Session management
 * - Context creation and management
 * - Browser action execution via API
 * - Screenshot capture via API
 * - Content extraction via API
 * - Click interactions via API
 * - Error handling and API responses
 * - Performance metrics
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, 'results');
const PAPERCLIPS_URL = 'https://williamzujkowski.github.io/paperclips/index2.html';
const BASE_URL = 'http://localhost:3000';
const API_BASE_URL = `${BASE_URL}/api/v1`;

class RestApiTest {
  constructor() {
    this.results = {
      testId: `rest-api-test-${Date.now()}`,
      startTime: new Date().toISOString(),
      endTime: null,
      duration: null,
      serverStartup: {
        success: false,
        duration: null,
        pid: null,
        error: null,
      },
      authentication: {
        tokenGeneration: false,
        tokenValidation: false,
        tokenExpiry: null,
        error: null,
      },
      sessionManagement: {
        sessionCreation: false,
        sessionRetrieval: false,
        sessionValidation: false,
        sessionId: null,
        error: null,
      },
      contextManagement: {
        contextCreation: false,
        contextRetrieval: false,
        contextId: null,
        pageId: null,
        error: null,
      },
      browserActions: {
        navigate: { success: false, duration: null, error: null },
        screenshot: { success: false, duration: null, data: null, error: null },
        content: { success: false, duration: null, data: null, error: null },
        click: { success: false, duration: null, data: null, error: null },
        secondScreenshot: { success: false, duration: null, data: null, error: null },
      },
      apiMetrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        requestTimes: [],
      },
      healthChecks: {
        basic: false,
        liveness: false,
        readiness: false,
      },
      issues: [],
      successes: [],
      screenshots: [],
      token: null,
      serverProcess: null,
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

  async ensureResultsDirectory() {
    try {
      await fs.mkdir(RESULTS_DIR, { recursive: true });
    } catch (error) {
      this.log(`Failed to create results directory: ${error.message}`, 'error');
    }
  }

  async makeApiRequest(method, endpoint, data = null, headers = {}) {
    const startTime = Date.now();
    this.results.apiMetrics.totalRequests++;

    try {
      const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

      const requestOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (data) {
        requestOptions.body = JSON.stringify(data);
      }

      const response = await fetch(url, requestOptions);
      const responseTime = Date.now() - startTime;
      this.results.apiMetrics.requestTimes.push(responseTime);

      let responseData = null;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (response.ok) {
        this.results.apiMetrics.successfulRequests++;
      } else {
        this.results.apiMetrics.failedRequests++;
      }

      return {
        success: response.ok,
        status: response.status,
        data: responseData,
        responseTime,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.results.apiMetrics.requestTimes.push(responseTime);
      this.results.apiMetrics.failedRequests++;

      return {
        success: false,
        error: error.message,
        responseTime,
      };
    }
  }

  async startServer() {
    this.log('Starting Puppeteer MCP server...', 'info');
    const startTime = Date.now();

    try {
      // Check if server is already running
      const healthCheck = await this.makeApiRequest('GET', `${BASE_URL}/health`);
      if (healthCheck.success) {
        this.log('Server is already running', 'success');
        this.results.serverStartup.success = true;
        this.results.serverStartup.duration = 0;
        return true;
      } else {
        throw new Error(`Server is not running. Please start it with: PORT=3000 npm run start`);
      }
    } catch (error) {
      this.results.serverStartup.error = error.message;
      this.log(`Server startup failed: ${error.message}`, 'error');
      return false;
    }
  }

  async stopServer() {
    // Don't stop the server since it was already running
    this.log('Leaving server running for further testing', 'info');
  }

  async testHealthChecks() {
    this.log('Testing health check endpoints...', 'info');

    try {
      // Test basic health check
      const healthResponse = await this.makeApiRequest('GET', `${BASE_URL}/health`);
      if (healthResponse.success) {
        this.results.healthChecks.basic = true;
        this.log('Basic health check passed', 'success');
      } else {
        this.log(
          `Basic health check failed: ${healthResponse.error || healthResponse.data}`,
          'error',
        );
      }

      // Test liveness probe
      const livenessResponse = await this.makeApiRequest('GET', `${BASE_URL}/health/live`);
      if (livenessResponse.success) {
        this.results.healthChecks.liveness = true;
        this.log('Liveness probe passed', 'success');
      } else {
        this.log(
          `Liveness probe failed: ${livenessResponse.error || livenessResponse.data}`,
          'error',
        );
      }

      // Test readiness probe
      const readinessResponse = await this.makeApiRequest('GET', `${BASE_URL}/health/ready`);
      if (readinessResponse.success) {
        this.results.healthChecks.readiness = true;
        this.log('Readiness probe passed', 'success');
      } else {
        this.log(
          `Readiness probe failed: ${readinessResponse.error || readinessResponse.data}`,
          'error',
        );
      }
    } catch (error) {
      this.log(`Health check testing failed: ${error.message}`, 'error');
    }
  }

  async testAuthentication() {
    this.log('Testing authentication system...', 'info');

    try {
      // Generate development authentication token
      const tokenProcess = spawn('node', ['generate-dev-token.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.join(__dirname),
      });

      let tokenOutput = '';
      let tokenError = '';

      tokenProcess.stdout.on('data', (data) => {
        tokenOutput += data.toString();
      });

      tokenProcess.stderr.on('data', (data) => {
        tokenError += data.toString();
      });

      await new Promise((resolve, reject) => {
        tokenProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const tokenData = JSON.parse(tokenOutput);
              this.results.token = tokenData.accessToken;
              this.results.authentication.tokenGeneration = true;
              this.results.authentication.tokenExpiry = tokenData.expiresIn;
              this.log('Development authentication token generated successfully', 'success');
              resolve();
            } catch (parseError) {
              reject(
                new Error(
                  `Failed to parse token response: ${parseError.message}\nOutput: ${tokenOutput}\nError: ${tokenError}`,
                ),
              );
            }
          } else {
            reject(
              new Error(`Token generation failed with exit code ${code}\nError: ${tokenError}`),
            );
          }
        });
      });

      // Test token validation
      if (this.results.token) {
        const sessionResponse = await this.makeApiRequest('GET', '/sessions/current', null, {
          Authorization: `Bearer ${this.results.token}`,
        });

        if (sessionResponse.success) {
          this.results.authentication.tokenValidation = true;
          this.log('Token validation successful', 'success');
        } else {
          this.log(
            `Token validation failed: ${sessionResponse.error || sessionResponse.data}`,
            'error',
          );
        }
      }
    } catch (error) {
      this.results.authentication.error = error.message;
      this.log(`Authentication testing failed: ${error.message}`, 'error');
    }
  }

  async testSessionManagement() {
    this.log('Testing session management...', 'info');

    if (!this.results.token) {
      this.log('No authentication token available, skipping session management tests', 'warning');
      return;
    }

    try {
      // Get current session
      const sessionResponse = await this.makeApiRequest('GET', '/sessions/current', null, {
        Authorization: `Bearer ${this.results.token}`,
      });

      if (sessionResponse.success) {
        this.results.sessionManagement.sessionCreation = true;
        this.results.sessionManagement.sessionRetrieval = true;
        this.results.sessionManagement.sessionValidation = true;
        this.results.sessionManagement.sessionId = sessionResponse.data.data.id;
        this.log('Session management tests passed', 'success');
      } else {
        this.results.sessionManagement.error = sessionResponse.error || sessionResponse.data;
        this.log(`Session management failed: ${this.results.sessionManagement.error}`, 'error');
      }
    } catch (error) {
      this.results.sessionManagement.error = error.message;
      this.log(`Session management testing failed: ${error.message}`, 'error');
    }
  }

  async testContextManagement() {
    this.log('Testing context management...', 'info');

    if (!this.results.token) {
      this.log('No authentication token available, skipping context management tests', 'warning');
      return;
    }

    try {
      // Create a new context
      const contextData = {
        name: 'REST API Test Context',
        viewport: {
          width: 1920,
          height: 1080,
        },
        createPage: true,
      };

      const contextResponse = await this.makeApiRequest('POST', '/contexts', contextData, {
        Authorization: `Bearer ${this.results.token}`,
      });

      if (contextResponse.success) {
        this.results.contextManagement.contextCreation = true;
        this.results.contextManagement.contextId = contextResponse.data.data.id;
        this.results.contextManagement.pageId = contextResponse.data.data.page?.id;
        this.log(
          `Context created successfully: ${this.results.contextManagement.contextId}`,
          'success',
        );

        // Verify context retrieval
        const getContextResponse = await this.makeApiRequest(
          'GET',
          `/contexts/${this.results.contextManagement.contextId}`,
          null,
          {
            Authorization: `Bearer ${this.results.token}`,
          },
        );

        if (getContextResponse.success) {
          this.results.contextManagement.contextRetrieval = true;
          this.log('Context retrieval successful', 'success');
        } else {
          this.log(
            `Context retrieval failed: ${getContextResponse.error || getContextResponse.data}`,
            'error',
          );
        }
      } else {
        this.results.contextManagement.error = contextResponse.error || contextResponse.data;
        this.log(`Context creation failed: ${this.results.contextManagement.error}`, 'error');
      }
    } catch (error) {
      this.results.contextManagement.error = error.message;
      this.log(`Context management testing failed: ${error.message}`, 'error');
    }
  }

  async testBrowserActions() {
    this.log('Testing browser actions via REST API...', 'info');

    if (!this.results.contextManagement.contextId || !this.results.contextManagement.pageId) {
      this.log('No context or page available, skipping browser action tests', 'warning');
      return;
    }

    const contextId = this.results.contextManagement.contextId;
    const pageId = this.results.contextManagement.pageId;

    // Test 1: Navigate to paperclips game
    await this.testNavigate(contextId, pageId);

    // Test 2: Take initial screenshot
    await this.testScreenshot(contextId, pageId, 'initial');

    // Test 3: Extract page content
    await this.testContentExtraction(contextId, pageId);

    // Test 4: Click paperclip button
    await this.testClick(contextId, pageId);

    // Test 5: Take second screenshot to verify changes
    await this.testScreenshot(contextId, pageId, 'after-click');
  }

  async testNavigate(contextId, pageId) {
    this.log(`Testing navigation to ${PAPERCLIPS_URL}...`, 'info');

    try {
      const startTime = Date.now();
      const navigationData = {
        type: 'navigate',
        pageId: pageId,
        url: PAPERCLIPS_URL,
        waitUntil: 'networkidle2',
      };

      const response = await this.makeApiRequest(
        'POST',
        `/contexts/${contextId}/execute`,
        navigationData,
        {
          Authorization: `Bearer ${this.results.token}`,
        },
      );

      const duration = Date.now() - startTime;
      this.results.browserActions.navigate.duration = duration;

      if (response.success) {
        this.results.browserActions.navigate.success = true;
        this.log(`Navigation successful in ${duration}ms`, 'success');
      } else {
        this.results.browserActions.navigate.error = response.error || response.data;
        this.log(`Navigation failed: ${this.results.browserActions.navigate.error}`, 'error');
      }
    } catch (error) {
      this.results.browserActions.navigate.error = error.message;
      this.log(`Navigation testing failed: ${error.message}`, 'error');
    }
  }

  async testScreenshot(contextId, pageId, label) {
    this.log(`Testing screenshot capture (${label})...`, 'info');

    try {
      const startTime = Date.now();
      const screenshotData = {
        type: 'screenshot',
        pageId: pageId,
        fullPage: true,
        format: 'png',
      };

      const response = await this.makeApiRequest(
        'POST',
        `/contexts/${contextId}/execute`,
        screenshotData,
        {
          Authorization: `Bearer ${this.results.token}`,
        },
      );

      const duration = Date.now() - startTime;
      const resultKey = label === 'initial' ? 'screenshot' : 'secondScreenshot';
      this.results.browserActions[resultKey].duration = duration;

      if (response.success && response.data.data.data) {
        this.results.browserActions[resultKey].success = true;
        this.results.browserActions[resultKey].data = {
          format: 'png',
          size: response.data.data.data.length || 0,
          base64: typeof response.data.data.data === 'string',
        };

        // Save screenshot to file
        if (typeof response.data.data.data === 'string') {
          const filename = `rest-api-screenshot-${label}-${Date.now()}.png`;
          const filepath = path.join(RESULTS_DIR, filename);

          try {
            const buffer = Buffer.from(response.data.data.data, 'base64');
            await fs.writeFile(filepath, buffer);
            this.results.screenshots.push({
              label,
              filename,
              filepath,
              size: buffer.length,
            });
            this.log(`Screenshot saved: ${filename} (${buffer.length} bytes)`, 'success');
          } catch (saveError) {
            this.log(`Failed to save screenshot: ${saveError.message}`, 'warning');
          }
        }

        this.log(`Screenshot capture (${label}) successful in ${duration}ms`, 'success');
      } else {
        this.results.browserActions[resultKey].error = response.error || response.data;
        this.log(
          `Screenshot capture (${label}) failed: ${this.results.browserActions[resultKey].error}`,
          'error',
        );
      }
    } catch (error) {
      const resultKey = label === 'initial' ? 'screenshot' : 'secondScreenshot';
      this.results.browserActions[resultKey].error = error.message;
      this.log(`Screenshot testing (${label}) failed: ${error.message}`, 'error');
    }
  }

  async testContentExtraction(contextId, pageId) {
    this.log('Testing content extraction via API...', 'info');

    try {
      const startTime = Date.now();
      const extractData = {
        type: 'evaluate',
        pageId: pageId,
        function:
          '() => ({ title: document.title, body: document.body.innerHTML.substring(0, 1000), url: window.location.href })',
      };

      const response = await this.makeApiRequest(
        'POST',
        `/contexts/${contextId}/execute`,
        extractData,
        {
          Authorization: `Bearer ${this.results.token}`,
        },
      );

      const duration = Date.now() - startTime;
      this.results.browserActions.content.duration = duration;

      if (response.success) {
        this.results.browserActions.content.success = true;
        this.results.browserActions.content.data = response.data.data.data;
        this.log(`Content extraction successful in ${duration}ms`, 'success');

        // Save content to file
        const filename = `rest-api-content-${Date.now()}.json`;
        const filepath = path.join(RESULTS_DIR, filename);

        try {
          await fs.writeFile(filepath, JSON.stringify(response.data.data.data, null, 2));
          this.log(`Content saved to: ${filename}`, 'success');
        } catch (saveError) {
          this.log(`Failed to save content: ${saveError.message}`, 'warning');
        }
      } else {
        this.results.browserActions.content.error = response.error || response.data;
        this.log(
          `Content extraction failed: ${this.results.browserActions.content.error}`,
          'error',
        );
      }
    } catch (error) {
      this.results.browserActions.content.error = error.message;
      this.log(`Content extraction testing failed: ${error.message}`, 'error');
    }
  }

  async testClick(contextId, pageId) {
    this.log('Testing click interaction via API...', 'info');

    try {
      const startTime = Date.now();

      // First, try to find the paperclip button
      const findButtonData = {
        type: 'evaluate',
        pageId: pageId,
        function: `() => {
          const selectors = [
            'button[id*="paperclip"]',
            'input[type="button"][value*="paperclip"]',
            '#btnMakePaperclip',
            'button[onclick*="makePaperclip"]',
            'input[value*="Make Paperclip"]',
            'button[title*="paperclip"]'
          ];
          
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              return {
                found: true,
                selector: selector,
                text: element.textContent || element.value || element.title,
                id: element.id,
                tagName: element.tagName
              };
            }
          }
          
          // Try to find any clickable element with paperclip or make text
          const allButtons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
          for (const btn of allButtons) {
            const text = (btn.textContent || btn.value || '').toLowerCase();
            if (text.includes('paperclip') || text.includes('clip') || text.includes('make')) {
              return {
                found: true,
                selector: btn.id ? '#' + btn.id : btn.tagName.toLowerCase(),
                text: btn.textContent || btn.value,
                id: btn.id,
                tagName: btn.tagName
              };
            }
          }
          
          return {
            found: false,
            availableButtons: Array.from(allButtons).map(b => ({
              text: (b.textContent || b.value || '').substring(0, 50),
              id: b.id,
              tagName: b.tagName
            }))
          };
        }`,
      };

      const buttonResponse = await this.makeApiRequest(
        'POST',
        `/contexts/${contextId}/execute`,
        findButtonData,
        {
          Authorization: `Bearer ${this.results.token}`,
        },
      );

      if (buttonResponse.success && buttonResponse.data.data.data.found) {
        this.log(`Found paperclip button: ${buttonResponse.data.data.data.text}`, 'success');

        // Now click the button
        const clickData = {
          type: 'click',
          pageId: pageId,
          selector: buttonResponse.data.data.data.selector || 'button',
          clickCount: 1,
        };

        const clickResponse = await this.makeApiRequest(
          'POST',
          `/contexts/${contextId}/execute`,
          clickData,
          {
            Authorization: `Bearer ${this.results.token}`,
          },
        );

        const duration = Date.now() - startTime;
        this.results.browserActions.click.duration = duration;

        if (clickResponse.success) {
          this.results.browserActions.click.success = true;
          this.results.browserActions.click.data = {
            buttonFound: true,
            buttonText: buttonResponse.data.data.data.text,
            clickExecuted: true,
          };
          this.log(`Click action successful in ${duration}ms`, 'success');
        } else {
          this.results.browserActions.click.error = clickResponse.error || clickResponse.data;
          this.log(`Click action failed: ${this.results.browserActions.click.error}`, 'error');
        }
      } else {
        this.results.browserActions.click.error = 'Paperclip button not found';
        this.results.browserActions.click.data = buttonResponse.data?.data?.data || {};
        this.log('Paperclip button not found on page', 'error');

        if (buttonResponse.data?.data?.data?.availableButtons) {
          this.log(
            `Available buttons: ${JSON.stringify(buttonResponse.data.data.data.availableButtons)}`,
            'info',
          );
        }
      }
    } catch (error) {
      this.results.browserActions.click.error = error.message;
      this.log(`Click testing failed: ${error.message}`, 'error');
    }
  }

  async calculateMetrics() {
    if (this.results.apiMetrics.requestTimes.length > 0) {
      const totalTime = this.results.apiMetrics.requestTimes.reduce((sum, time) => sum + time, 0);
      this.results.apiMetrics.averageResponseTime =
        totalTime / this.results.apiMetrics.requestTimes.length;
    }
  }

  async cleanup() {
    this.log('Cleaning up test resources...', 'info');

    try {
      // Delete context if created
      if (this.results.contextManagement.contextId && this.results.token) {
        const deleteResponse = await this.makeApiRequest(
          'DELETE',
          `/contexts/${this.results.contextManagement.contextId}`,
          null,
          {
            Authorization: `Bearer ${this.results.token}`,
          },
        );

        if (deleteResponse.success) {
          this.log('Test context deleted successfully', 'success');
        } else {
          this.log(
            `Failed to delete test context: ${deleteResponse.error || deleteResponse.data}`,
            'warning',
          );
        }
      }

      // Stop server if we started it
      await this.stopServer();
    } catch (error) {
      this.log(`Cleanup failed: ${error.message}`, 'error');
    }
  }

  async saveResults() {
    try {
      this.results.endTime = new Date().toISOString();
      this.results.duration = new Date(this.results.endTime) - new Date(this.results.startTime);

      await this.calculateMetrics();

      const filename = `rest-api-test-results-${Date.now()}.json`;
      const filepath = path.join(RESULTS_DIR, filename);

      await fs.writeFile(filepath, JSON.stringify(this.results, null, 2));
      this.log(`Test results saved to: ${filename}`, 'success');

      return filename;
    } catch (error) {
      this.log(`Failed to save results: ${error.message}`, 'error');
      return null;
    }
  }

  printSummary() {
    console.log('\n=== REST API TEST SUMMARY ===');
    console.log(`Test ID: ${this.results.testId}`);
    console.log(`Duration: ${this.results.duration}ms`);
    console.log(`Total API Requests: ${this.results.apiMetrics.totalRequests}`);
    console.log(`Successful Requests: ${this.results.apiMetrics.successfulRequests}`);
    console.log(`Failed Requests: ${this.results.apiMetrics.failedRequests}`);
    console.log(
      `Average Response Time: ${Math.round(this.results.apiMetrics.averageResponseTime)}ms`,
    );
    console.log(`Screenshots Captured: ${this.results.screenshots.length}`);

    console.log('\n=== TEST RESULTS ===');
    console.log(`✅ Server Startup: ${this.results.serverStartup.success ? 'PASS' : 'FAIL'}`);
    console.log(
      `✅ Health Checks: ${Object.values(this.results.healthChecks).every(Boolean) ? 'PASS' : 'FAIL'}`,
    );
    console.log(
      `✅ Authentication: ${this.results.authentication.tokenGeneration && this.results.authentication.tokenValidation ? 'PASS' : 'FAIL'}`,
    );
    console.log(
      `✅ Session Management: ${this.results.sessionManagement.sessionCreation && this.results.sessionManagement.sessionRetrieval ? 'PASS' : 'FAIL'}`,
    );
    console.log(
      `✅ Context Management: ${this.results.contextManagement.contextCreation && this.results.contextManagement.contextRetrieval ? 'PASS' : 'FAIL'}`,
    );
    console.log(
      `✅ Browser Navigation: ${this.results.browserActions.navigate.success ? 'PASS' : 'FAIL'}`,
    );
    console.log(
      `✅ Screenshot Capture: ${this.results.browserActions.screenshot.success ? 'PASS' : 'FAIL'}`,
    );
    console.log(
      `✅ Content Extraction: ${this.results.browserActions.content.success ? 'PASS' : 'FAIL'}`,
    );
    console.log(
      `✅ Click Interaction: ${this.results.browserActions.click.success ? 'PASS' : 'FAIL'}`,
    );
    console.log(
      `✅ Second Screenshot: ${this.results.browserActions.secondScreenshot.success ? 'PASS' : 'FAIL'}`,
    );

    console.log('\n=== PERFORMANCE METRICS ===');
    if (this.results.browserActions.navigate.success) {
      console.log(`Navigation Time: ${this.results.browserActions.navigate.duration}ms`);
    }
    if (this.results.browserActions.screenshot.success) {
      console.log(`Screenshot Time: ${this.results.browserActions.screenshot.duration}ms`);
    }
    if (this.results.browserActions.content.success) {
      console.log(`Content Extraction Time: ${this.results.browserActions.content.duration}ms`);
    }
    if (this.results.browserActions.click.success) {
      console.log(`Click Action Time: ${this.results.browserActions.click.duration}ms`);
    }

    if (this.results.issues.length > 0) {
      console.log('\n=== ISSUES ENCOUNTERED ===');
      this.results.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.message}`);
      });
    }

    console.log(`\n=== RESULTS SAVED TO ===`);
    console.log(`Directory: ${RESULTS_DIR}`);
    console.log(`Screenshots: ${this.results.screenshots.length} files`);
  }

  async runRestApiTest() {
    this.log('Starting REST API test suite...', 'info');

    await this.ensureResultsDirectory();

    try {
      // Step 1: Start server
      const serverStarted = await this.startServer();
      if (!serverStarted) {
        throw new Error('Failed to start server');
      }

      // Step 2: Test health checks
      await this.testHealthChecks();

      // Step 3: Test authentication
      await this.testAuthentication();

      // Step 4: Test session management
      await this.testSessionManagement();

      // Step 5: Test context management
      await this.testContextManagement();

      // Step 6: Test browser actions
      await this.testBrowserActions();

      this.log('REST API test suite completed successfully!', 'success');
    } catch (error) {
      this.log(`REST API test suite failed: ${error.message}`, 'error');
    } finally {
      // Cleanup
      await this.cleanup();

      // Save results
      await this.saveResults();

      // Print summary
      this.printSummary();
    }
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new RestApiTest();
  test.runRestApiTest().catch(console.error);
}

export { RestApiTest };
