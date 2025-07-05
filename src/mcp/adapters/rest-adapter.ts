/**
 * REST Adapter for MCP
 * @module mcp/adapters/rest-adapter
 * @description Translates MCP API calls to Express route calls and handles authentication
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @nist ia-2 "Identification and authentication"
 */

import { Application, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import type { AuthenticatedRequest } from '../../types/express.js';
import type { ProtocolAdapter, MCPResponse } from './adapter.interface.js';
import { applyAuthentication, createUserFromSession } from './rest-auth-helper.js';
import {
  transformToMCPResponse,
  transformErrorToMCPResponse,
} from './rest-response-transformer.js';

/**
 * REST operation parameters
 */
const RestOperationSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  endpoint: z.string(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  query: z.record(z.string()).optional(),
});

type RestOperation = z.infer<typeof RestOperationSchema>;

/**
 * Authentication parameters schema
 */
const AuthParamsSchema = z.object({
  type: z.enum(['jwt', 'apikey', 'session']),
  credentials: z.string(),
});

/**
 * REST adapter for MCP protocol
 * @nist ac-3 "Access enforcement"
 * @nist ia-2 "Identification and authentication"
 */
export class RestAdapter implements ProtocolAdapter {
  constructor(private readonly app: Application) {}

  /**
   * Execute a REST API request through MCP
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  async executeRequest(params: {
    operation: unknown;
    auth?: unknown;
    sessionId?: string;
  }): Promise<MCPResponse> {
    const startTime = Date.now();
    const requestId = `mcp-rest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validate operation parameters
      const operation = RestOperationSchema.parse(params.operation);

      // Validate auth if provided
      let auth;
      if (params.auth !== null && params.auth !== undefined) {
        auth = AuthParamsSchema.parse(params.auth);
      }

      // Create mock request object
      const req = await this.createMockRequest(operation, auth, params.sessionId, requestId);

      // Execute request
      const response = await this.forwardToExpress(req, operation);

      // Log successful execution
      await logSecurityEvent(SecurityEventType.API_ACCESS, {
        userId: req.user?.userId,
        resource: operation.endpoint,
        action: operation.method,
        result: 'success',
        metadata: {
          protocol: 'mcp-rest',
          requestId,
          duration: Date.now() - startTime,
        },
      });

      // Transform to MCP response
      return transformToMCPResponse(response, requestId);
    } catch (error) {
      // Log failed execution
      await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
        resource:
          params.operation !== null && params.operation !== undefined
            ? JSON.stringify(params.operation)
            : 'unknown',
        action: 'execute',
        result: 'failure',
        reason: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          protocol: 'mcp-rest',
          requestId,
          duration: Date.now() - startTime,
        },
      });

      // Transform error to MCP response
      return transformErrorToMCPResponse(error, requestId);
    }
  }

  /**
   * Create a mock Express request object
   * @nist ia-2 "Identification and authentication"
   */
  private async createMockRequest(
    operation: RestOperation,
    auth: z.infer<typeof AuthParamsSchema> | undefined,
    sessionId: string | undefined,
    requestId: string,
  ): Promise<AuthenticatedRequest> {
    const req = {
      method: operation.method,
      path: operation.endpoint,
      url: operation.endpoint,
      body: operation.body ?? {},
      query: operation.query ?? {},
      headers: {
        ...operation.headers,
        'x-request-id': requestId,
        'user-agent': 'MCP-REST-Adapter/1.0',
      },
      ip: '127.0.0.1', // Local MCP request
      get: (header: string) => req.headers[header.toLowerCase()],
    } as unknown as AuthenticatedRequest;

    // Handle authentication
    if (auth) {
      await applyAuthentication(req, auth, sessionId);
    } else if (sessionId !== null && sessionId !== undefined && sessionId !== '') {
      // Use session ID directly
      req.user = await createUserFromSession(sessionId);
    }

    // Add request context
    req.context = {
      requestId,
      userId: req.user?.userId,
      sessionId: req.user?.sessionId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string,
    };

    return req;
  }

