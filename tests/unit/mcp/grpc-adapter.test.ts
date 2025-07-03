/**
 * gRPC Adapter Tests
 * @module mcp/adapters/grpc-adapter.test
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @evidence test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as grpc from '@grpc/grpc-js';
import { GrpcAdapter } from '../../../src/mcp/adapters/grpc-adapter.js';
import { AppError } from '../../../src/core/errors/app-error.js';
import type { GrpcServer } from '../../../src/grpc/server.js';

// Mock dependencies
jest.mock('../../../src/utils/logger.js', () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
  SecurityEventType: {
    API_ACCESS: 'API_ACCESS',
    ACCESS_DENIED: 'ACCESS_DENIED',
  },
}));

describe('GrpcAdapter', () => {
  let adapter: GrpcAdapter;
  let mockServer: jest.Mocked<GrpcServer>;

  beforeEach(() => {
    // Create mock server
    mockServer = {
      getServer: jest.fn(),
    } as any;

    adapter = new GrpcAdapter(mockServer);
  });

  describe('executeRequest', () => {
    it('should execute a unary gRPC call successfully', async () => {
      // Arrange
      const mockResponse = { id: '123', name: 'Test Session' };
      const mockService = {
        CreateSession: jest.fn((call, callback) => {
          callback(null, mockResponse);
        }),
      };

      const mockHandlers = new Map();
      mockHandlers.set('/mcp.control.v1.SessionService/CreateSession', mockService.CreateSession);

      mockServer.getServer.mockReturnValue({
        handlers: mockHandlers,
      });

      // Act
      const result = await adapter.executeRequest({
        operation: {
          service: 'SessionService',
          method: 'CreateSession',
          request: { name: 'Test Session' },
        },
        auth: {
          type: 'jwt',
          credentials: 'test-token',
        },
      });

      // Assert
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].data).toEqual(mockResponse);
      expect(result.metadata?.protocol).toBe('grpc');
      expect(result.metadata?.service).toBe('SessionService');
      expect(result.metadata?.method).toBe('CreateSession');
      expect(result.metadata?.streaming).toBe(false);
    });

    it('should execute a streaming gRPC call successfully', async () => {
      // Arrange
      const mockEvents = [
        { type: 'created', sessionId: '123' },
        { type: 'updated', sessionId: '123' },
      ];

      const mockService = {
        StreamSessionEvents: jest.fn((call) => {
          mockEvents.forEach((event) => {
            call.write(event);
          });
          call.end();
        }),
      };

      const mockHandlers = new Map();
      mockHandlers.set(
        '/mcp.control.v1.SessionService/StreamSessionEvents',
        mockService.StreamSessionEvents,
      );

      mockServer.getServer.mockReturnValue({
        handlers: mockHandlers,
      });

      // Act
      const result = await adapter.executeRequest({
        operation: {
          service: 'SessionService',
          method: 'StreamSessionEvents',
          request: { sessionId: '123' },
          streaming: true,
        },
      });

      // Assert
      expect(result.content).toHaveLength(2);
      expect(result.metadata?.streaming).toBe(true);
      expect(result.metadata?.itemCount).toBe(2);
    });

    it('should handle JWT authentication', async () => {
      // Arrange
      const mockService = {
        GetSession: jest.fn((call, callback) => {
          // Verify JWT token is in metadata
          const auth = call.metadata.get('authorization');
          expect(auth).toEqual(['Bearer test-jwt-token']);
          callback(null, { id: '123' });
        }),
      };

      const mockHandlers = new Map();
      mockHandlers.set('/mcp.control.v1.SessionService/GetSession', mockService.GetSession);

      mockServer.getServer.mockReturnValue({
        handlers: mockHandlers,
      });

      // Act
      await adapter.executeRequest({
        operation: {
          service: 'SessionService',
          method: 'GetSession',
          request: { id: '123' },
        },
        auth: {
          type: 'jwt',
          credentials: 'test-jwt-token',
        },
      });

      // Assert
      expect(mockService.GetSession).toHaveBeenCalled();
    });

    it('should handle API key authentication', async () => {
      // Arrange
      const mockService = {
        GetSession: jest.fn((call, callback) => {
          // Verify API key is in metadata
          const apiKey = call.metadata.get('x-api-key');
          expect(apiKey).toEqual(['test-api-key']);
          callback(null, { id: '123' });
        }),
      };

      const mockHandlers = new Map();
      mockHandlers.set('/mcp.control.v1.SessionService/GetSession', mockService.GetSession);

      mockServer.getServer.mockReturnValue({
        handlers: mockHandlers,
      });

      // Act
      await adapter.executeRequest({
        operation: {
          service: 'SessionService',
          method: 'GetSession',
          request: { id: '123' },
        },
        auth: {
          type: 'apikey',
          credentials: 'test-api-key',
        },
      });

      // Assert
      expect(mockService.GetSession).toHaveBeenCalled();
    });

    it('should handle gRPC errors properly', async () => {
      // Arrange
      const grpcError = new Error('Permission denied') as grpc.ServiceError;
      (grpcError as any).code = grpc.status.PERMISSION_DENIED;

      const mockService = {
        DeleteSession: jest.fn((call, callback) => {
          callback(grpcError);
        }),
      };

      const mockHandlers = new Map();
      mockHandlers.set('/mcp.control.v1.SessionService/DeleteSession', mockService.DeleteSession);

      mockServer.getServer.mockReturnValue({
        handlers: mockHandlers,
      });

      // Act
      const result = await adapter.executeRequest({
        operation: {
          service: 'SessionService',
          method: 'DeleteSession',
          request: { id: '123' },
        },
      });

      // Assert
      expect(result.metadata?.error).toBe(true);
      expect(result.metadata?.status).toBe(403); // PERMISSION_DENIED maps to 403
      expect(result.content[0].text).toContain('Permission denied');
    });

    it('should handle invalid operation parameters', async () => {
      // Act
      const result = await adapter.executeRequest({
        operation: {
          service: 'InvalidService', // Invalid service name
          method: 'SomeMethod',
        },
      });

      // Assert
      expect(result.metadata?.error).toBe(true);
      expect(result.content[0].text).toContain('error');
    });

    it('should handle service not found', async () => {
      // Arrange
      mockServer.getServer.mockReturnValue({
        handlers: new Map(),
      });

      // Act
      const result = await adapter.executeRequest({
        operation: {
          service: 'SessionService',
          method: 'CreateSession',
          request: {},
        },
      });

      // Assert
      expect(result.metadata?.error).toBe(true);
      expect(result.metadata?.status).toBe(404);
    });
  });

  describe('listEndpoints', () => {
    it('should return all available gRPC endpoints', () => {
      // Act
      const result = adapter.listEndpoints();

      // Assert
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const services = result.content[0].data as any[];
      expect(services).toHaveLength(3); // SessionService, ContextService, HealthService

      const sessionService = services.find((s) => s.name === 'SessionService');
      expect(sessionService).toBeDefined();
      expect(sessionService.methods).toContainEqual(
        expect.objectContaining({ name: 'CreateSession', type: 'unary' }),
      );
      expect(sessionService.methods).toContainEqual(
        expect.objectContaining({ name: 'StreamSessionEvents', type: 'server-streaming' }),
      );
    });
  });

  describe('getCapabilities', () => {
    it('should return gRPC adapter capabilities', () => {
      // Act
      const capabilities = adapter.getCapabilities();

      // Assert
      expect(capabilities.protocol).toBe('grpc');
      expect(capabilities.version).toBe('1.0.0');
      expect(capabilities.features).toContain('unary-calls');
      expect(capabilities.features).toContain('server-streaming');
      expect(capabilities.features).toContain('jwt-authentication');
      expect(capabilities.features).toContain('tls-support');
    });
  });

  describe('error handling', () => {
    it('should properly map gRPC status codes to HTTP status codes', async () => {
      // Test various gRPC error codes
      const testCases = [
        { grpcCode: grpc.status.UNAUTHENTICATED, expectedHttp: 401 },
        { grpcCode: grpc.status.PERMISSION_DENIED, expectedHttp: 403 },
        { grpcCode: grpc.status.NOT_FOUND, expectedHttp: 404 },
        { grpcCode: grpc.status.INVALID_ARGUMENT, expectedHttp: 400 },
        { grpcCode: grpc.status.RESOURCE_EXHAUSTED, expectedHttp: 429 },
        { grpcCode: grpc.status.INTERNAL, expectedHttp: 500 },
        { grpcCode: grpc.status.UNAVAILABLE, expectedHttp: 503 },
      ];

      for (const { grpcCode, expectedHttp } of testCases) {
        const grpcError = new Error('Test error') as grpc.ServiceError;
        (grpcError as any).code = grpcCode;

        const mockService = {
          TestMethod: jest.fn((call, callback) => {
            callback(grpcError);
          }),
        };

        const mockHandlers = new Map();
        mockHandlers.set('/mcp.control.v1.SessionService/TestMethod', mockService.TestMethod);

        mockServer.getServer.mockReturnValue({
          handlers: mockHandlers,
        });

        const result = await adapter.executeRequest({
          operation: {
            service: 'SessionService',
            method: 'TestMethod',
            request: {},
          },
        });

        expect(result.metadata?.status).toBe(expectedHttp);
      }
    });

    it('should handle AppError instances', async () => {
      // Arrange
      const appError = new AppError('Custom app error', 422, 'VALIDATION_ERROR');

      const mockService = {
        CreateSession: jest.fn(() => {
          throw appError;
        }),
      };

      const mockHandlers = new Map();
      mockHandlers.set('/mcp.control.v1.SessionService/CreateSession', mockService.CreateSession);

      mockServer.getServer.mockReturnValue({
        handlers: mockHandlers,
      });

      // Act
      const result = await adapter.executeRequest({
        operation: {
          service: 'SessionService',
          method: 'CreateSession',
          request: {},
        },
      });

      // Assert
      expect(result.metadata?.error).toBe(true);
      expect(result.metadata?.status).toBe(422);
      expect(result.content[0].text).toContain('VALIDATION_ERROR');
      expect(result.content[0].text).toContain('Custom app error');
    });
  });
});
