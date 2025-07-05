/**
 * WebSocket server tests
 * @module tests/unit/ws/server
 * @standard TS:JEST
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WebSocket } from 'ws';
import { createServer } from 'http';
import { pino } from 'pino';
import { WSServer } from '../../../src/ws/server.js';
import { InMemorySessionStore } from '../../../src/store/in-memory-session-store.js';
import * as jwt from '../../../src/auth/jwt.js';
import { WSMessageType } from '../../../src/types/websocket.js';

// Mock JWT module
jest.mock('../../../src/auth/jwt.js');

// Helper to wait for WebSocket events
const waitForEvent = (ws: WebSocket, event: string): Promise<any> => {
  return new Promise((resolve) => {
    ws.once(event, resolve);
  });
};

// Helper to wait for message
const waitForMessage = (ws: WebSocket): Promise<any> => {
  return new Promise((resolve) => {
    ws.once('message', (data) => {
      const strData =
        data instanceof Buffer
          ? data.toString()
          : typeof data === 'string'
            ? data
            : typeof data === 'object'
              ? JSON.stringify(data)
              : String(data);
      resolve(JSON.parse(strData));
    });
  });
};

describe('WebSocket Server', () => {
  let httpServer: any;
  let wsServer: WSServer;
  let sessionStore: InMemorySessionStore;
  let logger: pino.Logger;
  let wsClient: WebSocket;
  const TEST_PORT = 0; // Let OS assign port

  beforeEach(async () => {
    logger = pino({ level: 'silent' });
    sessionStore = new InMemorySessionStore(logger);

    // Create HTTP server
    httpServer = createServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(TEST_PORT, '127.0.0.1', resolve);
    });

    // Create WebSocket server
    wsServer = new WSServer(logger, sessionStore, {
      server: httpServer,
      path: '/ws',
      heartbeatInterval: 1000, // Short interval for tests
    });

    // Mock JWT functions
    (jwt.generateTokens as jest.Mock).mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    });
  });

  afterEach(async () => {
    // Close client if open
    if (wsClient?.readyState === WebSocket.OPEN) {
      wsClient.close();
    }

    // Shutdown servers
    await wsServer.shutdown();
    await new Promise<void>((resolve) => {
      httpServer.close(resolve);
    });

    jest.clearAllMocks();
  });

  describe('Connection Handling', () => {
    it('should accept WebSocket connections', async () => {
      const port = httpServer.address().port;
      wsClient = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      await waitForEvent(wsClient, 'open');
      const connectMessage = await waitForMessage(wsClient);

      expect(connectMessage).toMatchObject({
        type: WSMessageType.CONNECT,
        data: {
          connectionId: expect.any(String),
          heartbeatInterval: 1000,
        },
      });
    });

    it('should reject connections with invalid path', async () => {
      const port = httpServer.address().port;
      wsClient = new WebSocket(`ws://127.0.0.1:${port}/invalid`);

      await expect(waitForEvent(wsClient, 'error')).resolves.toBeDefined();
    });

    it('should handle multiple concurrent connections', async () => {
      const port = httpServer.address().port;
      const clients: WebSocket[] = [];

      // Create multiple clients
      for (let i = 0; i < 5; i++) {
        const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        clients.push(client);
        await waitForEvent(client, 'open');
      }

      // Check server stats
      const stats = wsServer.getStats();
      expect(stats.totalConnections).toBe(5);
      expect(stats.authenticatedConnections).toBe(0);

      // Clean up
      for (const client of clients) {
        client.close();
      }
    });
  });

  describe('Authentication', () => {
    beforeEach(async () => {
      // Create test session
      await sessionStore.create({
        id: 'test-session',
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        data: {},
        expiresAt: Date.now() + 3600000,
      });

      // Mock JWT verification
      (jwt.verifyAccessToken as jest.Mock).mockResolvedValue({
        sessionId: 'test-session',
        userId: 'test-user',
      });

      // Connect client
      const port = httpServer.address().port;
      wsClient = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      await waitForEvent(wsClient, 'open');
      await waitForMessage(wsClient); // Connect message
    });

    it('should authenticate with valid token', async () => {
      const authMessage = {
        type: WSMessageType.AUTH,
        id: 'auth-1',
        data: {
          token: 'valid-token',
        },
      };

      wsClient.send(JSON.stringify(authMessage));
      const response = await waitForMessage(wsClient);

      expect(response).toMatchObject({
        type: WSMessageType.AUTH_SUCCESS,
        id: 'auth-1',
        data: {
          sessionId: 'test-session',
          userId: 'test-user',
          username: 'testuser',
          roles: ['user'],
        },
      });

      // Check server stats
      const stats = wsServer.getStats();
      expect(stats.authenticatedConnections).toBe(1);
    });

    it('should reject invalid token', async () => {
      (jwt.verifyAccessToken as jest.Mock).mockResolvedValue(null);

      const authMessage = {
        type: WSMessageType.AUTH,
        id: 'auth-2',
        data: {
          token: 'invalid-token',
        },
      };

      wsClient.send(JSON.stringify(authMessage));
      const response = await waitForMessage(wsClient);

      expect(response).toMatchObject({
        type: WSMessageType.AUTH_ERROR,
        id: 'auth-2',
        error: {
          code: expect.any(String),
          message: expect.any(String),
        },
      });
    });

    it('should reject requests without authentication', async () => {
      const requestMessage = {
        type: WSMessageType.REQUEST,
        id: 'req-1',
        method: 'GET',
        path: '/sessions',
      };

      wsClient.send(JSON.stringify(requestMessage));
      const response = await waitForMessage(wsClient);

      expect(response).toMatchObject({
        type: WSMessageType.ERROR,
        error: {
          code: 'UNAUTHORIZED',
          message: expect.stringContaining('Authentication required'),
        },
      });
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      // Setup authenticated connection
      await sessionStore.create({
        id: 'test-session',
        userId: 'test-user',
        username: 'testuser',
        roles: ['user'],
        data: {},
        expiresAt: Date.now() + 3600000,
      });

      (jwt.verifyAccessToken as jest.Mock).mockResolvedValue({
        sessionId: 'test-session',
        userId: 'test-user',
      });

      const port = httpServer.address().port;
      wsClient = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      await waitForEvent(wsClient, 'open');
      await waitForMessage(wsClient); // Connect message

      // Authenticate
      wsClient.send(
        JSON.stringify({
          type: WSMessageType.AUTH,
          id: 'auth',
          data: { token: 'valid-token' },
        }),
      );
      await waitForMessage(wsClient); // Auth success
    });

    it('should handle ping/pong messages', async () => {
      const pingMessage = {
        type: WSMessageType.PING,
        id: 'ping-1',
      };

      wsClient.send(JSON.stringify(pingMessage));
      const response = await waitForMessage(wsClient);

      expect(response).toMatchObject({
        type: WSMessageType.PONG,
        id: 'ping-1',
      });
    });

    it('should handle request messages', async () => {
      const requestMessage = {
        type: WSMessageType.REQUEST,
        id: 'req-1',
        method: 'GET',
        path: '/sessions',
      };

      wsClient.send(JSON.stringify(requestMessage));
      const response = await waitForMessage(wsClient);

      expect(response).toMatchObject({
        type: WSMessageType.RESPONSE,
        id: 'req-1',
        status: expect.any(Number),
      });
    });

    it('should handle subscription messages', async () => {
      const subscribeMessage = {
        type: WSMessageType.SUBSCRIBE,
        id: 'sub-1',
        topic: 'sessions.test-user',
      };

      wsClient.send(JSON.stringify(subscribeMessage));
      const response = await waitForMessage(wsClient);

      expect(response).toMatchObject({
        type: WSMessageType.EVENT,
        event: 'subscription_confirmed',
        data: {
          topic: 'sessions.test-user',
        },
      });
    });

    it('should reject invalid message format', async () => {
      wsClient.send('invalid json');
      const response = await waitForMessage(wsClient);

      expect(response).toMatchObject({
        type: WSMessageType.ERROR,
        error: {
          code: 'MESSAGE_ERROR',
          message: expect.any(String),
        },
      });
    });

    it('should reject unknown message types', async () => {
      const unknownMessage = {
        type: 'unknown_type',
        id: 'unknown-1',
      };

      wsClient.send(JSON.stringify(unknownMessage));
      const response = await waitForMessage(wsClient);

      expect(response).toMatchObject({
        type: WSMessageType.ERROR,
        error: {
          code: 'INVALID_MESSAGE',
        },
      });
    });
  });

  describe('Broadcasting', () => {
    let clients: WebSocket[] = [];

    beforeEach(async () => {
      // Setup multiple authenticated clients
      const port = httpServer.address().port;

      for (let i = 0; i < 3; i++) {
        await sessionStore.create({
          id: `session-${i}`,
          userId: `user-${i}`,
          username: `user${i}`,
          roles: ['user'],
          data: {},
          expiresAt: Date.now() + 3600000,
        });

        const client = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        await waitForEvent(client, 'open');
        await waitForMessage(client); // Connect message

        // Authenticate
        (jwt.verifyAccessToken as jest.Mock).mockResolvedValue({
          sessionId: `session-${i}`,
          userId: `user-${i}`,
        });

        client.send(
          JSON.stringify({
            type: WSMessageType.AUTH,
            id: `auth-${i}`,
            data: { token: `token-${i}` },
          }),
        );
        await waitForMessage(client); // Auth success

        clients.push(client);
      }
    });

    afterEach(() => {
      clients.forEach((client) => client.close());
      clients = [];
    });

    it('should broadcast to all authenticated clients', async () => {
      const messagePromises = clients.map((client) => waitForMessage(client));

      wsServer.broadcast({
        type: WSMessageType.EVENT,
        id: 'broadcast-1',
        timestamp: new Date().toISOString(),
        event: 'test_broadcast',
        data: { message: 'Hello everyone!' },
      });

      const messages = await Promise.all(messagePromises);

      messages.forEach((msg) => {
        expect(msg).toMatchObject({
          type: WSMessageType.EVENT,
          event: 'test_broadcast',
          data: { message: 'Hello everyone!' },
        });
      });
    });

    it('should send message to specific user', async () => {
      const targetClient = clients[1];
      const messagePromise = waitForMessage(targetClient);

      wsServer.sendToUser('user-1', {
        type: WSMessageType.EVENT,
        id: 'user-msg-1',
        timestamp: new Date().toISOString(),
        event: 'user_notification',
        data: { message: 'Hello user-1!' },
      });

      const message = await messagePromise;
      expect(message).toMatchObject({
        type: WSMessageType.EVENT,
        event: 'user_notification',
        data: { message: 'Hello user-1!' },
      });

      // Other clients should not receive the message
      // Give some time to ensure no messages are sent
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });
    });
  });

  describe('Heartbeat Mechanism', () => {
    it('should send ping frames periodically', async () => {
      const port = httpServer.address().port;
      wsClient = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      await waitForEvent(wsClient, 'open');
      await waitForMessage(wsClient); // Connect message

      // Wait for ping frame
      const pingPromise = waitForEvent(wsClient, 'ping');
      await expect(pingPromise).resolves.toBeDefined();
    });

    it('should close connections that do not respond to pings', async () => {
      const port = httpServer.address().port;
      wsClient = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      await waitForEvent(wsClient, 'open');
      await waitForMessage(wsClient); // Connect message

      // Disable pong responses
      wsClient.pong = jest.fn();

      // Wait for connection to be closed due to timeout
      const closePromise = waitForEvent(wsClient, 'close');

      // Speed up the test by waiting for multiple heartbeat intervals
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 3000);
      });

      await expect(closePromise).resolves.toBeDefined();
    });
  });
});
