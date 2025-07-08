/**
 * API and HTTP interaction acceptance tests
 * @module tests/acceptance/api/http-interactions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createMCPClient, createMCPSession, cleanupMCPSession, mcpNavigate, mcpGetContent } from '../utils/mcp-client.js';
import { TEST_TARGETS, TEST_CONFIG } from '../utils/test-config.js';
import { retryOperation, validateUrl, AssertionHelpers, PerformanceTracker } from '../utils/test-helpers.js';
import type { MCPTestClient, MCPSessionInfo } from '../utils/mcp-client.js';

describe('API and HTTP Interaction Tests', () => {
  let mcpClient: MCPTestClient;
  let sessionInfo: MCPSessionInfo;
  
  beforeAll(async () => {
    // Validate API endpoints are accessible
    const endpointsToValidate = [
      TEST_TARGETS.apis.httpbin,
      TEST_TARGETS.apis.jsonplaceholder,
      TEST_TARGETS.apis.reqres,
      TEST_TARGETS.apis.worldbank
    ];
    
    for (const endpoint of endpointsToValidate) {
      const isAccessible = await validateUrl(endpoint);
      if (!isAccessible) {
        console.warn(`Warning: API endpoint ${endpoint} is not accessible`);
      }
    }
    
    mcpClient = await createMCPClient();
  }, TEST_CONFIG.timeout);
  
  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.cleanup();
    }
  });
  
  beforeEach(async () => {
    sessionInfo = await createMCPSession(mcpClient.client);
  }, TEST_CONFIG.timeout);
  
  afterEach(async () => {
    if (sessionInfo) {
      await cleanupMCPSession(mcpClient.client, sessionInfo);
    }
  });

  describe('HTTPBin API Testing', () => {
    it('should handle GET requests and extract JSON data', async () => {
      const performance = new PerformanceTracker();
      
      await retryOperation(async () => {
        // Navigate to HTTPBin GET endpoint that returns JSON
        const url = `${TEST_TARGETS.apis.httpbin}/json`;
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
        performance.checkpoint('navigation');
        
        // Extract the JSON response
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        performance.checkpoint('content_extraction');
        
        // Parse and validate JSON structure
        let jsonData;
        try {
          // Extract JSON from HTML content
          const jsonMatch = content.match(/{.*}/s);
          if (jsonMatch) {
            jsonData = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // If parsing fails, content might be wrapped in HTML
          AssertionHelpers.containsText(content, 'slideshow');
          return; // Skip JSON validation but test passed
        }
        
        if (jsonData) {
          expect(jsonData).toHaveProperty('slideshow');
          expect(jsonData.slideshow).toHaveProperty('title');
        }
        
        console.warn('API GET performance:', performance.getReport());
      });
    }, TEST_CONFIG.timeout);

    it('should handle different HTTP status codes', async () => {
      const statusCodes = [200, 201, 400, 404, 500];
      
      for (const statusCode of statusCodes) {
        await retryOperation(async () => {
          const url = `${TEST_TARGETS.apis.httpbin}/status/${statusCode}`;
          await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
          
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          
          // Should navigate without throwing errors (error handling is at browser level)
          expect(content).toBeTruthy();
          
          // For error status codes, the response might be minimal
          if (statusCode >= 400) {
            // Error pages might be minimal or contain error indication
            console.warn(`Status ${statusCode} response length:`, content.length);
          }
        });
      }
    }, TEST_CONFIG.timeout * 2);

    it('should handle HTTP headers and user agent', async () => {
      await retryOperation(async () => {
        // HTTPBin's /headers endpoint returns request headers
        const url = `${TEST_TARGETS.apis.httpbin}/headers`;
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // Should contain headers information
        AssertionHelpers.containsText(content.toLowerCase(), 'user-agent');
        AssertionHelpers.containsText(content.toLowerCase(), 'accept');
        
        // Should contain browser user agent
        const hasUserAgent = content.toLowerCase().includes('chrome') || 
                           content.toLowerCase().includes('firefox') || 
                           content.toLowerCase().includes('webkit');
        expect(hasUserAgent).toBe(true);
      });
    }, TEST_CONFIG.timeout);

    it('should handle delayed responses', async () => {
      const performance = new PerformanceTracker();
      
      await retryOperation(async () => {
        // HTTPBin delay endpoint (2 second delay)
        const url = `${TEST_TARGETS.apis.httpbin}/delay/2`;
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
        performance.checkpoint('delayed_response');
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // Should have waited and received response
        expect(content).toBeTruthy();
        
        // Should have taken at least 2 seconds
        const elapsed = performance.getCheckpoint('delayed_response');
        expect(elapsed ?? 0).toBeGreaterThan(1800); // Allow some tolerance
        
        console.warn('Delayed response performance:', performance.getReport());
      });
    }, TEST_CONFIG.timeout);
  });

  describe('JSONPlaceholder API Testing', () => {
    it('should extract data from REST API endpoints', async () => {
      await retryOperation(async () => {
        // Navigate to posts endpoint
        const url = `${TEST_TARGETS.apis.jsonplaceholder}/posts/1`;
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // Should contain JSON data about a post
        AssertionHelpers.containsText(content, 'userId');
        AssertionHelpers.containsText(content, 'title');
        AssertionHelpers.containsText(content, 'body');
        
        // Try to parse as JSON
        try {
          const jsonMatch = content.match(/{.*}/s);
          if (jsonMatch) {
            const postData = JSON.parse(jsonMatch[0]);
            expect(postData).toHaveProperty('id', 1);
            expect(postData).toHaveProperty('userId');
            expect(postData).toHaveProperty('title');
            expect(postData).toHaveProperty('body');
          }
        } catch {
          // If JSON parsing fails, at least verify content structure
          console.warn('Could not parse JSON, but content validation passed');
        }
      });
    }, TEST_CONFIG.timeout);

    it('should handle collection endpoints', async () => {
      await retryOperation(async () => {
        // Navigate to posts collection (first 10 posts)
        const url = `${TEST_TARGETS.apis.jsonplaceholder}/posts?_limit=10`;
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // Should contain array of posts
        AssertionHelpers.containsText(content, '[');
        AssertionHelpers.containsText(content, ']');
        AssertionHelpers.containsText(content, 'userId');
        AssertionHelpers.containsText(content, 'title');
        
        // Should contain multiple posts
        const userIdMatches = content.match(/userId/g);
        if (userIdMatches) {
          expect(userIdMatches.length).toBeGreaterThan(5); // Should have multiple posts
        }
      });
    }, TEST_CONFIG.timeout);

    it('should handle nested resource endpoints', async () => {
      await retryOperation(async () => {
        // Get comments for a specific post
        const url = `${TEST_TARGETS.apis.jsonplaceholder}/posts/1/comments`;
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // Should contain comments data
        AssertionHelpers.containsText(content, 'postId');
        AssertionHelpers.containsText(content, 'email');
        AssertionHelpers.containsText(content, 'name');
        AssertionHelpers.containsText(content, 'body');
      });
    }, TEST_CONFIG.timeout);
  });

  describe('ReqRes API Testing', () => {
    it('should handle user data endpoints', async () => {
      await retryOperation(async () => {
        const url = `${TEST_TARGETS.apis.reqres}/api/users?page=1`;
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // Should contain user data structure
        AssertionHelpers.containsText(content, 'data');
        AssertionHelpers.containsText(content, 'page');
        AssertionHelpers.containsText(content, 'total');
        AssertionHelpers.containsText(content, 'email');
        AssertionHelpers.containsText(content, 'first_name');
      });
    }, TEST_CONFIG.timeout);

    it('should handle individual resource endpoints', async () => {
      await retryOperation(async () => {
        const url = `${TEST_TARGETS.apis.reqres}/api/users/2`;
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // Should contain single user data
        AssertionHelpers.containsText(content, '"id": 2');
        AssertionHelpers.containsText(content, 'email');
        AssertionHelpers.containsText(content, 'first_name');
        AssertionHelpers.containsText(content, 'last_name');
      });
    }, TEST_CONFIG.timeout);
  });

  describe('World Bank API Testing', () => {
    it('should handle government data APIs', async () => {
      await retryOperation(async () => {
        // Get list of countries (with JSON format)
        const url = `${TEST_TARGETS.apis.worldbank}/country?format=json&per_page=10`;
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // Should contain country data
        AssertionHelpers.containsText(content, 'name');
        AssertionHelpers.containsText(content, 'region');
        AssertionHelpers.containsText(content, 'capitalCity');
        
        // Should be JSON array format
        AssertionHelpers.containsText(content, '[');
        AssertionHelpers.containsText(content, ']');
      });
    }, TEST_CONFIG.timeout);

    it('should handle pagination in APIs', async () => {
      await retryOperation(async () => {
        // Get paginated results
        const url = `${TEST_TARGETS.apis.worldbank}/country?format=json&page=1&per_page=5`;
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // Should contain pagination metadata and data
        expect(content).toBeTruthy();
        
        try {
          // Try to parse the response structure
          const jsonMatch = content.match(/\[.*\]/s);
          if (jsonMatch) {
            const responseData = JSON.parse(jsonMatch[0]);
            if (Array.isArray(responseData) && responseData.length >= 2) {
              const metadata = responseData[0];
              const data = responseData[1];
              
              expect(metadata).toHaveProperty('page');
              expect(metadata).toHaveProperty('per_page');
              expect(Array.isArray(data)).toBe(true);
            }
          }
        } catch {
          // If JSON parsing fails, still validate basic content
          AssertionHelpers.containsText(content, 'page');
          AssertionHelpers.containsText(content, 'per_page');
        }
      });
    }, TEST_CONFIG.timeout);
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle API endpoints that return errors', async () => {
      await retryOperation(async () => {
        // Navigate to non-existent resource
        const url = `${TEST_TARGETS.apis.jsonplaceholder}/posts/99999`;
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // Should handle the 404 gracefully
        expect(content).toBeTruthy();
        
        // Content might be empty object or error message
        const isEmpty = content.includes('{}') || content.includes('null');
        const hasError = content.toLowerCase().includes('not found') || 
                        content.toLowerCase().includes('error');
        
        expect(isEmpty || hasError).toBe(true);
      });
    }, TEST_CONFIG.timeout);

    it('should handle large API responses', async () => {
      await retryOperation(async () => {
        // Get a larger dataset
        const url = `${TEST_TARGETS.apis.jsonplaceholder}/posts`;
        await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
        
        const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
        
        // Should handle large response
        expect(content.length).toBeGreaterThan(10000); // Expect substantial content
        
        // Should still contain expected structure
        AssertionHelpers.containsText(content, 'userId');
        AssertionHelpers.containsText(content, 'title');
        
        // Count number of posts (roughly)
        const userIdMatches = content.match(/userId/g);
        if (userIdMatches) {
          expect(userIdMatches.length).toBeGreaterThan(50); // Should have many posts
        }
      });
    }, TEST_CONFIG.timeout);

    it('should handle different content types', async () => {
      const contentTypes = [
        { endpoint: '/json', expectedContent: 'slideshow' },
        { endpoint: '/xml', expectedContent: '<slideshow>' },
        { endpoint: '/html', expectedContent: '<html>' }
      ];
      
      for (const { endpoint, expectedContent } of contentTypes) {
        await retryOperation(async () => {
          const url = `${TEST_TARGETS.apis.httpbin}${endpoint}`;
          await mcpNavigate(mcpClient.client, sessionInfo.contextId, url);
          
          const content = await mcpGetContent(mcpClient.client, sessionInfo.contextId);
          
          // Should contain expected content type indicators
          AssertionHelpers.containsText(content, expectedContent);
        });
      }
    }, TEST_CONFIG.timeout * 2);
  });
});