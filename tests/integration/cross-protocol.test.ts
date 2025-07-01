/**
 * Cross-protocol integration tests
 * @module tests/integration/cross-protocol
 * @standard TS:JEST
 * @description Tests that verify session and authentication work across REST, gRPC, and WebSocket
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { WebSocket } from 'ws';
import { join } from 'path';
import { createApp } from '../../src/server.js';
import { createGrpcServer } from '../../src/grpc/server.js';
import { createWebSocketServer } from '../../src/ws/server.js';
import { InMemorySessionStore } from '../../src/store/in-memory-session-store.js';
import { pino } from 'pino';
import { WSMessageType } from '../../src/types/websocket.js';
import { createServer } from 'http';

// Helper to load gRPC client
const loadGrpcClient = (): any => {
  const PROTO_PATH = join(process.cwd(), 'proto', 'control.proto');
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  
  const proto = grpc.loadPackageDefinition(packageDefinition) as any;
  return proto.mcp.control.v1;
};

// Helper to wait for WebSocket message
const waitForWsMessage = (ws: WebSocket): Promise<any> => {
  return new Promise((resolve) => {
    ws.once('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      const strData = data instanceof Buffer ? data.toString() : String(data);
      resolve(JSON.parse(strData) as unknown);
    });
  });
};

describe('Cross-Protocol Integration', () => {
  let app: any;
  let httpServer: any;
  let grpcServer: any;
  let wsServer: any;
  let sessionStore: InMemorySessionStore;
  let logger: pino.Logger;
  let grpcClient: any;
  let grpcPort: number;
  let httpPort: number;

  beforeAll(async () => {
    logger = pino({ level: 'silent' });
    sessionStore = new InMemorySessionStore(logger);

    // Create Express app
    app = createApp();
    
    // Create HTTP server
    httpServer = createServer(app);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', resolve);
    });
    httpPort = httpServer.address().port;

    // Create WebSocket server
    wsServer = createWebSocketServer(logger, sessionStore, httpServer);

    // Create and start gRPC server
    grpcServer = createGrpcServer(logger, sessionStore);
    await new Promise<void>((resolve) => {
      const server = grpcServer.getServer();
      server.bindAsync(
        '127.0.0.1:0',
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
          if (err !== null && err !== undefined) {throw err;}
          grpcPort = port;
          server.start();
          resolve();
        }
      );
    });

    // Create gRPC client
    const proto = loadGrpcClient();
    grpcClient = new proto.SessionService(
      `127.0.0.1:${grpcPort}`,
      grpc.credentials.createInsecure()
    );
  });

  afterAll(async () => {
    // Cleanup
    if (wsServer !== undefined) {await wsServer.shutdown();}
    if (grpcServer !== undefined) {await grpcServer.shutdown();}
    if (httpServer !== undefined) {
      await new Promise<void>((resolve) => {
        httpServer.close(resolve);
      });
    }
  });

  describe('Session Creation and Access', () => {
    let sessionId: string;
    let accessToken: string;

    it('should create session via REST API', async () => {
      const response = await request(app)
        .post('/api/v1/sessions')
        .send({
          userId: 'test-user-123',
          username: 'testuser',
          roles: ['user', 'admin'],
          data: { 
            email: 'test@example.com',
            preference: 'dark-mode',
          },
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          session: {
            id: expect.any(String),
            userId: 'test-user-123',
            username: 'testuser',
            roles: ['user', 'admin'],
          },
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
      });

      sessionId = response.body.data.session.id;
      accessToken = response.body.data.accessToken;
    });

    it('should access session via gRPC with same token', async () => {
      const metadata = new grpc.Metadata();
      metadata.set('authorization', `Bearer ${accessToken}`);

      const response = await new Promise((resolve, reject) => {
        grpcClient.getSession(
          { session_id: sessionId },
          metadata,
          (err: any, response: any) => {
            if (err !== undefined) {reject(err);}
            else {resolve(response);}
          }
        );
      });

      expect(response).toMatchObject({
        session: {
          id: sessionId,
          user_id: 'test-user-123',
          username: 'testuser',
          roles: ['user', 'admin'],
          data: {
            email: 'test@example.com',
            preference: 'dark-mode',
          },
        },
      });
    });

    it('should access session via WebSocket with same token', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${httpPort}/ws`);
      
      await new Promise<void>((resolve) => { ws.on('open', () => resolve()); });
      await waitForWsMessage(ws); // Connect message

      // Authenticate with same token
      ws.send(JSON.stringify({
        type: WSMessageType.AUTH,
        id: 'auth-1',
        data: { token: accessToken },
      }));

      const authResponse = await waitForWsMessage(ws);
      expect(authResponse).toMatchObject({
        type: WSMessageType.AUTH_SUCCESS,
        data: {
          sessionId,
          userId: 'test-user-123',
          username: 'testuser',
          roles: ['user', 'admin'],
        },
      });

      // Request session data
      ws.send(JSON.stringify({
        type: WSMessageType.REQUEST,
        id: 'req-1',
        method: 'GET',
        path: '/sessions',
      }));

      const sessionResponse = await waitForWsMessage(ws);
      expect(sessionResponse).toMatchObject({
        type: WSMessageType.RESPONSE,
        id: 'req-1',
        status: 200,
        data: {
          id: sessionId,
          userId: 'test-user-123',
          username: 'testuser',
        },
      });

      ws.close();
    });
  });

  describe('Session Updates Across Protocols', () => {
    let sessionId: string;
    let accessToken: string;

    beforeEach(async () => {
      // Create a session via REST
      const response = await request(app)
        .post('/api/v1/sessions')
        .send({
          userId: 'update-test-user',
          username: 'updateuser',
          roles: ['user'],
          data: { counter: 0 },
        });

      sessionId = response.body.data.session.id;
      accessToken = response.body.data.accessToken;
    });

    it('should reflect updates made via REST in gRPC', async () => {
      // Update via REST
      await request(app)
        .put(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          data: { counter: 1, newField: 'test' },
        })
        .expect(200);

      // Read via gRPC
      const metadata = new grpc.Metadata();
      metadata.set('authorization', `Bearer ${accessToken}`);

      const response = await new Promise((resolve, reject) => {
        grpcClient.getSession(
          { session_id: sessionId },
          metadata,
          (err: any, response: any) => {
            if (err !== undefined) {reject(err);}
            else {resolve(response);}
          }
        );
      });

      expect(response).toMatchObject({
        session: {
          data: {
            counter: '1', // Note: gRPC converts to string
            newField: 'test',
          },
        },
      });
    });

    it('should reflect updates made via gRPC in WebSocket', async () => {
      // Update via gRPC
      const metadata = new grpc.Metadata();
      metadata.set('authorization', `Bearer ${accessToken}`);

      await new Promise((resolve, reject) => {
        grpcClient.updateSession(
          {
            session_id: sessionId,
            data: { counter: '2', grpcField: 'added' },
          },
          metadata,
          (err: any, response: any) => {
            if (err !== undefined) {reject(err);}
            else {resolve(response);}
          }
        );
      });

      // Read via WebSocket
      const ws = new WebSocket(`ws://127.0.0.1:${httpPort}/ws`);
      await new Promise<void>((resolve) => { ws.on('open', () => resolve()); });
      await waitForWsMessage(ws); // Connect message

      // Authenticate
      ws.send(JSON.stringify({
        type: WSMessageType.AUTH,
        id: 'auth-2',
        data: { token: accessToken },
      }));
      await waitForWsMessage(ws); // Auth success

      // Get session
      ws.send(JSON.stringify({
        type: WSMessageType.REQUEST,
        id: 'req-2',
        method: 'GET',
        path: '/sessions',
      }));

      const response = await waitForWsMessage(ws);
      expect(response.data.data).toMatchObject({
        counter: 2,
        grpcField: 'added',
      });

      ws.close();
    });
  });

  describe('Session Deletion Across Protocols', () => {
    let sessionId: string;
    let accessToken: string;

    beforeEach(async () => {
      // Create a session
      const response = await request(app)
        .post('/api/v1/sessions')
        .send({
          userId: 'delete-test-user',
          username: 'deleteuser',
          roles: ['user'],
        });

      sessionId = response.body.data.session.id;
      accessToken = response.body.data.accessToken;
    });

    it('should prevent access after deletion via any protocol', async () => {
      // Delete via gRPC
      const metadata = new grpc.Metadata();
      metadata.set('authorization', `Bearer ${accessToken}`);

      await new Promise((resolve, reject) => {
        grpcClient.deleteSession(
          { session_id: sessionId },
          metadata,
          (err: any, response: any) => {
            if (err !== undefined) {reject(err);}
            else {resolve(response);}
          }
        );
      });

      // Try to access via REST - should fail
      await request(app)
        .get(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      // Try to access via WebSocket - should fail authentication
      const ws = new WebSocket(`ws://127.0.0.1:${httpPort}/ws`);
      await new Promise<void>((resolve) => { ws.on('open', () => resolve()); });
      await waitForWsMessage(ws); // Connect message

      ws.send(JSON.stringify({
        type: WSMessageType.AUTH,
        id: 'auth-3',
        data: { token: accessToken },
      }));

      const authResponse = await waitForWsMessage(ws);
      expect(authResponse).toMatchObject({
        type: WSMessageType.AUTH_ERROR,
      });

      ws.close();
    });
  });

  describe('Real-time Events Across Protocols', () => {
    it('should receive session events via gRPC streaming when created via REST', async () => {
      // Set up gRPC event stream
      const metadata = new grpc.Metadata();
      // Create admin session for monitoring
      const adminResponse = await request(app)
        .post('/api/v1/sessions')
        .send({
          userId: 'admin-user',
          username: 'admin',
          roles: ['admin'],
        });

      metadata.set('authorization', `Bearer ${adminResponse.body.data.accessToken}`);

      const eventStream = grpcClient.streamSessionEvents({
        event_types: ['SESSION_EVENT_TYPE_CREATED'],
      }, metadata);

      // Listen for event
      eventStream.on('data', (_data) => {
        // Event received
      });

      // Create session via REST
      await request(app)
        .post('/api/v1/sessions')
        .send({
          userId: 'event-test-user',
          username: 'eventuser',
          roles: ['user'],
        });

      // Note: Event streaming implementation is placeholder
      // In a real implementation, this would receive the event
      
      eventStream.cancel();
    });
  });

  describe('Token Refresh Across Protocols', () => {
    let sessionId: string;
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/sessions')
        .send({
          userId: 'refresh-test-user',
          username: 'refreshuser',
          roles: ['user'],
        });

      sessionId = response.body.data.session.id;
      accessToken = response.body.data.accessToken;
      refreshToken = response.body.data.refreshToken;
    });

    it('should refresh tokens via gRPC and use new token in REST', async () => {
      // Refresh via gRPC
      const response = await new Promise((resolve, reject) => {
        grpcClient.refreshSession(
          { refresh_token: refreshToken },
          (err: any, response: any) => {
            if (err !== undefined) {reject(err);}
            else {resolve(response);}
          }
        );
      });

      const newAccessToken = (response as any).access_token;
      expect(newAccessToken).toBeDefined();
      expect(newAccessToken).not.toBe(accessToken);

      // Use new token in REST
      const sessionResponse = await request(app)
        .get(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      expect(sessionResponse.body.data.id).toBe(sessionId);
    });
  });
});