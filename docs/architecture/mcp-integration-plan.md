# MCP Integration Implementation Plan

## Overview

This document outlines the implementation plan for integrating the Model Context Protocol (MCP) into
our existing multi-protocol API platform. This integration will enable LLMs to interact with our
REST, gRPC, and WebSocket APIs through a standardized interface.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        LLM Clients                              │
│            (Claude, GPT, Local Models, etc.)                    │
└───────────────────────┬─────────────────────────────────────────┘
                        │ MCP Protocol (JSON-RPC 2.0)
┌───────────────────────┴─────────────────────────────────────────┐
│                    MCP Server Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Tools     │  │  Resources  │  │     Prompts         │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Protocol Translation Layer                  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────────────┐
│              Existing Multi-Protocol Platform                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  REST API   │  │    gRPC     │  │    WebSocket        │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │     Session Store | Context Store | Auth Layer          │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: Foundation (Week 1-2)

### 1.1 Project Setup

**File Structure:**

```
src/mcp/
├── server.ts              # MCP server initialization
├── transport/
│   ├── stdio.ts          # Standard I/O transport
│   └── http.ts           # HTTP transport
├── tools/
│   ├── api-executor.ts   # Generic API execution tool
│   ├── session-tools.ts  # Session management tools
│   └── context-tools.ts  # Context management tools
├── resources/
│   ├── api-catalog.ts    # API discovery resource
│   └── schema-provider.ts # Schema information
├── prompts/
│   └── api-templates.ts  # Pre-built interaction templates
├── adapters/
│   ├── rest-adapter.ts   # REST to MCP adapter
│   ├── grpc-adapter.ts   # gRPC to MCP adapter
│   └── ws-adapter.ts     # WebSocket to MCP adapter
└── types/
    └── mcp.d.ts          # MCP-specific types
```

**Dependencies:**

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "zod": "^3.22.4" // Already in project
  }
}
```

### 1.2 Core MCP Server Implementation

```typescript
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export class MCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'puppeteer-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      },
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Tool execution handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      // Route to appropriate tool handler
    });

    // Resource listing handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      // Return available resources
    });

    // Resource reading handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      // Return resource content
    });
  }
}
```

## Phase 2: Protocol Adapters (Week 2-3)

### 2.1 REST Adapter

```typescript
// src/mcp/adapters/rest-adapter.ts
import { AppRequest } from '@types/express.js';
import { sessionStore } from '@store/session-store.js';

export class RestAdapter {
  async executeRequest(params: {
    method: string;
    endpoint: string;
    headers?: Record<string, string>;
    body?: unknown;
    sessionId?: string;
  }): Promise<MCPResponse> {
    // Validate session if provided
    if (params.sessionId) {
      const session = await sessionStore.get(params.sessionId);
      if (!session) {
        throw new Error('Invalid session');
      }
    }

    // Execute REST request
    const response = await this.forwardToExpress(params);

    // Transform to MCP response
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.body),
        },
      ],
      metadata: {
        status: response.status,
        headers: response.headers,
      },
    };
  }
}
```

### 2.2 gRPC Adapter

```typescript
// src/mcp/adapters/grpc-adapter.ts
import { getGrpcServer } from '@grpc/server.js';

export class GrpcAdapter {
  async executeCall(params: {
    service: string;
    method: string;
    request: unknown;
    metadata?: Record<string, string>;
  }): Promise<MCPResponse> {
    const server = getGrpcServer();
    const service = server.getService(params.service);

    if (!service) {
      throw new Error(`Service ${params.service} not found`);
    }

    // Execute gRPC call
    const response = await service[params.method](params.request, params.metadata);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response),
        },
      ],
    };
  }
}
```

### 2.3 WebSocket Adapter

```typescript
// src/mcp/adapters/ws-adapter.ts
import { WebSocketManager } from '@ws/connection-manager.js';

export class WebSocketAdapter {
  private subscriptions = new Map<string, (data: any) => void>();

