/**
 * API Catalog Resource Implementation
 * @module mcp/resources/api-catalog
 */

import type { RestAdapter } from '../adapters/rest-adapter.js';
import type { ApiCatalog, RestEndpoint, ResourceResponse } from '../types/resource-types.js';

/**
 * API Catalog resource handler
 * @nist ac-3 "Access enforcement"
 */
export class ApiCatalogResource {
  constructor(private restAdapter?: RestAdapter) {}

  /**
   * Get API catalog
   */
  async getApiCatalog(): Promise<ResourceResponse> {
    // Get REST endpoints from adapter if available
    const restEndpoints: RestEndpoint[] = await this.getRestEndpoints();
    
    const catalog: ApiCatalog = {
      rest: {
        baseUrl: '/api/v1',
        endpoints: restEndpoints,
        authentication: {
          methods: ['jwt', 'apikey', 'session'],
          headers: {
            jwt: 'Authorization: Bearer <token>',
            apikey: 'X-API-Key: <key>',
          },
        },
      },
      grpc: {
        services: [
          {
            name: 'SessionService',
            methods: ['CreateSession', 'GetSession', 'DeleteSession', 'ListSessions'],
          },
          {
            name: 'ContextService',
            methods: ['CreateContext', 'GetContext', 'ExecuteCommand'],
          },
          {
            name: 'HealthService',
            methods: ['Check', 'Watch'],
          },
        ],
      },
      websocket: {
        endpoint: '/ws',
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
      contents: [
        {
          uri: 'api://catalog',
          mimeType: 'application/json',
          text: JSON.stringify(catalog, null, 2),
        },
      ],
    };
  }

  /**
   * Get REST endpoints from adapter or use defaults
   */
  private async getRestEndpoints(): Promise<RestEndpoint[]> {
    if (this.restAdapter) {
      const endpointsResponse = await this.restAdapter.listEndpoints();
      if (endpointsResponse.content[0]?.text !== null && endpointsResponse.content[0]?.text !== undefined && endpointsResponse.content[0]?.text !== '') {
        const data = JSON.parse(endpointsResponse.content[0].text);
        return data.endpoints as RestEndpoint[];
      }
    }
    
    // Return default endpoints if adapter not available
    return [
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
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
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
    ];
  }
}