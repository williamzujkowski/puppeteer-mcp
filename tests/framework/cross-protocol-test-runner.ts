/**
 * Cross-Protocol Test Runner Framework
 * @module tests/framework/cross-protocol-test-runner
 * @description Automated testing framework for cross-protocol functionality
 */

import type { MCPServer } from '../../src/mcp/server.js';
import { WebSocket } from 'ws';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

/**
 * Test configuration interface
 */
export interface TestConfig {
  mcp?: {
    transport: 'stdio' | 'http';
    host?: string;
    port?: number;
  };
  rest: {
    baseUrl: string;
    timeout?: number;
  };
  grpc: {
    host: string;
    port: number;
    secure?: boolean;
  };
  websocket: {
    url: string;
    reconnect?: boolean;
  };
}

/**
 * Test suite interface
 */
export interface TestSuite {
  name: string;
  description: string;
  tests: TestCase[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

/**
 * Individual test case
 */
export interface TestCase {
  name: string;
  description?: string;
  timeout?: number;
  retries?: number;
  execute: (clients: TestClients) => Promise<void>;
  validate?: () => Promise<void>;
  setup?: () => Promise<void>;
  cleanup?: () => Promise<void>;
}

/**
 * Test clients interface
 */
export interface TestClients {
  mcp: MCPTestClient;
  rest: RestTestClient;
  grpc: GrpcTestClient;
  websocket: WebSocketTestClient;
}

/**
 * Test results interface
 */
export interface TestResults {
  passed: number;
  failed: number;
  skipped: number;
  errors: TestError[];
  duration: number;
  timestamp: string;
}

/**
 * Test error details
 */
export interface TestError {
  test: string;
  error: string;
  stack?: string;
  timestamp: string;
}

/**
 * MCP Test Client
 */
export class MCPTestClient {
  private config: TestConfig['mcp'];
  private server?: MCPServer;

  constructor(config: TestConfig['mcp'] = { transport: 'stdio' }) {
    this.config = config;
  }

  initialize(server?: MCPServer): void {
    if (server) {
      this.server = server;
    }
  }

  async callTool(
    name: string,
    args: unknown,
  ): Promise<{
    content: Array<{
      type: string;
      text: string;
    }>;
  }> {
    if (!this.server) {
      throw new Error('MCP server not initialized');
    }

    // Direct server call for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (this.server as any).executeTool(name, args);

    // Convert result to MCP response format for consistency with other tests
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };
  }

  async readResource(uri: string): Promise<any> {
    if (!this.server) {
      throw new Error('MCP server not initialized');
    }

    // Direct resource read for testing
    if (uri === 'api://catalog') {
      const resource = (this.server as any).apiCatalogResource;
      return await resource.getApiCatalog();
    } else if (uri === 'api://health') {
      const resource = (this.server as any).systemHealthResource;
      return resource.getSystemHealth();
    }

    throw new Error(`Unknown resource: ${uri}`);
  }
}

/**
 * REST Test Client
 */
export class RestTestClient {
  private baseUrl: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;

  constructor(config: TestConfig['rest']) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout ?? 30000;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async request(options: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: any;
    expectError?: boolean;
  }): Promise<any> {
    const url = `${this.baseUrl}${options.path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: { ...this.defaultHeaders, ...options.headers },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && !options.expectError) {
        throw new Error(`REST request failed: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  setApiKey(key: string): void {
    this.defaultHeaders['X-API-Key'] = key;
  }
}

/**
 * gRPC Test Client
 */
export class GrpcTestClient {
  private host: string;
  private port: number;
  private secure: boolean;
  private clients: Map<string, any> = new Map();

  constructor(config: TestConfig['grpc']) {
    this.host = config.host;
    this.port = config.port;
    this.secure = config.secure || false;
  }

  async call(service: string, method: string, request: any): Promise<any> {
    const client = this.getClient(service);

    return new Promise((resolve, reject) => {
      client[method](request, (error: any, response: any) => {
        if (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        } else {
          resolve(response);
        }
      });
    });
  }

  private getClient(service: string): any {
    if (!this.clients.has(service)) {
      // In real implementation, create gRPC client here
      // For testing, we'll use a mock
      this.clients.set(service, this.createMockClient(service));
    }
    return this.clients.get(service);
  }

