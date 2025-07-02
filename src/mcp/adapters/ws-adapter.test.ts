/**
 * WebSocket Adapter Tests
 * @module mcp/adapters/ws-adapter.test
 * @description Unit tests for the WebSocket MCP adapter
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { WebSocket } from 'ws';
import { pino } from 'pino';
import { WebSocketAdapter } from './ws-adapter.js';
import { WSConnectionManager } from '../../ws/connection-manager.js';
import { WSSubscriptionManager } from '../../ws/subscription-manager.js';
import { AppError } from '../../core/errors/app-error.js';
import { WSMessageType } from '../../types/websocket.js';
import type { AuthParams } from './adapter.interface.js';

// Mock dependencies
jest.mock('ws');
jest.mock('../../utils/logger.js', () => ({
  logSecurityEvent: jest.fn(),
  SecurityEventType: {
    API_ACCESS: 'API_ACCESS',
    AUTH_SUCCESS: 'AUTH_SUCCESS',
  },
}));

describe('WebSocketAdapter', () => {
  let adapter: WebSocketAdapter;
  let mockLogger: pino.Logger;
  let mockConnectionManager: jest.Mocked<WSConnectionManager>;
  let mockSubscriptionManager: jest.Mocked<WSSubscriptionManager>;

  beforeEach(() => {
    // Create mock logger
    mockLogger = pino({ level: 'silent' });

    // Create mock connection manager
    mockConnectionManager = {
      addConnection: jest.fn(),
      removeConnection: jest.fn(),
      getConnection: jest.fn(),
      getConnectionState: jest.fn(),
      getWebSocket: jest.fn(),
      authenticateConnection: jest.fn(),
      getAllConnections: jest.fn(),
      getConnectionsByUser: jest.fn(),
      getConnectionsBySession: jest.fn(),
      addSubscription: jest.fn().mockReturnValue(true),
      removeSubscription: jest.fn().mockReturnValue(true),
      getConnectionsByTopic: jest.fn(),
      getStats: jest.fn(),
      cleanupStaleConnections: jest.fn(),
    } as any;

    // Create mock subscription manager
    mockSubscriptionManager = {
      handleSubscriptionMessage: jest.fn(),
      broadcastEvent: jest.fn(),
    } as any;

    // Create adapter instance
    adapter = new WebSocketAdapter(mockLogger, mockConnectionManager, mockSubscriptionManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeRequest', () => {
    it('should handle subscribe operation', async () => {
      // Mock WebSocket connection creation BEFORE creating params
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        close: jest.fn(),
      } as any;
      
      // Override the createWebSocketConnection method to return our mock
      jest.spyOn(adapter as any, 'createWebSocketConnection').mockResolvedValue(mockWs);
      jest.spyOn(adapter as any, 'authenticateConnection').mockResolvedValue(undefined);

      const params = {
        operation: {
          type: 'subscribe',
          topic: 'sessions.user123',
          filters: { status: 'active' },
          duration: 60000,
        },
        auth: {
          type: 'jwt',
          credentials: 'test-token',
        } as AuthParams,
        sessionId: 'test-session',
      };

      const result = await adapter.executeRequest(params);

      expect(result.content[0].text).toContain('Subscribed to sessions.user123');
      expect(result.metadata?.topic).toBe('sessions.user123');
      expect(result.metadata?.duration).toBe(60000);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockConnectionManager.addSubscription).toHaveBeenCalled();
    });

    it('should handle unsubscribe operation', async () => {
      // Mock existing connection with subscription
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        close: jest.fn(),
      } as any;

      jest.spyOn(adapter as any, 'createWebSocketConnection').mockResolvedValue(mockWs);
      jest.spyOn(adapter as any, 'authenticateConnection').mockResolvedValue(undefined);
      
      const params = {
        operation: {
          type: 'unsubscribe',
          topic: 'sessions.user123',
        },
        sessionId: 'test-session',
      };
      
      // Pre-populate a subscription
      const connection = await (adapter as any).ensureConnection(undefined, params.sessionId);
      connection.subscriptions.set('sub-123', {
        topic: 'sessions.user123',
        handler: jest.fn(),
      });

      const result = await adapter.executeRequest(params);

      expect(result.content[0].text).toContain('Unsubscribed from sessions.user123');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockConnectionManager.removeSubscription).toHaveBeenCalled();
    });

    it('should handle send operation', async () => {
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        close: jest.fn(),
      } as any;

      jest.spyOn(adapter as any, 'createWebSocketConnection').mockResolvedValue(mockWs);
      jest.spyOn(adapter as any, 'authenticateConnection').mockResolvedValue(undefined);

      const params = {
        operation: {
          type: 'send',
          event: 'test-event',
          topic: '/test',
          data: { message: 'Hello' },
          timeout: 5000,
        },
        sessionId: 'test-session',
      };

      // Mock response handling
      const sendRequestSpy = jest.spyOn(adapter as any, 'sendRequestAndWaitForResponse')
        .mockResolvedValue({
          content: [{ type: 'text', text: 'Response received' }],
          metadata: { status: 200 },
        });

      const result = await adapter.executeRequest(params);

      expect(sendRequestSpy).toHaveBeenCalled();
      expect(result.content[0].text).toBe('Response received');
    });

    it('should handle broadcast operation', async () => {
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        close: jest.fn(),
      } as any;

      jest.spyOn(adapter as any, 'createWebSocketConnection').mockResolvedValue(mockWs);
      jest.spyOn(adapter as any, 'authenticateConnection').mockResolvedValue(undefined);

      const params = {
        operation: {
          type: 'broadcast',
          topic: 'system.alerts',
          event: 'maintenance',
          data: { message: 'System maintenance scheduled' },
        },
        sessionId: 'test-session',
      };

      const result = await adapter.executeRequest(params);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockSubscriptionManager.broadcastEvent).toHaveBeenCalledWith(
        'system.alerts',
        'maintenance',
        { message: 'System maintenance scheduled' }
      );
      expect(result.content[0].text).toContain('Broadcast sent to topic system.alerts');
    });

    it('should throw error for invalid operation', async () => {
      const params = {
        operation: {
          type: 'invalid',
        },
        sessionId: 'test-session',
      };

      await expect(adapter.executeRequest(params)).rejects.toThrow();
    });

    it('should throw error for missing topic in subscribe', async () => {
      const params = {
        operation: {
          type: 'subscribe',
        },
        sessionId: 'test-session',
      };

      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
      } as any;

      jest.spyOn(adapter as any, 'createWebSocketConnection').mockResolvedValue(mockWs);

      await expect(adapter.executeRequest(params)).rejects.toThrow(AppError);
      await expect(adapter.executeRequest(params)).rejects.toThrow('Topic is required for subscription');
    });
  });

  describe('listEndpoints', () => {
    it('should return available WebSocket operations', async () => {
      const result = await adapter.listEndpoints();

      expect(result.content[0].type).toBe('text');
      const endpoints = JSON.parse(result.content[0].text as string);
      
      expect(endpoints.endpoints).toHaveLength(4);
      expect(endpoints.endpoints.map((e: any) => e.operation)).toEqual([
        'subscribe',
        'unsubscribe',
        'send',
        'broadcast',
      ]);
    });
  });

  describe('getCapabilities', () => {
    it('should return WebSocket capabilities', async () => {
      const capabilities = await adapter.getCapabilities();

      expect(capabilities.protocol).toBe('websocket');
      expect(capabilities.version).toBe('1.0.0');
      expect(capabilities.features).toContain('real-time-messaging');
      expect(capabilities.features).toContain('pub-sub');
      expect(capabilities.features).toContain('authentication');
      expect(capabilities.authentication).toEqual(['jwt', 'apikey']);
    });
  });

  describe('message handling', () => {
    it('should handle response messages', async () => {
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
      } as any;

      jest.spyOn(adapter as any, 'createWebSocketConnection').mockResolvedValue(mockWs);

      const connection = await (adapter as any).ensureConnection(undefined, 'test-session');
      
      // Set up pending request
      const requestId = 'req-123';
      const resolveSpy = jest.fn();
      const rejectSpy = jest.fn();
      const timeout = setTimeout(() => {}, 1000);
      
      connection.pendingRequests.set(requestId, {
        resolve: resolveSpy,
        reject: rejectSpy,
        timeout,
      });

      // Simulate response message
      const responseMessage = {
        type: WSMessageType.RESPONSE,
        id: requestId,
        status: 200,
        data: { result: 'success' },
        timestamp: new Date().toISOString(),
      };

      (adapter as any).handleResponseMessage(connection, responseMessage);

      expect(resolveSpy).toHaveBeenCalledWith({
        content: [{ type: 'text', text: JSON.stringify({ result: 'success' }) }],
        metadata: {
          status: 200,
          timestamp: responseMessage.timestamp,
          requestId,
        },
      });
      expect(connection.pendingRequests.has(requestId)).toBe(false);
    });

    it('should handle event messages for subscriptions', async () => {
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
      } as any;

      jest.spyOn(adapter as any, 'createWebSocketConnection').mockResolvedValue(mockWs);

      const connection = await (adapter as any).ensureConnection(undefined, 'test-session');
      
      // Set up subscription
      const handlerSpy = jest.fn();
      connection.subscriptions.set('sub-123', {
        topic: 'sessions.updates',
        handler: handlerSpy,
      });

      // Simulate event message
      const eventMessage = {
        type: WSMessageType.EVENT,
        event: 'session_updated',
        data: {
          topic: 'sessions.updates',
          data: { sessionId: 'sess-123', status: 'active' },
        },
      };

      (adapter as any).handleEventMessage(connection, eventMessage);

      expect(handlerSpy).toHaveBeenCalledWith({ sessionId: 'sess-123', status: 'active' });
    });

    it('should handle error messages', async () => {
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
      } as any;

      jest.spyOn(adapter as any, 'createWebSocketConnection').mockResolvedValue(mockWs);

      const connection = await (adapter as any).ensureConnection(undefined, 'test-session');
      
      // Set up pending request
      const requestId = 'req-123';
      const resolveSpy = jest.fn();
      const rejectSpy = jest.fn();
      const timeout = setTimeout(() => {}, 1000);
      
      connection.pendingRequests.set(requestId, {
        resolve: resolveSpy,
        reject: rejectSpy,
        timeout,
      });

      // Simulate error message
      const errorMessage = {
        type: WSMessageType.ERROR,
        id: requestId,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request format',
        },
      };

      (adapter as any).handleErrorMessage(connection, errorMessage);

      expect(rejectSpy).toHaveBeenCalledWith(expect.any(AppError));
      expect(connection.pendingRequests.has(requestId)).toBe(false);
    });
  });

  describe('connection management', () => {
    it('should clean up connection on close', async () => {
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn((event, handler) => {
          if (event === 'close') {
            // Simulate close event
            setTimeout(() => handler(), 0);
          }
        }),
      } as any;

      jest.spyOn(adapter as any, 'createWebSocketConnection').mockResolvedValue(mockWs);

      const connectionId = 'test-session';
      await (adapter as any).ensureConnection(undefined, connectionId);

      // Wait for close handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith(connectionId);
    });

    it('should reuse existing open connection', async () => {
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
      } as any;

      const createSpy = jest.spyOn(adapter as any, 'createWebSocketConnection')
        .mockResolvedValue(mockWs);

      const sessionId = 'test-session';
      
      // First call creates connection
      const conn1 = await (adapter as any).ensureConnection(undefined, sessionId);
      
      // Second call should reuse
      const conn2 = await (adapter as any).ensureConnection(undefined, sessionId);

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(conn1).toBe(conn2);
    });
  });

  describe('streaming response', () => {
    it('should create streaming response generator', async () => {
      const subscriptionId = 'sub-123';
      const generator = adapter.createStreamingResponse(subscriptionId);

      // Emit test events
      setImmediate(() => {
        (adapter as any).eventEmitter.emit(`subscription:${subscriptionId}`, { data: 'event1' });
        (adapter as any).eventEmitter.emit(`subscription:${subscriptionId}`, { data: 'event2' });
      });

      // Collect first two events
      const events = [];
      for await (const response of generator) {
        events.push(response);
        if (events.length >= 2) {break;}
      }

      expect(events).toHaveLength(2);
      expect(JSON.parse(events[0].content[0].text as string)).toEqual({ data: 'event1' });
      expect(JSON.parse(events[1].content[0].text as string)).toEqual({ data: 'event2' });
    });
  });
});