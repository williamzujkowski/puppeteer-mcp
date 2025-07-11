/**
 * WebSocket Adapter Constants
 * @module mcp/adapters/websocket/constants
 * @description Constants and configuration for WebSocket adapter
 */

/**
 * WebSocket endpoint definitions
 */
export const WEBSOCKET_ENDPOINTS = [
  {
    operation: 'subscribe',
    description: 'Subscribe to real-time updates on a topic',
    parameters: {
      topic: 'string (required)',
      filters: 'object (optional)',
      duration: 'number in ms (optional)',
    },
  },
  {
    operation: 'unsubscribe',
    description: 'Unsubscribe from a topic',
    parameters: {
      topic: 'string (required)',
    },
  },
  {
    operation: 'send',
    description: 'Send a message through WebSocket',
    parameters: {
      topic: 'string (optional)',
      event: 'string (optional)',
      data: 'any (optional)',
      timeout: 'number in ms (default: 30000)',
    },
  },
  {
    operation: 'broadcast',
    description: 'Broadcast a message to all subscribers of a topic',
    parameters: {
      topic: 'string (required)',
      event: 'string (required)',
      data: 'any (optional)',
    },
  },
];

/**
 * WebSocket features
 */
export const WEBSOCKET_FEATURES = [
  'real-time-messaging',
  'pub-sub',
  'authentication',
  'heartbeat',
  'auto-reconnect',
  'message-filtering',
  'broadcast',
];

/**
 * WebSocket authentication types
 */
export const WEBSOCKET_AUTH_TYPES = ['jwt', 'apikey'];

/**
 * WebSocket subscription topics
 */
export const WEBSOCKET_SUBSCRIPTION_TOPICS = ['sessions.*', 'contexts.*', 'system.*'];

/**
 * Default WebSocket operation timeout
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * WebSocket protocol version
 */
export const WEBSOCKET_VERSION = '1.0.14';