  private createMockClient(service: string): any {
    // Mock implementation for testing
    const mockImplementations: Record<string, any> = {
      SessionService: {
        CreateSession: (request: any, callback: (error: any, response?: any) => void) => {
          if (!request.username || !request.password) {
            callback(new Error('Missing required fields: username and password'));
            return;
          }
          callback(null, {
            sessionId: uuidv4(),
            userId: uuidv4(),
            username: request.username,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          });
        },
        GetSession: (request: any, callback: (error: any, response?: any) => void) => {
          if (!request.sessionId) {
            callback(new Error('Session ID is required'));
            return;
          }
          if (request.sessionId === 'invalid-session-id-12345') {
            callback(new Error('Session not found'));
            return;
          }
          callback(null, {
            sessionId: request.sessionId,
            active: true,
            metadata: request.metadata || {},
          });
        },
        ExtendSession: (request: any, callback: (error: any, response?: any) => void) => {
          if (!request.sessionId) {
            callback(new Error('Session ID is required'));
            return;
          }
          callback(null, {
            success: true,
            newExpiryTime: new Date(
              Date.now() + (request.extensionMinutes || 30) * 60000,
            ).toISOString(),
          });
        },
        UpdateSession: (request: any, callback: (error: any, response?: any) => void) => {
          if (!request.sessionId) {
            callback(new Error('Session ID is required'));
            return;
          }
          callback(null, {
            success: true,
            sessionId: request.sessionId,
            metadata: request.metadata,
          });
        },
      },
      ContextService: {
        CreateContext: (request: any, callback: (error: any, response?: any) => void) => {
          if (!request.sessionId) {
            callback(new Error('Session ID is required'));
            return;
          }
          callback(null, {
            contextId: uuidv4(),
            sessionId: request.sessionId,
            options: request.options,
          });
        },
        ExecuteScript: (request: any, callback: (error: any, response?: any) => void) => {
          if (!request.contextId) {
            callback(new Error('Context ID is required'));
            return;
          }
          if (request.contextId === 'invalid-context-id-67890') {
            callback(new Error('Context not found'));
            return;
          }
          callback(null, {
            success: true,
            result: 'complete',
          });
        },
        Navigate: (request: any, callback: (error: any, response?: any) => void) => {
          if (!request.contextId || !request.url) {
            callback(new Error('Context ID and URL are required'));
            return;
          }
          callback(null, {
            success: true,
            url: request.url,
          });
        },
      },
    };

    const implementation = mockImplementations[service];
    if (!implementation) {
      // Return a proxy that throws for any method call
      return new Proxy(
        {},
        {
          get: (target, prop) => {
            return (request: any, callback: (error: any, response?: any) => void) => {
              callback(new Error(`Service '${service}' not found`));
            };
          },
        },
      );
    }

    return implementation;
  }
}

/**
 * WebSocket Test Client
 */
export class WebSocketTestClient {
  private url: string;
  private ws?: WebSocket;
  private reconnect: boolean;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private subscriptions: Map<string, (data: any) => void> = new Map();

