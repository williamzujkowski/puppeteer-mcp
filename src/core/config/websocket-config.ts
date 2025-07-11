/**
 * WebSocket configuration parser
 * @module core/config/websocket-config
 * @nist cm-7 "Least functionality"
 */

import { parseBoolean, parseInt } from './base-parsers.js';

/**
 * Parse WebSocket configuration from environment
 */
export function parseWebSocketConfig(): {
  WS_ENABLED: boolean;
  WS_PATH: string;
  WS_HEARTBEAT_INTERVAL: number;
  WS_MAX_PAYLOAD: number;
} {
  return {
    WS_ENABLED: parseBoolean(process.env.WS_ENABLED, true),
    WS_PATH: process.env.WS_PATH ?? '/ws',
    WS_HEARTBEAT_INTERVAL: parseInt(process.env.WS_HEARTBEAT_INTERVAL, 30000),
    WS_MAX_PAYLOAD: parseInt(process.env.WS_MAX_PAYLOAD, 1048576),
  };
}
