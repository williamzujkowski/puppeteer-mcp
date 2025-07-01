/**
 * Request ID generation middleware
 * @module core/middleware/request-id
 * @nist au-3 "Content of audit records"
 * @nist au-10 "Non-repudiation"
 */

import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Generate unique request ID for tracking
 * @returns Unique request ID
 */
export const generateRequestId = (): string => {
  return randomUUID();
};

/**
 * Request ID middleware
 * @nist au-3 "Content of audit records"
 * @nist au-10 "Non-repudiation"
 * @returns Express middleware
 */
export const requestIdMiddleware = (): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check for existing request ID from headers
    const existingId = req.headers['x-request-id'] ?? req.headers['x-correlation-id'];
    
    // Generate or use existing ID
    const requestId = typeof existingId === 'string' ? existingId : generateRequestId();
    
    // Attach to request object
    req.id = requestId;
    
    // Add to response headers for client correlation
    res.setHeader('X-Request-ID', requestId);
    
    // Add to all log entries via the logger's request context
    // This is handled by the logger middleware
    
    next();
  };
};

/**
 * Extract request ID from various sources
 * @param req - Express request object
 * @returns Request ID or undefined
 */
export const extractRequestId = (req: Request): string | undefined => {
  return req.id ?? 
         req.headers['x-request-id'] as string | undefined ?? 
         req.headers['x-correlation-id'] as string | undefined ??
         req.headers['x-trace-id'] as string | undefined;
};

/**
 * WebSocket request ID extractor
 * @param headers - WebSocket headers
 * @returns Request ID or newly generated one
 */
export const extractWebSocketRequestId = (headers: Record<string, string>): string => {
  const requestId = headers['x-request-id'] ?? 
         headers['x-correlation-id'] ??
         headers['x-trace-id'];
  
  return requestId !== undefined && requestId !== '' ? requestId : generateRequestId();
};

/**
 * gRPC metadata interface for type safety
 */
interface GrpcMetadata {
  get(key: string): string[] | undefined;
}

/**
 * gRPC request ID interceptor
 * @param metadata - gRPC metadata
 * @returns Request ID or newly generated one
 */
export const extractGrpcRequestId = (metadata: GrpcMetadata): string => {
  const requestId = metadata.get('x-request-id')?.[0] ??
                    metadata.get('x-correlation-id')?.[0] ??
                    metadata.get('x-trace-id')?.[0];
  
  return requestId ?? generateRequestId();
};