  async subscribe(params: {
    topic: string;
    filter?: Record<string, unknown>;
    duration?: number;
  }): Promise<MCPStreamResponse> {
    const subscriptionId = crypto.randomUUID();

    // Create subscription
    const unsubscribe = WebSocketManager.subscribe(
      params.topic,
      (data) => this.handleMessage(subscriptionId, data),
      params.filter,
    );

    // Store cleanup function
    this.subscriptions.set(subscriptionId, unsubscribe);

    // Auto-cleanup if duration specified
    if (params.duration) {
      setTimeout(() => this.unsubscribe(subscriptionId), params.duration);
    }

    return {
      subscriptionId,
      content: [
        {
          type: 'text',
          text: `Subscribed to ${params.topic}`,
        },
      ],
    };
  }
}
```

## Phase 3: MCP Tools Implementation (Week 3-4)

### 3.1 API Executor Tool

```typescript
// src/mcp/tools/api-executor.ts
export const apiExecutorTool = {
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
  handler: async (params: any) => {
    // Authenticate if credentials provided
    const context = await authenticateMCPRequest(params.auth);

    // Route to appropriate adapter
    switch (params.protocol) {
      case 'rest':
        return await restAdapter.executeRequest({
          ...params.operation,
          context,
        });
      case 'grpc':
        return await grpcAdapter.executeCall({
          ...params.operation,
          context,
        });
      case 'websocket':
        return await wsAdapter.handleOperation({
          ...params.operation,
          context,
        });
    }
  },
};
```

### 3.2 Session Management Tools

```typescript
// src/mcp/tools/session-tools.ts
export const sessionTools = [
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
    handler: async (params: any) => {
      const session = await authService.authenticate(params);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sessionId: session.id,
              expiresAt: session.expiresAt,
            }),
          },
        ],
      };
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
    handler: async (params: any) => {
      const sessions = await sessionStore.list({ userId: params.userId });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(sessions),
          },
        ],
      };
    },
  },
];
```

### 3.3 Context Management Tools

```typescript
// src/mcp/tools/context-tools.ts
export const contextTools = [
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
    handler: async (params: any) => {
      const context = await contextStore.create({
        sessionId: params.sessionId,
        type: 'puppeteer',
        config: params.options || {},
        status: 'active',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ contextId: context.id }),
          },
        ],
      };
    },
  },
  {
    name: 'execute-in-context',
    description: 'Execute commands in a browser context',
    inputSchema: {
      type: 'object',
      properties: {
        contextId: { type: 'string' },
        command: { type: 'string' },
        parameters: { type: 'object' },
      },
      required: ['contextId', 'command'],
    },
    handler: async (params: any) => {
      const result = await puppeteerExecutor.execute(
        params.contextId,
        params.command,
        params.parameters,
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    },
  },
];
```

## Phase 4: Resources & Discovery (Week 4-5)

### 4.1 API Catalog Resource

```typescript
// src/mcp/resources/api-catalog.ts
export const apiCatalogResource = {
  uri: 'api://catalog',
  name: 'API Catalog',
  description: 'Complete catalog of available APIs',
  mimeType: 'application/json',
  handler: async () => {
    const catalog = {
      rest: {
        baseUrl: '/api/v1',
        endpoints: [
          {
            path: '/sessions',
            methods: ['GET', 'POST', 'DELETE'],
            description: 'Session management',
          },
          {
            path: '/contexts',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'Context management',
          },
        ],
      },
      grpc: {
        services: [
          {
            name: 'SessionService',
            methods: ['CreateSession', 'GetSession', 'DeleteSession'],
          },
          {
            name: 'ContextService',
            methods: ['CreateContext', 'ExecuteCommand'],
          },
        ],
      },
      websocket: {
        topics: [
          {
            name: 'session-updates',
            description: 'Real-time session events',
          },
          {
            name: 'context-updates',
            description: 'Real-time context events',
          },
        ],
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(catalog, null, 2),
        },
      ],
    };
  },
};
```

### 4.2 Schema Provider Resource

```typescript
// src/mcp/resources/schema-provider.ts
export const schemaProviderResource = {
  uri: 'api://schemas/{service}/{method}',
  name: 'API Schemas',
  description: 'Request/response schemas for APIs',
  mimeType: 'application/json',
  handler: async (uri: string) => {
    const [, , , service, method] = uri.split('/');

    // Get schema based on service and method
    const schema = await schemaRegistry.getSchema(service, method);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(schema, null, 2),
        },
      ],
    };
  },
};
```

## Phase 5: Security & Authentication (Week 5-6)

### 5.1 MCP Authentication Bridge

```typescript
// src/mcp/auth/mcp-auth.ts
import { verifyToken } from '@auth/jwt.js';
import { validateApiKey } from '@auth/api-key.js';

export class MCPAuthBridge {
  async authenticate(auth?: {
    type: 'jwt' | 'apikey' | 'session';
    credentials: string;
  }): Promise<AuthContext> {
    if (!auth) {
      throw new Error('Authentication required');
    }

    switch (auth.type) {
      case 'jwt':
        return await this.authenticateJWT(auth.credentials);
      case 'apikey':
        return await this.authenticateApiKey(auth.credentials);
      case 'session':
        return await this.authenticateSession(auth.credentials);
      default:
        throw new Error('Invalid authentication type');
    }
  }

  private async authenticateJWT(token: string): Promise<AuthContext> {
    const decoded = await verifyToken(token);
    return {
      userId: decoded.userId,
      roles: decoded.roles,
      permissions: await this.getPermissions(decoded.roles),
    };
  }

  private async authenticateApiKey(key: string): Promise<AuthContext> {
    const apiKey = await validateApiKey(key);
    return {
      userId: apiKey.userId,
      roles: ['api-user'],
      permissions: apiKey.scopes,
    };
  }
}
```

### 5.2 Permission Mapping

```typescript
// src/mcp/auth/permission-mapper.ts
export class MCPPermissionMapper {
  private static toolPermissions = {
    'execute-api': ['api:read', 'api:write'],
    'create-session': ['session:create'],
    'list-sessions': ['session:read'],
    'create-browser-context': ['context:create'],
    'execute-in-context': ['context:execute'],
  };

