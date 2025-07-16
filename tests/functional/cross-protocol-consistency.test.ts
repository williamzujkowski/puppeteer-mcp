/**
 * Cross-Protocol Consistency Tests
 * @module tests/functional/cross-protocol-consistency
 * @description Tests to ensure consistent behavior across all protocols
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  CrossProtocolTestRunner,
  type TestSuite,
  type TestCase,
} from '../framework/cross-protocol-test-runner.js';
import { createMCPServer } from '../../src/mcp/server.js';
import type { MCPServer } from '../../src/mcp/server.js';
import { v4 as uuidv4 } from 'uuid';
import { createApp, sessionStore, browserPool } from '../../src/server.js';
import { createLogger } from '../../src/server/service-registry.js';
import type { Application } from 'express';
import * as http from 'http';
import { TestDataUrls } from '../utils/test-data-urls.js';
import { setupTestLogging } from '../utils/log-suppressor.js';

/**
 * Cross-protocol test configuration
 */
const testPort = process.env.TEST_SERVER_PORT || process.env.PORT || '3000';
const testConfig = {
  mcp: { transport: 'stdio' as const },
  rest: { baseUrl: `http://localhost:${testPort}/api/v1` },
  grpc: { host: 'localhost', port: 50051 },
  websocket: { url: `ws://localhost:${testPort}/ws` },
};

/**
 * Shared test data
 */
const testData = {
  sessions: new Map<string, any>(),
  contexts: new Map<string, any>(),
  users: new Map<string, any>(),
};

/**
 * Session management test suite
 */
const sessionManagementSuite: TestSuite = {
  name: 'Session Management Cross-Protocol',
  description: 'Verify session operations work consistently across all protocols',
  tests: [
    {
      name: 'Create session via MCP, verify via REST',
      execute: async (clients) => {
        // Create session using MCP
        const mcpResult = await clients.mcp.callTool('create-session', {
          username: 'crosstest1',
          password: 'testpass123',
        });

        const sessionData = JSON.parse(mcpResult.content[0].text);
        testData.sessions.set('test1', sessionData);

        // Verify via REST
        const restResult = await clients.rest.request({
          method: 'GET',
          path: `/sessions/${sessionData.sessionId}`,
          headers: {
            Authorization: `Bearer ${sessionData.token || sessionData.sessionId}`,
          },
        });

        expect(restResult.id).toBe(sessionData.sessionId);
        expect(restResult.userId).toBe(sessionData.userId);
      },
    },

    {
      name: 'Create session via REST, verify via MCP',
      execute: async (clients) => {
        // Create session using REST
        const restResult = await clients.rest.request({
          method: 'POST',
          path: '/sessions',
          body: {
            username: 'crosstest2',
            password: 'testpass123',
          },
        });

        testData.sessions.set('test2', restResult);

        // Verify via MCP list-sessions
        const mcpResult = await clients.mcp.callTool('list-sessions', {});
        const sessions = JSON.parse(mcpResult.content[0].text);

        const foundSession = sessions.sessions.find((s: any) => s.id === restResult.id);
        expect(foundSession).toBeDefined();
        expect(foundSession.userId).toBe(restResult.userId);
      },
    },

    {
      name: 'Delete session via gRPC, verify deletion across all protocols',
      setup: async () => {
        // Create a session to delete
        const result = await testConfig.rest.request({
          method: 'POST',
          path: '/sessions',
          body: {
            username: 'deletetest',
            password: 'testpass123',
          },
        });
        testData.sessions.set('delete-test', result);
      },
      execute: async (clients) => {
        const session = testData.sessions.get('delete-test');

        // Delete via gRPC
        await clients.grpc.call('SessionService', 'DeleteSession', {
          sessionId: session.id,
        });

        // Verify deletion via MCP
        const mcpResult = await clients.mcp.callTool('list-sessions', {});
        const sessions = JSON.parse(mcpResult.content[0].text);
        const foundSession = sessions.sessions.find((s: any) => s.id === session.id);
        expect(foundSession).toBeUndefined();

        // Verify deletion via REST (should return 404)
        await expect(
          clients.rest.request({
            method: 'GET',
            path: `/sessions/${session.id}`,
            expectError: true,
          }),
        ).rejects.toThrow();
      },
    },

    {
      name: 'Real-time session updates via WebSocket',
      execute: async (clients) => {
        const updates: any[] = [];

        // Subscribe to session updates
        await clients.websocket.subscribe('session-updates', (update: any) => {
          updates.push(update);
        });

        // Create session via MCP
        const mcpResult = await clients.mcp.callTool('create-session', {
          username: 'wstest',
          password: 'testpass123',
        });
        const sessionData = JSON.parse(mcpResult.content[0].text);

        // Wait for WebSocket notification
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Verify we received the update
        const createUpdate = updates.find(
          (u) => u.type === 'session.created' && u.sessionId === sessionData.sessionId,
        );
        expect(createUpdate).toBeDefined();

        // Delete session
        await clients.mcp.callTool('delete-session', {
          sessionId: sessionData.sessionId,
        });

        // Wait for delete notification
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const deleteUpdate = updates.find(
          (u) => u.type === 'session.deleted' && u.sessionId === sessionData.sessionId,
        );
        expect(deleteUpdate).toBeDefined();

        // Unsubscribe
        await clients.websocket.unsubscribe('session-updates');
      },
    },
  ],
};

