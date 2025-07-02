/**
 * HTTP Transport for MCP Server
 * @module mcp/transport/http
 * @description Handles MCP communication via HTTP/HTTPS
 */

import { createServer, Server as HttpServer } from 'http';
import { createServer as createHttpsServer, Server as HttpsServer } from 'https';
import { readFileSync } from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '@utils/logger.js';
import { config } from '@core/config.js';

interface HttpTransportConfig {
  port: number;
  host: string;
  useTls: boolean;
  tlsCertPath?: string;
  tlsKeyPath?: string;
}

/**
 * HTTP/WebSocket transport for MCP
 * @nist sc-8 "Transmission confidentiality and integrity"
 * @nist au-3 "Content of audit records"
 */
export class HttpTransport {
  private server: HttpServer | HttpsServer;
  private wsServer: WebSocketServer;
  private config: HttpTransportConfig;
  private connections = new Set<WebSocket>();

  constructor(transportConfig?: Partial<HttpTransportConfig>) {
    this.config = {
      port: transportConfig?.port ?? parseInt(process.env.MCP_HTTP_PORT ?? '3001'),
      host: transportConfig?.host ?? process.env.MCP_HTTP_HOST ?? 'localhost',
      useTls: transportConfig?.useTls ?? config.TLS_ENABLED,
      tlsCertPath: transportConfig?.tlsCertPath ?? config.TLS_CERT_PATH,
      tlsKeyPath: transportConfig?.tlsKeyPath ?? config.TLS_KEY_PATH,
    };

    this.server = this.createServer();
    this.wsServer = new WebSocketServer({ server: this.server });
    this.setupWebSocketHandlers();
  }

  /**
   * Create HTTP or HTTPS server based on configuration
   */
  private createServer(): HttpServer | HttpsServer {
    if (this.config.useTls) {
      if (!this.config.tlsCertPath || !this.config.tlsKeyPath) {
        throw new Error('TLS certificate and key paths required when TLS is enabled');
      }

      const tlsOptions = {
        cert: readFileSync(this.config.tlsCertPath),
        key: readFileSync(this.config.tlsKeyPath),
      };

      logger.info({
        msg: 'Creating HTTPS server for MCP',
        port: this.config.port,
        host: this.config.host,
        timestamp: new Date().toISOString(),
      });

      return createHttpsServer(tlsOptions);
    }

    logger.info({
      msg: 'Creating HTTP server for MCP',
      port: this.config.port,
      host: this.config.host,
      timestamp: new Date().toISOString(),
    });

    return createServer();
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    this.wsServer.on('connection', (ws, request) => {
      const clientIp = request.socket.remoteAddress;
      
      logger.info({
        msg: 'MCP HTTP transport connection established',
        clientIp,
        timestamp: new Date().toISOString(),
      });

      this.connections.add(ws);

      ws.on('error', (error) => {
        logger.error({
          msg: 'MCP WebSocket error',
          error: error.message,
          clientIp,
          timestamp: new Date().toISOString(),
        });
      });

      ws.on('close', () => {
        logger.info({
          msg: 'MCP WebSocket connection closed',
          clientIp,
          timestamp: new Date().toISOString(),
        });
        this.connections.delete(ws);
      });
    });

    this.wsServer.on('error', (error) => {
      logger.error({
        msg: 'MCP WebSocket server error',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Start the HTTP transport
   */
  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        logger.info({
          msg: 'MCP HTTP transport started',
          url: `${this.config.useTls ? 'https' : 'http'}://${this.config.host}:${this.config.port}`,
          timestamp: new Date().toISOString(),
        });
        resolve();
      });

      this.server.on('error', (error) => {
        logger.error({
          msg: 'MCP HTTP server error',
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        reject(error);
      });
    });
  }

  /**
   * Stop the HTTP transport
   */
  async stop(): Promise<void> {
    logger.info({
      msg: 'Stopping MCP HTTP transport',
      timestamp: new Date().toISOString(),
    });

    // Close all WebSocket connections
    for (const ws of this.connections) {
      ws.close();
    }
    this.connections.clear();

    // Close WebSocket server
    await new Promise<void>((resolve) => {
      this.wsServer.close(() => {
        logger.info({
          msg: 'MCP WebSocket server closed',
          timestamp: new Date().toISOString(),
        });
        resolve();
      });
    });

    // Close HTTP server
    await new Promise<void>((resolve) => {
      this.server.close(() => {
        logger.info({
          msg: 'MCP HTTP server closed',
          timestamp: new Date().toISOString(),
        });
        resolve();
      });
    });
  }

  /**
   * Get the WebSocket server instance
   */
  getWebSocketServer(): WebSocketServer {
    return this.wsServer;
  }

  /**
   * Get the HTTP server instance
   */
  getHttpServer(): HttpServer | HttpsServer {
    return this.server;
  }
}

/**
 * Factory function to create HTTP transport
 */
export function createHttpTransport(config?: Partial<HttpTransportConfig>): HttpTransport {
  return new HttpTransport(config);
}