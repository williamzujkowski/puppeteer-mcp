/**
 * Comprehensive MCP Resources Functional Tests
 * @module tests/functional/resources-comprehensive
 * @description Complete functional test suite for MCP resources (api://catalog and api://health)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MCPServer, createMCPServer } from '../../src/mcp/server.js';
import type { ApiCatalog, SystemHealth } from '../../src/mcp/types/resource-types.js';

/**
 * Mock MCP client for resource testing
 */
class MockMCPResourceClient {
  private server: MCPServer;
  private mockTransport: any;

  constructor(server: MCPServer) {
    this.server = server;
    this.setupMockTransport();
  }

  private setupMockTransport(): void {
    this.mockTransport = {
      send: jest.fn(),
      close: jest.fn()
    };
  }

  async listResources(): Promise<{
    resources: Array<{
      uri: string;
      name: string;
      title: string;
      description: string;
      mimeType: string;
    }>;
  }> {
    // Return list of available resources
    return {
      resources: [
        {
          uri: 'api://catalog',
          name: 'api-catalog',
          title: 'API Catalog',
          description: 'Complete catalog of available APIs across all protocols',
          mimeType: 'application/json'
        },
        {
          uri: 'api://health',
          name: 'system-health',
          title: 'System Health',
          description: 'Current system health and status including browser pool',
          mimeType: 'application/json'
        }
      ]
    };
  }

  async readResource(uri: string): Promise<{
    contents: Array<{
      uri: string;
      mimeType: string;
      text: string;
    }>;
  }> {
    const server = this.server as any;
    
    if (uri === 'api://catalog') {
      return await server.apiCatalogResource.getApiCatalog();
    } else if (uri === 'api://health') {
      return server.systemHealthResource.getSystemHealth();
    } else {
      throw new Error(`Unknown resource: ${uri}`);
    }
  }
}

