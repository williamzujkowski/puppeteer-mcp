#!/usr/bin/env node

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:8443/api/v1';

async function testApi() {
  console.log('Testing Puppeteer MCP API...\n');
  
  // Test 1: Health check
  console.log('1. Testing health endpoint:');
  try {
    const healthRes = await fetch('http://localhost:8443/health');
    const health = await healthRes.json();
    console.log('✅ Health:', health);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }

  // Test 2: Create session with API key auth
  console.log('\n2. Testing session creation with API key:');
  try {
    const sessionRes = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'X-API-Key': 'test-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        baseUrl: 'https://example.com'
      })
    });
    
    console.log('Response status:', sessionRes.status);
    const sessionData = await sessionRes.json();
    console.log('Response:', JSON.stringify(sessionData, null, 2));
    
    if (sessionRes.ok && sessionData.sessionId) {
      console.log('✅ Session created:', sessionData.sessionId);
      
      // Test 3: Navigate
      console.log('\n3. Testing navigation:');
      const navRes = await fetch(`${API_BASE}/sessions/${sessionData.sessionId}/navigate`, {
        method: 'POST',
        headers: {
          'X-API-Key': 'test-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: 'https://example.com'
        })
      });
      
      const navData = await navRes.json();
      console.log('Navigation response:', navData);
      
      // Cleanup
      console.log('\n4. Cleaning up session:');
      const deleteRes = await fetch(`${API_BASE}/sessions/${sessionData.sessionId}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': 'test-key'
        }
      });
      console.log('✅ Session deleted:', deleteRes.status);
    }
  } catch (error) {
    console.log('❌ Session test failed:', error.message);
  }
}

testApi().catch(console.error);