/**
 * REST Integration Example for MCP
 * @module mcp/examples/rest-integration
 * @description Shows how to integrate the Express app with MCP server
 */

import { createApp } from '../../server.js';
import { createMCPServer } from '../server.js';

/**
 * Example: Integrating MCP with existing Express app
 */
async function setupMCPWithExpress() {
  // Create the Express app with all routes and middleware
  const app = createApp();
  
  // Create MCP server with the Express app
  const mcpServer = createMCPServer({ app });
  
  // Start MCP server
  await mcpServer.start();
  
  // MCP server started with REST adapter enabled
}

/**
 * Example: Using MCP to execute REST API calls
 */
function exampleMCPRestCalls() {
  // These examples show the MCP tool call format
  
  // Example 1: Health check (no auth required)
  const healthCheck = {
    name: 'execute-api',
    arguments: {
      protocol: 'rest',
      operation: {
        method: 'GET',
        endpoint: '/api/v1/health',
      },
    },
  };
  
  // Example 2: Create session with JWT auth
  const createSession = {
    name: 'execute-api',
    arguments: {
      protocol: 'rest',
      operation: {
        method: 'POST',
        endpoint: '/api/v1/sessions',
        body: {
          username: 'testuser',
          password: 'password123',
        },
      },
      auth: {
        type: 'jwt',
        credentials: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  };
  
  // Example 3: List contexts with API key auth
  const listContexts = {
    name: 'execute-api',
    arguments: {
      protocol: 'rest',
      operation: {
        method: 'GET',
        endpoint: '/api/v1/contexts',
        query: {
          status: 'active',
          limit: '10',
        },
      },
      auth: {
        type: 'apikey',
        credentials: 'pk_test_123456789',
      },
    },
  };
  
  // Example 4: Execute command in context with session auth
  const executeCommand = {
    name: 'execute-api',
    arguments: {
      protocol: 'rest',
      operation: {
        method: 'POST',
        endpoint: '/api/v1/contexts/ctx-123/execute',
        body: {
          command: 'page.goto',
          params: ['https://example.com'],
        },
      },
      auth: {
        type: 'session',
        credentials: 'session-abc123',
      },
    },
  };
  
  // Example 5: Delete session
  const deleteSession = {
    name: 'execute-api',
    arguments: {
      protocol: 'rest',
      operation: {
        method: 'DELETE',
        endpoint: '/api/v1/sessions/session-123',
      },
      auth: {
        type: 'jwt',
        credentials: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  };
  
  return {
    healthCheck,
    createSession,
    listContexts,
    executeCommand,
    deleteSession,
  };
}

/**
 * Example: Error handling scenarios
 */
function exampleErrorScenarios() {
  // Example 1: Invalid authentication
  const invalidAuth = {
    name: 'execute-api',
    arguments: {
      protocol: 'rest',
      operation: {
        method: 'GET',
        endpoint: '/api/v1/sessions',
      },
      auth: {
        type: 'jwt',
        credentials: 'invalid-token',
      },
    },
  };
  // Expected response: 401 Unauthorized
  
  // Example 2: Validation error
  const validationError = {
    name: 'execute-api',
    arguments: {
      protocol: 'rest',
      operation: {
        method: 'INVALID_METHOD', // Invalid HTTP method
        endpoint: '/api/v1/health',
      },
    },
  };
  // Expected response: 400 Bad Request with validation errors
  
  // Example 3: Route not found
  const notFound = {
    name: 'execute-api',
    arguments: {
      protocol: 'rest',
      operation: {
        method: 'GET',
        endpoint: '/api/v1/nonexistent',
      },
    },
  };
  // Expected response: 404 Not Found
  
  // Example 4: Unsupported protocol
  const unsupportedProtocol = {
    name: 'execute-api',
    arguments: {
      protocol: 'graphql', // Not supported
      operation: {
        query: '{ health }',
      },
    },
  };
  // Expected response: Error - Unsupported protocol
  
  return {
    invalidAuth,
    validationError,
    notFound,
    unsupportedProtocol,
  };
}

/**
 * Example: Using the API catalog resource
 */
function exampleApiCatalog() {
  // MCP resource request to get API catalog
  const catalogRequest = {
    method: 'resources/read',
    params: {
      uri: 'api://catalog',
    },
  };
  
  // Expected response includes:
  // - REST endpoints with methods and descriptions
  // - gRPC services and methods
  // - WebSocket topics
  // - Authentication methods
  
  return catalogRequest;
}

// Export examples
export {
  setupMCPWithExpress,
  exampleMCPRestCalls,
  exampleErrorScenarios,
  exampleApiCatalog,
};