#!/usr/bin/env node

/**
 * Paperclips Automation Demo
 * 
 * This demonstration showcases the puppeteer-mcp platform's browser automation capabilities
 * by playing the Universal Paperclips game. It demonstrates:
 * 
 * - Browser pool initialization and management
 * - Session creation and authentication
 * - Context and page creation
 * - Page navigation and element interaction
 * - Game state monitoring and data extraction
 * - Screenshot capture at key moments
 * - Automated gameplay with progress tracking
 * - Comprehensive reporting of automation results
 * 
 * Run this demo to see puppeteer-mcp in action!
 */

import { BrowserPool } from '../../dist/puppeteer/pool/browser-pool.js';
import { puppeteerConfig } from '../../dist/puppeteer/config.js';
import { InMemorySessionStore } from '../../dist/store/in-memory-session-store.js';
import { generateTokenPair } from '../../dist/auth/jwt.js';
import { ContextStorage } from '../../dist/routes/context-storage.js';
import { getPageManager } from '../../dist/puppeteer/pages/page-manager.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAPERCLIPS_URL = 'https://williamzujkowski.github.io/paperclips/index2.html';
const RESULTS_DIR = path.join(__dirname, 'demo-results');

class PaperclipsAutomationDemo {
  constructor() {
    this.startTime = Date.now();
    this.browserPool = null;
    this.sessionStore = null;
    this.contextManager = null;
    this.results = {
      startTime: new Date().toISOString(),
      screenshots: [],
      gameStates: [],
      actions: [],
      errors: [],
      summary: {},
      duration: null,
      endTime: null
    };
  }