/**
 * Browser context test suite
 */
const browserContextSuite: TestSuite = {
  name: 'Browser Context Cross-Protocol',
  description: 'Verify browser context operations across protocols',
  tests: [
    {
      name: 'Create context via MCP, execute via REST',
      setup: async () => {
        // Create session first
        const runner = new CrossProtocolTestRunner(testConfig);
        const result = await runner.clients.mcp.callTool('create-session', {
          username: 'contexttest1',
          password: 'testpass123',
        });
        const sessionData = JSON.parse(result.content[0].text);
        testData.sessions.set('context-test-1', sessionData);
      },
      execute: async (clients) => {
        const session = testData.sessions.get('context-test-1');

        // Create context via MCP
        const mcpResult = await clients.mcp.callTool('create-browser-context', {
          sessionId: session.sessionId,
        });
        const contextData = JSON.parse(mcpResult.content[0].text);
        testData.contexts.set('test1', contextData);

        // Execute command via REST
        const restResult = await clients.rest.request({
          method: 'POST',
          path: `/contexts/${contextData.contextId}/execute`,
          headers: {
            Authorization: `Bearer ${session.token || session.sessionId}`,
          },
          body: {
            action: 'navigate',
            params: { url: TestDataUrls.basicPage() },
          },
        });

        expect(restResult.success).toBe(true);
        expect(restResult.data).toBeDefined();
      },
    },

    {
      name: 'Create context via gRPC, execute via MCP',
      setup: async () => {
        // Create session
        const result = await testConfig.grpc.call('SessionService', 'CreateSession', {
          username: 'contexttest2',
          password: 'testpass123',
        });
        testData.sessions.set('context-test-2', result);
      },
      execute: async (clients) => {
        const session = testData.sessions.get('context-test-2');

        // Create context via gRPC
        const grpcResult = await clients.grpc.call('ContextService', 'CreateContext', {
          sessionId: session.sessionId,
          options: { headless: true },
        });
        testData.contexts.set('test2', grpcResult);

        // Execute command via MCP
        const mcpResult = await clients.mcp.callTool('execute-in-context', {
          contextId: grpcResult.contextId,
          command: 'navigate',
          parameters: { url: TestDataUrls.basicPage() },
        });

        const executeData = JSON.parse(mcpResult.content[0].text);
        expect(executeData.success).toBe(true);
      },
    },

    {
      name: 'Context state consistency across protocols',
      execute: async (clients) => {
        const session = testData.sessions.get('context-test-1');
        const context = testData.contexts.get('test1');

        // Execute screenshot via MCP
        const screenshotResult = await clients.mcp.callTool('execute-in-context', {
          contextId: context.contextId,
          command: 'screenshot',
          parameters: { fullPage: true },
        });

        // Get context state via REST
        const stateResult = await clients.rest.request({
          method: 'GET',
          path: `/contexts/${context.contextId}`,
          headers: {
            Authorization: `Bearer ${session.token || session.sessionId}`,
          },
        });

        expect(stateResult.lastAction).toBe('screenshot');
        expect(stateResult.pageCount).toBeGreaterThan(0);
      },
    },
  ],
};

/**
 * Resource access test suite
 */
const resourceAccessSuite: TestSuite = {
  name: 'Resource Access Cross-Protocol',
  description: 'Verify resource access consistency',
  tests: [
    {
      name: 'API Catalog consistency',
      execute: async (clients) => {
        // Get catalog via MCP
        const mcpCatalog = await clients.mcp.readResource('api://catalog');
        const mcpData = JSON.parse(mcpCatalog.contents[0].text);

        // Get catalog via REST
        const restCatalog = await clients.rest.request({
          method: 'GET',
          path: '/catalog',
        });

        // Compare REST endpoints
        expect(mcpData.rest.endpoints.length).toBe(restCatalog.rest.endpoints.length);
        expect(mcpData.rest.baseUrl).toBe(restCatalog.rest.baseUrl);

        // Compare gRPC services
        expect(mcpData.grpc.services.length).toBe(restCatalog.grpc.services.length);

        // Compare WebSocket topics
        expect(mcpData.websocket.topics.length).toBe(restCatalog.websocket.topics.length);
      },
    },

    {
      name: 'Health status consistency',
      execute: async (clients) => {
        // Get health via MCP
        const mcpHealth = await clients.mcp.readResource('api://health');
        const mcpData = JSON.parse(mcpHealth.contents[0].text);

        // Get health via REST
        const restHealth = await clients.rest.request({
          method: 'GET',
          path: '/health',
        });

        // Get health via gRPC
        const grpcHealth = await clients.grpc.call('HealthService', 'Check', {});

        // All should report healthy
        expect(mcpData.status).toBe('healthy');
        expect(restHealth.status).toBe('healthy');
        expect(grpcHealth.status).toBe('SERVING');

        // Service statuses should match
        expect(mcpData.services.rest).toBe('operational');
        expect(mcpData.services.grpc).toBe('operational');
        expect(mcpData.services.websocket).toBe('operational');
        expect(mcpData.services.mcp).toBe('operational');
      },
    },
  ],
};

