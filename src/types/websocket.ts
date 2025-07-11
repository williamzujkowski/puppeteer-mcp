/**
 * WebSocket message type definitions
 * @module types/websocket
 */

import { z } from 'zod';

/**
 * WebSocket message types
 */
export enum WSMessageType {
  // Connection management
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  PING = 'ping',
  PONG = 'pong',

  // Authentication
  AUTH = 'auth',
  AUTH_SUCCESS = 'auth_success',
  AUTH_ERROR = 'auth_error',

  // Data messages
  REQUEST = 'request',
  RESPONSE = 'response',
  EVENT = 'event',
  ERROR = 'error',

  // Subscriptions
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  SUBSCRIPTION_UPDATE = 'subscription_update',
}

/**
 * Base WebSocket message schema
 */
export const wsBaseMessageSchema = z.object({
  type: z.nativeEnum(WSMessageType),
  id: z.string().uuid().optional(),
  timestamp: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
});

/**
 * Authentication message schema
 */
export const wsAuthMessageSchema = wsBaseMessageSchema.extend({
  type: z.literal(WSMessageType.AUTH),
  data: z.object({
    token: z.string(),
    apiKey: z.string().optional(),
  }),
});

/**
 * Authentication success message schema
 */
export const wsAuthSuccessMessageSchema = wsBaseMessageSchema.extend({
  type: z.literal(WSMessageType.AUTH_SUCCESS),
  data: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    roles: z.array(z.string()).optional(),
    permissions: z.array(z.string()).optional(),
    scopes: z.array(z.string()).optional(),
  }),
});

/**
 * Authentication error message schema
 */
export const wsAuthErrorMessageSchema = wsBaseMessageSchema.extend({
  type: z.literal(WSMessageType.AUTH_ERROR),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
});

/**
 * Request message schema
 */
export const wsRequestMessageSchema = wsBaseMessageSchema.extend({
  type: z.literal(WSMessageType.REQUEST),
  id: z.string().uuid(), // Required for requests
  method: z.string(),
  path: z.string(),
  data: z.unknown().optional(),
  headers: z.record(z.string()).optional(),
});

/**
 * Response message schema
 */
export const wsResponseMessageSchema = wsBaseMessageSchema.extend({
  type: z.literal(WSMessageType.RESPONSE),
  id: z.string().uuid(), // Matches request ID
  status: z.number().int().positive(),
  data: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    })
    .optional(),
});

/**
 * Event message schema
 */
export const wsEventMessageSchema = wsBaseMessageSchema.extend({
  type: z.literal(WSMessageType.EVENT),
  event: z.string(),
  data: z.unknown(),
});

/**
 * Error message schema
 */
export const wsErrorMessageSchema = wsBaseMessageSchema.extend({
  type: z.literal(WSMessageType.ERROR),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

/**
 * Subscription message schema
 */
export const wsSubscriptionMessageSchema = wsBaseMessageSchema.extend({
  type: z.enum([WSMessageType.SUBSCRIBE, WSMessageType.UNSUBSCRIBE]),
  topic: z.string(),
  filters: z.record(z.unknown()).optional(),
});

/**
 * Subscription update message schema
 */
export const wsSubscriptionUpdateSchema = wsBaseMessageSchema.extend({
  type: z.literal(WSMessageType.SUBSCRIPTION_UPDATE),
  topic: z.string(),
  data: z.unknown(),
});

/**
 * Ping/Pong message schema
 */
export const wsPingPongMessageSchema = wsBaseMessageSchema.extend({
  type: z.enum([WSMessageType.PING, WSMessageType.PONG]),
});

/**
 * Union of all message types
 */
export const wsMessageSchema = z.discriminatedUnion('type', [
  wsAuthMessageSchema,
  wsAuthSuccessMessageSchema,
  wsAuthErrorMessageSchema,
  wsRequestMessageSchema,
  wsResponseMessageSchema,
  wsEventMessageSchema,
  wsErrorMessageSchema,
  wsSubscriptionMessageSchema,
  wsSubscriptionUpdateSchema,
  wsPingPongMessageSchema,
]);

/**
 * WebSocket message types
 */
export type WSMessage = z.infer<typeof wsMessageSchema>;
export type WSAuthMessage = z.infer<typeof wsAuthMessageSchema>;
export type WSRequestMessage = z.infer<typeof wsRequestMessageSchema>;
export type WSResponseMessage = z.infer<typeof wsResponseMessageSchema>;
export type WSEventMessage = z.infer<typeof wsEventMessageSchema>;
export type WSErrorMessage = z.infer<typeof wsErrorMessageSchema>;
export type WSSubscriptionMessage = z.infer<typeof wsSubscriptionMessageSchema>;
export type WSSubscriptionUpdate = z.infer<typeof wsSubscriptionUpdateSchema>;
export type WSPingPongMessage = z.infer<typeof wsPingPongMessageSchema>;

/**
 * WebSocket connection state
 */
export interface WSConnectionState {
  id: string;
  authenticated: boolean;
  userId?: string;
  sessionId?: string;
  roles?: string[];
  permissions?: string[];
  scopes?: string[];
  subscriptions: Set<string>;
  lastActivity: Date;
  connectedAt: Date;
  remoteAddress?: string;
  userAgent?: string;
  protocol?: string;
  metadata?: Record<string, unknown>;
}

/**
 * WebSocket client options
 */
export interface WSClientOptions {
  url: string;
  token?: string;
  apiKey?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  requestTimeout?: number;
}
