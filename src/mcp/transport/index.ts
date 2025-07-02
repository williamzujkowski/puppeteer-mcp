/**
 * MCP Transport Layer
 * @module mcp/transport
 * @description Export all MCP transport implementations
 */

export { StdioTransport, createStdioTransport } from './stdio.js';
export { HttpTransport, createHttpTransport } from './http.js';

/**
 * Transport types supported by MCP
 */
export enum TransportType {
  STDIO = 'stdio',
  HTTP = 'http',
}

/**
 * Get transport type from environment or default
 */
export function getTransportType(): TransportType {
  const envTransport = process.env.MCP_TRANSPORT?.toLowerCase();
  
  switch (envTransport) {
    case 'http':
    case 'ws':
    case 'websocket':
      return TransportType.HTTP;
    case 'stdio':
    default:
      return TransportType.STDIO;
  }
}