/**
 * Enhanced Cross-Protocol Test Suite
 * @module tests/functional/cross-protocol-enhanced
 * @description Comprehensive tests for session and context operations across all protocols
 * Tests session creation, context management, state synchronization, and real-time updates
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  CrossProtocolTestRunner,
  type TestSuite,
  type TestCase,
  type TestClients,
} from '../framework/cross-protocol-test-runner.js';
import { createMCPServer } from '../../src/mcp/server.js';
import type { MCPServer } from '../../src/mcp/server.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enhanced cross-protocol test configuration
 */
const testConfig = {
  mcp: { transport: 'stdio' as const },
  rest: {
    baseUrl: 'http://localhost:3000/api/v1',
    timeout: 30000,
  },
  grpc: {
    host: 'localhost',
    port: 50051,
    secure: false,
  },
  websocket: {
    url: 'ws://localhost:3000/ws',
    reconnect: true,
  },
};

/**
 * Shared test state for cross-protocol validation
 */
interface TestState {
  sessions: Map<string, any>;
  contexts: Map<string, any>;
  users: Map<string, any>;
  wsEvents: any[];
  syncStates: Map<string, any>;
}

const testState: TestState = {
  sessions: new Map(),
  contexts: new Map(),
  users: new Map(),
  wsEvents: [],
  syncStates: new Map(),
};

/**
 * Enhanced Session Management Test Suite
 * Tests session lifecycle across all protocols with state synchronization
 */
