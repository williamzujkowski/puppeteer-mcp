/**
 * gRPC metadata handling
 * @module mcp/adapters/grpc/metadata-manager
 * @nist ia-2 "Identification and authentication"
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */

import * as grpc from '@grpc/grpc-js';
import type { AuthParams } from '../adapter.interface.js';
import type { MetadataOptions } from './types.js';

/**
 * gRPC metadata manager class
 */
export class GrpcMetadataManager {
  /**
   * Create gRPC metadata from authentication parameters
   * @nist ia-2 "Identification and authentication"
   * @nist ac-3 "Access enforcement"
   */
  createMetadata(options: MetadataOptions = {}): grpc.Metadata {
    const metadata = new grpc.Metadata();

    // Add authentication
    this.addAuthenticationToMetadata(metadata, options.auth);

    // Add session ID if provided separately
    this.addSessionIdToMetadata(metadata, options.sessionId, options.auth);

    // Add request ID for tracing
    this.addRequestIdToMetadata(metadata, options.requestId);

    return metadata;
  }

  /**
   * Add authentication headers to metadata
   * @nist ia-2 "Identification and authentication"
   */
  private addAuthenticationToMetadata(metadata: grpc.Metadata, auth?: AuthParams): void {
    if (auth === null || auth === undefined) {
      return;
    }

    switch (auth.type) {
      case 'jwt':
        metadata.add('authorization', `Bearer ${auth.credentials}`);
        break;
      case 'apikey':
        metadata.add('x-api-key', auth.credentials);
        break;
      case 'session':
        metadata.add('x-session-id', auth.credentials);
        break;
    }
  }

  /**
   * Add session ID to metadata if valid
   * @nist ac-3 "Access enforcement"
   */
  private addSessionIdToMetadata(
    metadata: grpc.Metadata,
    sessionId?: string,
    auth?: AuthParams,
  ): void {
    if (this.isValidSessionId(sessionId) && (!auth || auth.type !== 'session')) {
      metadata.add('x-session-id', sessionId);
    }
  }

  /**
   * Add request ID to metadata if valid
   * @nist au-3 "Content of audit records"
   */
  private addRequestIdToMetadata(metadata: grpc.Metadata, requestId?: string): void {
    if (this.isValidString(requestId)) {
      metadata.add('x-request-id', requestId);
    }
  }

  /**
   * Check if session ID is valid
   */
  private isValidSessionId(sessionId?: string): sessionId is string {
    return sessionId !== null && sessionId !== undefined && sessionId !== '';
  }

  /**
   * Check if string is valid and non-empty
   */
  private isValidString(str?: string): str is string {
    return str !== null && str !== undefined && str !== '';
  }
}
