/**
 * MCP Tool Definitions
 * @module mcp/tools/tool-definitions
 * @description Tool schemas for MCP server
 */

export const TOOL_DEFINITIONS = [
  {
    name: 'execute-api',
    title: 'Execute API',
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
    title: 'Create Session',
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
    title: 'List Sessions',
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
    title: 'Delete Session',
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
    title: 'Create Browser Context',
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
    title: 'Execute in Context',
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
  {
    name: 'close-browser-context',
    title: 'Close Browser Context',
    description: 'Close a browser context and all its pages',
    inputSchema: {
      type: 'object',
      properties: {
        contextId: { type: 'string', description: 'Context ID to close' },
        sessionId: { type: 'string', description: 'Session ID that owns the context' },
      },
      required: ['contextId', 'sessionId'],
    },
  },
  {
    name: 'list-browser-contexts',
    title: 'List Browser Contexts',
    description: 'List all browser contexts for a session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to list contexts for' },
      },
      required: ['sessionId'],
    },
  },
];