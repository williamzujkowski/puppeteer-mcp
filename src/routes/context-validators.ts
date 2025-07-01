/**
 * Context validation schemas
 * @module routes/context-validators
 * @nist si-10 "Information input validation"
 */

import { z } from 'zod';

/**
 * Context configuration schema
 */
export const contextConfigSchema = z.object({
  name: z.string().min(1).max(100),
  viewport: z
    .object({
      width: z.number().int().positive().max(3840),
      height: z.number().int().positive().max(2160),
    })
    .optional(),
  userAgent: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  geolocation: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().positive().optional(),
    })
    .optional(),
  permissions: z.array(z.enum(['geolocation', 'notifications', 'camera', 'microphone'])).optional(),
  httpCredentials: z
    .object({
      username: z.string(),
      password: z.string(),
    })
    .optional(),
  ignoreHTTPSErrors: z.boolean().optional(),
  javaScriptEnabled: z.boolean().optional(),
  bypassCSP: z.boolean().optional(),
  extraHTTPHeaders: z.record(z.string()).optional(),
});

/**
 * Action schema for context execution
 */
export const actionSchema = z.object({
  action: z.enum(['navigate', 'screenshot', 'evaluate', 'click', 'type', 'waitFor']),
  params: z.record(z.unknown()),
});

/**
 * Context type definitions
 */
export interface Context {
  id: string;
  userId: string;
  config: z.infer<typeof contextConfigSchema>;
  createdAt: string;
  lastUsedAt: string;
  status: string;
}