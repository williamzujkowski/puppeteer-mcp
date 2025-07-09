/**
 * gRPC streaming management (bidirectional, client, server streams)
 * @module mcp/adapters/grpc/stream-manager
 * @nist ac-3 "Access enforcement"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import * as grpc from '@grpc/grpc-js';
import { AppError } from '../../../core/errors/app-error.js';
import type { GrpcServiceHandler, MockStreamCall } from './types.js';

/**
 * Stream callbacks interface
 */
interface StreamCallbacks {
  onData: (data: Record<string, unknown>) => void;
  onEnd: () => void;
  onError: (error: Error) => void;
}

/**
 * Bidirectional stream options interface
 */
interface BidirectionalStreamOptions {
  service: GrpcServiceHandler;
  methodName: string;
  requests: Record<string, unknown>[];
  metadata: grpc.Metadata;
  callbacks: StreamCallbacks;
}

/**
 * gRPC stream manager for handling various streaming patterns
 */
export class GrpcStreamManager {
  /**
   * Handle streaming gRPC calls
   * @nist ac-3 "Access enforcement"
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  handleStreamingCall(
    service: GrpcServiceHandler,
    methodName: string,
    request: Record<string, unknown>,
    metadata: grpc.Metadata,
  ): Promise<Record<string, unknown>[]> {
    return new Promise((resolve, reject) => {
      const responses: Record<string, unknown>[] = [];

      // Create a mock call object that matches gRPC's ServerWritableStream interface
      const call: MockStreamCall = {
        request: request ?? {},
        metadata,
        getPeer: () => 'mcp-internal',
        sendMetadata: () => {},
        write: (chunk: unknown) => {
          responses.push(chunk as Record<string, unknown>);
          return true;
        },
        end: () => {
          resolve(responses);
        },
        destroy: (error?: Error) => {
          if (error !== null && error !== undefined) {
            reject(error);
          }
        },
        on: () => call,
        emit: (): boolean => true,
      };

      try {
        // Execute the streaming method
        const method = this.getServiceMethod(service, methodName);
        if (typeof method === 'function') {
          method(call);
        } else {
          reject(new AppError(`Method ${methodName} is not a function`, 500));
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Handle server-side streaming
   */
  handleServerStream(options: {
    service: GrpcServiceHandler;
    methodName: string;
    request: Record<string, unknown>;
    metadata: grpc.Metadata;
    callbacks: StreamCallbacks;
  }): void {
    const { service, methodName, request, metadata, callbacks } = options;
    
    const call: MockStreamCall = {
      request: request ?? {},
      metadata,
      getPeer: () => 'mcp-internal',
      sendMetadata: () => {},
      write: (chunk: unknown) => {
        callbacks.onData(chunk as Record<string, unknown>);
        return true;
      },
      end: () => {
        callbacks.onEnd();
      },
      destroy: (error?: Error) => {
        if (error !== null && error !== undefined) {
          callbacks.onError(error);
        }
      },
      on: () => call,
      emit: (): boolean => true,
    };

    try {
      const method = this.getServiceMethod(service, methodName);
      if (typeof method === 'function') {
        method(call);
      } else {
        callbacks.onError(new AppError(`Method ${methodName} is not a function`, 500));
      }
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Handle client-side streaming (mock implementation for adapter)
   */
  handleClientStream(
    service: GrpcServiceHandler,
    methodName: string,
    requests: Record<string, unknown>[],
    metadata: grpc.Metadata,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let response: Record<string, unknown> = {};

      // Mock client streaming by processing all requests
      const call = {
        metadata,
        getPeer: () => 'mcp-internal',
        sendMetadata: () => {},
        on: (event: string, listener: (...args: unknown[]) => void) => {
          if (event === 'data') {
            // Simulate receiving data from client
            requests.forEach(req => listener(req));
          } else if (event === 'end') {
            // Simulate end of client stream
            setTimeout(() => listener(), 0);
          }
        },
        end: () => {},
      };

      const callback = (
        error: grpc.ServiceError | null,
        result?: Record<string, unknown>,
      ): void => {
        if (error !== null) {
          reject(error);
        } else {
          response = result ?? {};
          resolve(response);
        }
      };

      try {
        const method = this.getServiceMethod(service, methodName);
        if (typeof method === 'function') {
          method(call, callback);
        } else {
          reject(new AppError(`Method ${methodName} is not a function`, 500));
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Handle bidirectional streaming (mock implementation for adapter)
   */
  handleBidirectionalStream(options: BidirectionalStreamOptions): void {
    const { service, methodName, requests, metadata, callbacks } = options;
    
    const call = {
      metadata,
      getPeer: () => 'mcp-internal',
      sendMetadata: () => {},
      write: (chunk: unknown) => {
        callbacks.onData(chunk as Record<string, unknown>);
        return true;
      },
      end: () => {
        callbacks.onEnd();
      },
      destroy: (error?: Error) => {
        if (error !== null && error !== undefined) {
          callbacks.onError(error);
        }
      },
      on: (event: string, listener: (...args: unknown[]) => void) => {
        if (event === 'data') {
          // Simulate receiving data from client
          requests.forEach(req => listener(req));
        } else if (event === 'end') {
          // Simulate end of client stream
          setTimeout(() => listener(), 0);
        }
        return call;
      },
      emit: (): boolean => true,
    };

    try {
      const method = this.getServiceMethod(service, methodName);
      if (typeof method === 'function') {
        method(call);
      } else {
        callbacks.onError(new AppError(`Method ${methodName} is not a function`, 500));
      }
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
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