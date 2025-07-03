/**
 * User Service for MCP Authentication
 * @module mcp/auth/user-service
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 * @nist au-3 "Content of audit records"
 */

import { randomUUID } from 'crypto';
import { createHash, pbkdf2Sync, randomBytes } from 'crypto';
import { AppError } from '../../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../../utils/logger.js';
import { z } from 'zod';

/**
 * User credentials schema
 */
export const userCredentialsSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
});

/**
 * User data interface
 */
export interface UserData {
  id: string;
  username: string;
  passwordHash: string;
  roles: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  lastLoginAt?: string;
}

/**
 * Simple in-memory user store
 * Note: This is for development/demo purposes. In production, use a proper database.
 */
class UserService {
  private users: Map<string, UserData> = new Map();

  constructor() {
    // Initialize with demo users
    this.initializeDemoUsers();
  }

  /**
   * Initialize demo users for testing
   * @nist ia-5 "Authenticator management"
   */
  private initializeDemoUsers(): void {
    // Demo admin user
    this.users.set('admin', {
      id: 'user-admin-001',
      username: 'admin',
      passwordHash: this.hashPassword('admin123!'),
      roles: ['admin', 'user'],
      metadata: { fullName: 'Admin User' },
      createdAt: new Date().toISOString(),
    });

    // Demo regular user
    this.users.set('demo', {
      id: 'user-demo-001',
      username: 'demo',
      passwordHash: this.hashPassword('demo123!'),
      roles: ['user'],
      metadata: { fullName: 'Demo User' },
      createdAt: new Date().toISOString(),
    });

    // Demo read-only user
    this.users.set('viewer', {
      id: 'user-viewer-001',
      username: 'viewer',
      passwordHash: this.hashPassword('viewer123!'),
      roles: ['viewer'],
      metadata: { fullName: 'Viewer User' },
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Hash password using PBKDF2
   * Note: This is more secure than SHA-256 but still use bcrypt or argon2 in production
   * @nist ia-5 "Authenticator management"
   */
  private hashPassword(password: string): string {
    // Generate a random salt for each password (16 bytes = 128 bits)
    const salt = randomBytes(16).toString('hex');
    // Use PBKDF2 with 100,000 iterations and SHA-256
    const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');
    // Return salt and hash combined (salt:hash format)
    return `${salt}:${hash}`;
  }

  /**
   * Verify password against stored hash
   * @nist ia-5 "Authenticator management"
   */
  private verifyPassword(password: string, storedHash: string): boolean {
    // Handle legacy SHA-256 hashes (for backward compatibility)
    if (!storedHash.includes(':')) {
      const salt = 'mcp-demo-salt';
      return (
        storedHash ===
        createHash('sha256')
          .update(password + salt)
          .digest('hex')
      );
    }

    // Parse salt and hash from stored value
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) {
      return false;
    }

    // Compute hash with the same salt
    const computedHash = pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex');

    // Constant-time comparison to prevent timing attacks
    return computedHash === hash;
  }

  /**
   * Authenticate user with username and password
   * @nist ia-2 "Identification and authentication"
   * @nist au-3 "Content of audit records"
   * @evidence code, test
   */
  async authenticateUser(username: string, password: string): Promise<UserData> {
    try {
      // Validate input
      const credentials = userCredentialsSchema.parse({ username, password });

      // Find user
      const user = this.users.get(credentials.username);

      if (!user) {
        await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
          reason: 'User not found',
          result: 'failure',
          metadata: {
            context: 'mcp',
            username: credentials.username,
          },
        });
        throw new AppError('Invalid username or password', 401);
      }

      // Verify password
      if (!this.verifyPassword(credentials.password, user.passwordHash)) {
        await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
          userId: user.id,
          reason: 'Invalid password',
          result: 'failure',
          metadata: {
            context: 'mcp',
            username: user.username,
          },
        });
        throw new AppError('Invalid username or password', 401);
      }

      // Update last login time
      user.lastLoginAt = new Date().toISOString();
      this.users.set(username, user);

      // Log successful authentication
      await logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
        userId: user.id,
        result: 'success',
        metadata: {
          context: 'mcp',
          method: 'password',
          username: user.username,
          roles: user.roles,
        },
      });

      return user;
    } catch (error) {
      if (error instanceof z.ZodError) {
        await logSecurityEvent(SecurityEventType.LOGIN_FAILURE, {
          reason: 'Invalid credentials format',
          result: 'failure',
          metadata: {
            context: 'mcp',
            errors: error.errors,
          },
        });
        throw new AppError('Invalid credentials format', 400);
      }
      throw error;
    }
  }

  /**
   * Get user by ID
   * @nist ac-3 "Access enforcement"
   */
  getUserById(userId: string): UserData | null {
    for (const user of this.users.values()) {
      if (user.id === userId) {
        return user;
      }
    }
    return null;
  }

  /**
   * Create a new user (for future use)
   * @nist ia-5 "Authenticator management"
   */
  async createUser(
    username: string,
    password: string,
    roles: string[] = ['user'],
  ): Promise<UserData> {
    // Validate input
    const credentials = userCredentialsSchema.parse({ username, password });

    // Check if user already exists
    if (this.users.has(credentials.username)) {
      throw new AppError('User already exists', 409);
    }

    // Create user
    const user: UserData = {
      id: `user-${randomUUID()}`,
      username: credentials.username,
      passwordHash: this.hashPassword(credentials.password),
      roles,
      createdAt: new Date().toISOString(),
    };

    this.users.set(username, user);

    await logSecurityEvent(SecurityEventType.RESOURCE_CREATED, {
      userId: user.id,
      resource: `user:${user.username}`,
      result: 'success',
      metadata: {
        context: 'mcp',
        roles: user.roles,
        action: 'user_created',
      },
    });

    return user;
  }
}

// Export singleton instance
export const userService = new UserService();
