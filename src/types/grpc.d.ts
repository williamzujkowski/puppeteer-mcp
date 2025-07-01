/**
 * gRPC type extensions
 */
import * as grpc from '@grpc/grpc-js';
import type { Session } from './session.js';

declare module '@grpc/grpc-js' {
  export interface ServerUnaryCall<RequestType, ResponseType> {
    session?: Session;
    userId?: string;
    username?: string;
    roles?: string[];
  }

  export interface ServerReadableStream<RequestType, ResponseType> {
    session?: Session;
    userId?: string;
    username?: string;
    roles?: string[];
  }

  export interface ServerWritableStream<RequestType, ResponseType> {
    session?: Session;
    userId?: string;
    username?: string;
    roles?: string[];
  }

  export interface ServerDuplexStream<RequestType, ResponseType> {
    session?: Session;
    userId?: string;
    username?: string;
    roles?: string[];
  }
}