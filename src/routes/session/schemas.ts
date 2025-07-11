/**
 * Session validation schemas
 * @module routes/session/schemas
 * @nist ia-2 "Identification and authentication"
 * @nist ia-5 "Authenticator management"
 */

import { z } from 'zod';

/**
 * Schema for refresh token request
 * @nist ia-5 "Authenticator management"
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
  accessToken: z.string().optional(),
});

/**
 * Schema for revoke token request
 * @nist ac-12 "Session termination"
 */
export const revokeTokenSchema = z.object({
  refreshToken: z.string(),
});

/**
 * Schema for development session creation
 * @nist ac-2 "Account management"
 */
export const createSessionSchema = z.object({
  userId: z.string().optional(),
  username: z.string().default('dev-user'),
  roles: z.array(z.string()).default(['user', 'admin']),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;
export type RevokeTokenRequest = z.infer<typeof revokeTokenSchema>;
export type CreateSessionRequest = z.infer<typeof createSessionSchema>;