const enhancedSessionManagementSuite: TestSuite = {
  name: 'Enhanced Session Management Cross-Protocol',
  description: 'Comprehensive session lifecycle testing across all protocols with state sync',

  setup: async () => {
    // Clear test state
    testState.sessions.clear();
    testState.contexts.clear();
    testState.users.clear();
    testState.wsEvents.length = 0;
    testState.syncStates.clear();
  },

  tests: [
    {
      name: 'Session Creation Chain - MCP → REST → gRPC → WebSocket Verification',
      description:
        'Create session via MCP, verify via REST, extend via gRPC, monitor via WebSocket',
      timeout: 45000,
      execute: async (clients: TestClients) => {
        const sessionId = uuidv4();
        const username = `chain_test_${Date.now()}`;

        // Step 1: Create session via MCP
        const mcpResult = await clients.mcp.callTool('create-session', {
          username,
          password: 'secure_test_pass_123',
        });

        const sessionData = JSON.parse(mcpResult.content[0].text);
        testState.sessions.set('chain_test', sessionData);

        expect(sessionData.sessionId).toBeDefined();
        expect(sessionData.userId).toBeDefined();
        expect(sessionData.username).toBe(username);

        // Step 2: Verify session via REST API
        const restResult = await clients.rest.request({
          method: 'GET',
          path: `/sessions/${sessionData.sessionId}`,
          headers: {
            Authorization: `Bearer ${sessionData.token || sessionData.sessionId}`,
          },
        });

        expect(restResult.id).toBe(sessionData.sessionId);
        expect(restResult.userId).toBe(sessionData.userId);
        expect(restResult.status).toBe('active');

        // Step 3: Extend session via gRPC
        const grpcResult = await clients.grpc.call('SessionService', 'ExtendSession', {
          sessionId: sessionData.sessionId,
          extensionMinutes: 30,
        });

        expect(grpcResult.success).toBe(true);
        expect(grpcResult.newExpiryTime).toBeDefined();

        // Step 4: Monitor via WebSocket real-time updates
        const wsUpdates: any[] = [];
        await clients.websocket.subscribe('session-lifecycle', (update: any) => {
          wsUpdates.push(update);
        });

        // Trigger an update by listing sessions
        await clients.mcp.callTool('list-sessions', {});

        // Wait for WebSocket propagation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify WebSocket received session updates
        const sessionUpdate = wsUpdates.find(
          (u) => u.sessionId === sessionData.sessionId && u.type === 'session.extended',
        );
        expect(sessionUpdate).toBeDefined();

        await clients.websocket.unsubscribe('session-lifecycle');
      },
    },

    {
      name: 'Concurrent Session Operations Across Protocols',
      description: 'Test concurrent session operations maintain consistency',
      timeout: 60000,
      execute: async (clients: TestClients) => {
        const concurrentSessions = [];
        const sessionCount = 5;

        // Create multiple sessions concurrently across different protocols
        const sessionPromises = [];

        // MCP sessions
        for (let i = 0; i < sessionCount; i++) {
          sessionPromises.push(
            clients.mcp.callTool('create-session', {
              username: `concurrent_mcp_${i}_${Date.now()}`,
              password: 'test_pass_123',
            }),
          );
        }

        // REST sessions
        for (let i = 0; i < sessionCount; i++) {
          sessionPromises.push(
            clients.rest.request({
              method: 'POST',
              path: '/sessions',
              body: {
                username: `concurrent_rest_${i}_${Date.now()}`,
                password: 'test_pass_123',
              },
            }),
          );
        }

        // gRPC sessions
        for (let i = 0; i < sessionCount; i++) {
          sessionPromises.push(
            clients.grpc.call('SessionService', 'CreateSession', {
              username: `concurrent_grpc_${i}_${Date.now()}`,
              password: 'test_pass_123',
            }),
          );
        }

        // Execute all concurrent operations
        const results = await Promise.allSettled(sessionPromises);

        // Verify all sessions were created successfully
        const successfulSessions = results.filter((r) => r.status === 'fulfilled');
        expect(successfulSessions.length).toBe(sessionCount * 3);

        // Verify session consistency across all protocols
        const mcpSessions = await clients.mcp.callTool('list-sessions', {});
        const sessionList = JSON.parse(mcpSessions.content[0].text);

        expect(sessionList.sessions.length).toBeGreaterThanOrEqual(sessionCount * 3);

        // Verify each session via different protocol than it was created
        for (const result of successfulSessions) {
          if (result.status === 'fulfilled') {
            const sessionData = result.value;
            let sessionId;

            // Extract session ID based on response format
            if (typeof sessionData === 'string') {
              const parsed = JSON.parse(sessionData);
              sessionId = parsed.sessionId;
            } else if (sessionData.content) {
              const parsed = JSON.parse(sessionData.content[0].text);
              sessionId = parsed.sessionId;
            } else {
              sessionId = sessionData.sessionId || sessionData.id;
            }

            if (sessionId) {
              // Verify via REST
              const restVerification = await clients.rest.request({
                method: 'GET',
                path: `/sessions/${sessionId}`,
                headers: {
                  Authorization: `Bearer ${sessionId}`,
                },
              });

              expect(restVerification.id).toBe(sessionId);
            }
          }
        }
      },
    },

    {
      name: 'Session State Synchronization Validation',
      description: 'Ensure session state changes propagate across all protocols',
      timeout: 40000,
      execute: async (clients: TestClients) => {
        // Create initial session
        const mcpResult = await clients.mcp.callTool('create-session', {
          username: `sync_test_${Date.now()}`,
          password: 'sync_test_pass',
        });

        const sessionData = JSON.parse(mcpResult.content[0].text);
        const sessionId = sessionData.sessionId;

        // Subscribe to real-time updates
        const stateUpdates: any[] = [];
        await clients.websocket.subscribe('session-state-changes', (update: any) => {
          stateUpdates.push(update);
        });

        // Modify session via REST
        await clients.rest.request({
          method: 'PUT',
          path: `/sessions/${sessionId}`,
          headers: {
            Authorization: `Bearer ${sessionData.token || sessionId}`,
          },
          body: {
            metadata: {
              testFlag: true,
              lastModifiedBy: 'REST',
              modificationTime: new Date().toISOString(),
            },
          },
        });

        // Wait for propagation
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Verify state via MCP
        const mcpVerification = await clients.mcp.callTool('list-sessions', {});
        const sessions = JSON.parse(mcpVerification.content[0].text);
        const updatedSession = sessions.sessions.find((s: any) => s.id === sessionId);

        expect(updatedSession.metadata.testFlag).toBe(true);
        expect(updatedSession.metadata.lastModifiedBy).toBe('REST');

        // Verify state via gRPC
        const grpcVerification = await clients.grpc.call('SessionService', 'GetSession', {
          sessionId,
        });

        expect(grpcVerification.metadata.testFlag).toBe(true);

        // Verify WebSocket received the update
        const syncUpdate = stateUpdates.find(
          (u) => u.sessionId === sessionId && u.type === 'session.metadata.updated',
        );
        expect(syncUpdate).toBeDefined();
        expect(syncUpdate.data.testFlag).toBe(true);

        await clients.websocket.unsubscribe('session-state-changes');
      },
    },
  ],
};

