/**
 * API key store implementation
 * @module store/api-key-store
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 * @nist ac-3 "Access enforcement"
 */

import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';

/**
 * API key interface
 */
export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string; // Store hash, not plain text
  prefix: string; // First 8 chars for identification
  roles: string[];
  scopes: string[];
  createdAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
  active: boolean;
}

/**
 * API key creation result
 */
export interface ApiKeyCreationResult {
  apiKey: ApiKey;
  plainTextKey: string; // Only returned on creation
}

/**
 * API key store interface
 */
export interface ApiKeyStore {
  create(options: {
    userId: string;
    name: string;
    roles?: string[];
    scopes?: string[];
    expiresAt?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ApiKeyCreationResult>;

  verify(plainTextKey: string): Promise<ApiKey | null>;
  get(id: string): Promise<ApiKey | null>;
  list(userId: string): Promise<ApiKey[]>;
  revoke(id: string): Promise<boolean>;
  updateLastUsed(id: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * In-memory API key store implementation
 * @nist ia-5 "Authenticator management"
 */
export class InMemoryApiKeyStore implements ApiKeyStore {
  private apiKeys: Map<string, ApiKey> = new Map();
  private keyHashToId: Map<string, string> = new Map();

  /**
   * Generate a secure API key
   */
  private generateApiKey(): string {
    // Generate a secure random key
    const uuid1 = uuidv4().replace(/-/g, '');
    const uuid2 = uuidv4().replace(/-/g, '');
    return `mcp_${uuid1}${uuid2}`; // mcp_ prefix + 64 hex chars
  }

  /**
   * Hash an API key
   */
  private hashApiKey(plainTextKey: string): string {
    return createHash('sha256').update(plainTextKey).digest('hex');
  }

  /**
   * Create a new API key
   * @nist ia-5 "Authenticator management"
   * @nist au-3 "Content of audit records"
   */
  async create(options: {
    userId: string;
    name: string;
    roles?: string[];
    scopes?: string[];
    expiresAt?: number;
    metadata?: Record<string, unknown>;
  }): Promise<ApiKeyCreationResult> {
    const plainTextKey = this.generateApiKey();
    const keyHash = this.hashApiKey(plainTextKey);
    const prefix = plainTextKey.substring(0, 8);

    const apiKey: ApiKey = {
      id: uuidv4(),
      userId: options.userId,
      name: options.name,
      keyHash,
      prefix,
      roles: options.roles ?? ['user'],
      scopes: options.scopes ?? ['*'],
      createdAt: Date.now(),
      expiresAt: options.expiresAt,
      metadata: options.metadata,
      active: true,
    };

    this.apiKeys.set(apiKey.id, apiKey);
    this.keyHashToId.set(keyHash, apiKey.id);

    await logSecurityEvent(SecurityEventType.API_KEY_CREATED, {
      userId: options.userId,
      resource: `apikey:${apiKey.id}`,
      action: 'create',
      result: 'success',
      metadata: {
        name: options.name,
        prefix,
        roles: apiKey.roles,
        scopes: apiKey.scopes,
      },
    });

    return {
      apiKey,
      plainTextKey,
    };
  }

  /**
   * Verify an API key
   * @nist ia-2 "Identification and authentication"
   */
  async verify(plainTextKey: string): Promise<ApiKey | null> {
    const keyHash = this.hashApiKey(plainTextKey);
    const id = this.keyHashToId.get(keyHash);

    if (id === null || id === '') {
      await logSecurityEvent(SecurityEventType.INVALID_TOKEN, {
        reason: 'Unknown API key',
        result: 'failure',
      });
      return null;
    }

    const apiKey = this.apiKeys.get(id as string);
    if (!apiKey) {
      return null;
    }

    // Check if key is active
    if (!apiKey.active) {
      await logSecurityEvent(SecurityEventType.INVALID_TOKEN, {
        userId: apiKey.userId,
        reason: 'API key revoked',
        result: 'failure',
      });
      return null;
    }

    // Check expiration
    if (
      apiKey.expiresAt !== null &&
      apiKey.expiresAt !== undefined &&
      apiKey.expiresAt > 0 &&
      apiKey.expiresAt < Date.now()
    ) {
      await logSecurityEvent(SecurityEventType.INVALID_TOKEN, {
        userId: apiKey.userId,
        reason: 'API key expired',
        result: 'failure',
      });
      return null;
    }

    // Update last used
    await this.updateLastUsed(id as string);

    await logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
      userId: apiKey.userId,
      result: 'success',
      metadata: { method: 'api_key' },
    });

    return apiKey;
  }

  /**
   * Get an API key by ID
   */
  get(id: string): Promise<ApiKey | null> {
    return Promise.resolve(this.apiKeys.get(id) ?? null);
  }

  /**
   * List API keys for a user
   */
  list(userId: string): Promise<ApiKey[]> {
    return Promise.resolve(
      Array.from(this.apiKeys.values()).filter((key) => key.userId === userId),
    );
  }

  /**
   * Revoke an API key
   * @nist ia-5 "Authenticator management"
   * @nist au-3 "Content of audit records"
   */
  async revoke(id: string): Promise<boolean> {
    const apiKey = this.apiKeys.get(id);
    if (!apiKey) {
      return false;
    }

    apiKey.active = false;

    await logSecurityEvent(SecurityEventType.API_KEY_REVOKED, {
      userId: apiKey.userId,
      resource: `apikey:${id}`,
      action: 'revoke',
      result: 'success',
    });

    return true;
  }

  /**
   * Update last used timestamp
   */
  updateLastUsed(id: string): Promise<void> {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      apiKey.lastUsedAt = Date.now();
    }
    return Promise.resolve();
  }

  /**
   * Clear all API keys
   */
  clear(): Promise<void> {
    this.apiKeys.clear();
    this.keyHashToId.clear();
    return Promise.resolve();
  }
}

/**
 * Singleton instance of API key store
 */
export const apiKeyStore = new InMemoryApiKeyStore();
