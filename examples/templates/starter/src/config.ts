/**
 * Application Configuration
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration schema
const configSchema = z.object({
  api: z.object({
    baseUrl: z.string().url(),
    key: z.string().min(1),
    timeout: z.number().positive()
  }),
  puppeteer: z.object({
    headless: z.boolean(),
    defaultTimeout: z.number().positive(),
    viewport: z.object({
      width: z.number().positive(),
      height: z.number().positive()
    })
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']),
    format: z.enum(['json', 'simple'])
  }),
  retry: z.object({
    maxAttempts: z.number().min(1).max(10),
    delay: z.number().positive()
  })
});

// Parse and validate configuration
export const config = configSchema.parse({
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api',
    key: process.env.API_KEY || 'your-api-key',
    timeout: parseInt(process.env.API_TIMEOUT || '30000', 10)
  },
  puppeteer: {
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    defaultTimeout: parseInt(process.env.PUPPETEER_TIMEOUT || '30000', 10),
    viewport: {
      width: parseInt(process.env.VIEWPORT_WIDTH || '1920', 10),
      height: parseInt(process.env.VIEWPORT_HEIGHT || '1080', 10)
    }
  },
  logging: {
    level: (process.env.LOG_LEVEL || 'info') as any,
    format: (process.env.LOG_FORMAT || 'json') as any
  },
  retry: {
    maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
    delay: parseInt(process.env.RETRY_DELAY || '1000', 10)
  }
});

export type Config = z.infer<typeof configSchema>;