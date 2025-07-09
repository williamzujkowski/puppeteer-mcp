/**
 * Basic Screenshot Capture Example
 * 
 * This example demonstrates how to:
 * - Create a session
 * - Navigate to a URL
 * - Take a screenshot
 * - Clean up resources
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const API_KEY = process.env.API_KEY || 'your-api-key';

interface Session {
  id: string;
  contexts: Array<{
    id: string;
    pages: Array<{ id: string; url: string }>;
  }>;
}

async function captureScreenshot() {
  let sessionId: string | null = null;
  
  try {
    // 1. Create a new session
    console.log('Creating session...');
    const sessionResponse = await axios.post(
      `${API_BASE_URL}/sessions`,
      {
        capabilities: {
          acceptInsecureCerts: true,
          browserName: 'chrome'
        }
      },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const session: Session = sessionResponse.data.data;
    sessionId = session.id;
    console.log(`Session created: ${sessionId}`);
    
    // 2. Navigate to a URL
    const url = 'https://example.com';
    console.log(`Navigating to ${url}...`);
    
    await axios.post(
      `${API_BASE_URL}/sessions/${sessionId}/execute`,
      {
        script: 'goto',
        args: [url],
        context: {}
      },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // 3. Take a screenshot
    console.log('Taking screenshot...');
    const screenshotResponse = await axios.post(
      `${API_BASE_URL}/sessions/${sessionId}/execute`,
      {
        script: 'screenshot',
        args: [{ fullPage: true }],
        context: {}
      },
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // 4. Save the screenshot
    const screenshotData = screenshotResponse.data.data.result;
    const buffer = Buffer.from(screenshotData, 'base64');
    const outputPath = path.join(__dirname, 'screenshots', `example-${Date.now()}.png`);
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, buffer);
    
    console.log(`Screenshot saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // 5. Clean up - delete the session
    if (sessionId) {
      try {
        console.log('Cleaning up session...');
        await axios.delete(`${API_BASE_URL}/sessions/${sessionId}`, {
          headers: { 'X-API-Key': API_KEY }
        });
        console.log('Session deleted successfully');
      } catch (cleanupError) {
        console.error('Error cleaning up session:', cleanupError);
      }
    }
  }
}

// Run the example
if (require.main === module) {
  captureScreenshot()
    .then(() => console.log('Example completed'))
    .catch(error => console.error('Example failed:', error));
}