  static canExecuteTool(tool: string, permissions: string[]): boolean {
    const required = this.toolPermissions[tool] || [];
    return required.every((p) => permissions.includes(p));
  }
}
```

## Phase 6: Testing & Documentation (Week 6-7)

### 6.1 Test Structure

```typescript
// tests/unit/mcp/mcp-server.test.ts
describe('MCP Server', () => {
  describe('Tool Execution', () => {
    it('should execute REST API calls through MCP', async () => {
      const response = await mcpClient.callTool('execute-api', {
        protocol: 'rest',
        operation: {
          method: 'GET',
          endpoint: '/api/v1/sessions',
        },
        auth: {
          type: 'jwt',
          credentials: testToken,
        },
      });

      expect(response.content[0].text).toContain('sessions');
    });
  });

  describe('Resource Access', () => {
    it('should provide API catalog', async () => {
      const catalog = await mcpClient.readResource('api://catalog');
      const data = JSON.parse(catalog.content[0].text);

      expect(data).toHaveProperty('rest');
      expect(data).toHaveProperty('grpc');
      expect(data).toHaveProperty('websocket');
    });
  });
});
```

### 6.2 Integration Tests

```typescript
// tests/integration/mcp/full-flow.test.ts
describe('MCP Full Integration', () => {
  it('should handle complete session workflow', async () => {
    // 1. Create session via MCP
    const sessionResponse = await mcpClient.callTool('create-session', {
      username: 'testuser',
      password: 'testpass',
    });

    const { sessionId } = JSON.parse(sessionResponse.content[0].text);

    // 2. Create browser context
    const contextResponse = await mcpClient.callTool('create-browser-context', {
      sessionId,
      options: { headless: true },
    });

    const { contextId } = JSON.parse(contextResponse.content[0].text);

    // 3. Execute browser command
    const executeResponse = await mcpClient.callTool('execute-in-context', {
      contextId,
      command: 'navigate',
      parameters: { url: 'https://example.com' },
    });

    expect(executeResponse).toBeDefined();
  });
});
```

## Phase 7: Deployment & Monitoring (Week 7-8)

### 7.1 Configuration

```typescript
// src/mcp/config.ts
export const mcpConfig = {
  transport: {
    type: process.env.MCP_TRANSPORT || 'stdio',
    http: {
      port: parseInt(process.env.MCP_HTTP_PORT || '3001'),
      host: process.env.MCP_HTTP_HOST || 'localhost',
    },
  },
  security: {
    requireAuth: process.env.MCP_REQUIRE_AUTH !== 'false',
    allowedClients: process.env.MCP_ALLOWED_CLIENTS?.split(',') || [],
  },
  features: {
    enableTools: true,
    enableResources: true,
    enablePrompts: true,
    enableSampling: false,
  },
};
```

### 7.2 Monitoring Integration

```typescript
// src/mcp/monitoring.ts
import { logger } from '@utils/logger.js';

export class MCPMonitoring {
  static logToolExecution(tool: string, params: any, result: any, duration: number) {
    logger.info({
      type: 'mcp_tool_execution',
      tool,
      params: this.sanitizeParams(params),
      success: !!result,
      duration,
      timestamp: new Date().toISOString(),
    });
  }

  static logResourceAccess(resource: string, duration: number) {
    logger.info({
      type: 'mcp_resource_access',
      resource,
      duration,
      timestamp: new Date().toISOString(),
    });
  }
}
```

## Implementation Timeline

| Week | Phase             | Deliverables                                 |
| ---- | ----------------- | -------------------------------------------- |
| 1-2  | Foundation        | Basic MCP server, file structure, core setup |
| 2-3  | Protocol Adapters | REST, gRPC, WebSocket adapters               |
| 3-4  | Tools             | API executor, session, and context tools     |
| 4-5  | Resources         | API catalog, schema provider                 |
| 5-6  | Security          | Authentication bridge, permission mapping    |
| 6-7  | Testing           | Unit and integration tests                   |
| 7-8  | Deployment        | Configuration, monitoring, documentation     |

## Success Metrics

1. **Functional Metrics**
   - All three protocols accessible via MCP
   - < 100ms latency for tool execution
   - 100% backward compatibility maintained

2. **Quality Metrics**
   - 90%+ test coverage for MCP components
   - Zero security vulnerabilities
   - Full NIST compliance maintained

3. **Adoption Metrics**
   - Example LLM integrations working
   - Documentation completeness
   - Developer feedback positive

## Risk Mitigation

1. **Performance Impact**
   - Risk: Additional protocol layer adds latency
   - Mitigation: Implement caching, connection pooling

2. **Security Concerns**
   - Risk: LLM access to sensitive APIs
   - Mitigation: Granular permissions, audit logging

3. **Complexity Increase**
   - Risk: Harder to maintain and debug
   - Mitigation: Clear separation of concerns, comprehensive logging

## Next Steps

1. Review and approve implementation plan
2. Set up MCP development branch
3. Begin Phase 1 implementation
4. Schedule weekly progress reviews

This plan ensures a systematic, secure, and maintainable integration of MCP into your platform while
preserving all existing functionality.
