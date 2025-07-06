#!/usr/bin/env node
/**
 * Demo: Running a single error handling test
 * This demonstrates testing invalid URL handling
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';
const TOKEN = process.env.API_TOKEN || 'test-token';

async function demoInvalidUrlTest() {
  console.log('🧪 Demo: Testing Invalid URL Error Handling\n');
  
  let sessionId;
  
  try {
    // 1. Create a test session
    console.log('1️⃣ Creating test session...');
    const sessionResponse = await axios.post(
      `${API_BASE}/sessions`,
      { name: 'demo-error-test' },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    sessionId = sessionResponse.data.data.id;
    console.log(`✅ Session created: ${sessionId}\n`);
    
    // 2. Test various invalid URLs
    const testUrls = [
      { url: 'htp://invalid-protocol', description: 'Invalid protocol' },
      { url: 'https://this-domain-does-not-exist-12345.com', description: 'Non-existent domain' },
      { url: 'javascript:alert(1)', description: 'JavaScript protocol (XSS attempt)' },
      { url: 'file:///etc/passwd', description: 'File protocol (security test)' }
    ];
    
    console.log('2️⃣ Testing invalid URLs:');
    for (const test of testUrls) {
      console.log(`\n   Testing: ${test.description}`);
      console.log(`   URL: ${test.url}`);
      
      try {
        const response = await axios.post(
          `${API_BASE}/contexts/${sessionId}/action`,
          {
            sessionId,
            action: 'navigate',
            params: { url: test.url }
          },
          { 
            headers: { Authorization: `Bearer ${TOKEN}` },
            validateStatus: () => true
          }
        );
        
        if (response.status >= 400) {
          console.log(`   ✅ Properly rejected with status ${response.status}`);
          console.log(`   Error: ${response.data.error || response.data.message}`);
        } else {
          console.log(`   ❌ SECURITY ISSUE: Invalid URL was accepted!`);
        }
      } catch (error) {
        console.log(`   ✅ Network error (expected): ${error.message}`);
      }
    }
    
    // 3. Verify session is still functional
    console.log('\n3️⃣ Verifying session recovery...');
    const recoveryResponse = await axios.post(
      `${API_BASE}/contexts/${sessionId}/action`,
      {
        sessionId,
        action: 'navigate',
        params: { url: 'https://example.com' }
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    
    if (recoveryResponse.status === 200) {
      console.log('✅ Session recovered successfully - can navigate to valid URLs');
    } else {
      console.log('❌ Session may be corrupted after error handling');
    }
    
  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    // Cleanup
    if (sessionId) {
      try {
        await axios.delete(
          `${API_BASE}/sessions/${sessionId}`,
          { headers: { Authorization: `Bearer ${TOKEN}` } }
        );
        console.log('\n✅ Test session cleaned up');
      } catch (error) {
        console.error('Cleanup error:', error.message);
      }
    }
  }
  
  console.log('\n🏁 Demo complete!');
}

// Check server and run demo
async function main() {
  try {
    // Check if server is running
    await axios.get(`${API_BASE.replace('/api', '/health')}`);
    await demoInvalidUrlTest();
  } catch (error) {
    console.error('❌ Error: Puppeteer-MCP server is not running');
    console.error('Please start the server with: npm run dev');
    process.exit(1);
  }
}

main().catch(console.error);