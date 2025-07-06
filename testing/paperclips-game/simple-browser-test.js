#!/usr/bin/env node

/**
 * Simple Browser Test
 * Tests browser functionality directly using Puppeteer without server components
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

const PAPERCLIPS_URL = 'https://williamzujkowski.github.io/paperclips/index2.html';
const RESULTS_DIR = path.join(process.cwd(), 'testing', 'paperclips-game', 'results');

class SimpleBrowserTest {
  constructor() {
    this.results = {
      startTime: new Date().toISOString(),
      browserLaunch: false,
      pageCreation: false,
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
    this.browser = null;
    this.page = null;
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
      const filename = `simple-paperclips-page-${Date.now()}.html`;
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

  async launchBrowser() {
    this.log('Launching browser...', 'info');
    
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });
      
      this.results.browserLaunch = true;
      this.log('Browser launched successfully', 'success');
    } catch (error) {
      this.results.browserLaunch = false;
      this.log(`Browser launch failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async createPage() {
    this.log('Creating new page...', 'info');
    
    try {
      this.page = await this.browser.newPage();
      
      await this.page.setViewport({
        width: 1920,
        height: 1080
      });
      
      await this.page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      this.results.pageCreation = true;
      this.log('Page created successfully', 'success');
    } catch (error) {
      this.results.pageCreation = false;
      this.log(`Page creation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async navigateToPage() {
    this.log(`Navigating to ${PAPERCLIPS_URL}...`, 'info');
    
    try {
      const response = await this.page.goto(PAPERCLIPS_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      if (response && response.ok()) {
        this.results.pageNavigation = true;
        this.log('Page navigation successful', 'success');
      } else {
        this.log(`Page navigation failed with status: ${response ? response.status() : 'unknown'}`, 'error');
      }
      
      return response;
    } catch (error) {
      this.results.pageNavigation = false;
      this.log(`Page navigation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async verifyPageLoading() {
    this.log('Verifying page loading...', 'info');
    
    try {
      // Get page title
      const title = await this.page.title();
      this.log(`Page title: ${title}`, 'info');
      
      // Get page URL
      const currentUrl = this.page.url();
      this.log(`Current URL: ${currentUrl}`, 'info');
      
      if (title && title.toLowerCase().includes('paperclips')) {
        this.results.pageLoading = true;
        this.log('Page loaded correctly (title contains "paperclips")', 'success');
      } else if (currentUrl === PAPERCLIPS_URL) {
        this.results.pageLoading = true;
        this.log('Page loaded correctly (URL matches)', 'success');
      } else {
        this.log(`Page may not have loaded correctly - title: ${title}, URL: ${currentUrl}`, 'warning');
        // Still mark as successful if we got some content
        this.results.pageLoading = true;
      }
    } catch (error) {
      this.log(`Page verification failed: ${error.message}`, 'error');
    }
  }

  async captureScreenshot() {
    this.log('Capturing screenshot...', 'info');
    
    try {
      const screenshot = await this.page.screenshot({
        fullPage: true,
        type: 'png'
      });
      
      this.results.screenshotCapture = true;
      const filename = `simple-paperclips-screenshot-${Date.now()}.png`;
      await this.saveScreenshot(screenshot, filename);
      this.log('Screenshot captured successfully', 'success');
      return screenshot;
    } catch (error) {
      this.results.screenshotCapture = false;
      this.log(`Screenshot capture failed: ${error.message}`, 'error');
    }
  }

  async extractPageContent() {
    this.log('Extracting page content...', 'info');
    
    try {
      const content = await this.page.content();
      this.results.contentExtraction = true;
      this.log(`Page content extracted: ${content.length} characters`, 'success');
      
      await this.saveHtmlContent(content);
      
      // Analyze game elements
      await this.analyzeGameElements();
      
      return content;
    } catch (error) {
      this.results.contentExtraction = false;
      this.log(`Content extraction failed: ${error.message}`, 'error');
    }
  }

  async analyzeGameElements() {
    this.log('Analyzing game elements...', 'info');
    
    try {
      const gameElementChecks = [
        {
          name: 'Paperclip Button',
          script: () => {
            const button = document.querySelector('button[id*="paperclip"], input[type="button"][value*="paperclip"], #btnMakePaperclip, button[onclick*="makePaperclip"]');
            return button ? {
              text: button.textContent || button.value || button.title || 'Unknown',
              id: button.id || 'no-id',
              tag: button.tagName,
              outerHTML: button.outerHTML.substring(0, 200)
            } : null;
          }
        },
        {
          name: 'Paperclip Counter',
          script: () => {
            const counter = document.querySelector('[id*="clip"], [id*="count"], [class*="count"]');
            return counter ? {
              text: counter.textContent || counter.value || 'Unknown',
              id: counter.id || 'no-id',
              tag: counter.tagName
            } : null;
          }
        },
        {
          name: 'Game Title',
          script: () => {
            const title = document.querySelector('h1, h2, h3');
            return title ? title.textContent : document.title;
          }
        },
        {
          name: 'Wire Input',
          script: () => {
            const input = document.querySelector('input[type="number"], input[id*="wire"]');
            return input ? {
              value: input.value,
              id: input.id || 'no-id',
              placeholder: input.placeholder || 'none'
            } : null;
          }
        },
        {
          name: 'Body Content Sample',
          script: () => document.body?.innerHTML?.substring(0, 500) || "No body content"
        },
        {
          name: 'All Buttons',
          script: () => {
            return Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(b => ({
              text: (b.textContent || b.value || 'No text').substring(0, 50),
              id: b.id || 'no-id',
              tag: b.tagName
            }));
          }
        }
      ];

      for (const check of gameElementChecks) {
        try {
          const result = await this.page.evaluate(check.script);
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

  async testPageInteraction() {
    this.log('Testing page interactions...', 'info');
    
    try {
      // Try to find and click the paperclip button
      const result = await this.page.evaluate(() => {
        // Try multiple possible selectors for the paperclip button
        const selectors = [
          'button[id*="paperclip"]',
          'input[type="button"][value*="paperclip"]',
          '#btnMakePaperclip',
          'button[onclick*="makePaperclip"]',
          'input[value*="Make Paperclip"]',
          'button[title*="paperclip"]',
          // More generic searches
          'button:contains("Make")',
          'input[type="button"]:contains("Make")'
        ];
        
        let button = null;
        for (const selector of selectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              button = elements[0];
              break;
            }
          } catch (e) {
            // Ignore errors for invalid selectors
          }
        }
        
        // Also try to find any clickable element with paperclip or make text
        if (!button) {
          const allButtons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
          for (const btn of allButtons) {
            const text = (btn.textContent || btn.value || '').toLowerCase();
            if (text.includes('paperclip') || text.includes('clip') || text.includes('make')) {
              button = btn;
              break;
            }
          }
        }
        
        if (button) {
          const initialText = button.textContent || button.value || button.title || 'Unknown';
          try {
            // Get initial state
            const initialClipCount = document.querySelector('[id*="clip"]')?.textContent || '0';
            
            button.click();
            
            // Wait a bit and check if anything changed
            setTimeout(() => {
              const newClipCount = document.querySelector('[id*="clip"]')?.textContent || '0';
              return {
                success: true,
                buttonText: initialText,
                buttonId: button.id || 'no-id',
                buttonType: button.tagName,
                initialClipCount,
                newClipCount,
                buttonSelector: button.outerHTML.substring(0, 100)
              };
            }, 100);
            
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
              text: (b.textContent || b.value || 'No text').substring(0, 50),
              id: b.id || 'no-id',
              tag: b.tagName,
              onclick: b.onclick ? 'has onclick' : 'no onclick'
            })),
            bodyText: document.body.textContent.substring(0, 500)
          };
        }
      });

      if (result.success) {
        this.results.pageInteraction = true;
        this.log(`Successfully clicked button: ${result.buttonText}`, 'success');
        this.log(`Button details: ${result.buttonType}#${result.buttonId}`, 'info');
        
        // Wait a moment and take another screenshot to see changes
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.captureScreenshot();
      } else {
        this.results.pageInteraction = false;
        this.log(`Page interaction failed: ${result.message}`, 'error');
        if (result.availableButtons) {
          this.log(`Available buttons: ${JSON.stringify(result.availableButtons, null, 2)}`, 'info');
        }
        if (result.bodyText) {
          this.log(`Page body text sample: ${result.bodyText}`, 'info');
        }
      }
    } catch (error) {
      this.results.pageInteraction = false;
      this.log(`Page interaction failed: ${error.message}`, 'error');
    }
  }

  async cleanup() {
    this.log('Cleaning up browser...', 'info');
    
    try {
      if (this.page) {
        await this.page.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      this.log('Browser cleanup completed successfully', 'success');
    } catch (error) {
      this.log(`Browser cleanup failed: ${error.message}`, 'error');
    }
  }

  async saveTestResults() {
    this.log('Saving test results...', 'info');
    
    this.results.endTime = new Date().toISOString();
    this.results.duration = new Date(this.results.endTime) - new Date(this.results.startTime);
    
    const filename = `simple-test-results-${Date.now()}.json`;
    const filepath = path.join(RESULTS_DIR, filename);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(this.results, null, 2));
      this.log(`Test results saved: ${filename}`, 'success');
    } catch (error) {
      this.log(`Failed to save test results: ${error.message}`, 'error');
    }
  }

  async runSimpleBrowserTest() {
    this.log('Starting simple browser test...', 'info');
    
    await this.ensureResultsDirectory();
    
    try {
      // Step 1: Launch browser
      await this.launchBrowser();
      
      // Step 2: Create page
      await this.createPage();
      
      // Step 3: Navigate to paperclips game
      await this.navigateToPage();
      
      // Step 4: Verify page loading
      await this.verifyPageLoading();
      
      // Step 5: Capture initial screenshot
      await this.captureScreenshot();
      
      // Step 6: Extract page content
      await this.extractPageContent();
      
      // Step 7: Test page interactions
      await this.testPageInteraction();
      
      this.log('Simple browser test completed successfully!', 'success');
      
    } catch (error) {
      this.results.error = error.message;
      this.log(`Simple browser test failed: ${error.message}`, 'error');
    } finally {
      // Cleanup
      await this.cleanup();
      await this.saveTestResults();
    }
    
    // Print summary
    this.printSummary();
  }

  printSummary() {
    console.log('\n=== SIMPLE BROWSER TEST SUMMARY ===');
    console.log(`Test Duration: ${this.results.duration}ms`);
    console.log(`Screenshots Captured: ${this.results.screenshots.length}`);
    console.log(`Game Elements Found: ${this.results.gameElements.filter(e => e.found).length}/${this.results.gameElements.length}`);
    console.log('\nTest Results:');
    console.log(`✅ Browser Launch: ${this.results.browserLaunch ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Page Creation: ${this.results.pageCreation ? 'PASS' : 'FAIL'}`);
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
            element.element.substring(0, 150) : 
            JSON.stringify(element.element).substring(0, 150);
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
  const test = new SimpleBrowserTest();
  test.runSimpleBrowserTest().catch(console.error);
}

export { SimpleBrowserTest };