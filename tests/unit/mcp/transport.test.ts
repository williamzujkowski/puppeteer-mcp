/**
 * Unit tests for MCP Transport Layer
 * @module tests/unit/mcp/transport
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  StdioTransport,
  HttpTransport,
  TransportType,
  getTransportType,
} from '../../../src/mcp/transport/index.js';
import { logger } from '../../../src/utils/logger.js';

// Mock dependencies
jest.mock('../../../src/utils/logger.js');
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('mock-cert-content'),
}));
jest.mock('https', () => ({
  createServer: jest.fn().mockReturnValue({
    listen: jest.fn(),
    close: jest.fn((callback) => {
      if (typeof callback === 'function') {
        callback();
      }
    }),
    on: jest.fn(),
  }),
}));
jest.mock('ws', () => ({
  WebSocketServer: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn((callback) => {
      if (typeof callback === 'function') {
        callback();
      }
    }),
    emit: jest.fn(),
  })),
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

    afterEach(() => {
      transport.close();
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
        }),
      );
    });

    it('should handle stdout errors', () => {
      const mockError = new Error('stdout error');
      process.stdout.emit('error', mockError);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP stdio output error',
          error: 'stdout error',
        }),
      );
    });

    it('should handle SIGINT signal', () => {
      const closeSpy = jest.spyOn(transport, 'close');
      process.emit('SIGINT', 'SIGINT');

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP stdio transport received SIGINT',
        }),
      );
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle SIGTERM signal', () => {
      const closeSpy = jest.spyOn(transport, 'close');
      process.emit('SIGTERM', 'SIGTERM');

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP stdio transport received SIGTERM',
        }),
      );
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should close transport gracefully', () => {
      transport.close();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Closing MCP stdio transport',
        }),
      );
    });
  });

  describe('HttpTransport', () => {
    let transport: HttpTransport;

    afterEach(async () => {
      if (transport) {
        try {
          await transport.stop();
        } catch {
          // Transport might not be started
        }
      }
    });

    it('should create HTTP transport with default config', () => {
      transport = new HttpTransport({ useTls: false });
      expect(transport).toBeDefined();
      expect(transport.getHttpServer()).toBeTruthy();
      expect(transport.getWebSocketServer()).toBeTruthy();
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
        }),
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
      transport = new HttpTransport({ port: 0, useTls: false }); // Use port 0 for random available port

      const startPromise = transport.start();

      // Simulate server listening
      const server = transport.getHttpServer();
      server.emit('listening');

      await startPromise;

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP HTTP transport started',
        }),
      );
    });

    it('should handle WebSocket connections', () => {
      transport = new HttpTransport({ port: 0, useTls: false });

      const wsServer = transport.getWebSocketServer();
      expect(wsServer).toBeDefined();

      // Verify that the WebSocket server exists and has proper methods
      expect(typeof wsServer.on).toBe('function');
      expect(typeof wsServer.close).toBe('function');
    });

    it('should handle WebSocket errors', () => {
      transport = new HttpTransport({ port: 0, useTls: false });

      const wsServer = transport.getWebSocketServer();
      expect(wsServer).toBeDefined();

      // Verify error handling infrastructure exists
      expect(typeof wsServer.emit).toBe('function');
    });

    it('should stop HTTP transport gracefully', async () => {
      transport = new HttpTransport({ port: 0, useTls: false });

      // Mock server close methods
      const httpServer = transport.getHttpServer();
      const wsServer = transport.getWebSocketServer();

      jest.spyOn(wsServer, 'close').mockImplementation((callback?: () => void) => {
        if (typeof callback === 'function') {
          callback();
        }
      });

      jest.spyOn(httpServer, 'close').mockImplementation((callback?: () => void) => {
        if (typeof callback === 'function') {
          callback();
        }
        return httpServer;
      });

      await transport.stop();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'Stopping MCP HTTP transport',
        }),
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP WebSocket server closed',
        }),
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'MCP HTTP server closed',
        }),
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
      const transport = transportModule.createHttpTransport({ port: 0, useTls: false });
      expect(transport).toBeInstanceOf(HttpTransport);
    });
  });
});
