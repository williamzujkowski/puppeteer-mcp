/**
 * Unit tests for MCP Transport Layer
 * @module tests/unit/mcp/transport
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { StdioTransport, HttpTransport, TransportType, getTransportType } from '../../../src/mcp/transport/index.js';
import { logger } from '../../../src/utils/logger.js';

// Mock dependencies
jest.mock('../../../src/utils/logger.js');
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('mock-cert-content'),
}));

describe('MCP Transport Layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MCP_TRANSPORT;
    delete process.env.MCP_HTTP_PORT;
    delete process.env.MCP_HTTP_HOST;
  });

  describe('Transport Type Detection', () => {
    it('should default to stdio transport', () => {
      expect(getTransportType()).toBe(TransportType.STDIO);
    });

    it('should detect stdio transport from environment', () => {
      process.env.MCP_TRANSPORT = 'stdio';
      expect(getTransportType()).toBe(TransportType.STDIO);
    });

    it('should detect HTTP transport from environment', () => {
      process.env.MCP_TRANSPORT = 'http';
      expect(getTransportType()).toBe(TransportType.HTTP);
    });

    it('should detect HTTP transport from websocket alias', () => {
      process.env.MCP_TRANSPORT = 'websocket';
      expect(getTransportType()).toBe(TransportType.HTTP);
    });

    it('should detect HTTP transport from ws alias', () => {
      process.env.MCP_TRANSPORT = 'ws';
      expect(getTransportType()).toBe(TransportType.HTTP);
    });
  });

  describe('StdioTransport', () => {
    let transport: StdioTransport;
    
    beforeEach(() => {
      transport = new StdioTransport();
    });
    
    afterEach(async () => {
      await transport.close();
    });

    it('should create stdio transport instance', () => {
      expect(transport).toBeDefined();
      expect(transport.getTransport()).toBeDefined();
    });

    it('should handle stdin errors', () => {
      const mockError = new Error('stdin error');
      process.stdin.emit('error', mockError);
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP stdio input error',
          error: 'stdin error',
        })
      );
    });

    it('should handle stdout errors', () => {
      const mockError = new Error('stdout error');
      process.stdout.emit('error', mockError);
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP stdio output error',
          error: 'stdout error',
        })
      );
    });

    it('should handle SIGINT signal', () => {
      const closeSpy = jest.spyOn(transport, 'close');
      process.emit('SIGINT', 'SIGINT');
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP stdio transport received SIGINT',
        })
      );
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle SIGTERM signal', () => {
      const closeSpy = jest.spyOn(transport, 'close');
      process.emit('SIGTERM', 'SIGTERM');
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP stdio transport received SIGTERM',
        })
      );
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should close transport gracefully', async () => {
      await transport.close();
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Closing MCP stdio transport',
        })
      );
    });
  });

  describe('HttpTransport', () => {
    let transport: HttpTransport;
    
    afterEach(async () => {
      if (transport) {
        try {
          await transport.stop();
        } catch (error) {
          // Transport might not be started
        }
      }
    });

    it('should create HTTP transport with default config', () => {
      transport = new HttpTransport();
      expect(transport).toBeDefined();
      expect(transport.getHttpServer()).toBeDefined();
      expect(transport.getWebSocketServer()).toBeDefined();
    });

    it('should create HTTP transport with custom config', () => {
      transport = new HttpTransport({
        port: 3002,
        host: '0.0.0.0',
        useTls: false,
      });
      expect(transport).toBeDefined();
    });

    it('should create HTTPS transport when TLS enabled', () => {
      transport = new HttpTransport({
        useTls: true,
        tlsCertPath: '/path/to/cert',
        tlsKeyPath: '/path/to/key',
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Creating HTTPS server for MCP',
        })
      );
    });

    it('should throw error when TLS enabled without cert paths', () => {
      expect(() => {
        new HttpTransport({
          useTls: true,
        });
      }).toThrow('TLS certificate and key paths required when TLS is enabled');
    });

    it('should start HTTP transport', async () => {
      transport = new HttpTransport({ port: 0 }); // Use port 0 for random available port
      
      const startPromise = transport.start();
      
      // Simulate server listening
      const server = transport.getHttpServer();
      server.emit('listening');
      
      await startPromise;
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP HTTP transport started',
        })
      );
    });

    it('should handle WebSocket connections', async () => {
      transport = new HttpTransport({ port: 0 });
      
      const wsServer = transport.getWebSocketServer();
      const mockWs = {
        on: jest.fn(),
        close: jest.fn(),
      };
      const mockRequest = {
        socket: {
          remoteAddress: '127.0.0.1',
        },
      };
      
      // Simulate WebSocket connection
      wsServer.emit('connection', mockWs, mockRequest);
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP HTTP transport connection established',
          clientIp: '127.0.0.1',
        })
      );
      
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should handle WebSocket errors', () => {
      transport = new HttpTransport({ port: 0 });
      
      const wsServer = transport.getWebSocketServer();
      const mockError = new Error('WebSocket server error');
      
      wsServer.emit('error', mockError);
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP WebSocket server error',
          error: 'WebSocket server error',
        })
      );
    });

    it('should stop HTTP transport gracefully', async () => {
      transport = new HttpTransport({ port: 0 });
      
      // Mock server close methods
      const httpServer = transport.getHttpServer();
      const wsServer = transport.getWebSocketServer();
      
      jest.spyOn(wsServer, 'close').mockImplementation((callback) => {
        if (callback) {callback();}
      });
      
      jest.spyOn(httpServer, 'close').mockImplementation((callback) => {
        if (callback) {callback();}
        return httpServer;
      });
      
      await transport.stop();
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Stopping MCP HTTP transport',
        })
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP WebSocket server closed',
        })
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP HTTP server closed',
        })
      );
    });
  });

  describe('Factory Functions', () => {
    it('should create stdio transport using factory', async () => {
      const transportModule = await import('../../../src/mcp/transport/index.js');
      const transport = transportModule.createStdioTransport();
      expect(transport).toBeInstanceOf(StdioTransport);
    });

    it('should create HTTP transport using factory', async () => {
      const transportModule = await import('../../../src/mcp/transport/index.js');
      const transport = transportModule.createHttpTransport({ port: 0 });
      expect(transport).toBeInstanceOf(HttpTransport);
    });
  });
});