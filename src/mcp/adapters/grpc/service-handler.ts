/**
 * gRPC service method handling
 * @module mcp/adapters/grpc/service-handler
 * @nist ac-3 "Access enforcement"
 * @nist si-10 "Information input validation"
 */

import * as grpc from '@grpc/grpc-js';
import { AppError } from '../../../core/errors/app-error.js';
import type { GrpcServiceHandler, GrpcOperation, GrpcResponse } from './types.js';
import { GrpcStreamManager } from './stream-manager.js';
import { GrpcConnectionManager } from './connection-manager.js';

/**
 * gRPC service method handler
 */
export class GrpcServiceMethodHandler {
  private readonly streamManager: GrpcStreamManager;

  constructor(private readonly connectionManager: GrpcConnectionManager) {
    this.streamManager = new GrpcStreamManager();
  }

  /**
   * Execute a gRPC call with proper error handling
   * @nist ac-3 "Access enforcement"
   * @nist si-10 "Information input validation"
   */
  executeGrpcCall(
    operation: GrpcOperation,
    metadata: grpc.Metadata,
  ): Promise<GrpcResponse> {
    // Get the service implementation from the server
    const service = this.connectionManager.getServiceFromServer(operation.service);

    if (service === null || service === undefined) {
      throw new AppError(`Service ${operation.service} not found`, 404);
    }

    const method = service[operation.method];
    if (method === null || method === undefined || typeof method !== 'function') {
      throw new AppError(`Method ${operation.method} not found in ${operation.service}`, 404);
    }

    // Handle streaming vs unary calls
    if (operation.streaming) {
      return this.streamManager.handleStreamingCall(
        service,
        operation.method,
        operation.request as Record<string, unknown>,
        metadata,
      );
    } else {
      return this.handleUnaryCall(
        service,
        operation.method,
        operation.request as Record<string, unknown>,
        metadata,
      );
    }
  }

  /**
   * Handle unary gRPC calls
   * @nist ac-3 "Access enforcement"
   */
  private handleUnaryCall(
    service: GrpcServiceHandler,
    methodName: string,
    request: Record<string, unknown>,
    metadata: grpc.Metadata,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      // Create a mock call object that matches gRPC's ServerUnaryCall interface
      const call = {
        request: request ?? {},
        metadata,
        getPeer: () => 'mcp-internal',
        sendMetadata: () => {},
        end: () => {},
      };

      // Create callback
      const callback = (
        error: grpc.ServiceError | null,
        response?: Record<string, unknown>,
      ): void => {
        if (error !== null) {
          reject(error);
        } else {
          resolve(response ?? {});
        }
      };

      // Execute the method
      const method = this.getServiceMethod(service, methodName);
      if (typeof method === 'function') {
        method(call, callback);
      } else {
        reject(new AppError(`Method ${methodName} is not a function`, 500));
      }
    });
  }

  /**
   * Validate service and method existence
   */
  validateServiceMethod(serviceName: string, methodName: string): boolean {
    const service = this.connectionManager.getServiceFromServer(serviceName);
    if (service === null || service === undefined) {
      return false;
    }

    const method = this.getServiceMethod(service, methodName);
    return method !== null && method !== undefined && typeof method === 'function';
  }

  /**
   * Get available methods for a service
   */
  getServiceMethods(serviceName: string): string[] {
    const service = this.connectionManager.getServiceFromServer(serviceName);
    if (service === null || service === undefined) {
      return [];
    }

    return Object.keys(service).filter(key => typeof this.getServiceMethod(service, key) === 'function');
  }

  /**
   * Safely get a method from service object
   */
  private getServiceMethod(service: GrpcServiceHandler, methodName: string): unknown {
    if (Object.prototype.hasOwnProperty.call(service, methodName)) {
      return Object.getOwnPropertyDescriptor(service, methodName)?.value;
    }
    return undefined;
  }
}