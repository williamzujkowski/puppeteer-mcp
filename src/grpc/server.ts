/**
 * gRPC server setup and configuration
 * @module grpc/server
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { pino } from 'pino';
import { config } from '../core/config.js';
import { authInterceptor } from './interceptors/auth.interceptor.js';
import { loggingInterceptor } from './interceptors/logging.interceptor.js';
import { errorInterceptor } from './interceptors/error.interceptor.js';
import { createRateLimitInterceptor } from './interceptors/rate-limit.interceptor.js';
import { SessionServiceImpl } from './services/session.service.js';
import { ContextServiceImpl } from './services/context.service.js';
import { HealthServiceImpl } from './services/health.service.js';
import type { SessionStore } from '../store/session-store.interface.js';
import type { ExtendedCall, GrpcCallback, NextFunction } from './interceptors/types.js';
import { existsSync } from 'fs';

// Load proto files - try multiple locations to support both local and global installs
function findProtoPath(): string {
  const possiblePaths = [
    // Local development or local npm install
    join(process.cwd(), 'proto', 'control.proto'),
  ];

  // In production environments, also check common installation paths
  /* istanbul ignore next - production-only code path */
  if (process.env.NODE_ENV !== 'test' && process.env.JEST_WORKER_ID === undefined) {
    // Add common global npm installation paths
    possiblePaths.push(
      // Relative to dist directory in production
      join(process.cwd(), 'dist', '..', 'proto', 'control.proto'),
      join(process.cwd(), '..', 'proto', 'control.proto'),
      // Global npm paths
      join('/usr/local/lib/node_modules/puppeteer-mcp/proto/control.proto'),
      join(
        process.env.HOME ?? '/home/user',
        '.npm/lib/node_modules/puppeteer-mcp/proto/control.proto',
      ),
    );
  }

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Fallback to the first option if none exist
  return possiblePaths[0] ?? join(process.cwd(), 'proto', 'control.proto');
}

const PROTO_PATH = findProtoPath();

/**
 * gRPC server instance
 */
export class GrpcServer {
  private server: grpc.Server;
  private logger: pino.Logger;
  private sessionStore: SessionStore;

  constructor(logger: pino.Logger, sessionStore: SessionStore) {
    this.logger = logger.child({ module: 'grpc-server' });
    this.sessionStore = sessionStore;
    this.server = new grpc.Server({
      'grpc.max_receive_message_length': config.GRPC_MAX_MESSAGE_SIZE || 4 * 1024 * 1024, // 4MB
      'grpc.max_send_message_length': config.GRPC_MAX_MESSAGE_SIZE || 4 * 1024 * 1024,
      'grpc.keepalive_time_ms': config.GRPC_KEEPALIVE_TIME || 120000, // 2 minutes
      'grpc.keepalive_timeout_ms': config.GRPC_KEEPALIVE_TIMEOUT || 20000, // 20 seconds
      'grpc.keepalive_permit_without_calls': 1,
      'grpc.http2.max_pings_without_data': 0,
      'grpc.http2.min_time_between_pings_ms': 120000,
      'grpc.http2.max_ping_strikes': 3,
    });
  }

  /**
   * Initialize gRPC server with services
   * @nist cm-7 "Least functionality"
   * @nist si-10 "Information input validation"
   */
  initialize(): void {
    try {
      // Load proto definitions
      const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [join(process.cwd(), 'proto')],
      });

      const proto = grpc.loadPackageDefinition(packageDefinition);

      // Create service implementations with interceptors
      const sessionService = new SessionServiceImpl(this.logger, this.sessionStore);
      const contextService = new ContextServiceImpl(this.logger, this.sessionStore);
      const healthService = new HealthServiceImpl(this.logger);

      // Wrap services with interceptors
      const wrappedSessionService = this.wrapServiceWithInterceptors(sessionService);
      const wrappedContextService = this.wrapServiceWithInterceptors(contextService);
      const wrappedHealthService = this.wrapServiceWithInterceptors(healthService, false); // No auth for health

      // Add services to server
      const mcpProto = proto as unknown as {
        mcp: {
          control: {
            v1: {
              SessionService: { service: grpc.ServiceDefinition };
              ContextService: { service: grpc.ServiceDefinition };
              HealthService: { service: grpc.ServiceDefinition };
            };
          };
        };
      };
      this.server.addService(mcpProto.mcp.control.v1.SessionService.service, wrappedSessionService);
      this.server.addService(mcpProto.mcp.control.v1.ContextService.service, wrappedContextService);
      this.server.addService(mcpProto.mcp.control.v1.HealthService.service, wrappedHealthService);

