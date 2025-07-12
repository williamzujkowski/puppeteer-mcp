#!/usr/bin/env node

/**
 * Comprehensive MCP Interface Test
 * Tests the complete MCP protocol implementation with real browser automation
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAPERCLIPS_URL = 'https://williamzujkowski.github.io/paperclips/index2.html';
const RESULTS_DIR = path.join(__dirname, 'results');
const LOGS_DIR = path.join(__dirname, 'logs', 'mcp');

class ComprehensiveMCPTest {
  constructor() {
    this.results = {
      startTime: new Date().toISOString(),
      testPhases: {
        mcpServerStartup: { status: 'pending', details: {} },
        protocolHandshake: { status: 'pending', details: {} },
        toolDiscovery: { status: 'pending', details: {} },
        sessionManagement: { status: 'pending', details: {} },
        browserAutomation: { status: 'pending', details: {} },
        contextManagement: { status: 'pending', details: {} },
        resourceAccess: { status: 'pending', details: {} },
      },
      mcpMessages: [],
      errors: [],
      warnings: [],
      performance: {
        messageLatencies: [],
        operationTimings: {},
      },
      screenshots: [],
      htmlContent: [],
      sessionData: null,
      contextData: null,
    };

    this.mcpProcess = null;
    this.messageId = 1;
    this.sessionId = null;
    this.contextId = null;
  }

  log(message, type = 'info', phase = null) {
    const timestamp = new Date().toISOString();
    const prefix =
      {
        error: '❌',
        success: '✅',
        warning: '⚠️',
        info: 'ℹ️',
        debug: '🔍',
      }[type] || 'ℹ️';

    console.log(`${prefix} [${timestamp}] ${phase ? `[${phase}] ` : ''}${message}`);

    if (type === 'error') {
      this.results.errors.push({ timestamp, message, phase });
    } else if (type === 'warning') {
      this.results.warnings.push({ timestamp, message, phase });
    }
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(RESULTS_DIR, { recursive: true });
      await fs.mkdir(LOGS_DIR, { recursive: true });
    } catch (error) {
      this.log(`Failed to create directories: ${error.message}`, 'error');
    }
  }

  async saveScreenshot(screenshotData, filename, metadata = {}) {
    try {
      const filepath = path.join(RESULTS_DIR, filename);
      const buffer = Buffer.from(screenshotData, 'base64');
      await fs.writeFile(filepath, buffer);

      const screenshotInfo = {
        filename,
        filepath,
        size: buffer.length,
        timestamp: new Date().toISOString(),
        ...metadata,
      };

      this.results.screenshots.push(screenshotInfo);
      this.log(`Screenshot saved: ${filename} (${buffer.length} bytes)`, 'success');
      return filepath;
    } catch (error) {
      this.log(`Failed to save screenshot: ${error.message}`, 'error');
      return null;
    }
  }

  async saveHTMLContent(content, filename, metadata = {}) {
    try {
      const filepath = path.join(RESULTS_DIR, filename);
      await fs.writeFile(filepath, content);

      const contentInfo = {
        filename,
        filepath,
        size: content.length,
        timestamp: new Date().toISOString(),
        ...metadata,
      };

      this.results.htmlContent.push(contentInfo);
      this.log(`HTML content saved: ${filename} (${content.length} chars)`, 'success');
      return filepath;
    } catch (error) {
      this.log(`Failed to save HTML content: ${error.message}`, 'error');
      return null;
    }
  }

  sendMCPMessage(method, params = {}, isNotification = false) {
    return new Promise((resolve, reject) => {
      if (!this.mcpProcess) {
        reject(new Error('MCP process not started'));
        return;
      }

      const startTime = Date.now();
      const message = {
        jsonrpc: '2.0',
        method,
        params,
      };

      // Only add ID for requests, not notifications
      if (!isNotification) {
        message.id = this.messageId++;
      }

      const messageString = JSON.stringify(message) + '\n';
      this.log(
        `Sending MCP ${isNotification ? 'notification' : 'message'}: ${method}${!isNotification ? ` (ID: ${message.id})` : ''}`,
        'debug',
      );
      this.results.mcpMessages.push({
        type: 'sent',
        message,
        timestamp: new Date().toISOString(),
      });

      // For notifications, resolve immediately after sending
      if (isNotification) {
        this.mcpProcess.stdin.write(messageString);
        resolve(null);
        return;
      }

      // Set up response handler with buffering for multi-line responses
      let responseBuffer = '';
      const timeout = setTimeout(() => {
        this.mcpProcess.stdout.removeListener('data', dataHandler);
        reject(new Error(`MCP message timeout: ${method}`));
      }, 30000);

      const dataHandler = (data) => {
        responseBuffer += data.toString();

        // Try to parse complete JSON messages
        const lines = responseBuffer.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const response = JSON.parse(line);

              // Record latency
              const latency = Date.now() - startTime;
              this.results.performance.messageLatencies.push({
                method,
                latency,
                timestamp: new Date().toISOString(),
              });

              this.results.mcpMessages.push({
                type: 'received',
                message: response,
                timestamp: new Date().toISOString(),
                latency,
              });

              if (response.id === message.id) {
                clearTimeout(timeout);
                this.mcpProcess.stdout.removeListener('data', dataHandler);

                if (response.error) {
                  reject(new Error(`MCP error: ${response.error.message}`));
                } else {
                  resolve(response.result);
                }
                return;
              }
            } catch (parseError) {
              this.log(`Failed to parse MCP response line: ${line}`, 'debug');
            }
          }
        }

        // Keep the last incomplete line in the buffer
        responseBuffer = lines[lines.length - 1];
      };

      this.mcpProcess.stdout.on('data', dataHandler);
      this.mcpProcess.stdin.write(messageString);
    });
  }

  async testMCPServerStartup() {
    const phase = 'mcpServerStartup';
    this.log('Starting MCP server...', 'info', phase);

    try {
      const startTime = Date.now();

      // Start the MCP server process
      this.mcpProcess = spawn('node', ['dist/mcp/start-mcp.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.join(__dirname, '..', '..'),
        env: {
          ...process.env,
          MCP_TRANSPORT: 'stdio',
          NODE_ENV: 'development', // Use development to avoid JWT requirement
          JWT_SECRET: 'test-secret-for-mcp-testing-with-32-chars-minimum',
          API_KEY_SECRET: 'test-api-key-secret-with-32-chars-minimum',
          LOG_LEVEL: 'debug',
        },
      });

      // Capture stderr for debugging
      let stderrBuffer = '';
      this.mcpProcess.stderr.on('data', (data) => {
        stderrBuffer += data.toString();
        this.log(`MCP stderr: ${data.toString()}`, 'debug', phase);
      });

      // Wait for process to stabilize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (this.mcpProcess.exitCode !== null) {
        throw new Error(
          `MCP process exited with code ${this.mcpProcess.exitCode}\nstderr: ${stderrBuffer}`,
        );
      }

      const startupTime = Date.now() - startTime;
      this.results.testPhases.mcpServerStartup = {
        status: 'success',
        details: {
          startupTime,
          pid: this.mcpProcess.pid,
          stderr: stderrBuffer,
        },
      };

      this.log(
        `MCP server started successfully (PID: ${this.mcpProcess.pid}, Time: ${startupTime}ms)`,
        'success',
        phase,
      );
      return true;
    } catch (error) {
      this.results.testPhases.mcpServerStartup = {
        status: 'failed',
        details: { error: error.message },
      };
      this.log(`MCP server startup failed: ${error.message}`, 'error', phase);
      throw error;
    }
  }

  async testProtocolHandshake() {
    const phase = 'protocolHandshake';
    this.log('Testing MCP protocol handshake...', 'info', phase);

    try {
      const startTime = Date.now();

      // Send initialize message
      const initResult = await this.sendMCPMessage('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: true,
          },
          sampling: {},
        },
        clientInfo: {
          name: 'puppeteer-mcp-test',
          version: '1.0.0',
        },
      });

      // Send initialized notification
      await this.sendMCPMessage('notifications/initialized', {}, true);

      const handshakeTime = Date.now() - startTime;

      this.results.testPhases.protocolHandshake = {
        status: 'success',
        details: {
          handshakeTime,
          serverInfo: initResult.serverInfo,
          protocolVersion: initResult.protocolVersion,
          capabilities: initResult.capabilities,
        },
      };

      this.log(`Protocol handshake successful (Time: ${handshakeTime}ms)`, 'success', phase);
      this.log(
        `Server: ${initResult.serverInfo?.name} v${initResult.serverInfo?.version}`,
        'info',
        phase,
      );

      return initResult;
    } catch (error) {
      this.results.testPhases.protocolHandshake = {
        status: 'failed',
        details: { error: error.message },
      };
      this.log(`Protocol handshake failed: ${error.message}`, 'error', phase);
      throw error;
    }
  }

  async testToolDiscovery() {
    const phase = 'toolDiscovery';
    this.log('Testing tool discovery...', 'info', phase);

    try {
      const startTime = Date.now();

      // List available tools
      const toolsResult = await this.sendMCPMessage('tools/list');
      const discoveryTime = Date.now() - startTime;

      const tools = toolsResult.tools || [];
      this.log(`Discovered ${tools.length} tools`, 'info', phase);

      // Categorize tools
      const toolCategories = {
        session: [],
        browser: [],
        api: [],
        other: [],
      };

      tools.forEach((tool) => {
        this.log(`  - ${tool.name}: ${tool.description}`, 'info', phase);

        if (tool.name.includes('session')) {
          toolCategories.session.push(tool);
        } else if (tool.name.includes('browser') || tool.name.includes('context')) {
          toolCategories.browser.push(tool);
        } else if (tool.name.includes('api')) {
          toolCategories.api.push(tool);
        } else {
          toolCategories.other.push(tool);
        }
      });

      // List available resources
      const resourcesResult = await this.sendMCPMessage('resources/list');
      const resources = resourcesResult.resources || [];
      this.log(`Discovered ${resources.length} resources`, 'info', phase);

      resources.forEach((resource) => {
        this.log(`  - ${resource.name} (${resource.uri}): ${resource.description}`, 'info', phase);
      });

      this.results.testPhases.toolDiscovery = {
        status: 'success',
        details: {
          discoveryTime,
          totalTools: tools.length,
          toolCategories,
          tools,
          resources,
        },
      };

      this.log(`Tool discovery successful (Time: ${discoveryTime}ms)`, 'success', phase);
      return { tools, resources };
    } catch (error) {
      this.results.testPhases.toolDiscovery = {
        status: 'failed',
        details: { error: error.message },
      };
      this.log(`Tool discovery failed: ${error.message}`, 'error', phase);
      throw error;
    }
  }

  async testSessionManagement() {
    const phase = 'sessionManagement';
    this.log('Testing session management...', 'info', phase);

    try {
      const startTime = Date.now();

      // Create a session
      this.log('Creating session...', 'info', phase);
      const createResult = await this.sendMCPMessage('tools/call', {
        name: 'create-session',
        arguments: {
          username: 'demo',
          password: 'demo123!',
          duration: 3600, // 1 hour
        },
      });

      if (!createResult.content?.[0]?.text) {
        throw new Error('Invalid session creation response');
      }

      const sessionData = JSON.parse(createResult.content[0].text);
      this.sessionId = sessionData.sessionId;
      this.results.sessionData = sessionData;

      this.log(`Session created: ${this.sessionId}`, 'success', phase);

      // List sessions
      this.log('Listing sessions...', 'info', phase);
      const listResult = await this.sendMCPMessage('tools/call', {
        name: 'list-sessions',
        arguments: {
          userId: sessionData.userId,
        },
      });

      const sessionsList = JSON.parse(listResult.content[0].text);
      this.log(`Found ${sessionsList.sessions?.length || 0} active sessions`, 'info', phase);

      const sessionTime = Date.now() - startTime;

      this.results.testPhases.sessionManagement = {
        status: 'success',
        details: {
          operationTime: sessionTime,
          sessionId: this.sessionId,
          sessionData,
          activeSessions: sessionsList.sessions?.length || 0,
        },
      };

      this.log(`Session management test successful (Time: ${sessionTime}ms)`, 'success', phase);
      return sessionData;
    } catch (error) {
      this.results.testPhases.sessionManagement = {
        status: 'failed',
        details: { error: error.message },
      };
      this.log(`Session management test failed: ${error.message}`, 'error', phase);
      throw error;
    }
  }

  async testBrowserAutomation() {
    const phase = 'browserAutomation';
    this.log('Testing browser automation capabilities...', 'info', phase);

    if (!this.sessionId) {
      this.log('No session available, skipping browser tests', 'warning', phase);
      this.results.testPhases.browserAutomation = {
        status: 'skipped',
        details: { reason: 'No session available' },
      };
      return;
    }

    try {
      const startTime = Date.now();
      const automationResults = {};

      // Create browser context
      this.log('Creating browser context...', 'info', phase);
      const contextResult = await this.sendMCPMessage('tools/call', {
        name: 'create-browser-context',
        arguments: {
          sessionId: this.sessionId,
          options: {
            headless: true,
            viewport: {
              width: 1920,
              height: 1080,
            },
          },
        },
      });

      const contextData = JSON.parse(contextResult.content[0].text);
      this.contextId = contextData.contextId;
      this.results.contextData = contextData;
      automationResults.contextCreation = { success: true, contextId: this.contextId };

      this.log(`Browser context created: ${this.contextId}`, 'success', phase);

      // Navigate to page
      this.log(`Navigating to ${PAPERCLIPS_URL}...`, 'info', phase);
      const navResult = await this.sendMCPMessage('tools/call', {
        name: 'execute-in-context',
        arguments: {
          contextId: this.contextId,
          command: 'navigate',
          parameters: {
            url: PAPERCLIPS_URL,
            waitUntil: 'networkidle2',
            timeout: 30000,
          },
        },
      });

      const navData = JSON.parse(navResult.content[0].text);
      automationResults.navigation = { success: navData.success, url: PAPERCLIPS_URL };
      this.log('Navigation successful', 'success', phase);

      // Wait for page to load
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Take screenshot
      this.log('Capturing screenshot...', 'info', phase);
      const screenshotResult = await this.sendMCPMessage('tools/call', {
        name: 'execute-in-context',
        arguments: {
          contextId: this.contextId,
          command: 'screenshot',
          parameters: {
            fullPage: true,
            type: 'png',
          },
        },
      });

      const screenshotData = JSON.parse(screenshotResult.content[0].text);
      if (screenshotData.screenshot) {
        const filename = `mcp-paperclips-initial-${Date.now()}.png`;
        await this.saveScreenshot(screenshotData.screenshot, filename, { phase: 'initial' });
        automationResults.screenshot = { success: true, filename };
      }

      // Get page content
      this.log('Extracting page content...', 'info', phase);
      const contentResult = await this.sendMCPMessage('tools/call', {
        name: 'execute-in-context',
        arguments: {
          contextId: this.contextId,
          command: 'evaluate',
          parameters: {
            expression: 'document.documentElement.outerHTML',
          },
        },
      });

      const contentData = JSON.parse(contentResult.content[0].text);
      if (contentData.result) {
        const filename = `mcp-paperclips-content-${Date.now()}.html`;
        await this.saveHTMLContent(contentData.result, filename, { phase: 'initial' });
        automationResults.contentExtraction = { success: true, filename };
      }

      // Test page interaction
      this.log('Testing page interactions...', 'info', phase);
      const interactionResult = await this.sendMCPMessage('tools/call', {
        name: 'execute-in-context',
        arguments: {
          contextId: this.contextId,
          command: 'evaluate',
          parameters: {
            expression: `
              // Find and click paperclip button
              const buttons = Array.from(document.querySelectorAll('button, input[type="button"]'));
              const paperclipButton = buttons.find(b => 
                (b.textContent && b.textContent.toLowerCase().includes('paperclip')) ||
                (b.value && b.value.toLowerCase().includes('paperclip')) ||
                (b.id && b.id.toLowerCase().includes('paperclip'))
              );
              
              if (paperclipButton) {
                paperclipButton.click();
                { success: true, buttonFound: true, buttonId: paperclipButton.id || 'unknown' }
              } else {
                { success: false, buttonFound: false, availableButtons: buttons.length }
              }
            `,
          },
        },
      });

      const interactionData = JSON.parse(interactionResult.content[0].text);
      automationResults.interaction = interactionData.result;

      if (interactionData.result?.success) {
        this.log('Page interaction successful', 'success', phase);

        // Take screenshot after interaction
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const postInteractionScreenshot = await this.sendMCPMessage('tools/call', {
          name: 'execute-in-context',
          arguments: {
            contextId: this.contextId,
            command: 'screenshot',
            parameters: {
              fullPage: true,
              type: 'png',
            },
          },
        });

        const postScreenshotData = JSON.parse(postInteractionScreenshot.content[0].text);
        if (postScreenshotData.screenshot) {
          const filename = `mcp-paperclips-post-interaction-${Date.now()}.png`;
          await this.saveScreenshot(postScreenshotData.screenshot, filename, {
            phase: 'post-interaction',
          });
        }
      }

      const automationTime = Date.now() - startTime;

      this.results.testPhases.browserAutomation = {
        status: 'success',
        details: {
          operationTime: automationTime,
          contextId: this.contextId,
          results: automationResults,
        },
      };

      this.log(`Browser automation test successful (Time: ${automationTime}ms)`, 'success', phase);
    } catch (error) {
      this.results.testPhases.browserAutomation = {
        status: 'failed',
        details: { error: error.message },
      };
      this.log(`Browser automation test failed: ${error.message}`, 'error', phase);
      throw error;
    }
  }

  async testContextManagement() {
    const phase = 'contextManagement';
    this.log('Testing context management...', 'info', phase);

    if (!this.contextId) {
      this.log('No context available, skipping context tests', 'warning', phase);
      this.results.testPhases.contextManagement = {
        status: 'skipped',
        details: { reason: 'No context available' },
      };
      return;
    }

    try {
      const startTime = Date.now();
      const managementResults = {};

      // Test context state persistence
      this.log('Testing context state persistence...', 'info', phase);
      const stateResult = await this.sendMCPMessage('tools/call', {
        name: 'execute-in-context',
        arguments: {
          contextId: this.contextId,
          command: 'evaluate',
          parameters: {
            expression: `
              // Set a value in the page
              window.testValue = 'MCP_TEST_' + Date.now();
              window.testValue;
            `,
          },
        },
      });

      const stateData = JSON.parse(stateResult.content[0].text);
      const testValue = stateData.result;
      managementResults.statePersistence = { set: true, value: testValue };

      // Verify state persistence
      const verifyResult = await this.sendMCPMessage('tools/call', {
        name: 'execute-in-context',
        arguments: {
          contextId: this.contextId,
          command: 'evaluate',
          parameters: {
            expression: 'window.testValue',
          },
        },
      });

      const verifyData = JSON.parse(verifyResult.content[0].text);
      managementResults.statePersistence.verified = verifyData.result === testValue;

      // Test multiple page operations
      this.log('Testing multiple page operations...', 'info', phase);
      const operations = [
        {
          name: 'cookies',
          command: 'evaluate',
          parameters: { expression: 'document.cookie' },
        },
        {
          name: 'localStorage',
          command: 'evaluate',
          parameters: { expression: 'Object.keys(localStorage).length' },
        },
        {
          name: 'pageTitle',
          command: 'evaluate',
          parameters: { expression: 'document.title' },
        },
      ];

      for (const op of operations) {
        const opResult = await this.sendMCPMessage('tools/call', {
          name: 'execute-in-context',
          arguments: {
            contextId: this.contextId,
            command: op.command,
            parameters: op.parameters,
          },
        });

        const opData = JSON.parse(opResult.content[0].text);
        managementResults[op.name] = opData.result;
      }

      const managementTime = Date.now() - startTime;

      this.results.testPhases.contextManagement = {
        status: 'success',
        details: {
          operationTime: managementTime,
          results: managementResults,
        },
      };

      this.log(`Context management test successful (Time: ${managementTime}ms)`, 'success', phase);
    } catch (error) {
      this.results.testPhases.contextManagement = {
        status: 'failed',
        details: { error: error.message },
      };
      this.log(`Context management test failed: ${error.message}`, 'error', phase);
    }
  }

  async testResourceAccess() {
    const phase = 'resourceAccess';
    this.log('Testing resource access...', 'info', phase);

    try {
      const startTime = Date.now();
      const resourceResults = {};

      // Read API catalog
      this.log('Reading API catalog resource...', 'info', phase);
      const catalogResult = await this.sendMCPMessage('resources/read', {
        uri: 'api://catalog',
      });

      if (catalogResult.contents?.[0]) {
        const catalog = JSON.parse(catalogResult.contents[0].text);
        resourceResults.apiCatalog = {
          success: true,
          endpointCount: Object.keys(catalog.endpoints || {}).length,
          protocols: catalog.protocols || [],
        };
        this.log(
          `API catalog loaded: ${resourceResults.apiCatalog.endpointCount} endpoints`,
          'success',
          phase,
        );
      }

      // Read system health
      this.log('Reading system health resource...', 'info', phase);
      const healthResult = await this.sendMCPMessage('resources/read', {
        uri: 'api://health',
      });

      if (healthResult.contents?.[0]) {
        const health = JSON.parse(healthResult.contents[0].text);
        resourceResults.systemHealth = {
          success: true,
          status: health.status,
          components: Object.keys(health.components || {}),
        };
        this.log(`System health: ${health.status}`, 'success', phase);
      }

      const resourceTime = Date.now() - startTime;

      this.results.testPhases.resourceAccess = {
        status: 'success',
        details: {
          operationTime: resourceTime,
          results: resourceResults,
        },
      };

      this.log(`Resource access test successful (Time: ${resourceTime}ms)`, 'success', phase);
    } catch (error) {
      this.results.testPhases.resourceAccess = {
        status: 'failed',
        details: { error: error.message },
      };
      this.log(`Resource access test failed: ${error.message}`, 'error', phase);
    }
  }

  async cleanup() {
    this.log('Cleaning up test resources...', 'info');

    try {
      // Delete session if created
      if (this.sessionId) {
        this.log('Deleting test session...', 'info');
        await this.sendMCPMessage('tools/call', {
          name: 'delete-session',
          arguments: {
            sessionId: this.sessionId,
          },
        });
        this.log('Session deleted', 'success');
      }

      // Close browser context if open
      if (this.contextId) {
        this.log('Closing browser context...', 'info');
        try {
          await this.sendMCPMessage('tools/call', {
            name: 'execute-in-context',
            arguments: {
              contextId: this.contextId,
              command: 'close',
              parameters: {},
            },
          });
          this.log('Browser context closed', 'success');
        } catch (error) {
          this.log(`Failed to close browser context: ${error.message}`, 'warning');
        }
      }

      // Stop MCP process
      if (this.mcpProcess) {
        this.log('Stopping MCP server...', 'info');
        this.mcpProcess.kill('SIGTERM');
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (this.mcpProcess.exitCode === null) {
          this.mcpProcess.kill('SIGKILL');
        }
        this.log('MCP server stopped', 'success');
      }
    } catch (error) {
      this.log(`Cleanup error: ${error.message}`, 'error');
    }
  }

  async saveTestResults() {
    this.log('Saving comprehensive test results...', 'info');

    this.results.endTime = new Date().toISOString();
    this.results.duration = new Date(this.results.endTime) - new Date(this.results.startTime);

    // Calculate statistics
    this.results.statistics = {
      totalMessages: this.results.mcpMessages.length,
      averageLatency:
        this.results.performance.messageLatencies.length > 0
          ? this.results.performance.messageLatencies.reduce((sum, m) => sum + m.latency, 0) /
            this.results.performance.messageLatencies.length
          : 0,
      successfulPhases: Object.values(this.results.testPhases).filter((p) => p.status === 'success')
        .length,
      failedPhases: Object.values(this.results.testPhases).filter((p) => p.status === 'failed')
        .length,
      skippedPhases: Object.values(this.results.testPhases).filter((p) => p.status === 'skipped')
        .length,
    };

    const filename = `comprehensive-mcp-test-results-${Date.now()}.json`;
    const filepath = path.join(RESULTS_DIR, filename);

    try {
      await fs.writeFile(filepath, JSON.stringify(this.results, null, 2));
      this.log(`Test results saved: ${filename}`, 'success');

      // Also save a summary report
      const summaryFilename = `mcp-test-summary-${Date.now()}.md`;
      const summaryPath = path.join(RESULTS_DIR, summaryFilename);
      await fs.writeFile(summaryPath, this.generateSummaryReport());
      this.log(`Summary report saved: ${summaryFilename}`, 'success');
    } catch (error) {
      this.log(`Failed to save test results: ${error.message}`, 'error');
    }
  }

  generateSummaryReport() {
    const report = [];

    report.push('# Comprehensive MCP Test Report');
    report.push(`\nGenerated: ${new Date().toISOString()}`);
    report.push(`Duration: ${this.results.duration}ms`);

    report.push('\n## Test Phase Results\n');
    Object.entries(this.results.testPhases).forEach(([phase, result]) => {
      const statusEmoji =
        {
          success: '✅',
          failed: '❌',
          skipped: '⏭️',
          pending: '⏳',
        }[result.status] || '❓';

      report.push(`### ${statusEmoji} ${phase}`);
      report.push(`- Status: ${result.status}`);
      if (result.details) {
        report.push(`- Details: ${JSON.stringify(result.details, null, 2)}`);
      }
      report.push('');
    });

    report.push('\n## Statistics\n');
    report.push(`- Total MCP Messages: ${this.results.statistics.totalMessages}`);
    report.push(
      `- Average Message Latency: ${this.results.statistics.averageLatency.toFixed(2)}ms`,
    );
    report.push(`- Successful Phases: ${this.results.statistics.successfulPhases}`);
    report.push(`- Failed Phases: ${this.results.statistics.failedPhases}`);
    report.push(`- Skipped Phases: ${this.results.statistics.skippedPhases}`);

    report.push('\n## Artifacts\n');
    report.push(`- Screenshots: ${this.results.screenshots.length}`);
    report.push(`- HTML Content Files: ${this.results.htmlContent.length}`);

    if (this.results.errors.length > 0) {
      report.push('\n## Errors\n');
      this.results.errors.forEach((error, index) => {
        report.push(
          `${index + 1}. [${error.timestamp}] ${error.phase || 'General'}: ${error.message}`,
        );
      });
    }

    if (this.results.warnings.length > 0) {
      report.push('\n## Warnings\n');
      this.results.warnings.forEach((warning, index) => {
        report.push(
          `${index + 1}. [${warning.timestamp}] ${warning.phase || 'General'}: ${warning.message}`,
        );
      });
    }

    return report.join('\n');
  }

  async runComprehensiveTest() {
    console.log('🚀 Starting Comprehensive MCP Interface Test');
    console.log('=' * 50);

    await this.ensureDirectories();

    try {
      // Run all test phases
      await this.testMCPServerStartup();
      await this.testProtocolHandshake();
      await this.testToolDiscovery();
      await this.testSessionManagement();
      await this.testBrowserAutomation();
      await this.testContextManagement();
      await this.testResourceAccess();

      this.log('All test phases completed!', 'success');
    } catch (error) {
      this.results.error = error.message;
      this.log(`Test suite failed: ${error.message}`, 'error');
    } finally {
      await this.cleanup();
      await this.saveTestResults();
      this.printSummary();
    }
  }

  printSummary() {
    console.log('\n' + '=' * 60);
    console.log('📊 COMPREHENSIVE MCP TEST SUMMARY');
    console.log('=' * 60);

    console.log(`\n⏱️  Test Duration: ${this.results.duration}ms`);
    console.log(`📨 Total MCP Messages: ${this.results.statistics.totalMessages}`);
    console.log(`⚡ Average Latency: ${this.results.statistics.averageLatency.toFixed(2)}ms`);

    console.log('\n🧪 Test Phase Results:');
    Object.entries(this.results.testPhases).forEach(([phase, result]) => {
      const statusEmoji =
        {
          success: '✅',
          failed: '❌',
          skipped: '⏭️',
          pending: '⏳',
        }[result.status] || '❓';

      console.log(`  ${statusEmoji} ${phase}: ${result.status.toUpperCase()}`);
    });

    console.log('\n📈 Overall Statistics:');
    console.log(`  ✅ Successful: ${this.results.statistics.successfulPhases}`);
    console.log(`  ❌ Failed: ${this.results.statistics.failedPhases}`);
    console.log(`  ⏭️  Skipped: ${this.results.statistics.skippedPhases}`);

    if (this.results.screenshots.length > 0) {
      console.log(`\n📸 Screenshots captured: ${this.results.screenshots.length}`);
    }

    if (this.results.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${this.results.errors.length}`);
    }

    console.log(`\n📁 Results saved to: ${RESULTS_DIR}`);
    console.log('=' * 60);
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new ComprehensiveMCPTest();
  test.runComprehensiveTest().catch(console.error);
}

export { ComprehensiveMCPTest };
