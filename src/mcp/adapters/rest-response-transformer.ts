/**
 * REST Adapter Response Transformer
 * @module mcp/adapters/rest-response-transformer
 * @description Helper functions for transforming responses in REST adapter
 * @nist au-10 "Non-repudiation"
 */

import { z } from 'zod';
import { AppError } from '../../core/errors/app-error.js';
import { logger } from '../../utils/logger.js';
import type { MCPResponse } from './adapter.interface.js';

/**
 * Transform Express response to MCP format
 */
export function transformToMCPResponse(
  response: { status: number; body: unknown; headers: Record<string, string> },
  requestId: string
): MCPResponse {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(response.body, null, 2),
    }],
    metadata: {
      status: response.status,
      headers: response.headers,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

/**
 * Transform error to MCP response format
 * @nist au-10 "Non-repudiation"
 */
export function transformErrorToMCPResponse(error: unknown, requestId: string): MCPResponse {
  let status = 500;
  let message = 'Internal server error';
  let details: unknown;
  
  if (error instanceof AppError) {
    status = error.statusCode;
    message = error.message;
    details = error.details;
  } else if (error instanceof z.ZodError) {
    status = 400;
    message = 'Validation error';
    details = error.errors;
  } else if (error instanceof Error) {
    message = error.message;
  }
  
  logger.error({
    msg: 'MCP REST adapter error',
    error: message,
    details,
    requestId,
  });
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: {
          message,
          status,
          details,
          timestamp: new Date().toISOString(),
          requestId,
        },
      }, null, 2),
    }],
    metadata: {
      status,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}