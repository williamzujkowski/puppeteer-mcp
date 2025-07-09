/**
 * gRPC connection management and lifecycle
 * @module mcp/adapters/grpc/connection-manager
 * @nist ac-3 "Access enforcement"
 * @nist cm-7 "Least functionality"
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join, dirname } from 'path';
import { getDirnameFromSrc } from '../../../utils/path-utils.js';
import type { GrpcServer } from '../../../grpc/server.js';
import type { GrpcServiceHandler } from './types.js';

/**
 * gRPC connection and protocol buffer manager
 */
export class GrpcConnectionManager {
  private readonly protoPath: string;
  private packageDefinition?: protoLoader.PackageDefinition;

  constructor(
    private readonly server: GrpcServer,
    protoPath?: string,
  ) {
    // Use getDirnameFromSrc to work in both production and test environments
    this.protoPath = protoPath ?? join(
      getDirnameFromSrc('mcp/adapters'),
      '..',
      '..',
      '..',
      'proto',
      'control.proto',
    );
    this.initializeProto();
  }

  /**
   * Initialize proto definitions
   * @nist cm-7 "Least functionality"
   */
  private initializeProto(): void {
    // Load proto definitions
    this.packageDefinition = protoLoader.loadSync(this.protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [dirname(this.protoPath)],
    });

    // Load the package definition into gRPC
    grpc.loadPackageDefinition(this.packageDefinition);
  }

  /**
   * Get the gRPC server instance
   */
  getServer(): GrpcServer {
    return this.server;
  }

  /**
   * Get service implementation from the server
   * @nist cm-7 "Least functionality"
   */
  getServiceFromServer(serviceName: string): GrpcServiceHandler | null {
    // Access the service implementations through the server's internal structure
    // This is a simplified approach - in production, you might want to expose
    // a proper API for accessing services

    // The services are stored in the server's handlers
    // This is implementation-specific and may need adjustment
    const server = this.server.getServer() as unknown as {
      handlers: Map<string, unknown>;
    };
    const handlers = server.handlers;

    if (handlers instanceof Map) {
      // Build service object by collecting all methods for this service
      const serviceObj: GrpcServiceHandler = {};

      for (const [key, handler] of handlers) {
        if (key.includes(serviceName)) {
          // Extract method name from the key (e.g., "/mcp.control.v1.SessionService/CreateSession" -> "CreateSession")
          const methodName = key.split('/').pop();
          if (
            methodName !== null &&
            methodName !== undefined &&
            methodName !== '' &&
            typeof handler === 'function'
          ) {
            // Use Object.defineProperty to avoid object injection vulnerability
            Object.defineProperty(serviceObj, methodName, {
              value: handler as GrpcServiceHandler[string],
              writable: true,
              enumerable: true,
              configurable: true,
            });
          }
        }
      }

      // Return the service object if it has methods, otherwise null
      return Object.keys(serviceObj).length > 0 ? serviceObj : null;
    }

    return null;
  }

  /**
   * Check if the connection is healthy
   */
  isHealthy(): boolean {
    // Basic health check - could be expanded with more sophisticated checks
    return this.server !== null && this.server !== undefined;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    isConnected: boolean;
    protoLoaded: boolean;
    serverActive: boolean;
  } {
    return {
      isConnected: this.isHealthy(),
      protoLoaded: this.packageDefinition !== undefined,
      serverActive: this.server !== null && this.server !== undefined,
    };
  }
}