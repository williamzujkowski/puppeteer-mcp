/**
 * Cross-Protocol Test Runner Framework
 * @module tests/framework/cross-protocol-test-runner
 * @description Automated testing framework for cross-protocol functionality
 */

import type { MCPServer } from '../../src/mcp/server.js';
import { WebSocket } from 'ws';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

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

  private createMockClient(_service: string): any {
    // Mock implementation for testing
    return {
      CreateSession: (request: any, callback: (error: any, response?: any) => void) => {
        callback(null, {
          sessionId: uuidv4(),
          userId: uuidv4(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        });
      },
      GetSession: (request: any, callback: (error: any, response?: any) => void) => {
        if (request.sessionId) {
          callback(null, { sessionId: request.sessionId, active: true });
        } else {
          callback(new Error('Session not found'));
        }
      },
    };
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
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        // WebSocket connected
        resolve();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', () => {
        // WebSocket disconnected
        if (this.reconnect) {
          setTimeout(() => {
            void this.connect();
          }, 5000);
        }
      });
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
    await this.clients.mcp.initialize(mcpServer);

    // Connect WebSocket
    await this.clients.websocket.connect();
  }

  async runSuite(suite: TestSuite): Promise<TestResults> {
    const startTime = Date.now();
    // Running test suite

    // Run suite setup
    if (suite.setup) {
      await suite.setup();
    }

    // Run each test
    for (const test of suite.tests) {
      await this.runTest(test);
    }

    // Run suite teardown
    if (suite.teardown) {
      await suite.teardown();
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
