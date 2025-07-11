/**
 * Protocol buffer serialization/deserialization
 * @module mcp/adapters/grpc/serialization-manager
 * @nist si-10 "Information input validation"
 * @nist sc-8 "Transmission confidentiality and integrity"
 */

import { z } from 'zod';
import type { GrpcResponse, ValidationResult } from './types.js';

/**
 * Protocol buffer serialization manager
 */
export class GrpcSerializationManager {
  /**
   * Serialize data for gRPC transmission
   * @nist sc-8 "Transmission confidentiality and integrity"
   */
  serialize<T>(data: T): Buffer {
    try {
      const jsonString = JSON.stringify(data);
      return Buffer.from(jsonString, 'utf8');
    } catch (error) {
      throw new Error(
        `Serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Deserialize data from gRPC transmission
   * @nist si-10 "Information input validation"
   */
  deserialize<T>(buffer: Buffer, schema?: z.ZodSchema<T>): ValidationResult<T> {
    try {
      const jsonString = buffer.toString('utf8');
      const data = JSON.parse(jsonString) as T;

      if (schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
          return {
            success: false,
            error: `Validation failed: ${result.error.message}`,
          };
        }
        return {
          success: true,
          data: result.data,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: `Deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate and serialize request data
   */
  serializeRequest(request: unknown, schema?: z.ZodSchema): ValidationResult<Buffer> {
    try {
      let validatedRequest = request;

      if (schema) {
        const result = schema.safeParse(request);
        if (!result.success) {
          return {
            success: false,
            error: `Request validation failed: ${result.error.message}`,
          };
        }
        validatedRequest = result.data;
      }

      const buffer = this.serialize(validatedRequest);
      return {
        success: true,
        data: buffer,
      };
    } catch (error) {
      return {
        success: false,
        error: `Request serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Deserialize and validate response data
   */
  deserializeResponse(buffer: Buffer, schema?: z.ZodSchema): ValidationResult<GrpcResponse> {
    try {
      const result = this.deserialize(buffer, schema);
      if (!result.success) {
        return result;
      }

      return {
        success: true,
        data: result.data as GrpcResponse,
      };
    } catch (error) {
      return {
        success: false,
        error: `Response deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Convert between different data formats
   */
  convertFormat(
    data: unknown,
    fromFormat: 'json' | 'protobuf',
    toFormat: 'json' | 'protobuf',
  ): ValidationResult<unknown> {
    try {
      if (fromFormat === toFormat) {
        return {
          success: true,
          data,
        };
      }

      if (fromFormat === 'json' && toFormat === 'protobuf') {
        const buffer = this.serialize(data);
        return {
          success: true,
          data: buffer,
        };
      }

      if (fromFormat === 'protobuf' && toFormat === 'json') {
        if (!(data instanceof Buffer)) {
          return {
            success: false,
            error: 'Expected Buffer for protobuf format',
          };
        }
        return this.deserialize(data);
      }

      return {
        success: false,
        error: `Unsupported format conversion: ${fromFormat} to ${toFormat}`,
      };
    } catch (error) {
      return {
        success: false,
        error: `Format conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Create validation schema for common gRPC messages
   */
  static createRequestSchema(): z.ZodSchema {
    return z.object({
      service: z.enum(['SessionService', 'ContextService', 'HealthService']),
      method: z.string().min(1),
      request: z.unknown().optional(),
      streaming: z.boolean().optional().default(false),
    });
  }

  /**
   * Create validation schema for response messages
   */
  static createResponseSchema(): z.ZodSchema {
    return z.union([z.record(z.unknown()), z.array(z.record(z.unknown()))]);
  }

  /**
   * Sanitize data for safe serialization
   */
  sanitizeData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    if (typeof data === 'object') {
      return this.sanitizeObject(data);
    }

    return data;
  }

  /**
   * Sanitize object data
   */
  private sanitizeObject(data: object): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip functions and undefined values
      if (typeof value !== 'function' && value !== undefined) {
        // Use Object.defineProperty to avoid object injection vulnerability
        Object.defineProperty(sanitized, key, {
          value: this.sanitizeData(value),
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
    return sanitized;
  }
}