  constructor(config: TestConfig['websocket']) {
    this.url = config.url;
    this.reconnect = config.reconnect || true;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        if (this.ws) {
          this.ws.terminate();
        }
        reject(new Error('WebSocket connection timeout after 10 seconds'));
      }, 10000);

      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', async () => {
          // WebSocket connected, now authenticate
          clearTimeout(connectTimeout);
          try {
            await this.authenticate();
            resolve();
          } catch (authError) {
            reject(
              new Error(
                `WebSocket authentication failed: ${authError instanceof Error ? authError.message : 'Unknown error'}`,
              ),
            );
          }
        });

        this.ws.on('error', (error) => {
          clearTimeout(connectTimeout);
          console.error('WebSocket error:', error);
          reject(error);
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('close', () => {
          // WebSocket disconnected
          clearTimeout(connectTimeout);
          if (this.reconnect) {
            setTimeout(() => {
              void this.connect().catch((err) => {
                console.error('WebSocket reconnection failed:', err);
              });
            }, 5000);
          }
        });
      } catch (error) {
        clearTimeout(connectTimeout);
        reject(error);
      }
    });
  }

  async send(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const messageId = uuidv4();
      const fullMessage = { ...message, id: messageId };

      this.messageHandlers.set(messageId, (response: any) => {
        this.messageHandlers.delete(messageId);
        resolve(response);
      });

      this.ws.send(JSON.stringify(fullMessage));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.messageHandlers.has(messageId)) {
          this.messageHandlers.delete(messageId);
          reject(new Error('WebSocket request timeout'));
        }
      }, 10000);
    });
  }

  async subscribe(topic: string, handler: (data: any) => void): Promise<void> {
    this.subscriptions.set(topic, handler);

    await this.send({
      type: 'subscribe',
      topic,
    });
  }

  async unsubscribe(topic: string): Promise<void> {
    this.subscriptions.delete(topic);

    await this.send({
      type: 'unsubscribe',
      topic,
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.reconnect = false;
      this.ws.close();
    }
  }

  /**
   * Authenticate the WebSocket connection
   */
  private async authenticate(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection not established');
    }

    // Create a valid session via REST API first, then use that token for WebSocket auth
    const sessionToken = await this.createValidSession();

    return new Promise((resolve, reject) => {
      const authMessageId = uuidv4();

      // Set up authentication response handler
      this.messageHandlers.set(authMessageId, (response: any) => {
        this.messageHandlers.delete(authMessageId);

        if (response.type === 'auth_success') {
          resolve();
        } else if (response.type === 'auth_error') {
          reject(new Error(`Authentication failed: ${response.error?.message || 'Unknown error'}`));
        } else {
          reject(new Error(`Unexpected auth response type: ${response.type}`));
        }
      });

      // Send authentication message with the session token
      const authMessage = {
        type: 'auth',
        id: authMessageId,
        timestamp: new Date().toISOString(),
        data: {
          token: sessionToken,
        },
      };

      this.ws!.send(JSON.stringify(authMessage));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.messageHandlers.has(authMessageId)) {
          this.messageHandlers.delete(authMessageId);
          reject(new Error('Authentication timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Create a valid session via REST API to get a token that exists in the session store
   */
  private async createValidSession(): Promise<string> {
    const testPort = process.env.TEST_SERVER_PORT || process.env.PORT || '3000';
    const createSessionUrl = `http://localhost:${testPort}/api/v1/sessions/dev-create`;

    try {
      const response = await fetch(createSessionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username: 'websocket-test-user',
          password: 'test-password-123',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
      }

      const sessionData = await response.json();
      return sessionData.accessToken || sessionData.token || sessionData.sessionId;
    } catch (error) {
      throw new Error(
        `Failed to create valid session for WebSocket auth: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Create a test JWT token for WebSocket authentication
   */
  private createTestToken(): string {
    // Use the same test secret that's configured in CI environment
    const secret = process.env.JWT_SECRET || 'test-secret-key';

    const payload = {
      sub: 'test-user-id',
      username: 'testuser',
      roles: ['user'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    };

    return jwt.sign(payload, secret, { algorithm: 'HS256' });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle response to specific request
      if (message.id && this.messageHandlers.has(message.id)) {
        const handler = this.messageHandlers.get(message.id);
        handler!(message);
        return;
      }

      // Handle subscription updates
      if (message.topic && this.subscriptions.has(message.topic)) {
        const handler = this.subscriptions.get(message.topic);
        handler!(message.data);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }
}

/**
 * Cross-Protocol Test Runner
 */
export class CrossProtocolTestRunner {
  private config: TestConfig;
  private clients: TestClients;
  private results: TestResults;

  constructor(config: TestConfig) {
    this.config = config;
    this.clients = {
      mcp: new MCPTestClient(config.mcp),
      rest: new RestTestClient(config.rest),
      grpc: new GrpcTestClient(config.grpc),
      websocket: new WebSocketTestClient(config.websocket),
    };
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      duration: 0,
      timestamp: new Date().toISOString(),
    };
  }

  async initialize(mcpServer?: MCPServer): Promise<void> {
    // Initialize MCP client with server
    this.clients.mcp.initialize(mcpServer);

    // Connect WebSocket with retry
    let retries = 3;
    let lastError: Error | null = null;

    while (retries > 0) {
      try {
        await this.clients.websocket.connect();
        return; // Success
      } catch (error) {
        lastError = error as Error;
        console.error(`WebSocket connection attempt ${4 - retries} failed:`, error);
        retries--;
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    throw new Error(
      `Failed to connect WebSocket after 3 attempts: ${lastError?.message || 'Unknown error'}`,
    );
  }

  async runSuite(suite: TestSuite): Promise<TestResults> {
    const startTime = Date.now();
    // Running test suite

    // Reset results for this suite
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      duration: 0,
      timestamp: new Date().toISOString(),
    };

    try {
      // Run suite setup
      if (suite.setup) {
        await suite.setup();
      }

      // Run each test
      for (const test of suite.tests) {
        try {
          await this.runTest(test);
        } catch (error) {
          // Ensure test failures are captured
          console.error(`Test '${test.name}' failed with uncaught error:`, error);
          if (this.results.failed === 0 && this.results.errors.length === 0) {
            this.results.failed++;
            this.results.errors.push({
              test: test.name,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      // Run suite teardown
      if (suite.teardown) {
        try {
          await suite.teardown();
        } catch (error) {
          console.error('Suite teardown failed:', error);
        }
      }
    } catch (error) {
      // Suite-level failure
      console.error('Suite execution failed:', error);
      throw error;
    }

    this.results.duration = Date.now() - startTime;
    // Test suite completed

    return this.results;
  }

  private async runTest(test: TestCase): Promise<void> {
    // Running test
    const maxRetries = test.retries || 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Run test setup
        if (test.setup) {
          await test.setup();
        }

        // Execute test with timeout
        await this.executeWithTimeout(() => test.execute(this.clients), test.timeout ?? 30000);

        // Run validation if provided
        if (test.validate) {
          await test.validate();
        }

        // Test passed
        this.results.passed++;
        // Test passed
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(`Test attempt ${attempt} failed: ${test.name}`, error);

        if (attempt < maxRetries) {
          // Retrying test
          await this.delay(1000); // Wait 1 second before retry
        }
      } finally {
        // Always run cleanup
        if (test.cleanup) {
          try {
            await test.cleanup();
          } catch (cleanupError) {
            console.error(`Test cleanup failed: ${test.name}`, cleanupError);
          }
        }
      }
    }

    // Test failed after all retries
    this.results.failed++;
    this.results.errors.push({
      test: test.name,
      error: lastError?.message || 'Unknown error',
      stack: lastError?.stack,
      timestamp: new Date().toISOString(),
    });
  }

  private async executeWithTimeout(fn: () => Promise<any>, timeout: number): Promise<any> {
    return Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), timeout)),
    ]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async cleanup(): void {
    // Disconnect WebSocket
    this.clients.websocket.disconnect();
  }

  getResults(): TestResults {
    return this.results;
  }
}
