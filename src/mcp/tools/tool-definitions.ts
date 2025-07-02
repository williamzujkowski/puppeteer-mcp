/**
 * MCP Tool Definitions
 * @module mcp/tools/tool-definitions
 * @description Tool schemas for MCP server
 */

export const TOOL_DEFINITIONS = [
  {
    name: 'execute-api',
    description: 'Execute API calls across REST, gRPC, or WebSocket protocols',
    inputSchema: {
      type: 'object',
      properties: {
        protocol: {
          type: 'string',
          enum: ['rest', 'grpc', 'websocket'],
          description: 'Protocol to use',
        },
        operation: {
          type: 'object',
          description: 'Protocol-specific operation details',
        },
        auth: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['jwt', 'apikey', 'session'] },
            credentials: { type: 'string' },
          },
        },
      },
      required: ['protocol', 'operation'],
    },
  },
  {
    name: 'create-session',
    description: 'Create a new session for API interactions',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        password: { type: 'string' },
        duration: { type: 'number', description: 'Session duration in seconds' },
      },
      required: ['username', 'password'],
    },
  },
  {
    name: 'list-sessions',
    description: 'List active sessions',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
      },
    },
  },
  {
    name: 'delete-session',
    description: 'Delete an active session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to delete' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'create-browser-context',
    description: 'Create a Puppeteer browser context',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        options: {
          type: 'object',
          properties: {
            headless: { type: 'boolean' },
            viewport: {
              type: 'object',
              properties: {
                width: { type: 'number' },
                height: { type: 'number' },
              },
            },
          },
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'execute-in-context',
    description: 'Execute commands in a browser context',
    inputSchema: {
      type: 'object',
      properties: {
        contextId: { type: 'string', description: 'Context ID to execute command in' },
        command: { type: 'string', description: 'Command to execute' },
        parameters: { type: 'object', description: 'Parameters for the command' },
      },
      required: ['contextId', 'command'],
    },
  },
];