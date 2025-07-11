/**
 * gRPC configuration parser
 * @module core/config/grpc-config
 * @nist cm-7 "Least functionality"
 */

import { parseBoolean, parseInt } from './base-parsers.js';

/**
 * Parse gRPC configuration from environment
 */
export function parseGRPCConfig(): {
  GRPC_ENABLED: boolean;
  GRPC_PORT: number;
  GRPC_HOST: string;
  GRPC_MAX_RECEIVE_MESSAGE_SIZE: number;
  GRPC_MAX_SEND_MESSAGE_SIZE: number;
  GRPC_KEEPALIVE_TIME: number;
  GRPC_KEEPALIVE_TIMEOUT: number;
  GRPC_KEEPALIVE_WITHOUT_CALLS: boolean;
  GRPC_MAX_CONNECTION_IDLE: number;
  GRPC_MAX_CONNECTION_AGE: number;
  GRPC_MAX_CONNECTION_AGE_GRACE: number;
} {
  return {
    GRPC_ENABLED: parseBoolean(process.env.GRPC_ENABLED, true),
    GRPC_PORT: parseInt(process.env.GRPC_PORT, 50051),
    GRPC_HOST: process.env.GRPC_HOST ?? '0.0.0.0',
    GRPC_MAX_RECEIVE_MESSAGE_SIZE: parseInt(process.env.GRPC_MAX_RECEIVE_MESSAGE_SIZE, 4194304),
    GRPC_MAX_SEND_MESSAGE_SIZE: parseInt(process.env.GRPC_MAX_SEND_MESSAGE_SIZE, 4194304),
    GRPC_KEEPALIVE_TIME: parseInt(process.env.GRPC_KEEPALIVE_TIME, 7200000),
    GRPC_KEEPALIVE_TIMEOUT: parseInt(process.env.GRPC_KEEPALIVE_TIMEOUT, 20000),
    GRPC_KEEPALIVE_WITHOUT_CALLS: parseBoolean(process.env.GRPC_KEEPALIVE_WITHOUT_CALLS, false),
    GRPC_MAX_CONNECTION_IDLE: parseInt(process.env.GRPC_MAX_CONNECTION_IDLE, 3600000),
    GRPC_MAX_CONNECTION_AGE: parseInt(process.env.GRPC_MAX_CONNECTION_AGE, 86400000),
    GRPC_MAX_CONNECTION_AGE_GRACE: parseInt(process.env.GRPC_MAX_CONNECTION_AGE_GRACE, 5000),
  };
}
