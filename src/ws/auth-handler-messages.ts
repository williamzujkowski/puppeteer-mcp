/**
 * WebSocket authentication message handlers
 * @module ws/auth-handler-messages
 * @nist ia-2 "Identification and authentication"
 * @nist au-3 "Content of audit records"
 */

import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { WSMessageType } from '../types/websocket.js';
import type { WSErrorMessage, WSEventMessage } from '../types/websocket.js';

/**
 * Send authentication success message
 */
export function sendAuthSuccess(
  ws: WebSocket,
  requestId: string | undefined,
  data: Record<string, unknown>,
): void {
  const message: WSEventMessage = {
    type: WSMessageType.EVENT,
    id: requestId ?? uuidv4(),
    timestamp: new Date().toISOString(),
    event: 'auth_success',
    data,
  };

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Send authentication error message
 */
export function sendAuthError(
  ws: WebSocket,
  requestId: string | undefined,
  code: string,
  message: string,
): void {
  const errorMessage: WSErrorMessage = {
    type: WSMessageType.ERROR,
    id: requestId ?? uuidv4(),
    timestamp: new Date().toISOString(),
    error: {
      code,
      message,
    },
  };

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(errorMessage));
  }
}
