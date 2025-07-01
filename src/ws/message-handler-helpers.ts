/**
 * WebSocket message handler helper functions
 * @module ws/message-handler-helpers
 */

import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { WSMessage, WSMessageType } from '../types/ws.types.js';
import { pino } from 'pino';

/**
 * Response parameters
 */
export interface SendResponseParams {
  ws: WebSocket;
  requestId: string;
  status: number;
  data: unknown;
  headers?: Record<string, string>;
}

/**
 * Error parameters
 */
export interface SendErrorParams {
  ws: WebSocket;
  requestId?: string;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Send response message
 * @nist au-3 "Content of audit records"
 */
export function sendResponse(params: SendResponseParams, logger: pino.Logger): void {
  const { ws, requestId, status, data, headers } = params;
  
  const responseMessage: WSMessage = {
    type: WSMessageType.RESPONSE,
    id: requestId,
    timestamp: new Date().toISOString(),
    status,
    data,
    headers,
  };

  try {
    ws.send(JSON.stringify(responseMessage));
  } catch (error) {
    logger.error({ error, messageId: requestId }, 'Failed to send response');
  }
}

/**
 * Send error message
 * @nist au-3 "Content of audit records"
 */
export function sendError(params: SendErrorParams, logger: pino.Logger): void {
  const { ws, requestId, code, message, details } = params;
  
  const errorMessage: WSMessage = {
    type: WSMessageType.ERROR,
    id: requestId ?? uuidv4(),
    timestamp: new Date().toISOString(),
    error: {
      code,
      message,
      details,
    },
  };

  try {
    ws.send(JSON.stringify(errorMessage));
  } catch (error) {
    logger.error({ error, messageId: requestId }, 'Failed to send error');
  }
}