/**
 * Enhanced Context Management Test Suite
 * Tests browser context lifecycle and cross-protocol execution
 */
const enhancedContextManagementSuite: TestSuite = {
  name: 'Enhanced Context Management Cross-Protocol',
  description: 'Comprehensive browser context testing with cross-protocol execution',

  tests: [
    {
      name: 'Context Creation and Execution Chain',
      description: 'Create context via one protocol, execute commands via others',
      timeout: 60000,
      setup: async () => {
        // Create a session for context operations
        const runner = new CrossProtocolTestRunner(testConfig);
        const sessionResult = await runner.clients.mcp.callTool('create-session', {
          username: `context_chain_${Date.now()}`,
          password: 'context_pass',
        });
        const sessionData = JSON.parse(sessionResult.content[0].text);
        testState.sessions.set('context_chain', sessionData);
      },
      execute: async (clients: TestClients) => {
        const session = testState.sessions.get('context_chain');

        // Step 1: Create context via MCP
        const mcpContextResult = await clients.mcp.callTool('create-browser-context', {
          sessionId: session.sessionId,
          options: {
            headless: true,
            viewport: { width: 1920, height: 1080 },
          },
        });

        const contextData = JSON.parse(mcpContextResult.content[0].text);
        testState.contexts.set('chain_context', contextData);

        expect(contextData.contextId).toBeDefined();
        expect(contextData.sessionId).toBe(session.sessionId);

        // Step 2: Navigate via REST
        const restNavigateResult = await clients.rest.request({
          method: 'POST',
          path: `/contexts/${contextData.contextId}/execute`,
          headers: {
            Authorization: `Bearer ${session.token || session.sessionId}`,
          },
          body: {
            action: 'navigate',
            params: {
              url: 'https://httpbin.org/json',
              waitUntil: 'networkidle0',
            },
          },
        });

        expect(restNavigateResult.success).toBe(true);
        expect(restNavigateResult.data.url).toContain('httpbin.org');

        // Step 3: Execute JavaScript via gRPC
        const grpcJsResult = await clients.grpc.call('ContextService', 'ExecuteScript', {
          contextId: contextData.contextId,
          script: 'document.title',
          waitForResult: true,
        });

        expect(grpcJsResult.success).toBe(true);
        expect(grpcJsResult.result).toBeDefined();

        // Step 4: Take screenshot via MCP
        const screenshotResult = await clients.mcp.callTool('execute-in-context', {
          contextId: contextData.contextId,
          command: 'screenshot',
          parameters: {
            fullPage: true,
            type: 'png',
          },
        });

        const screenshotData = JSON.parse(screenshotResult.content[0].text);
        expect(screenshotData.success).toBe(true);
        expect(screenshotData.data.screenshot).toBeDefined();

        // Step 5: Verify context state consistency
        const contextStateRest = await clients.rest.request({
          method: 'GET',
          path: `/contexts/${contextData.contextId}`,
          headers: {
            Authorization: `Bearer ${session.token || session.sessionId}`,
          },
        });

        expect(contextStateRest.lastAction).toBe('screenshot');
        expect(contextStateRest.pageCount).toBe(1);
        expect(contextStateRest.currentUrl).toContain('httpbin.org');
      },
    },

    {
      name: 'Multi-Context Session Management',
      description: 'Manage multiple contexts within a session across protocols',
      timeout: 45000,
      setup: async () => {
        const runner = new CrossProtocolTestRunner(testConfig);
        const sessionResult = await runner.clients.rest.request({
          method: 'POST',
          path: '/sessions',
          body: {
            username: `multi_context_${Date.now()}`,
            password: 'multi_context_pass',
          },
        });
        testState.sessions.set('multi_context', sessionResult);
      },
      execute: async (clients: TestClients) => {
        const session = testState.sessions.get('multi_context');
        const contextIds: string[] = [];

        // Create multiple contexts via different protocols
        // Context 1 via MCP
        const mcpContext = await clients.mcp.callTool('create-browser-context', {
          sessionId: session.id,
          options: { headless: true },
        });
        const mcpContextData = JSON.parse(mcpContext.content[0].text);
        contextIds.push(mcpContextData.contextId);

        // Context 2 via gRPC
        const grpcContext = await clients.grpc.call('ContextService', 'CreateContext', {
          sessionId: session.id,
          options: {
            headless: true,
            incognito: true,
          },
        });
        contextIds.push(grpcContext.contextId);

        // Context 3 via REST
        const restContext = await clients.rest.request({
          method: 'POST',
          path: '/contexts',
          headers: {
            Authorization: `Bearer ${session.token || session.id}`,
          },
          body: {
            sessionId: session.id,
            options: { headless: true },
          },
        });
        contextIds.push(restContext.contextId);

        // Execute different actions in each context simultaneously
        const actionPromises = [
          // Context 1: Navigate to example.com
          clients.rest.request({
            method: 'POST',
            path: `/contexts/${contextIds[0]}/execute`,
            headers: { Authorization: `Bearer ${session.token || session.id}` },
            body: {
              action: 'navigate',
              params: { url: 'https://example.com' },
            },
          }),

          // Context 2: Navigate to httpbin.org
          clients.mcp.callTool('execute-in-context', {
            contextId: contextIds[1],
            command: 'navigate',
            parameters: { url: 'https://httpbin.org' },
          }),

          // Context 3: Navigate to jsonplaceholder
          clients.grpc.call('ContextService', 'Navigate', {
            contextId: contextIds[2],
            url: 'https://jsonplaceholder.typicode.com/posts/1',
          }),
        ];

        const results = await Promise.all(actionPromises);

        // Verify all actions succeeded
        expect(results[0].success).toBe(true);

        const mcpResult = JSON.parse(results[1].content[0].text);
        expect(mcpResult.success).toBe(true);

        expect(results[2].success).toBe(true);

        // Verify session has all contexts
        const sessionState = await clients.rest.request({
          method: 'GET',
          path: `/sessions/${session.id}/contexts`,
          headers: {
            Authorization: `Bearer ${session.token || session.id}`,
          },
        });

        expect(sessionState.contexts.length).toBe(3);
        expect(sessionState.contexts.map((c: any) => c.id).sort()).toEqual(contextIds.sort());
      },
    },

    {
      name: 'Context State Real-time Synchronization',
      description: 'Monitor context state changes in real-time via WebSocket',
      timeout: 40000,
      setup: async () => {
        const runner = new CrossProtocolTestRunner(testConfig);
        const sessionResult = await runner.clients.grpc.call('SessionService', 'CreateSession', {
          username: `realtime_sync_${Date.now()}`,
          password: 'realtime_pass',
        });
        testState.sessions.set('realtime_sync', sessionResult);
      },
      execute: async (clients: TestClients) => {
        const session = testState.sessions.get('realtime_sync');
        const contextEvents: any[] = [];

        // Subscribe to context events
        await clients.websocket.subscribe('context-events', (event: any) => {
          contextEvents.push(event);
        });

        // Create context
        const contextResult = await clients.mcp.callTool('create-browser-context', {
          sessionId: session.sessionId,
          options: { headless: true },
        });
        const contextData = JSON.parse(contextResult.content[0].text);

        // Wait for creation event
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Execute various actions and monitor events
        const actions = [
          // Navigate
          clients.rest.request({
            method: 'POST',
            path: `/contexts/${contextData.contextId}/execute`,
            headers: { Authorization: `Bearer ${session.token || session.sessionId}` },
            body: {
              action: 'navigate',
              params: { url: 'https://httpbin.org/json' },
            },
          }),

          // Wait and take screenshot
          new Promise((resolve) => setTimeout(resolve, 2000)).then(() =>
            clients.mcp.callTool('execute-in-context', {
              contextId: contextData.contextId,
              command: 'screenshot',
              parameters: { fullPage: true },
            }),
          ),

          // Execute script
          new Promise((resolve) => setTimeout(resolve, 3000)).then(() =>
            clients.grpc.call('ContextService', 'ExecuteScript', {
              contextId: contextData.contextId,
              script: 'document.readyState',
            }),
          ),
        ];

        await Promise.all(actions);

        // Wait for all events to propagate
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify we received expected events
        const creationEvent = contextEvents.find(
          (e) => e.type === 'context.created' && e.contextId === contextData.contextId,
        );
        expect(creationEvent).toBeDefined();

        const navigationEvent = contextEvents.find(
          (e) => e.type === 'context.navigation' && e.contextId === contextData.contextId,
        );
        expect(navigationEvent).toBeDefined();

        const screenshotEvent = contextEvents.find(
          (e) => e.type === 'context.screenshot' && e.contextId === contextData.contextId,
        );
        expect(screenshotEvent).toBeDefined();

        const scriptEvent = contextEvents.find(
          (e) => e.type === 'context.script.executed' && e.contextId === contextData.contextId,
        );
        expect(scriptEvent).toBeDefined();

        await clients.websocket.unsubscribe('context-events');
      },
    },
  ],
};