  /**
   * Forward request to Express application
   * @nist ac-3 "Access enforcement"
   */
  private forwardToExpress(
    req: AuthenticatedRequest,
    operation: RestOperation,
  ): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
    return new Promise((resolve, reject) => {
      // Create mock response object
      let responseData: unknown;
      let responseStatus = 200;
      const responseHeaders: Record<string, string> = {};

      const res = {
        status: (code: number) => {
          responseStatus = code;
          return res;
        },
        json: (data: unknown) => {
          responseData = data;
          resolve({
            status: responseStatus,
            body: responseData,
            headers: responseHeaders,
          });
        },
        send: (data: unknown) => {
          responseData = data;
          resolve({
            status: responseStatus,
            body: responseData,
            headers: responseHeaders,
          });
        },
        set: (header: string, value: string) => {
          // eslint-disable-next-line security/detect-object-injection
          responseHeaders[header] = value;
          return res;
        },
        setHeader: (header: string, value: string) => {
          // eslint-disable-next-line security/detect-object-injection
          responseHeaders[header] = value;
          return res;
        },
      } as unknown as Response;

      // Create next function for error handling
      const next: NextFunction = (error?: unknown) => {
        if (error !== null && error !== undefined) {
          reject(error instanceof Error ? error : new Error(String(error)));
        } else {
          resolve({
            status: responseStatus,
            body: responseData,
            headers: responseHeaders,
          });
        }
      };

      // Find and execute the matching route
      const layer = this.findMatchingRoute(operation.method, operation.endpoint);

      if (layer === null || layer === undefined) {
        reject(new AppError(`Route not found: ${operation.method} ${operation.endpoint}`, 404));
        return;
      }

      // Execute route handler
      try {
        (layer as { handle: (req: unknown, res: unknown, next: unknown) => void }).handle(
          req,
          res,
          next,
        );
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Find matching route in Express app
   */
  private findMatchingRoute(method: string, path: string): unknown {
    // This is a simplified implementation
    // In production, we would need to properly match routes with parameters
    const router = (this.app as unknown as Record<string, { _router?: unknown }>)._router;

    if (router === null || router === undefined) {
      return null;
    }

    // Find matching layer
    for (const layer of (
      router as {
        stack: Array<{ route?: { methods?: Record<string, boolean>; path?: string | RegExp } }>;
      }
    ).stack) {
      if (
        layer.route?.methods?.[method.toLowerCase()] === true &&
        layer.route.path !== undefined &&
        layer.route.path !== null &&
        this.pathMatches(layer.route.path, path)
      ) {
        return layer as { handle: (req: unknown, res: unknown, next: unknown) => void };
      }
    }

    return null;
  }

  /**
   * Check if path matches route pattern
   */
  private pathMatches(routePath: string | RegExp, requestPath: string): boolean {
    if (typeof routePath === 'string') {
      // Simple string matching (doesn't handle parameters)
      return routePath === requestPath;
    } else if (routePath instanceof RegExp) {
      return routePath.test(requestPath);
    }
    return false;
  }

  /**
   * Get REST adapter capabilities
   */
  getCapabilities(): Promise<{
    protocol: string;
    version: string;
    features: string[];
    authentication: string[];
    contentTypes: string[];
  }> {
    return Promise.resolve({
      protocol: 'rest',
      version: '1.0.0',
      features: [
        'http-methods',
        'query-parameters',
        'request-body',
        'custom-headers',
        'authentication',
        'error-handling',
        'rate-limiting',
      ],
      authentication: ['jwt', 'apikey', 'session'],
      contentTypes: ['application/json', 'application/x-www-form-urlencoded'],
    });
  }

  /**
   * List available REST endpoints
   * @nist ac-3 "Access enforcement"
   */
  listEndpoints(): Promise<MCPResponse> {
    return Promise.resolve({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              baseUrl: '/api/v1',
              endpoints: [
                {
                  path: '/sessions',
                  methods: ['GET', 'POST', 'DELETE'],
                  description: 'Session management',
                },
                {
                  path: '/sessions/:id',
                  methods: ['GET', 'DELETE'],
                  description: 'Individual session operations',
                },
                {
                  path: '/contexts',
                  methods: ['GET', 'POST'],
                  description: 'Context management',
                },
                {
                  path: '/contexts/:id',
                  methods: ['GET', 'PUT', 'DELETE'],
                  description: 'Individual context operations',
                },
                {
                  path: '/contexts/:id/execute',
                  methods: ['POST'],
                  description: 'Execute commands in context',
                },
                {
                  path: '/api-keys',
                  methods: ['GET', 'POST'],
                  description: 'API key management',
                },
                {
                  path: '/api-keys/:id',
                  methods: ['DELETE'],
                  description: 'Individual API key operations',
                },
                {
                  path: '/health',
                  methods: ['GET'],
                  description: 'Health check',
                },
              ],
            },
            null,
            2,
          ),
        },
      ],
      metadata: {
        status: 200,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Create REST adapter instance
 */
export function createRestAdapter(app: Application): RestAdapter {
  return new RestAdapter(app);
}
