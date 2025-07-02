/**
 * gRPC Integration Example for MCP
 * @module mcp/examples/grpc-integration
 * @description Example demonstrating how to use the gRPC adapter with MCP
 * @nist ac-3 "Access enforcement"
 * @nist ia-2 "Identification and authentication"
 */

import { createGrpcServer } from '../../grpc/server.js';
import { GrpcAdapter } from '../adapters/grpc-adapter.js';
import { createLogger } from '../../utils/logger.js';
import { InMemorySessionStore } from '../../store/in-memory-session-store.js';

/**
 * Example: Basic gRPC adapter usage
 */
async function basicGrpcExample(): Promise<void> {
  // console.log('=== Basic gRPC Adapter Example ===\n');

  // Create dependencies
  const logger = createLogger('info');
  const sessionStore = new InMemorySessionStore(logger);
  
  // Create and initialize gRPC server
  const grpcServer = createGrpcServer(logger, sessionStore);
  
  // Create gRPC adapter
  const adapter = new GrpcAdapter(grpcServer);

  // Example 1: Create a session (unary call)
  // console.log('1. Creating a session via gRPC:');
  const createResponse = await adapter.executeRequest({
    operation: {
      service: 'SessionService',
      method: 'CreateSession',
      request: {
        name: 'Test Session',
        metadata: {
          browser: 'Chrome',
          version: '120.0',
        },
      },
    },
    auth: {
      type: 'jwt',
      credentials: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  });
  
  // console.log('Response:', JSON.stringify(createResponse, null, 2));
  // console.log();

  // Example 2: Get session details
  const sessionId = JSON.parse(createResponse.content[0]?.text ?? '{}').id;
  
  // console.log('2. Getting session details:');
  await adapter.executeRequest({
    operation: {
      service: 'SessionService',
      method: 'GetSession',
      request: { id: sessionId },
    },
    auth: {
      type: 'jwt',
      credentials: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  });
  
  // console.log('Response would be logged here');
  // console.log();

  // Example 3: List available endpoints
  // console.log('3. Listing available gRPC endpoints:');
  await adapter.listEndpoints();
  // console.log('Endpoints would be logged here');
  // console.log();

  // Example 4: Get adapter capabilities
  // console.log('4. Getting adapter capabilities:');
  await adapter.getCapabilities();
  // console.log('Capabilities would be logged here');
}

/**
 * Example: Streaming gRPC calls
 */
async function streamingGrpcExample(): Promise<void> {
  // console.log('\n=== Streaming gRPC Example ===\n');

  // Create dependencies
  const logger = createLogger('info');
  const sessionStore = new InMemorySessionStore(logger);
  const grpcServer = createGrpcServer(logger, sessionStore);
  const adapter = new GrpcAdapter(grpcServer);

  // Create a session first
  const createResponse = await adapter.executeRequest({
    operation: {
      service: 'SessionService',
      method: 'CreateSession',
      request: { name: 'Streaming Test' },
    },
  });
  
  const sessionId = JSON.parse(createResponse.content[0]?.text ?? '{}').id;

  // Stream session events
  // console.log('Streaming session events:');
  const streamResponse = await adapter.executeRequest({
    operation: {
      service: 'SessionService',
      method: 'StreamSessionEvents',
      request: {
        sessionId,
        eventTypes: ['created', 'updated', 'deleted'],
      },
      streaming: true,
    },
    auth: {
      type: 'session',
      credentials: sessionId,
    },
  });

  // console.log('Stream response:');
  // console.log(`- Total events: ${streamResponse.metadata?.itemCount}`);
  // console.log(`- Streaming: ${streamResponse.metadata?.streaming}`);
  streamResponse.content.forEach((_item, _index) => {
    // console.log(`- Event ${_index + 1}:`, _item.text);
  });
}

/**
 * Example: Error handling
 */
async function errorHandlingExample(): Promise<void> {
  // console.log('\n=== Error Handling Example ===\n');

  const logger = createLogger('info');
  const sessionStore = new InMemorySessionStore(logger);
  const grpcServer = createGrpcServer(logger, sessionStore);
  const adapter = new GrpcAdapter(grpcServer);

  // Example 1: Invalid authentication
  // console.log('1. Testing invalid authentication:');
  await adapter.executeRequest({
    operation: {
      service: 'SessionService',
      method: 'GetSession',
      request: { id: 'test-123' },
    },
    auth: {
      type: 'jwt',
      credentials: 'invalid-token',
    },
  });

  // console.log('Error response would be logged here');
  // console.log();

  // Example 2: Service not found
  // console.log('2. Testing invalid service:');
  await adapter.executeRequest({
    operation: {
      service: 'NonExistentService',
      method: 'SomeMethod',
      request: {},
    },
  });

  // console.log('Error response would be logged here');
  // console.log();

  // Example 3: Method not found
  // console.log('3. Testing invalid method:');
  await adapter.executeRequest({
    operation: {
      service: 'SessionService',
      method: 'NonExistentMethod',
      request: {},
    },
  });

  // console.log('Error response would be logged here');
}

/**
 * Example: Different authentication methods
 */
async function authenticationExample(): Promise<void> {
  // console.log('\n=== Authentication Methods Example ===\n');

  const logger = createLogger('info');
  const sessionStore = new InMemorySessionStore(logger);
  const grpcServer = createGrpcServer(logger, sessionStore);
  const adapter = new GrpcAdapter(grpcServer);

  // Example 1: JWT authentication
  // console.log('1. Using JWT authentication:');
  await adapter.executeRequest({
    operation: {
      service: 'HealthService',
      method: 'Check',
      request: { service: 'grpc-adapter' },
    },
    auth: {
      type: 'jwt',
      credentials: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  });
  // console.log('Response would be logged here');
  // console.log();

  // Example 2: API key authentication
  // console.log('2. Using API key authentication:');
  await adapter.executeRequest({
    operation: {
      service: 'HealthService',
      method: 'Check',
      request: { service: 'grpc-adapter' },
    },
    auth: {
      type: 'apikey',
      credentials: 'sk-test-1234567890abcdef',
    },
  });
  // console.log('Response would be logged here');
  // console.log();

  // Example 3: Session authentication
  // console.log('3. Using session authentication:');
  await adapter.executeRequest({
    operation: {
      service: 'HealthService',
      method: 'Check',
      request: { service: 'grpc-adapter' },
    },
    auth: {
      type: 'session',
      credentials: 'session-123-456-789',
    },
  });
  // console.log('Response would be logged here');
}

/**
 * Example: Context management via gRPC
 */
async function contextManagementExample(): Promise<void> {
  // console.log('\n=== Context Management Example ===\n');

  const logger = createLogger('info');
  const sessionStore = new InMemorySessionStore(logger);
  const grpcServer = createGrpcServer(logger, sessionStore);
  const adapter = new GrpcAdapter(grpcServer);

  // Create a session first
  const sessionResponse = await adapter.executeRequest({
    operation: {
      service: 'SessionService',
      method: 'CreateSession',
      request: { name: 'Context Test' },
    },
  });
  
  const sessionId = JSON.parse(sessionResponse.content[0]?.text ?? '{}').id;

  // Example 1: Create a context
  // console.log('1. Creating a context:');
  const createContextResponse = await adapter.executeRequest({
    operation: {
      service: 'ContextService',
      method: 'CreateContext',
      request: {
        sessionId,
        type: 'browser',
        metadata: {
          url: 'https://example.com',
          viewport: { width: 1920, height: 1080 },
        },
      },
    },
    auth: {
      type: 'session',
      credentials: sessionId,
    },
  });
  // console.log('Response:', JSON.stringify(createContextResponse, null, 2));
  // console.log();

  const contextId = JSON.parse(createContextResponse.content[0]?.text ?? '{}').id;

  // Example 2: Execute a command in the context
  // console.log('2. Executing a command:');
  const commandResponse = await adapter.executeRequest({
    operation: {
      service: 'ContextService',
      method: 'ExecuteCommand',
      request: {
        contextId,
        command: {
          type: 'navigate',
          params: { url: 'https://example.com/products' },
        },
      },
    },
    auth: {
      type: 'session',
      credentials: sessionId,
    },
  });
  // console.log('Response:', JSON.stringify(commandResponse, null, 2));
  // console.log();

  // Example 3: List contexts
  // console.log('3. Listing contexts:');
  const listResponse = await adapter.executeRequest({
    operation: {
      service: 'ContextService',
      method: 'ListContexts',
      request: {
        sessionId,
        pageSize: 10,
      },
    },
    auth: {
      type: 'session',
      credentials: sessionId,
    },
  });
  // console.log('Response:', JSON.stringify(listResponse, null, 2));
}

/**
 * Run all examples
 */
async function runExamples(): Promise<void> {
  try {
    await basicGrpcExample();
    await streamingGrpcExample();
    await errorHandlingExample();
    await authenticationExample();
    await contextManagementExample();
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error);
}

export {
  basicGrpcExample,
  streamingGrpcExample,
  errorHandlingExample,
  authenticationExample,
  contextManagementExample,
};