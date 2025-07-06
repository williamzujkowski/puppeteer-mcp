#!/usr/bin/env node

/**
 * MCP Interface Workflow Test
 * Tests the paperclips game workflow via the MCP stdio interface
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const PAPERCLIPS_URL = 'https://williamzujkowski.github.io/paperclips/index2.html';
const RESULTS_DIR = path.join(process.cwd(), 'testing', 'paperclips-game', 'results');

class MCPWorkflowTest {
  constructor() {
    this.results = {
      startTime: new Date().toISOString(),
      mcpConnection: false,
      contextCreation: false,
      pageNavigation: false,
      pageLoading: false,
      pageInteraction: false,
      screenshotCapture: false,
      contentExtraction: false,
      issues: [],
      successes: [],
      mcpMessages: [],
      screenshots: [],
      htmlContent: null,
      gameElements: [],
      error: null
    };
    this.mcpProcess = null;
    this.messageId = 1;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
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

  async saveScreenshot(screenshotData, filename) {
    try {
      const filepath = path.join(RESULTS_DIR, filename);
      const buffer = Buffer.from(screenshotData, 'base64');
      await fs.writeFile(filepath, buffer);
      this.results.screenshots.push({
        filename,
        filepath,
        size: buffer.length,
        timestamp: new Date().toISOString()
      });
      this.log(`Screenshot saved: ${filename} (${buffer.length} bytes)`, 'success');
      return filepath;
    } catch (error) {
      this.log(`Failed to save screenshot: ${error.message}`, 'error');
      return null;
    }
  }

  sendMCPMessage(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.mcpProcess) {
        reject(new Error('MCP process not started'));
        return;
      }

      const message = {
        jsonrpc: '2.0',
        id: this.messageId++,
        method,
        params
      };

      const messageString = JSON.stringify(message) + '\n';
      this.log(`Sending MCP message: ${method}`, 'info');
      this.results.mcpMessages.push({ type: 'sent', message, timestamp: new Date().toISOString() });

      // Set up response handler
      const timeout = setTimeout(() => {
        reject(new Error(`MCP message timeout: ${method}`));
      }, 30000);

      const responseHandler = (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString().trim());
          this.results.mcpMessages.push({ type: 'received', message: response, timestamp: new Date().toISOString() });
          if (response.id === message.id) {
            if (response.error) {
              reject(new Error(`MCP error: ${response.error.message}`));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          reject(new Error(`Failed to parse MCP response: ${error.message}`));
        }
      };

      this.mcpProcess.stdout.once('data', responseHandler);
      this.mcpProcess.stdin.write(messageString);
    });
  }

  async startMCPConnection() {
    this.log('Starting MCP connection...', 'info');
    
    try {
      // Start the MCP server process
      this.mcpProcess = spawn('node', ['dist/mcp/start-mcp.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      this.mcpProcess.stderr.on('data', (data) => {
        this.log(`MCP stderr: ${data.toString()}`, 'warning');
      });

      // Wait for the process to be ready
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Send initialize message
      const initResult = await this.sendMCPMessage('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: true
          },
          sampling: {}
        },
        clientInfo: {
          name: 'paperclips-test',
          version: '1.0.0'
        }
      });

      this.log('MCP connection initialized', 'success');
      this.results.mcpConnection = true;
      
      return initResult;
    } catch (error) {
      this.results.mcpConnection = false;
      this.log(`MCP connection failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async testMCPCapabilities() {
    this.log('Testing MCP capabilities...', 'info');
    
    try {
      // List available tools
      const tools = await this.sendMCPMessage('tools/list');
      this.log(`Available MCP tools: ${tools.tools?.length || 0}`, 'info');
      
      // Look for browser-related tools
      const browserTools = tools.tools?.filter(tool => 
        tool.name.includes('browser') || 
        tool.name.includes('navigate') || 
        tool.name.includes('screenshot') ||
        tool.name.includes('page')
      ) || [];
      
      this.log(`Browser-related tools: ${browserTools.map(t => t.name).join(', ')}`, 'info');
      
      return tools;
    } catch (error) {
      this.log(`Failed to get MCP capabilities: ${error.message}`, 'error');
      throw error;
    }
  }

  async createBrowserContext() {
    this.log('Creating browser context via MCP...', 'info');
    
    try {
      // Try to call a browser creation tool
      const result = await this.sendMCPMessage('tools/call', {
        name: 'create_browser_context',
        arguments: {
          createPage: true,
          options: {
            viewport: { width: 1920, height: 1080 }
          }
        }
      });
      
      this.results.contextCreation = true;
      this.log('Browser context created successfully', 'success');
      return result;
    } catch (error) {
      this.results.contextCreation = false;
      this.log(`Browser context creation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async navigateToPage(contextId) {
    this.log(`Navigating to ${PAPERCLIPS_URL}...`, 'info');
    
    try {
      const result = await this.sendMCPMessage('tools/call', {
        name: 'navigate_page',
        arguments: {
          contextId,
          url: PAPERCLIPS_URL,
          options: {
            waitUntil: 'networkidle2',
            timeout: 30000
          }
        }
      });
      
      this.results.pageNavigation = true;
      this.log('Page navigation successful', 'success');
      return result;
    } catch (error) {
      this.results.pageNavigation = false;
      this.log(`Page navigation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async captureScreenshot(contextId) {
    this.log('Capturing screenshot via MCP...', 'info');
    
    try {
      const result = await this.sendMCPMessage('tools/call', {
        name: 'take_screenshot',
        arguments: {
          contextId,
          options: {
            fullPage: true,
            type: 'png'
          }
        }
      });
      
      if (result.screenshot) {
        this.results.screenshotCapture = true;
        const filename = `mcp-paperclips-screenshot-${Date.now()}.png`;
        await this.saveScreenshot(result.screenshot, filename);
        this.log('Screenshot captured successfully', 'success');
      }
      
      return result;
    } catch (error) {
      this.results.screenshotCapture = false;
      this.log(`Screenshot capture failed: ${error.message}`, 'error');
    }
  }

  async extractPageContent(contextId) {
    this.log('Extracting page content via MCP...', 'info');
    
    try {
      const result = await this.sendMCPMessage('tools/call', {
        name: 'get_page_content',
        arguments: {
          contextId
        }
      });
      
      if (result.content) {
        this.results.contentExtraction = true;
        this.log(`Page content extracted: ${result.content.length} characters`, 'success');
        
        // Save HTML content
        const filename = `mcp-paperclips-page-${Date.now()}.html`;
        const filepath = path.join(RESULTS_DIR, filename);
        await fs.writeFile(filepath, result.content);
        this.results.htmlContent = {
          filename,
          filepath,
          size: result.content.length,
          timestamp: new Date().toISOString()
        };
      }
      
      return result;
    } catch (error) {
      this.results.contentExtraction = false;
      this.log(`Content extraction failed: ${error.message}`, 'error');
    }
  }

  async testPageInteraction(contextId) {
    this.log('Testing page interactions via MCP...', 'info');
    
    try {
      // Try to find and click the paperclip button
      const result = await this.sendMCPMessage('tools/call', {
        name: 'evaluate_script',
        arguments: {
          contextId,
          script: `
            // Find paperclip button
            const selectors = [
              'button[id*="paperclip"]',
              'input[type="button"][value*="paperclip"]',
              '#btnMakePaperclip',
              'button[onclick*="makePaperclip"]'
            ];
            
            let button = null;
            for (const selector of selectors) {
              button = document.querySelector(selector);
              if (button) break;
            }
            
            if (button) {
              const buttonText = button.textContent || button.value;
              button.click();
              return {
                success: true,
                buttonText,
                buttonId: button.id,
                message: 'Paperclip button clicked successfully'
              };
            } else {
              return {
                success: false,
                message: 'No paperclip button found',
                availableButtons: Array.from(document.querySelectorAll('button, input[type="button"]')).map(b => ({
                  text: b.textContent || b.value,
                  id: b.id
                }))
              };
            }
          `
        }
      });
      
      if (result.result?.success) {
        this.results.pageInteraction = true;
        this.log(`Page interaction successful: ${result.result.message}`, 'success');
        
        // Take another screenshot after interaction
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.captureScreenshot(contextId);
      } else {
        this.results.pageInteraction = false;
        this.log(`Page interaction failed: ${result.result?.message}`, 'error');
      }
      
      return result;
    } catch (error) {
      this.results.pageInteraction = false;
      this.log(`Page interaction failed: ${error.message}`, 'error');
    }
  }

  async cleanupMCP() {
    this.log('Cleaning up MCP connection...', 'info');
    
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
    }
  }

  async saveTestResults() {
    this.log('Saving test results...', 'info');
    
    this.results.endTime = new Date().toISOString();
    this.results.duration = new Date(this.results.endTime) - new Date(this.results.startTime);
    
    const filename = `mcp-test-results-${Date.now()}.json`;
    const filepath = path.join(RESULTS_DIR, filename);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(this.results, null, 2));
      this.log(`Test results saved: ${filename}`, 'success');
    } catch (error) {
      this.log(`Failed to save test results: ${error.message}`, 'error');
    }
  }

  async runMCPWorkflowTest() {
    this.log('Starting MCP workflow test...', 'info');
    
    await this.ensureResultsDirectory();
    
    let contextId = null;
    
    try {
      // Step 1: Start MCP connection
      await this.startMCPConnection();
      
      // Step 2: Test MCP capabilities
      const capabilities = await this.testMCPCapabilities();
      
      // Step 3: Create browser context
      const contextResult = await this.createBrowserContext();
      contextId = contextResult?.contextId;
      
      // Step 4: Navigate to paperclips game
      await this.navigateToPage(contextId);
      
      // Step 5: Capture initial screenshot
      await this.captureScreenshot(contextId);
      
      // Step 6: Extract page content
      await this.extractPageContent(contextId);
      
      // Step 7: Test page interactions
      await this.testPageInteraction(contextId);
      
      this.log('MCP workflow test completed successfully!', 'success');
      
    } catch (error) {
      this.results.error = error.message;
      this.log(`MCP workflow test failed: ${error.message}`, 'error');
    } finally {
      // Cleanup
      await this.cleanupMCP();
      await this.saveTestResults();
    }
    
    // Print summary
    this.printSummary();
  }

  printSummary() {
    console.log('\n=== MCP BROWSER WORKFLOW TEST SUMMARY ===');
    console.log(`Test Duration: ${this.results.duration}ms`);
    console.log(`Screenshots Captured: ${this.results.screenshots.length}`);
    console.log(`MCP Messages Exchanged: ${this.results.mcpMessages.length}`);
    console.log('\nTest Results:');
    console.log(`✅ MCP Connection: ${this.results.mcpConnection ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Context Creation: ${this.results.contextCreation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Page Navigation: ${this.results.pageNavigation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Screenshot Capture: ${this.results.screenshotCapture ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Content Extraction: ${this.results.contentExtraction ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Page Interaction: ${this.results.pageInteraction ? 'PASS' : 'FAIL'}`);
    
    if (this.results.issues.length > 0) {
      console.log('\nIssues Encountered:');
      this.results.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.message}`);
      });
    }
    
    console.log(`\nResults saved to: ${RESULTS_DIR}`);
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new MCPWorkflowTest();
  test.runMCPWorkflowTest().catch(console.error);
}

export { MCPWorkflowTest };