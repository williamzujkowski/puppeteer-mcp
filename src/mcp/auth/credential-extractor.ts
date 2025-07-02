/**
 * MCP Credential Extraction Utilities
 * @module mcp/auth/credential-extractor
 * @nist ia-2 "Identification and authentication"
 */

import { MCPAuthCredentials } from './mcp-auth.js';

/**
 * Extract JWT token from headers
 */
function extractJwtFromHeaders(headers?: Record<string, string | string[] | undefined>): string | undefined {
  if (!headers?.authorization) {
    return undefined;
  }
  
  const authHeader = Array.isArray(headers.authorization) 
    ? headers.authorization[0] 
    : headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return undefined;
}

/**
 * Extract API key from headers
 */
function extractApiKeyFromHeaders(headers?: Record<string, string | string[] | undefined>): string | undefined {
  const apiKeyHeader = headers?.['x-api-key'] ?? headers?.['apikey'];
  if (!apiKeyHeader) {
    return undefined;
  }
  
  return Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
}

/**
 * Extract token from query parameters
 */
function extractTokenFromQuery(query?: Record<string, string | string[] | undefined>): string | undefined {
  if (!query?.token) {
    return undefined;
  }
  return Array.isArray(query.token) ? query.token[0] : query.token;
}

/**
 * Extract API key from query parameters
 */
function extractApiKeyFromQuery(query?: Record<string, string | string[] | undefined>): string | undefined {
  if (!query?.apikey) {
    return undefined;
  }
  return Array.isArray(query.apikey) ? query.apikey[0] : query.apikey;
}

/**
 * Extract session ID from query parameters
 */
function extractSessionIdFromQuery(query?: Record<string, string | string[] | undefined>): string | undefined {
  if (!query?.sessionId) {
    return undefined;
  }
  return Array.isArray(query.sessionId) ? query.sessionId[0] : query.sessionId;
}

/**
 * Extract credentials from WebSocket metadata
 */
function extractFromMetadata(metadata?: Record<string, unknown>): MCPAuthCredentials | undefined {
  if (!metadata?.auth) {
    return undefined;
  }
  
  const auth = metadata.auth as { type?: string; credentials?: string };
  if (auth.type && auth.credentials && ['jwt', 'apikey', 'session'].includes(auth.type)) {
    return {
      type: auth.type as 'jwt' | 'apikey' | 'session',
      credentials: auth.credentials
    };
  }
  
  return undefined;
}

/**
 * Extract authentication credentials from various sources
 * Supports Authorization header, query params, or WebSocket metadata
 * @nist ia-2 "Identification and authentication"
 */
export function extractCredentials(source: {
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  metadata?: Record<string, unknown>;
}): MCPAuthCredentials | undefined {
  // Check JWT in Authorization header
  const jwt = extractJwtFromHeaders(source.headers);
  if (jwt) {
    return { type: 'jwt', credentials: jwt };
  }
  
  // Check API key in headers
  const apiKeyHeader = extractApiKeyFromHeaders(source.headers);
  if (apiKeyHeader) {
    return { type: 'apikey', credentials: apiKeyHeader };
  }
  
  // Check query parameters
  const token = extractTokenFromQuery(source.query);
  if (token) {
    return { type: 'jwt', credentials: token };
  }
  
  const apiKeyQuery = extractApiKeyFromQuery(source.query);
  if (apiKeyQuery) {
    return { type: 'apikey', credentials: apiKeyQuery };
  }
  
  const sessionId = extractSessionIdFromQuery(source.query);
  if (sessionId) {
    return { type: 'session', credentials: sessionId };
  }
  
  // Check WebSocket metadata
  return extractFromMetadata(source.metadata);
}