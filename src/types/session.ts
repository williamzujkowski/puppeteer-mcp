/**
 * Session type definitions
 * @module types/session
 */

import { z } from 'zod';

/**
 * Session data schema
 */
export const sessionDataSchema = z.object({
  userId: z.string().uuid(),
  username: z.string().min(3).max(50),
  roles: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

/**
 * Session schema
 */
export const sessionSchema = z.object({
  id: z.string().uuid(),
  data: sessionDataSchema,
  lastAccessedAt: z.string().datetime(),
});

/**
 * Session types
 */
export type SessionData = z.infer<typeof sessionDataSchema>;
export type Session = z.infer<typeof sessionSchema>;
