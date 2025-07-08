/**
 * API type definitions
 * @module types/api
 */

import { z } from 'zod';

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

/**
 * API response wrapper schema
 */
export const apiResponseSchema = <T extends z.ZodType>(
  dataSchema: T,
): z.ZodObject<{
  success: z.ZodBoolean;
  data: z.ZodOptional<T>;
  error: z.ZodOptional<
    z.ZodObject<{
      code: z.ZodString;
      message: z.ZodString;
      details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }>
  >;
  meta: z.ZodOptional<
    z.ZodObject<{
      timestamp: z.ZodString;
      version: z.ZodString;
      requestId: z.ZodString;
    }>
  >;
  pagination: z.ZodOptional<typeof paginationSchema>;
}> =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.record(z.unknown()).optional(),
      })
      .optional(),
    meta: z
      .object({
        timestamp: z.string().datetime(),
        version: z.string(),
        requestId: z.string().uuid(),
      })
      .optional(),
    pagination: paginationSchema.optional(),
  });

/**
 * API types
 */
export type Pagination = z.infer<typeof paginationSchema>;
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    version: string;
    requestId: string;
  };
  pagination?: Pagination;
};
