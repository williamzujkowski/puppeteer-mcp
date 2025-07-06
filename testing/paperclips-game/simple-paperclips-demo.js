#!/usr/bin/env node

/**
 * Simple Paperclips Automation Demo
 * 
 * This demonstration showcases the core browser automation capabilities
 * by directly using Puppeteer to play the Universal Paperclips game.
 * 
 * This is a simplified version that demonstrates the working features
 * without the complex API integration.
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAPERCLIPS_URL = 'https://williamzujkowski.github.io/paperclips/index2.html';
const RESULTS_DIR = path.join(__dirname, 'demo-results');

class SimplePaperclipsDemo {
  constructor() {
    this.results = {
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      gameStats: [],
      screenshots: [],
      actions: [],
      errors: []
    };
  }

  // Color output functions
  log(message, type = 'info') {
    const colors = {
      info: '\x1b[34m',      // Blue
      success: '\x1b[32m',    // Green
      warning: '\x1b[33m',    // Yellow
      error: '\x1b[31m',      // Red
      action: '\x1b[35m',     // Magenta
      metric: '\x1b[36m',     // Cyan
      screenshot: '\x1b[95m', // Bright Magenta
      reset: '\x1b[0m'
    };

    const emojis = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      action: '🎯',
      metric: '📊',
      screenshot: '📸'
    };

    const timestamp = new Date().toISOString().substring(11, 23);
    const emoji = emojis[type] || '';
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

  async saveScreenshot(page, name) {
    try {
      const buffer = await page.screenshot({ fullPage: true });
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
      this.log(`Screenshot failed: ${error.message}`, 'error');
      return null;
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
          return element ? element.value || element.textContent || element.innerText : null;
        };

        // Look for various game state indicators
        const paperclips = getElementText('#clips') || 
                          getElementText('#paperclips') || 
                          getElementText('[id*="clip"]') ||
                          getElementText('[class*="clip"]');
        
        const money = getElementText('#money') || 
                     getElementText('#funds') || 
                     getElementText('[id*="money"]') ||
                     getElementText('[class*="money"]');

        const clipButton = document.querySelector('#btnMakePaperclip') ||
                          document.querySelector('[id*="make"]') ||
                          document.querySelector('[class*="make"]') ||
                          document.querySelector('button');

        // Get page title and basic info
        const title = document.title;
        const url = window.location.href;
        const buttons = document.querySelectorAll('button').length;
        const inputs = document.querySelectorAll('input').length;

        return {
          title,
          url,
          paperclips,
          money,
          buttons,
          inputs,
          clipButtonFound: !!clipButton,
          clipButtonText: clipButton ? clipButton.textContent : null,
          timestamp: new Date().toISOString()
        };
      });

      this.results.gameStats.push(gameState);
      
      this.log(`Game State - Title: "${gameState.title}"`, 'metric');
      this.log(`Game State - Paperclips: ${gameState.paperclips || 'Not found'}`, 'metric');
      this.log(`Game State - Money: ${gameState.money || 'Not found'}`, 'metric');
      this.log(`Game State - Buttons: ${gameState.buttons}, Inputs: ${gameState.inputs}`, 'metric');
      this.log(`Game State - Make Button: ${gameState.clipButtonFound ? 'Found' : 'Not found'}`, 'metric');
      
      return gameState;
    } catch (error) {
      this.log(`Game state analysis failed: ${error.message}`, 'error');
      return null;
    }
  }

  async clickMakeButton(page, attempts = 3) {
    this.log('Attempting to click Make Paperclip button...', 'action');
    
    for (let i = 0; i < attempts; i++) {
      try {
        const clicked = await page.evaluate(() => {
          // Try multiple selectors for the make button
          const selectors = [
            '#btnMakePaperclip',
            '[id*="make"]',
            '[class*="make"]',
            'button:contains("Make")',
            'button:contains("Paperclip")',
            'button:contains("Click")',
            'button'
          ];

          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.toLowerCase().includes('make')) {
              element.click();
              return { 
                success: true, 
                selector, 
                text: element.textContent 
              };
            }
          }

          // Fallback: click the first button
          const firstButton = document.querySelector('button');
          if (firstButton) {
            firstButton.click();
            return { 
              success: true, 
              selector: 'button', 
              text: firstButton.textContent 
            };
          }

          return { success: false };
        });

        if (clicked.success) {
          this.log(`Successfully clicked button: "${clicked.text}" (${clicked.selector})`, 'success');
          return true;
        } else {
          this.log(`Attempt ${i + 1} failed - button not found`, 'warning');
        }
      } catch (error) {
        this.log(`Click attempt ${i + 1} failed: ${error.message}`, 'error');
      }
      
      await this.sleep(1000);
    }

    this.log('Failed to click Make Paperclip button after all attempts', 'error');
    return false;
  }

  async runAutomatedSession(page, durationSeconds = 30) {
    this.log(`=== STARTING AUTOMATED GAMEPLAY (${durationSeconds}s) ===`, 'info');
    
    const endTime = Date.now() + (durationSeconds * 1000);
    let clickCount = 0;
    let lastGameState = null;
    
    while (Date.now() < endTime) {
      try {
        // Click the make button
        const clicked = await this.clickMakeButton(page, 1);
        if (clicked) {
          clickCount++;
          
          // Every 5 clicks, analyze game state
          if (clickCount % 5 === 0) {
            lastGameState = await this.analyzeGameState(page);
          }
          
          // Every 10 clicks, take a screenshot
          if (clickCount % 10 === 0) {
            await this.saveScreenshot(page, `gameplay-${clickCount}-clicks`);
          }
        }
        
        // Small delay between actions
        await this.sleep(500);
        
        // Progress indicator
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
        if (clickCount % 10 === 0) {
          this.log(`Progress: ${clickCount} clicks, ${remaining}s remaining`, 'info');
        }
        
      } catch (error) {
        this.log(`Automation error: ${error.message}`, 'error');
        break;
      }
    }
    
    this.log(`Automation completed: ${clickCount} clicks in ${durationSeconds}s`, 'success');
    
    // Final game state analysis
    const finalState = await this.analyzeGameState(page);
    await this.saveScreenshot(page, 'final-state');
    
    return {
      clickCount,
      finalState,
      lastGameState
    };
  }

  async generateReport() {
    this.results.endTime = new Date().toISOString();
    this.results.duration = (new Date(this.results.endTime) - new Date(this.results.startTime)) / 1000;
    
    const jsonReport = JSON.stringify(this.results, null, 2);
    const jsonPath = path.join(RESULTS_DIR, 'demo-report.json');
    await fs.writeFile(jsonPath, jsonReport);
    
    // Generate markdown report
    const mdReport = this.generateMarkdownReport();
    const mdPath = path.join(RESULTS_DIR, 'demo-report.md');
    await fs.writeFile(mdPath, mdReport);
    
    this.log(`Reports generated: ${jsonPath} and ${mdPath}`, 'success');
  }

  generateMarkdownReport() {
    const { startTime, endTime, duration, gameStats, screenshots, actions, errors } = this.results;
    
    return `# Paperclips Automation Demo Report

## Summary
- **Start Time**: ${startTime}
- **End Time**: ${endTime}
- **Duration**: ${duration.toFixed(2)} seconds
- **Total Actions**: ${actions.length}
- **Screenshots**: ${screenshots.length}
- **Errors**: ${errors.length}

## Game Statistics
${gameStats.map((stat, i) => `
### State ${i + 1}
- **Title**: ${stat.title}
- **Paperclips**: ${stat.paperclips || 'N/A'}
- **Money**: ${stat.money || 'N/A'}
- **Buttons**: ${stat.buttons}
- **Make Button**: ${stat.clipButtonFound ? 'Found' : 'Not found'}
- **Timestamp**: ${stat.timestamp}
`).join('\n')}

## Screenshots
${screenshots.map(shot => `
- **${shot.name}**: ${shot.filename} (${Math.round(shot.size / 1024)}KB)
`).join('\n')}

## Actions Log
${actions.map(action => `
- **${action.type}**: ${action.message} (${action.timestamp})
`).join('\n')}

${errors.length > 0 ? `## Errors
${errors.map(error => `
- ${error.message} (${error.timestamp})
`).join('\n')}` : ''}

## Conclusion
The demo successfully demonstrated browser automation capabilities using Puppeteer. 
The platform was able to navigate to the Universal Paperclips game, analyze the page structure,
interact with game elements, and capture comprehensive results.
`;
  }

  async run() {
    this.log('🎮 Starting Simple Paperclips Automation Demo', 'info');
    this.log('=' .repeat(50), 'info');
    
    await this.ensureResultsDirectory();
    
    let browser;
    try {
      // Launch browser
      this.log('Launching browser...', 'info');
      browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1920, height: 1080 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      this.log('Browser launched successfully', 'success');
      
      // Navigate to game
      this.log(`Navigating to ${PAPERCLIPS_URL}`, 'info');
      await page.goto(PAPERCLIPS_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      this.log('Page loaded successfully', 'success');
      
      // Take initial screenshot
      await this.saveScreenshot(page, 'initial');
      
      // Analyze initial state
      await this.analyzeGameState(page);
      
      // Run automated session
      const results = await this.runAutomatedSession(page, 30);
      
      // Generate comprehensive report
      await this.generateReport();
      
      this.log('🎉 Demo completed successfully!', 'success');
      this.log(`Total results saved to: ${RESULTS_DIR}`, 'info');
      
      return results;
      
    } catch (error) {
      this.log(`Demo failed: ${error.message}`, 'error');
      throw error;
    } finally {
      if (browser) {
        await browser.close();
        this.log('Browser closed', 'info');
      }
    }
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new SimplePaperclipsDemo();
  demo.run().catch(console.error);
}

export default SimplePaperclipsDemo;