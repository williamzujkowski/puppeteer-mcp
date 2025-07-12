#!/usr/bin/env node

/**
 * Comprehensive diagnostic script for puppeteer-mcp
 * Tests all major functionality and identifies issues
 */

// Using native fetch (Node.js 18+)
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SERVER_URL = 'http://localhost:3002';
const JWT_SECRET = 'test-secret-for-paperclips-must-be-32-chars-long';

class PuppeteerMCPDiagnostic {
  constructor() {
    this.issues = [];
    this.successes = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);

    if (type === 'error') {
      this.issues.push(message);
    } else if (type === 'success') {
      this.successes.push(message);
    }
  }

  async makeRequest(endpoint, method = 'GET', body = null, headers = {}) {
    try {
      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : null,
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      return {
        status: response.status,
        ok: response.ok,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      return {
        status: 0,
        ok: false,
        error: error.message,
      };
    }
  }

  createTestToken(sessionId = crypto.randomUUID()) {
    return jwt.sign(
      {
        sub: crypto.randomUUID(),
        username: 'test-user',
        roles: ['user', 'admin'],
        sessionId,
        type: 'access',
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );
  }

  async testBasicConnectivity() {
    this.log('Testing basic connectivity...', 'info');

    // Test health endpoint
    const health = await this.makeRequest('/health');
    if (health.ok) {
      this.log('Health endpoint working', 'success');
    } else {
      this.log(`Health endpoint failed: ${health.status}`, 'error');
    }

    // Test root endpoint
    const root = await this.makeRequest('/');
    if (root.ok) {
      this.log('Root endpoint working', 'success');
      this.log(`Available endpoints: ${JSON.stringify(root.data.endpoints)}`, 'info');
    } else {
      this.log(`Root endpoint failed: ${root.status}`, 'error');
    }
  }

  async testAuthenticationMethods() {
    this.log('Testing authentication methods...', 'info');

    // Test 1: No authentication
    const noAuth = await this.makeRequest('/api/v1/contexts');
    this.log(`No auth response: ${noAuth.status} - ${JSON.stringify(noAuth.data)}`, 'info');

    // Test 2: Invalid JWT
    const invalidJWT = await this.makeRequest('/api/v1/contexts', 'GET', null, {
      Authorization: 'Bearer invalid-token',
    });
    this.log(
      `Invalid JWT response: ${invalidJWT.status} - ${JSON.stringify(invalidJWT.data)}`,
      'info',
    );

    // Test 3: Valid JWT structure but wrong secret
    const wrongSecret = jwt.sign({ sub: 'test' }, 'wrong-secret');
    const wrongSecretResponse = await this.makeRequest('/api/v1/contexts', 'GET', null, {
      Authorization: `Bearer ${wrongSecret}`,
    });
    this.log(
      `Wrong secret response: ${wrongSecretResponse.status} - ${JSON.stringify(wrongSecretResponse.data)}`,
      'info',
    );

    // Test 4: Correct secret but missing session
    const missingSession = this.createTestToken();
    const missingSessionResponse = await this.makeRequest('/api/v1/contexts', 'GET', null, {
      Authorization: `Bearer ${missingSession}`,
    });
    this.log(
      `Missing session response: ${missingSessionResponse.status} - ${JSON.stringify(missingSessionResponse.data)}`,
      'info',
    );

    // Test 5: API Key authentication
    const apiKeyResponse = await this.makeRequest('/api/v1/contexts', 'GET', null, {
      'X-API-Key': 'test-api-key-that-doesnt-exist',
    });
    this.log(
      `API Key response: ${apiKeyResponse.status} - ${JSON.stringify(apiKeyResponse.data)}`,
      'info',
    );
  }

  async testSessionManagement() {
    this.log('Testing session management...', 'info');

    // Try to list sessions
    const listSessions = await this.makeRequest('/api/v1/sessions');
    this.log(
      `List sessions: ${listSessions.status} - ${JSON.stringify(listSessions.data)}`,
      'info',
    );

    // Try to create a session
    const createSession = await this.makeRequest('/api/v1/sessions', 'POST', {
      userId: 'test-user',
      username: 'test-user',
      roles: ['user'],
    });
    this.log(
      `Create session: ${createSession.status} - ${JSON.stringify(createSession.data)}`,
      'info',
    );
  }

  async testAvailableEndpoints() {
    this.log('Testing available API endpoints...', 'info');

    const endpoints = ['/api/v1', '/api/v1/sessions', '/api/v1/contexts', '/api/v1/api-keys'];

    for (const endpoint of endpoints) {
      const response = await this.makeRequest(endpoint);
      this.log(
        `${endpoint}: ${response.status} - ${JSON.stringify(response.data).substring(0, 100)}...`,
        'info',
      );
    }
  }

  async testMCPInterface() {
    this.log('Testing MCP interface...', 'info');

    // The MCP interface runs on stdio, so we can't directly test it via HTTP
    // But we can check if the MCP server files exist and are configured correctly
    this.log('MCP interface requires stdio transport - checking server configuration', 'info');

    // Check if we can hit any MCP-related HTTP endpoints
    const mcpHealth = await this.makeRequest('/mcp/health');
    this.log(
      `MCP health endpoint: ${mcpHealth.status} - ${JSON.stringify(mcpHealth.data)}`,
      'info',
    );
  }

  async testGrpcInterface() {
    this.log('Testing gRPC interface...', 'info');

    // gRPC testing would require a gRPC client, which is complex to set up inline
    // For now, just log that gRPC is running on port 50052
    this.log('gRPC server should be running on port 50052 (requires gRPC client to test)', 'info');
  }

  async testWebSocketInterface() {
    this.log('Testing WebSocket interface...', 'info');

    // WebSocket testing would require a WebSocket client
    this.log(
      'WebSocket server should be available at /ws endpoint (requires WS client to test)',
      'info',
    );
  }

  async identifyAuthenticationIssues() {
    this.log('Analyzing authentication issues...', 'info');

    // The main issue seems to be that we need a session in the session store
    // Let's see if we can identify the exact authentication flow
    this.log('Authentication Flow Analysis:', 'info');
    this.log('1. JWT token needs sessionId in payload', 'info');
    this.log('2. Session must exist in server session store', 'info');
    this.log('3. Session store is created per server instance', 'info');
    this.log('4. No public endpoint to create sessions', 'info');
    this.log(
      '5. Chicken-and-egg problem: need auth to create session, need session for auth',
      'info',
    );
  }

  async proposeSolutions() {
    this.log('Proposed solutions for authentication:', 'info');

    const solutions = [
      'Solution 1: Add development-mode authentication bypass',
      'Solution 2: Add public session creation endpoint for development',
      'Solution 3: Add seed user/session creation on server startup',
      'Solution 4: Add API key-based initial authentication',
      'Solution 5: Use MCP interface which may have different auth',
      'Solution 6: Modify server to accept auth without session for context creation',
    ];

    solutions.forEach((solution, index) => {
      this.log(`${solution}`, 'info');
    });
  }

  async runFullDiagnostic() {
    this.log('Starting comprehensive puppeteer-mcp diagnostic...', 'info');

    await this.testBasicConnectivity();
    await this.testAuthenticationMethods();
    await this.testSessionManagement();
    await this.testAvailableEndpoints();
    await this.testMCPInterface();
    await this.testGrpcInterface();
    await this.testWebSocketInterface();
    await this.identifyAuthenticationIssues();
    await this.proposeSolutions();

    this.log('=== DIAGNOSTIC SUMMARY ===', 'info');
    this.log(`Successful tests: ${this.successes.length}`, 'success');
    this.log(`Issues found: ${this.issues.length}`, 'error');

    if (this.issues.length > 0) {
      this.log('ISSUES TO FIX:', 'error');
      this.issues.forEach((issue, index) => {
        this.log(`${index + 1}. ${issue}`, 'error');
      });
    }

    if (this.successes.length > 0) {
      this.log('WORKING FUNCTIONALITY:', 'success');
      this.successes.forEach((success, index) => {
        this.log(`${index + 1}. ${success}`, 'success');
      });
    }
  }
}

// Run diagnostic if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const diagnostic = new PuppeteerMCPDiagnostic();
  diagnostic.runFullDiagnostic().catch(console.error);
}

export { PuppeteerMCPDiagnostic };
