/**
 * JWT utility tests
 * @module tests/unit/auth/jwt
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  generateToken,
  generateTokenPair,
  verifyToken,
  extractTokenFromHeader,
  isTokenExpiringSoon,
} from '../../../src/auth/jwt.js';
import { AppError } from '../../../src/core/errors/app-error.js';
import jwt from 'jsonwebtoken';

// Mock config
jest.mock('../../../src/core/config.js', () => ({
  config: {
    JWT_SECRET: 'test-secret-key-for-testing-only-32-chars-long!!',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '7d',
    JWT_ALGORITHM: 'HS256',
  },
}));

// Mock logger
jest.mock('../../../src/utils/logger.js', () => ({
  logSecurityEvent: jest.fn(),
  SecurityEventType: {
    INVALID_TOKEN: 'INVALID_TOKEN',
  },
}));

describe('JWT Utilities', () => {
  const testPayload = {
    sub: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    roles: ['user'],
    sessionId: '987e6543-e21b-12d3-a456-426614174000',
    type: 'access' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(testPayload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // Header.Payload.Signature

      // Verify the token can be decoded
      const decoded = jwt.decode(token) as any;
      expect(decoded.sub).toBe(testPayload.sub);
      expect(decoded.username).toBe(testPayload.username);
      expect(decoded.roles).toEqual(testPayload.roles);
      expect(decoded.sessionId).toBe(testPayload.sessionId);
      expect(decoded.type).toBe(testPayload.type);
    });

    it('should set expiration time', () => {
      const token = generateToken(testPayload, '2h');
      const decoded = jwt.decode(token) as any;

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();

      // Check expiration is approximately 2 hours from issued time
      const expiryTime = decoded.exp - decoded.iat;
      expect(expiryTime).toBe(7200); // 2 hours in seconds
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = generateTokenPair(
        testPayload.sub,
        testPayload.username,
        testPayload.roles,
        testPayload.sessionId,
      );

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens).toHaveProperty('expiresIn');

      // Verify access token
      const accessDecoded = jwt.decode(tokens.accessToken) as any;
      expect(accessDecoded.type).toBe('access');

      // Verify refresh token
      const refreshDecoded = jwt.decode(tokens.refreshToken) as any;
      expect(refreshDecoded.type).toBe('refresh');
    });

    it('should have different expiry times for access and refresh tokens', () => {
      const tokens = generateTokenPair(
        testPayload.sub,
        testPayload.username,
        testPayload.roles,
        testPayload.sessionId,
      );

      const accessDecoded = jwt.decode(tokens.accessToken) as any;
      const refreshDecoded = jwt.decode(tokens.refreshToken) as any;

      const accessExpiry = accessDecoded.exp - accessDecoded.iat;
      const refreshExpiry = refreshDecoded.exp - refreshDecoded.iat;

      expect(refreshExpiry).toBeGreaterThan(accessExpiry);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const token = generateToken(testPayload);
      const verified = await verifyToken(token);

      expect(verified.sub).toBe(testPayload.sub);
      expect(verified.username).toBe(testPayload.username);
      expect(verified.roles).toEqual(testPayload.roles);
      expect(verified.sessionId).toBe(testPayload.sessionId);
      expect(verified.type).toBe(testPayload.type);
    });

    it('should verify token type when specified', async () => {
      const accessToken = generateToken({ ...testPayload, type: 'access' });
      const refreshToken = generateToken({ ...testPayload, type: 'refresh' });

      await expect(verifyToken(accessToken, 'access')).resolves.toBeTruthy();
      await expect(verifyToken(refreshToken, 'refresh')).resolves.toBeTruthy();
    });

    it('should throw error for wrong token type', async () => {
      const accessToken = generateToken({ ...testPayload, type: 'access' });

      await expect(verifyToken(accessToken, 'refresh')).rejects.toThrow(AppError);
      await expect(verifyToken(accessToken, 'refresh')).rejects.toThrow('Invalid token type');
    });

    it('should throw error for expired token', async () => {
      const expiredToken = generateToken(testPayload, '-1s'); // Already expired

      await expect(verifyToken(expiredToken)).rejects.toThrow(AppError);
      await expect(verifyToken(expiredToken)).rejects.toThrow('Token expired');
    });

    it('should throw error for invalid token', async () => {
      const invalidToken = 'invalid.token.signature';

      await expect(verifyToken(invalidToken)).rejects.toThrow(AppError);
      await expect(verifyToken(invalidToken)).rejects.toThrow('Invalid token');
    });

    it('should throw error for token with invalid payload', async () => {
      // Create token with missing required fields
      const invalidPayload = { sub: 'test' };
      const token = jwt.sign(invalidPayload, 'test-secret-key-for-testing-only-32-chars-long!!');

      await expect(verifyToken(token)).rejects.toThrow(AppError);
      await expect(verifyToken(token)).rejects.toThrow('Invalid token payload');
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
      const header = `Bearer ${token}`;

      const extracted = extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    it('should return null for missing header', () => {
      expect(extractTokenFromHeader(undefined)).toBeNull();
      expect(extractTokenFromHeader('')).toBeNull();
    });

    it('should return null for invalid header format', () => {
      expect(extractTokenFromHeader('InvalidFormat')).toBeNull();
      expect(extractTokenFromHeader('Basic dGVzdDp0ZXN0')).toBeNull();
      expect(extractTokenFromHeader('Bearer')).toBeNull();
      expect(extractTokenFromHeader('Bearer token1 token2')).toBeNull();
    });
  });

  describe('isTokenExpiringSoon', () => {
    it('should return true for token expiring within threshold', () => {
      // Token expiring in 4 minutes
      const token = generateToken(testPayload, '240s');

      // Check with 5 minute threshold
      expect(isTokenExpiringSoon(token, 300)).toBe(true);
    });

    it('should return false for token not expiring soon', () => {
      // Token expiring in 1 hour
      const token = generateToken(testPayload, '1h');

      // Check with 5 minute threshold
      expect(isTokenExpiringSoon(token, 300)).toBe(false);
    });

    it('should return true for invalid token', () => {
      expect(isTokenExpiringSoon('invalid.token', 300)).toBe(true);
    });

    it('should use default threshold of 5 minutes', () => {
      // Token expiring in 4 minutes
      const token = generateToken(testPayload, '240s');

      expect(isTokenExpiringSoon(token)).toBe(true);
    });
  });
});
