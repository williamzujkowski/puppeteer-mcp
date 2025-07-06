#!/usr/bin/env node

/**
 * Paperclips Game Automation Script
 * Uses the Puppeteer MCP server to automatically play the paperclips game
 */

import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SERVER_URL = 'http://localhost:3002';
const GAME_URL = 'https://williamzujkowski.github.io/paperclips/index2.html';

class PaperclipsPlayer {
  constructor() {
    this.sessionId = null;
    this.contextId = null;
    this.pageId = null;
    this.authToken = this.generateAuthToken();
  }

  generateAuthToken() {
    // Use the same secret as the server for testing
    const JWT_SECRET = 'test-secret-for-paperclips-must-be-32-chars-long';
    
    return jwt.sign(
      {
        sub: 'paperclips-player',
        username: 'paperclips-player',
        roles: ['user', 'admin'], // Give admin role for full access
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const response = await fetch(`${SERVER_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: body ? JSON.stringify(body) : null,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  async createSession() {
    console.log('🔄 Creating session...');
    const result = await this.makeRequest('/api/v1/sessions', 'POST', {
      userId: 'paperclips-player',
      metadata: { purpose: 'game-automation' }
    });
    this.sessionId = result.id;
    console.log(`✅ Session created: ${this.sessionId}`);
  }

  async createContext() {
    console.log('🔄 Creating browser context...');
    const result = await this.makeRequest('/api/v1/contexts', 'POST', {
      name: 'paperclips-game',
      sessionId: this.sessionId,
      config: {
        headless: false, // Show browser for demo
        viewport: { width: 1200, height: 800 }
      }
    });
    this.contextId = result.id;
    console.log(`✅ Context created: ${this.contextId}`);
  }

  async navigateToGame() {
    console.log('🔄 Navigating to paperclips game...');
    const result = await this.makeRequest(
      `/api/v1/contexts/${this.contextId}/execute`,
      'POST',
      {
        action: 'navigate',
        params: { url: GAME_URL }
      }
    );
    console.log('✅ Navigated to game');
    
    // Wait a moment for the page to load
    await this.wait(3000);
  }

  async wait(ms) {
    console.log(`⏱️  Waiting ${ms}ms...`);
    await this.makeRequest(
      `/api/v1/contexts/${this.contextId}/execute`,
      'POST',
      {
        action: 'wait',
        params: { time: ms }
      }
    );
  }

  async takeScreenshot(filename = 'game-state.png') {
    console.log(`📸 Taking screenshot: ${filename}`);
    const result = await this.makeRequest(
      `/api/v1/contexts/${this.contextId}/execute`,
      'POST',
      {
        action: 'screenshot',
        params: { 
          path: `./testing/paperclips-game/${filename}`,
          fullPage: true 
        }
      }
    );
    console.log(`✅ Screenshot saved`);
    return result;
  }

  async analyzeGameInterface() {
    console.log('🔍 Analyzing game interface...');
    
    // Take initial screenshot
    await this.takeScreenshot('initial-state.png');
    
    // Get page content to analyze the game structure
    const content = await this.makeRequest(
      `/api/v1/contexts/${this.contextId}/execute`,
      'POST',
      {
        action: 'content',
        params: {}
      }
    );
    
    console.log('🎮 Game loaded successfully!');
    
    // Look for key game elements
    const keyElements = [
      'btnMakePaperclip',
      'clips',
      'funds',
      'wire',
      'unsoldClips'
    ];
    
    for (const elementId of keyElements) {
      try {
        const element = await this.makeRequest(
          `/api/v1/contexts/${this.contextId}/execute`,
          'POST',
          {
            action: 'evaluate',
            params: {
              expression: `document.getElementById('${elementId}') ? '${elementId} found' : '${elementId} not found'`
            }
          }
        );
        console.log(`🔍 ${element.result}`);
      } catch (error) {
        console.log(`❌ Error checking ${elementId}: ${error.message}`);
      }
    }
  }

  async clickElement(selector) {
    try {
      const result = await this.makeRequest(
        `/api/v1/contexts/${this.contextId}/execute`,
        'POST',
        {
          action: 'click',
          params: { selector }
        }
      );
      return true;
    } catch (error) {
      console.log(`❌ Failed to click ${selector}: ${error.message}`);
      return false;
    }
  }

  async getGameStats() {
    try {
      const stats = await this.makeRequest(
        `/api/v1/contexts/${this.contextId}/execute`,
        'POST',
        {
          action: 'evaluate',
          params: {
            expression: `({
              clips: document.getElementById('clips')?.textContent || '0',
              funds: document.getElementById('funds')?.textContent || '0',
              wire: document.getElementById('wire')?.textContent || '0',
              unsoldClips: document.getElementById('unsoldClips')?.textContent || '0'
            })`
          }
        }
      );
      return stats.result;
    } catch (error) {
      console.log(`❌ Failed to get stats: ${error.message}`);
      return null;
    }
  }

  async autoPlay() {
    console.log('🎮 Starting automated gameplay...');
    
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loop
    
    while (iterations < maxIterations) {
      iterations++;
      
      // Get current game state
      const stats = await this.getGameStats();
      if (stats) {
        console.log(`📊 Stats - Clips: ${stats.clips}, Funds: ${stats.funds}, Wire: ${stats.wire}`);
      }
      
      // Try to make paperclips
      const clicked = await this.clickElement('#btnMakePaperclip');
      if (clicked) {
        console.log(`🔄 Iteration ${iterations}: Made paperclip`);
      }
      
      // Take screenshot every 10 iterations
      if (iterations % 10 === 0) {
        await this.takeScreenshot(`gameplay-${iterations}.png`);
      }
      
      // Small delay between actions
      await this.wait(500);
      
      // Check if we have enough clips to buy something
      if (iterations % 20 === 0) {
        // Try to buy auto-clickers or other upgrades
        console.log('🔄 Checking for available upgrades...');
        
        // This would need to be expanded based on the actual game interface
        const upgradeButtons = ['btnMakeAutoclipper', 'btnWire', 'btnSell'];
        for (const button of upgradeButtons) {
          await this.clickElement(`#${button}`);
        }
      }
    }
    
    console.log('🎮 Gameplay completed!');
    await this.takeScreenshot('final-state.png');
  }

  async cleanup() {
    if (this.contextId) {
      console.log('🧹 Cleaning up context...');
      try {
        await this.makeRequest(`/api/v1/contexts/${this.contextId}`, 'DELETE');
        console.log('✅ Context cleaned up');
      } catch (error) {
        console.log(`❌ Failed to cleanup context: ${error.message}`);
      }
    }
  }

  async run() {
    try {
      await this.createSession();
      await this.createContext();
      await this.navigateToGame();
      await this.analyzeGameInterface();
      await this.autoPlay();
    } catch (error) {
      console.error('❌ Error during gameplay:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the game player
const player = new PaperclipsPlayer();
player.run().then(() => {
  console.log('🎯 Paperclips automation completed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});