/**
 * Error Handling Consistency Test Suite
 * Tests error handling behavior across all protocols
 */
const errorHandlingConsistencySuite: TestSuite = {
  name: 'Error Handling Consistency Cross-Protocol',
  description: 'Verify consistent error handling and reporting across all protocols',

  tests: [
    {
      name: 'Invalid Session ID Error Consistency',
      description: 'Test error handling for invalid session IDs across protocols',
      execute: async (clients: TestClients) => {
        const invalidSessionId = 'invalid-session-id-12345';
        const errors: any[] = [];

        // Test MCP error handling
        try {
          await clients.mcp.callTool('delete-session', {
            sessionId: invalidSessionId,
          });
        } catch (error) {
          errors.push({ protocol: 'MCP', error });
        }

        // Test REST error handling
        try {
          await clients.rest.request({
            method: 'GET',
            path: `/sessions/${invalidSessionId}`,
            expectError: true,
          });
        } catch (error) {
          errors.push({ protocol: 'REST', error });
        }

        // Test gRPC error handling
        try {
          await clients.grpc.call('SessionService', 'GetSession', {
            sessionId: invalidSessionId,
          });
        } catch (error) {
          errors.push({ protocol: 'gRPC', error });
        }

        // Verify all protocols returned errors
        expect(errors.length).toBe(3);

        // Verify error messages are consistent (contain relevant keywords)
        errors.forEach(({ protocol, error }) => {
          const errorMsg = error.message.toLowerCase();
          expect(
            errorMsg.includes('not found') ||
              errorMsg.includes('invalid') ||
              errorMsg.includes('session'),
          ).toBe(true);
        });
      },
    },

    {
      name: 'Context Operation Error Propagation',
      description: 'Test error propagation when context operations fail',
      timeout: 30000,
      setup: async () => {
        // Create valid session for context testing
        const runner = new CrossProtocolTestRunner(testConfig);
        const sessionResult = await runner.clients.mcp.callTool('create-session', {
          username: `error_test_${Date.now()}`,
          password: 'error_test_pass',
        });
        const sessionData = JSON.parse(sessionResult.content[0].text);
        testState.sessions.set('error_test', sessionData);
      },
      execute: async (clients: TestClients) => {
        const session = testState.sessions.get('error_test');
        const invalidContextId = 'invalid-context-id-67890';
        const errorResults: any[] = [];

        // Test invalid context operations across protocols
        const errorTests = [
          // MCP invalid context execution
          clients.mcp
            .callTool('execute-in-context', {
              contextId: invalidContextId,
              command: 'navigate',
              parameters: { url: 'https://example.com' },
            })
            .catch((error) => ({ protocol: 'MCP', operation: 'execute', error })),

          // REST invalid context operation
          clients.rest
            .request({
              method: 'POST',
              path: `/contexts/${invalidContextId}/execute`,
              headers: { Authorization: `Bearer ${session.token || session.sessionId}` },
              body: { action: 'navigate', params: { url: 'https://example.com' } },
              expectError: true,
            })
            .catch((error) => ({ protocol: 'REST', operation: 'execute', error })),

          // gRPC invalid context script execution
          clients.grpc
            .call('ContextService', 'ExecuteScript', {
              contextId: invalidContextId,
              script: 'document.title',
            })
            .catch((error) => ({ protocol: 'gRPC', operation: 'script', error })),
        ];

        const results = await Promise.allSettled(errorTests);

        // Extract errors from settled promises
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.error) {
            errorResults.push(result.value);
          } else if (result.status === 'rejected') {
            errorResults.push({ protocol: 'Unknown', error: result.reason });
          }
        });

        // Verify all protocols detected the error
        expect(errorResults.length).toBeGreaterThanOrEqual(3);

        // Verify error consistency
        errorResults.forEach(({ protocol, error }) => {
          const errorMsg = error.message.toLowerCase();
          expect(
            errorMsg.includes('context') ||
              errorMsg.includes('not found') ||
              errorMsg.includes('invalid'),
          ).toBe(true);
        });
      },
    },

    {
      name: 'WebSocket Error Event Broadcasting',
      description: 'Verify WebSocket broadcasts error events from other protocols',
      timeout: 35000,
      execute: async (clients: TestClients) => {
        const errorEvents: any[] = [];

        // Subscribe to error events
        await clients.websocket.subscribe('error-events', (event: any) => {
          errorEvents.push(event);
        });

        // Trigger various errors across protocols
        const errorTriggers = [
          // Invalid session via MCP
          clients.mcp
            .callTool('delete-session', {
              sessionId: 'nonexistent-session',
            })
            .catch(() => {}),

          // Invalid API call via REST
          clients.rest
            .request({
              method: 'POST',
              path: '/invalid-endpoint',
              expectError: true,
            })
            .catch(() => {}),

          // Invalid gRPC call
          clients.grpc.call('NonexistentService', 'NonexistentMethod', {}).catch(() => {}),
        ];

        await Promise.allSettled(errorTriggers);

        // Wait for error event propagation
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Verify error events were received
        expect(errorEvents.length).toBeGreaterThanOrEqual(1);

        // Verify error event structure
        errorEvents.forEach((event) => {
          expect(event.type).toBe('error');
          expect(event.protocol).toBeDefined();
          expect(event.error).toBeDefined();
          expect(event.timestamp).toBeDefined();
        });

        await clients.websocket.unsubscribe('error-events');
      },
    },
  ],
};

