/**
 * User type definitions
 * @module types/user
 */

import { z } from 'zod';

/**
 * User role enum
 */
export const UserRole = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

/**
 * User schema
 */
export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(50),
  email: z.string().email(),
  roles: z.array(z.enum(['admin', 'user', 'guest'])).default(['user']),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * User types
 */
export type User = z.infer<typeof userSchema>;
