/**
 * MCP Server Resource Handlers
 * @module mcp/server-resource-handlers
 * @description Resource-related handlers for MCP server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { ApiCatalogResource } from './resources/api-catalog.js';
import { SystemHealthResource } from './resources/system-health.js';

/**
 * Setup resource handlers for MCP server
 */
export function setupResourceHandlers(
  server: Server,
  apiCatalogResource: ApiCatalogResource,
  systemHealthResource: SystemHealthResource,
): void {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, () => {
    return {
      resources: [
        {
          uri: 'api://catalog',
          name: 'api-catalog',
          title: 'API Catalog',
          description: 'Complete catalog of available APIs across all protocols',
          mimeType: 'application/json',
        },
        {
          uri: 'api://health',
          name: 'system-health',
          title: 'System Health',
          description: 'Current system health and status including browser pool',
          mimeType: 'application/json',
        },
      ],
    };
  });

  // Read resource content
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    logger.info({
      msg: 'MCP resource access',
      resource: uri,
      timestamp: new Date().toISOString(),
    });

    switch (uri) {
      case 'api://catalog': {
        const catalog = await apiCatalogResource.getApiCatalog();
        return {
          contents: catalog.contents,
        };
      }
      case 'api://health': {
        const health = systemHealthResource.getSystemHealth();
        return {
          contents: health.contents,
        };
      }
      default:
        throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
    }
  });
}