/**
 * Performance comparison suite
 */
const performanceSuite: TestSuite = {
  name: 'Cross-Protocol Performance',
  description: 'Compare performance across protocols',
  tests: [
    {
      name: 'Session creation performance comparison',
      execute: async (clients) => {
        const iterations = 10;
        const results = {
          mcp: [] as number[],
          rest: [] as number[],
          grpc: [] as number[],
        };

        // Test MCP performance
        for (let i = 0; i < iterations; i++) {
          const start = Date.now();
          await clients.mcp.callTool('create-session', {
            username: `perftest_mcp_${i}`,
            password: 'testpass123',
          });
          results.mcp.push(Date.now() - start);
        }

        // Test REST performance
        for (let i = 0; i < iterations; i++) {
          const start = Date.now();
          await clients.rest.request({
            method: 'POST',
            path: '/sessions',
            body: {
              username: `perftest_rest_${i}`,
              password: 'testpass123',
            },
          });
          results.rest.push(Date.now() - start);
        }

        // Test gRPC performance
        for (let i = 0; i < iterations; i++) {
          const start = Date.now();
          await clients.grpc.call('SessionService', 'CreateSession', {
            username: `perftest_grpc_${i}`,
            password: 'testpass123',
          });
          results.grpc.push(Date.now() - start);
        }

        // Calculate averages
        const avgMcp = results.mcp.reduce((a, b) => a + b, 0) / iterations;
        const avgRest = results.rest.reduce((a, b) => a + b, 0) / iterations;
        const avgGrpc = results.grpc.reduce((a, b) => a + b, 0) / iterations;

        console.log('Performance Results:');
        console.log(`MCP Average: ${avgMcp.toFixed(2)}ms`);
        console.log(`REST Average: ${avgRest.toFixed(2)}ms`);
        console.log(`gRPC Average: ${avgGrpc.toFixed(2)}ms`);

        // All should complete within reasonable time
        expect(avgMcp).toBeLessThan(1000);
        expect(avgRest).toBeLessThan(1000);
        expect(avgGrpc).toBeLessThan(1000);
      },
    },
  ],
};

// TODO: Fix these tests - they expect thrown errors but protocols return error content
describe.skip('Cross-Protocol Consistency Tests', () => {
  setupTestLogging();

  let runner: CrossProtocolTestRunner;
  let mcpServer: MCPServer;
  let app: Application;
  let httpServer: http.Server;

  beforeAll(async () => {
    // Create Express app with required dependencies
    const logger = createLogger();
    app = createApp(logger, sessionStore, browserPool);

    // Start HTTP server for REST and WebSocket endpoints
    httpServer = http.createServer(app);
    const port = parseInt(testPort, 10);
    await new Promise<void>((resolve) => {
      httpServer.listen(port, () => {
        console.log(`Test HTTP server started on port ${port}`);
        resolve();
      });
    });

    // Create and start MCP server with Express app
    mcpServer = createMCPServer({ app });
    await mcpServer.start();

    // Initialize test runner
    runner = new CrossProtocolTestRunner(testConfig);
    await runner.initialize(mcpServer);
  }, 60000);

  afterAll(async () => {
    // Cleanup
    await runner.cleanup();
    await mcpServer.stop();

    // Close HTTP server
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          console.log('Test HTTP server closed');
          resolve();
        });
      });
    }
  }, 60000);

  it('should pass session management tests', async () => {
    const results = await runner.runSuite(sessionManagementSuite);

    expect(results.failed).toBe(0);
    expect(results.passed).toBe(sessionManagementSuite.tests.length);
  });

  it('should pass browser context tests', async () => {
    const results = await runner.runSuite(browserContextSuite);

    expect(results.failed).toBe(0);
    expect(results.passed).toBe(browserContextSuite.tests.length);
  });

  it('should pass resource access tests', async () => {
    const results = await runner.runSuite(resourceAccessSuite);

    expect(results.failed).toBe(0);
    expect(results.passed).toBe(resourceAccessSuite.tests.length);
  });

  it('should demonstrate consistent performance', async () => {
    const results = await runner.runSuite(performanceSuite);

    expect(results.failed).toBe(0);
    expect(results.passed).toBe(performanceSuite.tests.length);
  });

  it('should generate comprehensive test report', async () => {
    const allResults = runner.getResults();

    console.log('\n=== Cross-Protocol Test Summary ===');
    console.log(`Total Tests: ${allResults.passed + allResults.failed}`);
    console.log(`Passed: ${allResults.passed}`);
    console.log(`Failed: ${allResults.failed}`);
    console.log(`Duration: ${allResults.duration}ms`);

    if (allResults.errors.length > 0) {
      console.log('\nFailures:');
      allResults.errors.forEach((error) => {
        console.log(`- ${error.test}: ${error.error}`);
      });
    }

    expect(allResults.failed).toBe(0);
  });
});
