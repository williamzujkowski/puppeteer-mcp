#!/usr/bin/env node

/**
 * Direct Server Integration Test
 * Tests browser workflow by directly instantiating server components
 */

import { BrowserPool } from '../../dist/puppeteer/pool/browser-pool.js';
import { puppeteerConfig } from '../../dist/puppeteer/config.js';
import { InMemorySessionStore } from '../../dist/store/in-memory-session-store.js';
import { generateTokenPair } from '../../dist/auth/jwt.js';
import { ContextManager } from '../../dist/puppeteer/context/context-manager.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const PAPERCLIPS_URL = 'https://williamzujkowski.github.io/paperclips/index2.html';
const RESULTS_DIR = path.join(process.cwd(), 'testing', 'paperclips-game', 'results');

class DirectServerTest {
  constructor() {
    this.results = {
      startTime: new Date().toISOString(),
      browserPool: false,
      sessionCreation: false,
      contextCreation: false,
      pageNavigation: false,
      pageLoading: false,
      pageInteraction: false,
      screenshotCapture: false,
      contentExtraction: false,
      issues: [],
      successes: [],
      screenshots: [],
      htmlContent: null,
      gameElements: [],
      error: null
    };
    this.browserPool = null;
    this.sessionStore = null;
    this.contextManager = null;
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

  async saveScreenshot(screenshotBuffer, filename) {
    try {
      const filepath = path.join(RESULTS_DIR, filename);
      await fs.writeFile(filepath, screenshotBuffer);
      this.results.screenshots.push({
        filename,
        filepath,
        size: screenshotBuffer.length,
        timestamp: new Date().toISOString()
      });
      this.log(`Screenshot saved: ${filename} (${screenshotBuffer.length} bytes)`, 'success');
      return filepath;
    } catch (error) {
      this.log(`Failed to save screenshot: ${error.message}`, 'error');
      return null;
    }
  }

  async saveHtmlContent(htmlContent) {
    try {
      const filename = `direct-paperclips-page-${Date.now()}.html`;
      const filepath = path.join(RESULTS_DIR, filename);
      await fs.writeFile(filepath, htmlContent);
      this.results.htmlContent = {
        filename,
        filepath,
        size: htmlContent.length,
        timestamp: new Date().toISOString()
      };
      this.log(`HTML content saved: ${filename} (${htmlContent.length} characters)`, 'success');
    } catch (error) {
      this.log(`Failed to save HTML content: ${error.message}`, 'error');
    }
  }

  async initializeBrowserPool() {
    this.log('Initializing browser pool...', 'info');
    
    try {
      this.browserPool = new BrowserPool({
        maxBrowsers: 1,
        maxPagesPerBrowser: 5,
        idleTimeout: puppeteerConfig.idleTimeout,
        healthCheckInterval: 60000,
        launchOptions: {
          headless: puppeteerConfig.headless,
          executablePath: puppeteerConfig.executablePath,
          args: puppeteerConfig.args,
        },
      });

      await this.browserPool.initialize();
      this.results.browserPool = true;
      this.log('Browser pool initialized successfully', 'success');
    } catch (error) {
      this.results.browserPool = false;
      this.log(`Browser pool initialization failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async createTestSession() {
    this.log('Creating test session...', 'info');
    
    try {
      this.sessionStore = new InMemorySessionStore();
      
      const userId = crypto.randomUUID();
      const username = 'direct-test-user';
      const roles = ['user', 'admin'];
      
      const sessionData = {
        userId,
        username,
        roles,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      
      const sessionId = await this.sessionStore.create(sessionData);
      const tokens = generateTokenPair(userId, username, roles, sessionId);
      
      this.results.sessionCreation = true;
      this.log('Test session created successfully', 'success');
      
      return {
        sessionId,
        userId,
        username,
        roles,
        accessToken: tokens.accessToken
      };
    } catch (error) {
      this.results.sessionCreation = false;
      this.log(`Session creation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async createBrowserContext() {
    this.log('Creating browser context...', 'info');
    
    try {
      this.contextManager = new ContextManager(this.browserPool);
      
      const contextId = await this.contextManager.createContext({
        createPage: true,
        options: {
          viewport: {
            width: 1920,
            height: 1080
          },
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      this.results.contextCreation = true;
      this.log(`Browser context created: ${contextId}`, 'success');
      return contextId;
    } catch (error) {
      this.results.contextCreation = false;
      this.log(`Context creation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async navigateToPage(contextId) {
    this.log(`Navigating to ${PAPERCLIPS_URL}...`, 'info');
    
    try {
      const context = this.contextManager.getContext(contextId);
      if (!context || !context.pages || context.pages.length === 0) {
        throw new Error('No page available in context');
      }
      
      const page = context.pages[0];
      await page.goto(PAPERCLIPS_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      this.results.pageNavigation = true;
      this.log('Page navigation successful', 'success');
      return { url: page.url() };
    } catch (error) {
      this.results.pageNavigation = false;
      this.log(`Page navigation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async verifyPageLoading(contextId) {
    this.log('Verifying page loading...', 'info');
    
    try {
      const context = this.contextManager.getContext(contextId);
      const page = context.pages[0];
      
      // Get page title
      const title = await page.title();
      this.log(`Page title: ${title}`, 'info');
      
      // Get page URL
      const currentUrl = page.url();
      this.log(`Current URL: ${currentUrl}`, 'info');
      
      if (title && title.toLowerCase().includes('paperclips')) {
        this.results.pageLoading = true;
        this.log('Page loaded correctly (title contains "paperclips")', 'success');
      } else if (currentUrl === PAPERCLIPS_URL) {
        this.results.pageLoading = true;
        this.log('Page loaded correctly (URL matches)', 'success');
      } else {
        this.log(`Page may not have loaded correctly - title: ${title}, URL: ${currentUrl}`, 'warning');
      }
    } catch (error) {
      this.log(`Page verification failed: ${error.message}`, 'error');
    }
  }

  async captureScreenshot(contextId) {
    this.log('Capturing screenshot...', 'info');
    
    try {
      const context = this.contextManager.getContext(contextId);
      const page = context.pages[0];
      
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      });
      
      this.results.screenshotCapture = true;
      const filename = `direct-paperclips-screenshot-${Date.now()}.png`;
      await this.saveScreenshot(screenshot, filename);
      this.log('Screenshot captured successfully', 'success');
      return screenshot;
    } catch (error) {
      this.results.screenshotCapture = false;
      this.log(`Screenshot capture failed: ${error.message}`, 'error');
    }
  }

  async extractPageContent(contextId) {
    this.log('Extracting page content...', 'info');
    
    try {
      const context = this.contextManager.getContext(contextId);
      const page = context.pages[0];
      
      const content = await page.content();
      this.results.contentExtraction = true;
      this.log(`Page content extracted: ${content.length} characters`, 'success');
      
      await this.saveHtmlContent(content);
      
      // Analyze game elements
      await this.analyzeGameElements(contextId);
      
      return content;
    } catch (error) {
      this.results.contentExtraction = false;
      this.log(`Content extraction failed: ${error.message}`, 'error');
    }
  }

  async analyzeGameElements(contextId) {
    this.log('Analyzing game elements...', 'info');
    
    try {
      const context = this.contextManager.getContext(contextId);
      const page = context.pages[0];
      
      const gameElementChecks = [
        {
          name: 'Paperclip Button',
          script: () => document.querySelector('button[id*="paperclip"], input[type="button"][value*="paperclip"], #btnMakePaperclip')
        },
        {
          name: 'Paperclip Counter',
          script: () => document.querySelector('[id*="clip"], [id*="count"]')
        },
        {
          name: 'Game Title',
          script: () => document.querySelector('h1, h2')?.textContent || document.title
        },
        {
          name: 'Wire Input',
          script: () => document.querySelector('input[type="number"], input[id*="wire"]')
        },
        {
          name: 'Page Body Content',
          script: () => document.body?.innerHTML?.substring(0, 200) || "No body content"
        }
      ];

      for (const check of gameElementChecks) {
        try {
          const result = await page.evaluate(check.script);
          if (result) {
            this.results.gameElements.push({
              name: check.name,
              found: true,
              element: result
            });
            this.log(`Game element found: ${check.name}`, 'success');
          } else {
            this.results.gameElements.push({
              name: check.name,
              found: false
            });
            this.log(`Game element not found: ${check.name}`, 'warning');
          }
        } catch (error) {
          this.results.gameElements.push({
            name: check.name,
            found: false,
            error: error.message
          });
          this.log(`Error checking ${check.name}: ${error.message}`, 'warning');
        }
      }
    } catch (error) {
      this.log(`Game element analysis failed: ${error.message}`, 'error');
    }
  }

  async testPageInteraction(contextId) {
    this.log('Testing page interactions...', 'info');
    
    try {
      const context = this.contextManager.getContext(contextId);
      const page = context.pages[0];
      
      // Try to find and click the paperclip button
      const result = await page.evaluate(() => {
        // Try multiple possible selectors for the paperclip button
        const selectors = [
          'button[id*="paperclip"]',
          'input[type="button"][value*="paperclip"]',
          '#btnMakePaperclip',
          'button[onclick*="makePaperclip"]',
          'input[value*="Make Paperclip"]',
          'button[title*="paperclip"]'
        ];
        
        let button = null;
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            button = elements[0];
            break;
          }
        }
        
        // Also try to find any clickable element with paperclip text
        if (!button) {
          const allButtons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
          for (const btn of allButtons) {
            const text = (btn.textContent || btn.value || '').toLowerCase();
            if (text.includes('paperclip') || text.includes('clip')) {
              button = btn;
              break;
            }
          }
        }
        
        if (button) {
          const initialText = button.textContent || button.value || button.title || 'Unknown';
          try {
            button.click();
            return {
              success: true,
              buttonText: initialText,
              buttonId: button.id || 'no-id',
              buttonType: button.tagName,
              buttonSelector: button.outerHTML.substring(0, 100)
            };
          } catch (clickError) {
            return {
              success: false,
              message: 'Found button but click failed: ' + clickError.message,
              buttonText: initialText
            };
          }
        } else {
          return {
            success: false,
            message: 'No paperclip button found',
            availableButtons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(b => ({
              text: b.textContent || b.value || 'No text',
              id: b.id || 'no-id',
              type: b.tagName
            }))
          };
        }
      });

      if (result.success) {
        this.results.pageInteraction = true;
        this.log(`Successfully clicked paperclip button: ${result.buttonText}`, 'success');
        this.log(`Button details: ${result.buttonType}#${result.buttonId}`, 'info');
        
        // Wait a moment and take another screenshot to see changes
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.captureScreenshot(contextId);
      } else {
        this.results.pageInteraction = false;
        this.log(`Page interaction failed: ${result.message}`, 'error');
        if (result.availableButtons) {
          this.log(`Available buttons: ${JSON.stringify(result.availableButtons)}`, 'info');
        }
      }
    } catch (error) {
      this.results.pageInteraction = false;
      this.log(`Page interaction failed: ${error.message}`, 'error');
    }
  }

  async cleanup() {
    this.log('Cleaning up resources...', 'info');
    
    try {
      if (this.contextManager) {
        await this.contextManager.cleanup();
      }
      if (this.browserPool) {
        await this.browserPool.cleanup();
      }
      this.log('Cleanup completed successfully', 'success');
    } catch (error) {
      this.log(`Cleanup failed: ${error.message}`, 'error');
    }
  }

  async saveTestResults() {
    this.log('Saving test results...', 'info');
    
    this.results.endTime = new Date().toISOString();
    this.results.duration = new Date(this.results.endTime) - new Date(this.results.startTime);
    
    const filename = `direct-test-results-${Date.now()}.json`;
    const filepath = path.join(RESULTS_DIR, filename);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(this.results, null, 2));
      this.log(`Test results saved: ${filename}`, 'success');
    } catch (error) {
      this.log(`Failed to save test results: ${error.message}`, 'error');
    }
  }

  async runDirectServerTest() {
    this.log('Starting direct server integration test...', 'info');
    
    await this.ensureResultsDirectory();
    
    let contextId = null;
    
    try {
      // Step 1: Initialize browser pool
      await this.initializeBrowserPool();
      
      // Step 2: Create test session
      await this.createTestSession();
      
      // Step 3: Create browser context
      contextId = await this.createBrowserContext();
      
      // Step 4: Navigate to paperclips game
      await this.navigateToPage(contextId);
      
      // Step 5: Verify page loading
      await this.verifyPageLoading(contextId);
      
      // Step 6: Capture initial screenshot
      await this.captureScreenshot(contextId);
      
      // Step 7: Extract page content
      await this.extractPageContent(contextId);
      
      // Step 8: Test page interactions
      await this.testPageInteraction(contextId);
      
      this.log('Direct server test completed successfully!', 'success');
      
    } catch (error) {
      this.results.error = error.message;
      this.log(`Direct server test failed: ${error.message}`, 'error');
    } finally {
      // Cleanup
      await this.cleanup();
      await this.saveTestResults();
    }
    
    // Print summary
    this.printSummary();
  }

  printSummary() {
    console.log('\n=== DIRECT SERVER INTEGRATION TEST SUMMARY ===');
    console.log(`Test Duration: ${this.results.duration}ms`);
    console.log(`Screenshots Captured: ${this.results.screenshots.length}`);
    console.log(`Game Elements Found: ${this.results.gameElements.filter(e => e.found).length}/${this.results.gameElements.length}`);
    console.log('\nTest Results:');
    console.log(`✅ Browser Pool: ${this.results.browserPool ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Session Creation: ${this.results.sessionCreation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Context Creation: ${this.results.contextCreation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Page Navigation: ${this.results.pageNavigation ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Page Loading: ${this.results.pageLoading ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Screenshot Capture: ${this.results.screenshotCapture ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Content Extraction: ${this.results.contentExtraction ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Page Interaction: ${this.results.pageInteraction ? 'PASS' : 'FAIL'}`);
    
    if (this.results.gameElements.length > 0) {
      console.log('\nGame Elements Analysis:');
      this.results.gameElements.forEach(element => {
        console.log(`  ${element.found ? '✅' : '❌'} ${element.name}`);
        if (element.found && element.element) {
          const preview = typeof element.element === 'string' ? 
            element.element.substring(0, 100) : 
            JSON.stringify(element.element).substring(0, 100);
          console.log(`      Preview: ${preview}...`);
        }
      });
    }
    
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
  const test = new DirectServerTest();
  test.runDirectServerTest().catch(console.error);
}

export { DirectServerTest };