/**
 * JWT authentication utilities
 * @module auth/jwt
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 * @nist sc-13 "Cryptographic protection"
 */

import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../core/config.js';
import { AppError } from '../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';

/**
 * JWT payload schema
 */
export const jwtPayloadSchema = z.object({
  sub: z.string().uuid(), // Subject (user ID)
  username: z.string(),
  roles: z.array(z.string()),
  sessionId: z.string().uuid(),
  type: z.enum(['access', 'refresh']),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type JWTPayload = z.infer<typeof jwtPayloadSchema>;

/**
 * Token pair interface
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Generate JWT token
 * @nist ia-5 "Authenticator management"
 * @nist sc-13 "Cryptographic protection"
 */
export const generateToken = (
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  expiresIn: string = config.JWT_EXPIRY,
): string => {
  const signOptions: jwt.SignOptions = {
    algorithm: config.JWT_ALGORITHM as jwt.Algorithm,
    expiresIn,
  };
  return jwt.sign(payload as object, config.JWT_SECRET, signOptions);
};

/**
 * Generate token pair (access and refresh tokens)
 * @nist ia-5 "Authenticator management"
 */
export const generateTokenPair = (
  userId: string,
  username: string,
  roles: string[],
  sessionId: string,
): TokenPair => {
  const accessToken = generateToken(
    {
      sub: userId,
      username,
      roles,
      sessionId,
      type: 'access',
    },
    config.JWT_EXPIRY,
  );

  const refreshToken = generateToken(
    {
      sub: userId,
      username,
      roles,
      sessionId,
      type: 'refresh',
    },
    config.JWT_REFRESH_EXPIRY,
  );

  // Calculate expiry in seconds
  const decodedToken = jwt.decode(accessToken) as jwt.JwtPayload;
  const expiryTime = (decodedToken.exp ?? 0) - (decodedToken.iat ?? 0);

  return {
    accessToken,
    refreshToken,
    expiresIn: expiryTime,
  };
};

/**
 * Verify and decode JWT token
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 */
export const verifyToken = async (
  token: string,
  expectedType?: 'access' | 'refresh',
): Promise<JWTPayload> => {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: [config.JWT_ALGORITHM as jwt.Algorithm],
    }) as jwt.JwtPayload;

    // Validate payload structure
    const payload = jwtPayloadSchema.parse(decoded);

    // Check token type if specified
    if (expectedType && payload.type !== expectedType) {
      throw new AppError(`Invalid token type. Expected ${expectedType}`, 401);
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      await logSecurityEvent(SecurityEventType.INVALID_TOKEN, {
        reason: 'Token expired',
        result: 'failure',
      });
      throw new AppError('Token expired', 401);
    }

    if (error instanceof jwt.JsonWebTokenError) {
      await logSecurityEvent(SecurityEventType.INVALID_TOKEN, {
        reason: 'Invalid token',
        result: 'failure',
      });
      throw new AppError('Invalid token', 401);
    }

    if (error instanceof z.ZodError) {
      await logSecurityEvent(SecurityEventType.INVALID_TOKEN, {
        reason: 'Invalid token payload',
        result: 'failure',
      });
      throw new AppError('Invalid token payload', 401);
    }

    throw error;
  }
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (authHeader === undefined || authHeader === null || authHeader === '') {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] ?? null;
};

/**
 * Decode token without verification (for debugging only)
 * @warning Do not use for authentication purposes
 */
export const decodeToken = (token: string): JWTPayload | null => {
  try {
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    return jwtPayloadSchema.parse(decoded);
  } catch {
    return null;
  }
};

/**
 * Check if token is about to expire
 * @param token - JWT token
 * @param thresholdSeconds - Number of seconds before expiry to consider it "about to expire"
 */
export const isTokenExpiringSoon = (token: string, thresholdSeconds: number = 300): boolean => {
  try {
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    if (decoded?.exp === undefined) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;

    return timeUntilExpiry <= thresholdSeconds;
  } catch {
    return true;
  }
};

// Export aliases for backward compatibility
export const generateTokens = generateTokenPair;

/**
 * Verify refresh token
 * @nist ia-2 "Identification and authentication"
 */
export const verifyRefreshToken = (token: string): Promise<JWTPayload> => {
  return verifyToken(token, 'refresh');
};

/**
 * Verify access token
 * @nist ia-2 "Identification and authentication"
 */
export const verifyAccessToken = (token: string): Promise<JWTPayload> => {
  return verifyToken(token, 'access');
};
