/**
 * HTTP Transport for MCP Server
 * @module mcp/transport/http
 * @description Handles MCP communication via HTTP/HTTPS
 */

import { createServer, Server as HttpServer } from 'http';
import { createServer as createHttpsServer, Server as HttpsServer } from 'https';
import { readFileSync } from 'fs';
import { resolve, normalize } from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../../utils/logger.js';
import { config } from '../../core/config.js';

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
    this.config = this.buildConfig(transportConfig);
    this.server = this.createServer();
    this.wsServer = new WebSocketServer({ server: this.server });
    this.setupWebSocketHandlers();
  }

  /**
   * Get default port from environment or use fallback
   */
  private getDefaultPort(): number {
    return parseInt(process.env.MCP_HTTP_PORT ?? '3001');
  }

  /**
   * Get default host from environment or use fallback
   */
  private getDefaultHost(): string {
    return process.env.MCP_HTTP_HOST ?? 'localhost';
  }

  /**
   * Get configuration value with default
   */
  private getConfigValue<T>(value: T | undefined, defaultValue: T): T {
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Build configuration with defaults
   */
  private buildConfig(transportConfig?: Partial<HttpTransportConfig>): HttpTransportConfig {
    const tc = transportConfig || {};
    
    return {
      port: this.getConfigValue(tc.port, this.getDefaultPort()),
      host: this.getConfigValue(tc.host, this.getDefaultHost()),
      useTls: this.getConfigValue(tc.useTls, config.TLS_ENABLED),
      tlsCertPath: this.getConfigValue(tc.tlsCertPath, config.TLS_CERT_PATH),
      tlsKeyPath: this.getConfigValue(tc.tlsKeyPath, config.TLS_KEY_PATH),
    };
  }

  /**
   * Validate TLS path to prevent path traversal attacks
   */
  private isValidTlsPath(path: string): boolean {
    // Disallow path traversal patterns
    return !path.includes('..') && !path.includes('~');
  }

  /**
   * Check if TLS path is defined and non-empty
   */
  private isTlsPathDefined(path: string | undefined | null): path is string {
    return path !== undefined && path !== null && path !== '';
  }

  /**
   * Validate TLS configuration
   */
  private validateTlsConfig(): void {
    if (
      !this.isTlsPathDefined(this.config.tlsCertPath) ||
      !this.isTlsPathDefined(this.config.tlsKeyPath)
    ) {
      throw new Error('TLS certificate and key paths required when TLS is enabled');
    }

    // Validate paths are strings to prevent path traversal attacks
    if (typeof this.config.tlsCertPath !== 'string' || typeof this.config.tlsKeyPath !== 'string') {
      throw new Error('TLS certificate and key paths must be strings');
    }

    if (
      !this.isValidTlsPath(this.config.tlsCertPath) ||
      !this.isValidTlsPath(this.config.tlsKeyPath)
    ) {
      throw new Error('Invalid TLS certificate or key path');
    }
  }

  /**
   * Create HTTPS server with TLS
   */
  private createHttpsServer(): HttpsServer {
    this.validateTlsConfig();

    // After validation, we know these are defined strings
    const certPath = this.config.tlsCertPath as string;
    const keyPath = this.config.tlsKeyPath as string;

    // Additional runtime validation to satisfy security scanners
    if (!certPath || !keyPath) {
      throw new Error('TLS paths must be non-empty strings');
    }

    // Re-validate paths at the point of use
    if (!this.isValidTlsPath(certPath) || !this.isValidTlsPath(keyPath)) {
      throw new Error('Invalid TLS certificate or key path detected');
    }

    // Normalize and resolve paths to prevent directory traversal
    const normalizedCertPath = normalize(resolve(certPath));
    const normalizedKeyPath = normalize(resolve(keyPath));

    // Final validation on normalized paths
    if (!this.isValidTlsPath(normalizedCertPath) || !this.isValidTlsPath(normalizedKeyPath)) {
      throw new Error('Invalid normalized TLS paths');
    }

    const tlsOptions = {
      cert: readFileSync(normalizedCertPath),
      key: readFileSync(normalizedKeyPath),
    };

    logger.info({
      msg: 'Creating HTTPS server for MCP',
      port: this.config.port,
      host: this.config.host,
      timestamp: new Date().toISOString(),
    });

    return createHttpsServer(tlsOptions);
  }

  /**
   * Create HTTP or HTTPS server based on configuration
   */
  private createServer(): HttpServer | HttpsServer {
    if (this.config.useTls) {
      return this.createHttpsServer();
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