  // Colorful console logging with emojis
  log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const emojis = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      action: '🎮',
      metric: '📊',
      screenshot: '📸',
      start: '🚀',
      end: '🎉'
    };
    
    const colors = {
      info: '\x1b[36m',    // cyan
      success: '\x1b[32m', // green
      warning: '\x1b[33m', // yellow
      error: '\x1b[31m',   // red
      action: '\x1b[35m',  // magenta
      metric: '\x1b[34m',  // blue
      reset: '\x1b[0m'
    };
    
    const emoji = emojis[type] || emojis.info;
    const color = colors[type] || colors.info;
    
    console.log(`${color}${emoji} [${timestamp}] ${message}${colors.reset}`);
    
    // Track actions for reporting
    if (type === 'action' || type === 'success' || type === 'error') {
      this.results.actions.push({
        timestamp: new Date().toISOString(),
        type,
        message
      });
    }
    
    if (type === 'error') {
      this.results.errors.push({
        timestamp: new Date().toISOString(),
        message
      });
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async ensureResultsDirectory() {
    try {
      await fs.mkdir(RESULTS_DIR, { recursive: true });
      this.log(`Results directory ready: ${RESULTS_DIR}`, 'info');
    } catch (error) {
      this.log(`Failed to create results directory: ${error.message}`, 'error');
    }
  }

  async saveScreenshot(buffer, name) {
    try {
      const filename = `screenshot-${name}-${Date.now()}.png`;
      const filepath = path.join(RESULTS_DIR, filename);
      await fs.writeFile(filepath, buffer);
      
      this.results.screenshots.push({
        name,
        filename,
        filepath,
        timestamp: new Date().toISOString(),
        size: buffer.length
      });
      
      this.log(`Screenshot saved: ${name} (${Math.round(buffer.length / 1024)}KB)`, 'screenshot');
      return filepath;
    } catch (error) {
      this.log(`Failed to save screenshot: ${error.message}`, 'error');
      return null;
    }
  }

  async initializePlatform() {
    this.log('=== INITIALIZING PUPPETEER-MCP PLATFORM ===', 'start');
    
    try {
      // Initialize browser pool
      this.log('Creating browser pool...', 'info');
      this.browserPool = new BrowserPool({
        maxBrowsers: 1,
        maxPagesPerBrowser: 5,
        idleTimeout: puppeteerConfig.idleTimeout,
        healthCheckInterval: 60000,
        launchOptions: {
          headless: false, // Show browser for demo
          executablePath: puppeteerConfig.executablePath,
          args: [
            ...puppeteerConfig.args,
            '--window-size=1920,1080'
          ],
        },
      });

      await this.browserPool.initialize();
      this.log('Browser pool initialized successfully', 'success');

      // Create session store and test session
      this.log('Creating authentication session...', 'info');
      this.sessionStore = new InMemorySessionStore();
      
      const userId = crypto.randomUUID();
      const sessionData = {
        userId,
        username: 'demo-user',
        roles: ['user', 'admin'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      
      const sessionId = await this.sessionStore.create(sessionData);
      const tokens = generateTokenPair(userId, 'demo-user', ['user', 'admin'], sessionId);
      this.log(`Session created for user: ${sessionData.username}`, 'success');

      // Initialize context storage and page manager
      this.log('Initializing context storage and page manager...', 'info');
      this.contextStorage = new ContextStorage();
      this.pageManager = getPageManager(this.browserPool);
      this.log('Context storage and page manager ready', 'success');

      return { sessionId, tokens };
    } catch (error) {
      this.log(`Platform initialization failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async createBrowserContext() {
    this.log('Creating browser context with automation settings...', 'info');
    
    try {
      // Create context through storage
      const contextConfig = {
        name: 'Paperclips Demo Context',
        viewport: {
          width: 1920,
          height: 1080
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        javaScriptEnabled: true,
        ignoreHTTPSErrors: false,
        bypassCSP: false,
        extraHTTPHeaders: {}
      };
      
      const context = await this.contextStorage.createContext('demo-user', contextConfig);
      const contextId = context.id;
      
      // Create initial page
      const browser = await this.browserPool.acquireBrowser('demo-session');
      const pageOptions = {
        viewport: contextConfig.viewport,
        userAgent: contextConfig.userAgent,
        javaScriptEnabled: contextConfig.javaScriptEnabled,
        ignoreHTTPSErrors: contextConfig.ignoreHTTPSErrors,
        bypassCSP: contextConfig.bypassCSP,
        extraHeaders: contextConfig.extraHTTPHeaders
      };
      
      const pageInfo = await this.pageManager.createPage(
        contextId,
        'demo-session',
        browser.id,
        pageOptions
      );
      
      this.pageId = pageInfo.id;
      this.contextId = contextId;
      
      this.log(`Browser context created: ${contextId}`, 'success');
      this.log(`Initial page created: ${pageInfo.id}`, 'success');
      
      return contextId;
    } catch (error) {
      this.log(`Context creation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async navigateToGame(contextId) {
    this.log('=== NAVIGATING TO UNIVERSAL PAPERCLIPS ===', 'info');
    
    try {
      // Get the page from the page manager
      const pages = await this.pageManager.listPagesForContext(contextId, 'demo-session');
      
      if (pages.length === 0) {
        throw new Error('No pages found for context');
      }
      
      const pageInfo = pages[0];
      const page = pageInfo.page;
      
      this.log(`Loading game from: ${PAPERCLIPS_URL}`, 'info');
      await page.goto(PAPERCLIPS_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait for game to initialize
      await this.sleep(2000);
      
      const title = await page.title();
      this.log(`Page loaded successfully: "${title}"`, 'success');
      
      // Take initial screenshot
      const screenshot = await page.screenshot({ fullPage: true });
      await this.saveScreenshot(screenshot, 'initial-load');
      
      return page;
    } catch (error) {
      this.log(`Navigation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async analyzeGameState(page) {
    this.log('Analyzing game state...', 'metric');
    
    try {
      const gameState = await page.evaluate(() => {
        // Extract game elements and their values
        const getElementText = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.textContent || element.value || element.innerText : null;
        };
        
        const getElementValue = (selector) => {
          const element = document.querySelector(selector);
          return element ? parseFloat(element.textContent || element.value || '0') || 0 : 0;
        };
        
        // Try various selectors for game elements
        const state = {
          // Paperclips count
          paperclips: getElementValue('#clips') || 
                     getElementValue('#paperclips') || 
                     getElementValue('[id*="clip"]') || 0,
          
          // Funds/money
          funds: getElementValue('#funds') || 
                getElementValue('#money') || 
                getElementValue('[id*="fund"]') || 0,
          
          // Wire amount
          wire: getElementValue('#wire') || 
               getElementValue('[id*="wire"]') || 0,
          
          // Price per clip
          price: getElementValue('#price') || 
                getElementValue('[id*="price"]') || 0,
          
          // Demand
          demand: getElementValue('#demand') || 
                 getElementValue('[id*="demand"]') || 0,
          
          // Business metrics
          unsoldInventory: getElementValue('#unsoldInventory') || 
                          getElementValue('[id*="inventory"]') || 0,
          
          // Manufacturing
          clipmakerLevel: getElementValue('#clipmakerLevel') || 
                         getElementValue('[id*="clipmaker"]') || 0,
          
          // Marketing
          marketingLevel: getElementValue('#marketingLevel') || 
                         getElementValue('[id*="marketing"]') || 0,
          
          // Page info
          pageTitle: document.title,
          hasButtons: document.querySelectorAll('button').length,
          timestamp: new Date().toISOString()
        };
        
        // Find important buttons
        const buttons = [];
        document.querySelectorAll('button').forEach(btn => {
          const text = btn.textContent || btn.innerText || '';
          if (text.toLowerCase().includes('paperclip') || 
              text.toLowerCase().includes('wire') ||
              text.toLowerCase().includes('marketing') ||
              text.toLowerCase().includes('clipmaker')) {
            buttons.push({
              text: text.trim(),
              id: btn.id,
              disabled: btn.disabled
            });
          }
        });
        state.availableButtons = buttons;
        
        return state;
      });
      
      // Log key metrics
      this.log(`📊 Paperclips: ${gameState.paperclips.toLocaleString()}`, 'metric');
      this.log(`💰 Funds: $${gameState.funds.toFixed(2)}`, 'metric');
      this.log(`🔧 Wire: ${gameState.wire.toLocaleString()} inches`, 'metric');
      this.log(`💵 Price: $${gameState.price.toFixed(2)}`, 'metric');
      this.log(`📈 Demand: ${gameState.demand}%`, 'metric');
      
      this.results.gameStates.push(gameState);
      return gameState;
    } catch (error) {
      this.log(`Failed to analyze game state: ${error.message}`, 'error');
      return null;
    }
  }

  async clickMakePaperclip(page) {
    try {
      const clicked = await page.evaluate(() => {
        // Try multiple selectors for the make paperclip button
        const selectors = [
          '#btnMakePaperclip',
          'button[onclick*="makePaperclip"]',
          'button:contains("Make Paperclip")',
          '[id*="paperclip"][type="button"]'
        ];
        
        for (const selector of selectors) {
          const button = document.querySelector(selector);
          if (button && !button.disabled) {
            button.click();
            return { success: true, selector, text: button.textContent };
          }
        }
        
        // Fallback: find by text content
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const button of buttons) {
          const text = (button.textContent || '').toLowerCase();
          if ((text.includes('make') && text.includes('paperclip')) || 
              text === 'make paperclip') {
            if (!button.disabled) {
              button.click();
              return { success: true, text: button.textContent };
            }
          }
        }
        
        return { success: false, message: 'Make paperclip button not found or disabled' };
      });
      
      if (clicked.success) {
        this.log(`Clicked: "${clicked.text || 'Make Paperclip'}"`, 'action');
        return true;
      } else {
        this.log(clicked.message, 'warning');
        return false;
      }
    } catch (error) {
      this.log(`Click failed: ${error.message}`, 'error');
      return false;
    }
  }

  async automateGameplay(page, duration = 30000) {
    this.log('=== STARTING AUTOMATED GAMEPLAY ===', 'start');
    this.log(`Automation will run for ${duration / 1000} seconds`, 'info');
    
    const startTime = Date.now();
    const endTime = startTime + duration;
    let clickCount = 0;
    let lastPaperclips = 0;
    
    // Initial game state
    const initialState = await this.analyzeGameState(page);
    
    while (Date.now() < endTime) {
      try {
        // Click make paperclip button
        const clicked = await this.clickMakePaperclip(page);
        if (clicked) {
          clickCount++;
        }
        
        // Every 10 clicks, check game state
        if (clickCount % 10 === 0) {
          const currentState = await this.analyzeGameState(page);
          
          if (currentState && currentState.paperclips > lastPaperclips) {
            const produced = currentState.paperclips - lastPaperclips;
            this.log(`Produced ${produced} paperclips (Total: ${currentState.paperclips})`, 'success');
            lastPaperclips = currentState.paperclips;
          }
          
          // Take progress screenshot every 50 clicks
          if (clickCount % 50 === 0) {
            const screenshot = await page.screenshot({ fullPage: false });
            await this.saveScreenshot(screenshot, `progress-${clickCount}-clicks`);
          }
        }
        
        // Small delay between clicks
        await this.sleep(100);
        
        // Check for available upgrades every 5 seconds
        if ((Date.now() - startTime) % 5000 < 100) {
          await this.checkForUpgrades(page);
        }
        
      } catch (error) {
        this.log(`Automation error: ${error.message}`, 'error');
      }
    }
    
    // Final game state
    const finalState = await this.analyzeGameState(page);
    
    // Calculate results
    const totalProduced = finalState ? finalState.paperclips - (initialState?.paperclips || 0) : 0;
    const actualDuration = Date.now() - startTime;
    const clicksPerSecond = clickCount / (actualDuration / 1000);
    
    this.log('=== AUTOMATION COMPLETE ===', 'end');
    this.log(`Total clicks: ${clickCount}`, 'metric');
    this.log(`Paperclips produced: ${totalProduced}`, 'metric');
    this.log(`Clicks per second: ${clicksPerSecond.toFixed(2)}`, 'metric');
    this.log(`Final paperclip count: ${finalState?.paperclips || 0}`, 'metric');
    
    // Take final screenshot
    const finalScreenshot = await page.screenshot({ fullPage: true });
    await this.saveScreenshot(finalScreenshot, 'final-state');
    
    return {
      clickCount,
      totalProduced,
      clicksPerSecond,
      duration: actualDuration,
      initialState,
      finalState
    };
  }

  async checkForUpgrades(page) {
    try {
      const upgrades = await page.evaluate(() => {
        const upgradeButtons = [];
        
        // Look for upgrade buttons
        const buttons = document.querySelectorAll('button:not([disabled])');
        buttons.forEach(button => {
          const text = (button.textContent || '').toLowerCase();
          if (text.includes('buy') || text.includes('upgrade') || text.includes('increase')) {
            upgradeButtons.push({
              text: button.textContent,
              id: button.id
            });
          }
        });
        
        return upgradeButtons;
      });
      
      if (upgrades.length > 0) {
        this.log(`Found ${upgrades.length} available upgrades`, 'info');
      }
    } catch (error) {
      // Silently fail - upgrades are optional
    }
  }

  async generateReport() {
    this.log('=== GENERATING AUTOMATION REPORT ===', 'info');
    
    const report = {
      title: 'Puppeteer-MCP Browser Automation Demo Report',
      generatedAt: new Date().toISOString(),
      platform: 'puppeteer-mcp',
      demo: 'Universal Paperclips Automation',
      duration: this.results.duration,
      summary: this.results.summary,
      screenshots: this.results.screenshots,
      gameProgression: this.results.gameStates,
      actions: this.results.actions,
      errors: this.results.errors,
      capabilities: [
        'Browser pool management',
        'Session authentication',
        'Context creation',
        'Page navigation',
        'Element interaction',
        'State monitoring',
        'Screenshot capture',
        'Automated gameplay',
        'Progress tracking',
        'Error handling'
      ]
    };
    
    // Save JSON report
    const jsonPath = path.join(RESULTS_DIR, `automation-report-${Date.now()}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
    this.log(`JSON report saved: ${jsonPath}`, 'success');
    
    // Generate markdown report
    const markdown = this.generateMarkdownReport(report);
    const mdPath = path.join(RESULTS_DIR, `automation-report-${Date.now()}.md`);
    await fs.writeFile(mdPath, markdown);
    this.log(`Markdown report saved: ${mdPath}`, 'success');
    
    return { jsonPath, mdPath };
  }

  generateMarkdownReport(report) {
    let md = `# ${report.title}\n\n`;
    md += `**Generated:** ${new Date(report.generatedAt).toLocaleString()}\n`;
    md += `**Platform:** ${report.platform}\n`;
    md += `**Demo:** ${report.demo}\n`;
    md += `**Duration:** ${(report.duration / 1000).toFixed(2)} seconds\n\n`;
    
    md += `## Summary\n\n`;
    md += `- **Total Paperclips Produced:** ${report.summary.totalProduced || 0}\n`;
    md += `- **Click Count:** ${report.summary.clickCount || 0}\n`;
    md += `- **Clicks Per Second:** ${report.summary.clicksPerSecond?.toFixed(2) || 0}\n`;
    md += `- **Screenshots Captured:** ${report.screenshots.length}\n`;
    md += `- **Game States Recorded:** ${report.gameProgression.length}\n`;
    md += `- **Errors:** ${report.errors.length}\n\n`;
    
    md += `## Capabilities Demonstrated\n\n`;
    report.capabilities.forEach(cap => {
      md += `- ✅ ${cap}\n`;
    });
    md += `\n`;
    
    md += `## Game Progression\n\n`;
    if (report.gameProgression.length > 0) {
      md += `| Time | Paperclips | Funds | Wire | Demand |\n`;
      md += `|------|------------|-------|------|--------|\n`;
      report.gameProgression.forEach((state, index) => {
        const time = new Date(state.timestamp).toLocaleTimeString();
        md += `| ${time} | ${state.paperclips} | $${state.funds.toFixed(2)} | ${state.wire} | ${state.demand}% |\n`;
      });
    }
    md += `\n`;
    
    md += `## Screenshots\n\n`;
    report.screenshots.forEach(screenshot => {
      md += `- **${screenshot.name}** - ${screenshot.filename} (${Math.round(screenshot.size / 1024)}KB)\n`;
    });
    md += `\n`;
    
    if (report.errors.length > 0) {
      md += `## Errors\n\n`;
      report.errors.forEach(error => {
        md += `- ${error.timestamp}: ${error.message}\n`;
      });
    }
    
    return md;
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
      this.log(`Cleanup error: ${error.message}`, 'error');
    }
  }

  async runDemo() {
    try {
      await this.ensureResultsDirectory();
      
      // Initialize platform
      const { sessionId } = await this.initializePlatform();
      
      // Create browser context
      const contextId = await this.createBrowserContext();
      
      // Navigate to game
      const page = await this.navigateToGame(contextId);
      
      // Run automated gameplay
      const gameplayResults = await this.automateGameplay(page, 30000); // 30 seconds
      
      // Update results summary
      this.results.summary = gameplayResults;
      this.results.duration = Date.now() - this.startTime;
      this.results.endTime = new Date().toISOString();
      
      // Generate reports
      const { jsonPath, mdPath } = await this.generateReport();
      
      this.log('=== DEMO COMPLETE ===', 'end');
      this.log(`Reports saved to: ${RESULTS_DIR}`, 'success');
      this.log(`- JSON: ${path.basename(jsonPath)}`, 'info');
      this.log(`- Markdown: ${path.basename(mdPath)}`, 'info');
      
      // Print quick summary
      console.log('\n📊 Quick Summary:');
      console.log(`   • Automation ran for ${(this.results.duration / 1000).toFixed(1)} seconds`);
      console.log(`   • Produced ${gameplayResults.totalProduced} paperclips`);
      console.log(`   • Performed ${gameplayResults.clickCount} clicks`);
      console.log(`   • Captured ${this.results.screenshots.length} screenshots`);
      console.log(`   • Recorded ${this.results.gameStates.length} game states`);
      console.log(`   • Encountered ${this.results.errors.length} errors`);
      
    } catch (error) {
      this.log(`Demo failed: ${error.message}`, 'error');
      this.results.error = error.message;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n🎮 PUPPETEER-MCP BROWSER AUTOMATION DEMO 🎮');
  console.log('=========================================\n');
  console.log('This demo will showcase browser automation capabilities by playing Universal Paperclips.\n');
  
  const demo = new PaperclipsAutomationDemo();
  demo.runDemo().catch(console.error);
}

export { PaperclipsAutomationDemo };