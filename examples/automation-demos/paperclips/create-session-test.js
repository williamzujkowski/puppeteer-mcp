#!/usr/bin/env node

/**
 * Simple test to create a valid session using the server's session store
 * This will help us understand how to properly authenticate with the API
 */

import { v4 as uuidv4 } from 'uuid';

// We'll test a simpler approach: create a session via the server's token refresh endpoint
// But first, let's see what endpoints are available

const BASE_URL = 'http://localhost:3000';

async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

    const requestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (data) {
      requestOptions.body = JSON.stringify(data);
    }

    const response = await fetch(url, requestOptions);
    const responseData = await response.text();

    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = responseData;
    }

    return {
      success: response.ok,
      status: response.status,
      data: parsedData,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function exploreApiEndpoints() {
  console.log('🔍 Exploring API endpoints...\n');

  // Test different potential endpoints
  const endpoints = [
    { method: 'GET', path: '/api/v1/' },
    { method: 'GET', path: '/api/v1' },
    { method: 'OPTIONS', path: '/api/v1/contexts' },
    { method: 'POST', path: '/api/v1/auth/login' },
    { method: 'POST', path: '/api/v1/sessions/create' },
    { method: 'POST', path: '/api/v1/login' },
    { method: 'GET', path: '/api/v1/health' },
    { method: 'GET', path: '/openapi.json' },
    { method: 'GET', path: '/api/v1/openapi.json' },
    { method: 'GET', path: '/docs' },
    { method: 'GET', path: '/api/v1/docs' },
  ];

  for (const endpoint of endpoints) {
    const response = await makeRequest(endpoint.method, endpoint.path);
    console.log(
      `${endpoint.method} ${endpoint.path}: ${response.status} - ${response.success ? 'SUCCESS' : 'FAIL'}`,
    );
    if (response.success && typeof response.data === 'object') {
      console.log(`  Response:`, JSON.stringify(response.data, null, 2).substring(0, 200), '...\n');
    } else {
      console.log(
        `  Error:`,
        response.data ? String(response.data).substring(0, 100) : 'No data',
        '\n',
      );
    }
  }
}

async function testTokenlessAccess() {
  console.log('\n🔒 Testing access without authentication...\n');

  // Try accessing endpoints without tokens
  const protectedEndpoints = [
    { method: 'GET', path: '/api/v1/contexts' },
    { method: 'POST', path: '/api/v1/contexts', data: { name: 'test' } },
  ];

  for (const endpoint of protectedEndpoints) {
    const response = await makeRequest(endpoint.method, endpoint.path, endpoint.data);
    console.log(`${endpoint.method} ${endpoint.path}: ${response.status}`);
    console.log(`  Response:`, response.data, '\n');
  }
}

async function main() {
  // Check if server is running
  const healthResponse = await makeRequest('GET', '/health');
  if (!healthResponse.success) {
    console.error('❌ Server is not running. Please start it first.');
    process.exit(1);
  }

  console.log('✅ Server is running\n');

  await exploreApiEndpoints();
  await testTokenlessAccess();
}

main().catch(console.error);