      this.logger.info('gRPC services initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize gRPC server:', error);
      throw error;
    }
  }

  /**
   * Wrap service implementation with interceptors
   * @nist ac-3 "Access enforcement"
   * @nist au-3 "Content of audit records"
   */
  private wrapServiceWithInterceptors(
    service: object,
    requireAuth = true,
  ): Record<string, NextFunction> {
    const wrapped: Record<string, NextFunction> = {};

    for (const [methodName, handler] of Object.entries(service)) {
      if (typeof handler === 'function') {
        // Use Object.defineProperty for safe property assignment to prevent object injection
        Object.defineProperty(wrapped, methodName, {
          value: (call: ExtendedCall, callback?: GrpcCallback) => {
            // Create interceptor chain
            const interceptorChain = [
              createRateLimitInterceptor(),
              errorInterceptor(this.logger),
              loggingInterceptor(this.logger),
            ];

            if (requireAuth) {
              interceptorChain.unshift(authInterceptor(this.logger, this.sessionStore));
            }

            // Apply interceptors in order
            let wrappedHandler = handler.bind(service) as NextFunction;

            for (const interceptor of interceptorChain.reverse()) {
              const previousHandler = wrappedHandler;
              wrappedHandler = (call: ExtendedCall, callback?: GrpcCallback) => {
                void interceptor(call, callback as GrpcCallback, previousHandler);
              };
            }

            void wrappedHandler(call, callback ?? (() => {}));
          },
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }

    return wrapped;
  }

  /**
   * Create TLS credentials for gRPC server
   */
  private createTLSCredentials(): grpc.ServerCredentials {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');

    // Helper function to validate and read TLS files safely
    const readTLSFile = (filePath: string, fileType: string): Buffer => {
      // Validate path is a string and not empty
      if (typeof filePath !== 'string' || filePath.trim() === '') {
        throw new Error(`Invalid ${fileType} path`);
      }

      // Resolve to absolute path
      const absolutePath = path.resolve(filePath);

      // Ensure path doesn't contain null bytes
      if (absolutePath.includes('\0')) {
        throw new Error(`Invalid ${fileType} path: contains null bytes`);
      }

      // Read file directly to avoid TOCTOU race condition
      try {
        const content = fs.readFileSync(absolutePath);

        // Verify it's a file after reading (not a directory)
        const stats = fs.statSync(absolutePath);
        if (!stats.isFile()) {
          throw new Error(`${fileType} path is not a file: ${absolutePath}`);
        }

        return content;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EISDIR') {
          throw new Error(`${fileType} path is a directory, not a file: ${absolutePath}`);
        }
        throw new Error(`${fileType} file not found or inaccessible: ${absolutePath}`);
      }
    };

    // Read TLS files with validation
    const cert = readTLSFile(config.GRPC_TLS_CERT_PATH as string, 'TLS certificate');
    const key = readTLSFile(config.GRPC_TLS_KEY_PATH as string, 'TLS key');

    let ca: Buffer | undefined;
    if (
      config.GRPC_TLS_CA_PATH !== null &&
      config.GRPC_TLS_CA_PATH !== undefined &&
      config.GRPC_TLS_CA_PATH !== ''
    ) {
      ca = readTLSFile(config.GRPC_TLS_CA_PATH, 'TLS CA');
    }

    return grpc.ServerCredentials.createSsl(
      ca ?? null,
      [
        {
          cert_chain: cert,
          private_key: key,
        },
      ],
      config.GRPC_TLS_CLIENT_AUTH, // Require client certificates if configured
    );
  }

  /**
   * Check if TLS should be enabled
   */
  private shouldEnableTLS(): boolean {
    return (
      config.TLS_ENABLED === true &&
      config.GRPC_TLS_CERT_PATH !== null &&
      config.GRPC_TLS_CERT_PATH !== undefined &&
      config.GRPC_TLS_CERT_PATH !== '' &&
      config.GRPC_TLS_KEY_PATH !== null &&
      config.GRPC_TLS_KEY_PATH !== undefined &&
      config.GRPC_TLS_KEY_PATH !== ''
    );
  }

  /**
   * Start the gRPC server
   * @nist sc-8 "Transmission confidentiality and integrity"
   * @nist sc-13 "Cryptographic protection"
   */
  start(port: number, host: string = '0.0.0.0'): Promise<void> {
    return new Promise((resolve, reject) => {
      let credentials: grpc.ServerCredentials;

      try {
        if (this.shouldEnableTLS()) {
          // Production: Use TLS
          credentials = this.createTLSCredentials();
        } else {
          // Development: Insecure
          if (config.NODE_ENV === 'production') {
            reject(new Error('TLS must be enabled for gRPC in production'));
            return;
          }
          credentials = grpc.ServerCredentials.createInsecure();
          this.logger.warn('gRPC server running without TLS - development only!');
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      this.server.bindAsync(`${host}:${port}`, credentials, (error, port) => {
        if (error) {
          this.logger.error('Failed to bind gRPC server:', error);
          reject(error);
          return;
        }

        // server.start() is deprecated and no longer needed in newer versions
        // The server starts automatically when bindAsync succeeds
        this.logger.info(`gRPC server started on ${host}:${port}`);
        resolve();
      });
    });
  }

  /**
   * Gracefully shutdown the gRPC server
   * @nist cm-7 "Least functionality"
   */
  shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.info('Shutting down gRPC server...');

      this.server.tryShutdown((error) => {
        if (error) {
          this.logger.warn('Error during graceful shutdown, forcing shutdown:', error);
          this.server.forceShutdown();
        }

        this.logger.info('gRPC server shut down successfully');
        resolve();
      });

      // Force shutdown after timeout
      setTimeout(() => {
        this.logger.warn('gRPC server shutdown timeout, forcing shutdown');
        this.server.forceShutdown();
        resolve();
      }, 30000); // 30 seconds
    });
  }

  /**
   * Get server instance (for testing)
   */
  getServer(): grpc.Server {
    return this.server;
  }
}

/**
 * Create and initialize gRPC server
 */
export function createGrpcServer(logger: pino.Logger, sessionStore: SessionStore): GrpcServer {
  const server = new GrpcServer(logger, sessionStore);
  server.initialize();
  return server;
}