describe('MCP Resources Comprehensive Functional Tests', () => {
  let mcpServer: MCPServer;
  let mcpClient: MockMCPResourceClient;

  beforeAll(async () => {
    // Create MCP server
    mcpServer = createMCPServer();
    mcpClient = new MockMCPResourceClient(mcpServer);
    
    // Start the server
    await mcpServer.start();
  });

  afterAll(async () => {
    await mcpServer.stop();
  });

  describe('1. Resource Listing Tests', () => {
    it('should list all available resources', async () => {
      const result = await mcpClient.listResources();

      expect(result.resources).toBeDefined();
      expect(Array.isArray(result.resources)).toBe(true);
      expect(result.resources).toHaveLength(2);

      // Verify catalog resource
      const catalogResource = result.resources.find(r => r.uri === 'api://catalog');
      expect(catalogResource).toBeDefined();
      expect(catalogResource).toMatchObject({
        uri: 'api://catalog',
        name: 'api-catalog',
        title: 'API Catalog',
        description: 'Complete catalog of available APIs across all protocols',
        mimeType: 'application/json'
      });

      // Verify health resource
      const healthResource = result.resources.find(r => r.uri === 'api://health');
      expect(healthResource).toBeDefined();
      expect(healthResource).toMatchObject({
        uri: 'api://health',
        name: 'system-health',
        title: 'System Health',
        description: 'Current system health and status including browser pool',
        mimeType: 'application/json'
      });
    });

    it('should have correct resource metadata', async () => {
      const result = await mcpClient.listResources();

      result.resources.forEach(resource => {
        expect(resource.uri).toMatch(/^api:\/\/(catalog|health)$/);
        expect(resource.name).toBeDefined();
        expect(resource.title).toBeDefined();
        expect(resource.description).toBeDefined();
        expect(resource.mimeType).toBe('application/json');
      });
    });
  });

  describe('2. API Catalog Resource Tests', () => {
    describe('Reading API Catalog', () => {
      it('should read api://catalog resource successfully', async () => {
        const result = await mcpClient.readResource('api://catalog');

        expect(result.contents).toBeDefined();
        expect(Array.isArray(result.contents)).toBe(true);
        expect(result.contents).toHaveLength(1);

        const content = result.contents[0];
        expect(content.uri).toBe('api://catalog');
        expect(content.mimeType).toBe('application/json');
        expect(content.text).toBeDefined();
        expect(typeof content.text).toBe('string');
      });

      it('should parse catalog JSON content correctly', async () => {
        const result = await mcpClient.readResource('api://catalog');
        const content = result.contents[0];
        
        expect(() => JSON.parse(content.text)).not.toThrow();
        
        const catalog: ApiCatalog = JSON.parse(content.text);
        expect(catalog).toBeDefined();
      });
    });

    describe('Catalog Structure Validation', () => {
      let catalog: ApiCatalog;

      beforeAll(async () => {
        const result = await mcpClient.readResource('api://catalog');
        catalog = JSON.parse(result.contents[0].text);
      });

      it('should have valid REST endpoints structure', () => {
        expect(catalog.rest).toBeDefined();
        expect(catalog.rest.baseUrl).toBe('/api/v1');
        expect(Array.isArray(catalog.rest.endpoints)).toBe(true);
        
        // Validate endpoint structure
        catalog.rest.endpoints.forEach(endpoint => {
          expect(endpoint.path).toBeDefined();
          expect(typeof endpoint.path).toBe('string');
          expect(Array.isArray(endpoint.methods)).toBe(true);
          expect(endpoint.methods.length).toBeGreaterThan(0);
          expect(endpoint.description).toBeDefined();
          expect(typeof endpoint.description).toBe('string');
        });
      });

      it('should have valid gRPC services structure', () => {
        expect(catalog.grpc).toBeDefined();
        expect(Array.isArray(catalog.grpc.services)).toBe(true);
        expect(catalog.grpc.services.length).toBeGreaterThan(0);

        // Validate service structure
        catalog.grpc.services.forEach(service => {
          expect(service.name).toBeDefined();
          expect(typeof service.name).toBe('string');
          expect(Array.isArray(service.methods)).toBe(true);
          expect(service.methods.length).toBeGreaterThan(0);
        });

        // Check for expected services
        const serviceNames = catalog.grpc.services.map(s => s.name);
        expect(serviceNames).toContain('SessionService');
        expect(serviceNames).toContain('ContextService');
        expect(serviceNames).toContain('HealthService');
      });

      it('should have valid WebSocket topics structure', () => {
        expect(catalog.websocket).toBeDefined();
        expect(catalog.websocket.endpoint).toBeDefined();
        expect(typeof catalog.websocket.endpoint).toBe('string');
        expect(Array.isArray(catalog.websocket.topics)).toBe(true);

        // Validate topics structure
        catalog.websocket.topics.forEach(topic => {
          expect(topic.name).toBeDefined();
          expect(typeof topic.name).toBe('string');
          expect(topic.description).toBeDefined();
          expect(typeof topic.description).toBe('string');
        });
      });

      it('should have valid authentication configuration', () => {
        expect(catalog.rest.authentication).toBeDefined();
        expect(Array.isArray(catalog.rest.authentication.methods)).toBe(true);
        expect(catalog.rest.authentication.methods.length).toBeGreaterThan(0);
        
        // Check for expected auth methods
        const authMethods = catalog.rest.authentication.methods;
        expect(authMethods).toContain('jwt');
        expect(authMethods).toContain('apikey');
        expect(authMethods).toContain('session');

        // Validate headers structure
        expect(catalog.rest.authentication.headers).toBeDefined();
        expect(typeof catalog.rest.authentication.headers).toBe('object');
        expect(catalog.rest.authentication.headers.jwt).toMatch(/^Authorization: Bearer/);
        expect(catalog.rest.authentication.headers.apikey).toMatch(/^X-API-Key:/);
      });

      it('should contain essential REST endpoints', () => {
        const endpointPaths = catalog.rest.endpoints.map(e => e.path);
        
        // Check for core endpoints
        expect(endpointPaths).toContain('/health');
        expect(endpointPaths).toContain('/sessions');
        expect(endpointPaths).toContain('/catalog');

        // Validate health endpoint
        const healthEndpoint = catalog.rest.endpoints.find(e => e.path === '/health');
        expect(healthEndpoint).toBeDefined();
        expect(healthEndpoint.methods).toContain('GET');
        expect(healthEndpoint!.description).toBeDefined();

        // Validate sessions endpoint
        const sessionsEndpoint = catalog.rest.endpoints.find(e => e.path === '/sessions');
        expect(sessionsEndpoint).toBeDefined();
        expect(sessionsEndpoint.methods).toContain('GET');
        expect(sessionsEndpoint.methods).toContain('POST');
      });
    });
  });

  describe('3. System Health Resource Tests', () => {
    describe('Reading Health Resource', () => {
      it('should read api://health resource successfully', async () => {
        const result = await mcpClient.readResource('api://health');

        expect(result.contents).toBeDefined();
        expect(Array.isArray(result.contents)).toBe(true);
        expect(result.contents).toHaveLength(1);

        const content = result.contents[0];
        expect(content.uri).toBe('api://health');
        expect(content.mimeType).toBe('application/json');
        expect(content.text).toBeDefined();
        expect(typeof content.text).toBe('string');
      });

      it('should parse health JSON content correctly', async () => {
        const result = await mcpClient.readResource('api://health');
        const content = result.contents[0];
        
        expect(() => JSON.parse(content.text)).not.toThrow();
        
        const health: SystemHealth = JSON.parse(content.text);
        expect(health).toBeDefined();
      });
    });

    describe('Health Status Structure Validation', () => {
      let health: SystemHealth;

      beforeAll(async () => {
        const result = await mcpClient.readResource('api://health');
        health = JSON.parse(result.contents[0].text);
      });

      it('should have valid health status fields', () => {
        expect(health.status).toBeDefined();
        expect(typeof health.status).toBe('string');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);

        expect(health.uptime).toBeDefined();
        expect(typeof health.uptime).toBe('number');
        expect(health.uptime).toBeGreaterThanOrEqual(0);

        expect(health.timestamp).toBeDefined();
        expect(typeof health.timestamp).toBe('string');
        expect(() => new Date(health.timestamp)).not.toThrow();
        expect(new Date(health.timestamp).getTime()).toBeGreaterThan(0);
      });

      it('should have valid services status', () => {
        expect(health.services).toBeDefined();
        expect(typeof health.services).toBe('object');

        // Check all required services
        const requiredServices = ['rest', 'grpc', 'websocket', 'mcp'];
        requiredServices.forEach(service => {
          expect(health.services[service]).toBeDefined();
          expect(typeof health.services[service]).toBe('string');
          expect(['operational', 'degraded', 'down']).toContain(health.services[service]);
        });
      });

      it('should have recent timestamp', () => {
        const healthTime = new Date(health.timestamp).getTime();
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000);

        expect(healthTime).toBeGreaterThan(fiveMinutesAgo);
        expect(healthTime).toBeLessThanOrEqual(now);
      });

      it('should have realistic uptime', () => {
        // Uptime should be positive and reasonable (less than 30 days for tests)
        expect(health.uptime).toBeGreaterThan(0);
        expect(health.uptime).toBeLessThan(30 * 24 * 60 * 60 * 1000); // 30 days in ms
      });
    });

    describe('Health Resource Consistency', () => {
      it('should return consistent data on multiple reads', async () => {
        const result1 = await mcpClient.readResource('api://health');
        const health1: SystemHealth = JSON.parse(result1.contents[0].text);

        // Wait a small amount
        await new Promise(resolve => setTimeout(resolve, 100));

        const result2 = await mcpClient.readResource('api://health');
        const health2: SystemHealth = JSON.parse(result2.contents[0].text);

        // Status should be the same
        expect(health2.status).toBe(health1.status);
        
        // Services should be the same
        expect(health2.services).toEqual(health1.services);
        
        // Uptime should have increased
        expect(health2.uptime).toBeGreaterThanOrEqual(health1.uptime);
        
        // Timestamp should be more recent
        expect(new Date(health2.timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(health1.timestamp).getTime()
        );
      });
    });
  });

  describe('4. Error Cases for Invalid Resource URIs', () => {
    it('should reject invalid resource URI', async () => {
      await expect(
        mcpClient.readResource('api://invalid')
      ).rejects.toThrow('Unknown resource: api://invalid');
    });

    it('should reject non-api protocol', async () => {
      await expect(
        mcpClient.readResource('http://catalog')
      ).rejects.toThrow('Unknown resource: http://catalog');
    });

    it('should reject empty URI', async () => {
      await expect(
        mcpClient.readResource('')
      ).rejects.toThrow('Unknown resource: ');
    });

    it('should reject malformed URI', async () => {
      await expect(
        mcpClient.readResource('not-a-uri')
      ).rejects.toThrow('Unknown resource: not-a-uri');
    });

    it('should reject URI with invalid scheme', async () => {
      await expect(
        mcpClient.readResource('file://catalog')
      ).rejects.toThrow('Unknown resource: file://catalog');
    });

    it('should reject URI with query parameters', async () => {
      await expect(
        mcpClient.readResource('api://catalog?param=value')
      ).rejects.toThrow('Unknown resource: api://catalog?param=value');
    });

    it('should reject URI with fragments', async () => {
      await expect(
        mcpClient.readResource('api://health#section')
      ).rejects.toThrow('Unknown resource: api://health#section');
    });

    it('should handle case-sensitive URIs', async () => {
      await expect(
        mcpClient.readResource('API://CATALOG')
      ).rejects.toThrow('Unknown resource: API://CATALOG');

      await expect(
        mcpClient.readResource('api://HEALTH')
      ).rejects.toThrow('Unknown resource: api://HEALTH');
    });
  });

  describe('5. Resource Access Performance Tests', () => {
    it('should handle concurrent resource reads', async () => {
      const promises = [
        mcpClient.readResource('api://catalog'),
        mcpClient.readResource('api://health'),
        mcpClient.readResource('api://catalog'),
        mcpClient.readResource('api://health'),
        mcpClient.readResource('api://catalog'),
      ];

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.contents).toBeDefined();
        expect(result.contents).toHaveLength(1);
      });

      // Verify catalog results
      const catalogResults = results.filter((_, index) => [0, 2, 4].includes(index));
      catalogResults.forEach(result => {
        expect(result.contents[0].uri).toBe('api://catalog');
        expect(() => JSON.parse(result.contents[0].text)).not.toThrow();
      });

      // Verify health results
      const healthResults = results.filter((_, index) => [1, 3].includes(index));
      healthResults.forEach(result => {
        expect(result.contents[0].uri).toBe('api://health');
        expect(() => JSON.parse(result.contents[0].text)).not.toThrow();
      });
    });

    it('should respond quickly to resource reads', async () => {
      const startTime = Date.now();
      
      await mcpClient.readResource('api://catalog');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should respond within 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should handle rapid sequential reads', async () => {
      const resources = ['api://catalog', 'api://health'];
      const results: any[] = [];

      for (let i = 0; i < 10; i++) {
        const uri = resources[i % resources.length];
        const result = await mcpClient.readResource(uri);
        results.push(result);
      }

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.contents).toBeDefined();
        expect(result.contents[0].text).toBeDefined();
        expect(() => JSON.parse(result.contents[0].text)).not.toThrow();
      });
    });
  });

  describe('6. Resource Content Validation Edge Cases', () => {
    it('should handle large catalog data', async () => {
      const result = await mcpClient.readResource('api://catalog');
      const catalogText = result.contents[0].text;
      
      // Catalog should be reasonably sized but not empty
      expect(catalogText.length).toBeGreaterThan(100);
      expect(catalogText.length).toBeLessThan(100000); // Reasonable upper limit
      
      // Should be valid JSON
      const catalog = JSON.parse(catalogText);
      expect(catalog).toBeDefined();
    });

    it('should validate catalog endpoint uniqueness', async () => {
      const result = await mcpClient.readResource('api://catalog');
      const catalog: ApiCatalog = JSON.parse(result.contents[0].text);
      
      const endpointPaths = catalog.rest.endpoints.map(e => e.path);
      const uniquePaths = new Set(endpointPaths);
      
      expect(uniquePaths.size).toBe(endpointPaths.length);
    });

    it('should validate gRPC service method uniqueness within services', async () => {
      const result = await mcpClient.readResource('api://catalog');
      const catalog: ApiCatalog = JSON.parse(result.contents[0].text);
      
      catalog.grpc.services.forEach(service => {
        const uniqueMethods = new Set(service.methods);
        expect(uniqueMethods.size).toBe(service.methods.length);
      });
    });

    it('should validate WebSocket topic uniqueness', async () => {
      const result = await mcpClient.readResource('api://catalog');
      const catalog: ApiCatalog = JSON.parse(result.contents[0].text);
      
      const topicNames = catalog.websocket.topics.map(t => t.name);
      const uniqueTopics = new Set(topicNames);
      
      expect(uniqueTopics.size).toBe(topicNames.length);
    });
  });
});