/**
 * State Synchronization Test Suite
 * Advanced testing of state consistency across protocols
 */
const stateSynchronizationSuite: TestSuite = {
  name: 'Advanced State Synchronization',
  description: 'Test complex state synchronization scenarios across protocols',

  tests: [
    {
      name: 'Distributed State Consistency Under Load',
      description: 'Test state consistency with concurrent operations across protocols',
      timeout: 90000,
      execute: async (clients: TestClients) => {
        const numOperations = 10;
        const sessions: any[] = [];
        const stateUpdates: any[] = [];

        // Subscribe to all state change events
        await clients.websocket.subscribe('state-changes', (update: any) => {
          stateUpdates.push(update);
        });

        // Create multiple sessions concurrently
        const sessionPromises = [];
        for (let i = 0; i < numOperations; i++) {
          sessionPromises.push(
            clients.mcp.callTool('create-session', {
              username: `load_test_${i}_${Date.now()}`,
              password: 'load_test_pass',
            }),
          );
        }

        const sessionResults = await Promise.all(sessionPromises);
        sessionResults.forEach((result) => {
          const sessionData = JSON.parse(result.content[0].text);
          sessions.push(sessionData);
        });

        // Perform concurrent state modifications
        const modificationPromises = sessions.map((session, index) => {
          const protocol = ['rest', 'grpc', 'mcp'][index % 3];

          switch (protocol) {
            case 'rest':
              return clients.rest.request({
                method: 'PUT',
                path: `/sessions/${session.sessionId}`,
                headers: { Authorization: `Bearer ${session.token || session.sessionId}` },
                body: {
                  metadata: {
                    loadTestIndex: index,
                    modifiedVia: 'REST',
                    timestamp: new Date().toISOString(),
                  },
                },
              });

            case 'grpc':
              return clients.grpc.call('SessionService', 'UpdateSession', {
                sessionId: session.sessionId,
                metadata: {
                  loadTestIndex: index,
                  modifiedVia: 'gRPC',
                  timestamp: new Date().toISOString(),
                },
              });

            case 'mcp':
              return clients.mcp.callTool('update-session-metadata', {
                sessionId: session.sessionId,
                metadata: {
                  loadTestIndex: index,
                  modifiedVia: 'MCP',
                  timestamp: new Date().toISOString(),
                },
              });

            default:
              return Promise.resolve();
          }
        });

        await Promise.all(modificationPromises);

        // Wait for state synchronization
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Verify final state consistency across all protocols
        const finalStateChecks = sessions.map((session) => ({
          mcpCheck: clients.mcp.callTool('list-sessions', {}).then((result) => {
            const sessionsList = JSON.parse(result.content[0].text);
            return sessionsList.sessions.find((s: any) => s.id === session.sessionId);
          }),

          restCheck: clients.rest.request({
            method: 'GET',
            path: `/sessions/${session.sessionId}`,
            headers: { Authorization: `Bearer ${session.token || session.sessionId}` },
          }),

          grpcCheck: clients.grpc.call('SessionService', 'GetSession', {
            sessionId: session.sessionId,
          }),
        }));

        for (const checks of finalStateChecks) {
          const [mcpState, restState, grpcState] = await Promise.all([
            checks.mcpCheck,
            checks.restCheck,
            checks.grpcCheck,
          ]);

          // Verify all protocols report the same metadata
          expect(mcpState.metadata.loadTestIndex).toBe(restState.metadata.loadTestIndex);
          expect(restState.metadata.loadTestIndex).toBe(grpcState.metadata.loadTestIndex);
          expect(mcpState.metadata.modifiedVia).toBe(restState.metadata.modifiedVia);
        }

        // Verify WebSocket received appropriate state change events
        expect(stateUpdates.length).toBeGreaterThanOrEqual(sessions.length);

        await clients.websocket.unsubscribe('state-changes');
      },
    },
  ],
};

/**
 * Main test suite execution
 */
describe('Enhanced Cross-Protocol Integration Tests', () => {
  let runner: CrossProtocolTestRunner;
  let mcpServer: MCPServer;

  beforeAll(async () => {
    // Create and start MCP server
    mcpServer = createMCPServer();
    await mcpServer.start();

    // Initialize test runner
    runner = new CrossProtocolTestRunner(testConfig);
    await runner.initialize(mcpServer);
  }, 60000);

  afterAll(async () => {
    // Cleanup
    await runner.cleanup();
    await mcpServer.stop();
  }, 30000);

  beforeEach(() => {
    // Clear test state before each test
    testState.sessions.clear();
    testState.contexts.clear();
    testState.users.clear();
    testState.wsEvents.length = 0;
    testState.syncStates.clear();
  });

  describe('Enhanced Session Management', () => {
    it('should pass all enhanced session management tests', async () => {
      const results = await runner.runSuite(enhancedSessionManagementSuite);

      expect(results.failed).toBe(0);
      expect(results.passed).toBe(enhancedSessionManagementSuite.tests.length);

      if (results.errors.length > 0) {
        console.error('Session management test errors:', results.errors);
      }
    }, 120000);
  });

  describe('Enhanced Context Management', () => {
    it('should pass all enhanced context management tests', async () => {
      const results = await runner.runSuite(enhancedContextManagementSuite);

      expect(results.failed).toBe(0);
      expect(results.passed).toBe(enhancedContextManagementSuite.tests.length);

      if (results.errors.length > 0) {
        console.error('Context management test errors:', results.errors);
      }
    }, 120000);
  });

  describe('Error Handling Consistency', () => {
    it('should demonstrate consistent error handling across protocols', async () => {
      const results = await runner.runSuite(errorHandlingConsistencySuite);

      expect(results.failed).toBe(0);
      expect(results.passed).toBe(errorHandlingConsistencySuite.tests.length);

      if (results.errors.length > 0) {
        console.error('Error handling test errors:', results.errors);
      }
    }, 90000);
  });

  describe('Advanced State Synchronization', () => {
    it('should maintain state consistency under complex scenarios', async () => {
      const results = await runner.runSuite(stateSynchronizationSuite);

      expect(results.failed).toBe(0);
      expect(results.passed).toBe(stateSynchronizationSuite.tests.length);

      if (results.errors.length > 0) {
        console.error('State synchronization test errors:', results.errors);
      }
    }, 120000);
  });

  describe('Comprehensive Integration Report', () => {
    it('should generate comprehensive cross-protocol test report', async () => {
      const allResults = runner.getResults();

      console.log('\n=== Enhanced Cross-Protocol Integration Test Report ===');
      console.log(`Test Execution Timestamp: ${allResults.timestamp}`);
      console.log(`Total Test Duration: ${allResults.duration}ms`);
      console.log(
        `Total Tests Executed: ${allResults.passed + allResults.failed + allResults.skipped}`,
      );
      console.log(`Tests Passed: ${allResults.passed}`);
      console.log(`Tests Failed: ${allResults.failed}`);
      console.log(`Tests Skipped: ${allResults.skipped}`);

      if (allResults.errors.length > 0) {
        console.log('\n=== Test Failures ===');
        allResults.errors.forEach((error) => {
          console.log(`❌ ${error.test}`);
          console.log(`   Error: ${error.error}`);
          console.log(`   Time: ${error.timestamp}`);
          if (error.stack) {
            console.log(`   Stack: ${error.stack.split('\n')[0]}`);
          }
        });
      }

      console.log('\n=== Protocol Coverage Summary ===');
      console.log('✅ MCP Tool Execution');
      console.log('✅ REST API Operations');
      console.log('✅ gRPC Service Calls');
      console.log('✅ WebSocket Real-time Updates');
      console.log('✅ Cross-Protocol State Synchronization');
      console.log('✅ Error Handling Consistency');
      console.log('✅ Concurrent Operation Handling');

      console.log('\n=== Test Categories Completed ===');
      console.log('• Session Management Cross-Protocol');
      console.log('• Context Management Cross-Protocol');
      console.log('• Error Handling Consistency');
      console.log('• Advanced State Synchronization');

      // Verify comprehensive test coverage
      expect(allResults.failed).toBe(0);
      expect(allResults.passed).toBeGreaterThan(8); // Minimum test count

      // Verify reasonable execution time (not hanging)
      expect(allResults.duration).toBeLessThan(300000); // 5 minutes max
    });
  });
});
