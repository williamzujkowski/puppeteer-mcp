/**
 * Action validation utilities for browser automation
 * @module puppeteer/actions/validation
 * @nist si-10 "Information input validation"
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import { z } from 'zod';
import type { ValidationResult } from '../interfaces/action-executor.interface.js';
import type { BrowserAction } from '../interfaces/action-executor.interface.js';
import { validateEvaluateAction, checkTimeoutWarnings } from './validation-helpers.js';
import { validateJavaScriptCode } from './sanitization.js';

// Re-export sanitization functions for backwards compatibility
export { validateJavaScriptCode, sanitizeUrl } from './sanitization.js';

/**
 * Base action schema
 */
const baseActionSchema = z.object({
  type: z.string().min(1),
  pageId: z.string().uuid(),
  timeout: z.number().int().positive().optional(),
  description: z.string().optional(),
});

/**
 * URL validation schema
 * @nist si-10 "Information input validation"
 */
const urlSchema = z.string().url().refine(
  (url) => {
    const parsed = new URL(url);
    // Only allow HTTP and HTTPS protocols
    return ['http:', 'https:'].includes(parsed.protocol);
  },
  {
    message: 'Only HTTP and HTTPS URLs are allowed',
  }
);

/**
 * Selector validation schema
 */
const selectorSchema = z.string().min(1).max(1000).refine(
  (selector) => {
    // Basic CSS selector validation
    try {
      // Attempt to parse as CSS selector
      if (selector.includes('<') || selector.includes('>') || selector.includes('&')) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },
  {
    message: 'Invalid CSS selector format',
  }
);

/**
 * Text input validation schema
 */
const textInputSchema = z.string().max(10000).refine(
  (text) => {
    // Check for potentially malicious content
    const suspiciousPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i,
      /on\w+\s*=/i,
    ];
    
    return !suspiciousPatterns.some(pattern => pattern.test(text));
  },
  {
    message: 'Text contains potentially malicious content',
  }
);

/**
 * File path validation schema
 */
const filePathSchema = z.string().refine(
  (path) => {
    // Prevent path traversal attacks
    const normalizedPath = path.replace(/\\/g, '/');
    return !normalizedPath.includes('../') && !normalizedPath.includes('./');
  },
  {
    message: 'Invalid file path - path traversal not allowed',
  }
);

/**
 * JavaScript code validation schema
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 */
const javascriptCodeSchema = z.string().max(50000).refine(
  (code) => {
    // Additional security checks
    const lowerCode = code.toLowerCase();
    if (lowerCode.includes('eval(') || lowerCode.includes('function(')) {
      throw new Error('Dynamic code execution is not allowed');
    }
    
    return true;
  },
  {
    message: 'JavaScript code contains potentially dangerous operations',
  }
);

/**
 * Action-specific validation schemas
 */
const actionSchemas = {
  navigate: baseActionSchema.extend({
    type: z.literal('navigate'),
    url: urlSchema,
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).optional(),
  }),

  click: baseActionSchema.extend({
    type: z.literal('click'),
    selector: selectorSchema,
    clickCount: z.number().int().min(1).max(3).optional(),
    button: z.enum(['left', 'right', 'middle']).optional(),
    delay: z.number().int().min(0).max(5000).optional(),
  }),

  type: baseActionSchema.extend({
    type: z.literal('type'),
    selector: selectorSchema,
    text: textInputSchema,
    delay: z.number().int().min(0).max(1000).optional(),
    clearFirst: z.boolean().optional(),
  }),

  select: baseActionSchema.extend({
    type: z.literal('select'),
    selector: selectorSchema,
    values: z.array(z.string().max(1000)).min(1).max(10),
  }),

  keyboard: baseActionSchema.extend({
    type: z.literal('keyboard'),
    key: z.string().min(1).max(50),
    action: z.enum(['press', 'down', 'up']),
  }),

  mouse: baseActionSchema.extend({
    type: z.literal('mouse'),
    action: z.enum(['move', 'down', 'up', 'wheel']),
    x: z.number().int().min(0).max(10000).optional(),
    y: z.number().int().min(0).max(10000).optional(),
    deltaX: z.number().int().min(-1000).max(1000).optional(),
    deltaY: z.number().int().min(-1000).max(1000).optional(),
    button: z.enum(['left', 'right', 'middle']).optional(),
  }),

  screenshot: baseActionSchema.extend({
    type: z.literal('screenshot'),
    fullPage: z.boolean().optional(),
    selector: selectorSchema.optional(),
    quality: z.number().int().min(1).max(100).optional(),
    format: z.enum(['png', 'jpeg', 'webp']).optional(),
  }),

  pdf: baseActionSchema.extend({
    type: z.literal('pdf'),
    format: z.enum(['letter', 'legal', 'tabloid', 'ledger', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6']).optional(),
    landscape: z.boolean().optional(),
    scale: z.number().min(0.1).max(2).optional(),
    displayHeaderFooter: z.boolean().optional(),
    margin: z.object({
      top: z.string().optional(),
      bottom: z.string().optional(),
      left: z.string().optional(),
      right: z.string().optional(),
    }).optional(),
  }),

  wait: baseActionSchema.extend({
    type: z.literal('wait'),
    waitType: z.enum(['selector', 'navigation', 'timeout', 'function']),
    selector: selectorSchema.optional(),
    duration: z.number().int().min(100).max(300000).optional(), // Max 5 minutes
    function: javascriptCodeSchema.optional(),
  }),

  scroll: baseActionSchema.extend({
    type: z.literal('scroll'),
    direction: z.enum(['up', 'down', 'left', 'right']).optional(),
    distance: z.number().int().min(1).max(10000).optional(),
    selector: selectorSchema.optional(),
    toElement: z.boolean().optional(),
  }),

  evaluate: baseActionSchema.extend({
    type: z.literal('evaluate'),
    function: javascriptCodeSchema,
    args: z.array(z.unknown()).max(10).optional(),
  }),

  upload: baseActionSchema.extend({
    type: z.literal('upload'),
    selector: selectorSchema,
    filePaths: z.array(filePathSchema).min(1).max(10),
  }),

  cookie: baseActionSchema.extend({
    type: z.literal('cookie'),
    operation: z.enum(['set', 'get', 'delete', 'clear']),
    cookies: z.array(z.object({
      name: z.string().min(1).max(255),
      value: z.string().max(4096).optional(),
      domain: z.string().max(255).optional(),
      path: z.string().max(255).optional(),
      expires: z.number().int().positive().optional(),
      httpOnly: z.boolean().optional(),
      secure: z.boolean().optional(),
      sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
    })).max(50).optional(),
  }),
};

/**
 * Validate action structure and security
 * @param action - Browser action to validate
 * @returns Validation result
 * @nist si-10 "Information input validation"
 * @nist ac-4 "Information flow enforcement"
 */
export function validateAction(action: BrowserAction): ValidationResult {
  const errors: Array<{ field: string; message: string; code?: string }> = [];
  const warnings: Array<{ field: string; message: string; code?: string }> = [];

  try {
    // Get the appropriate schema for the action type
    const schema = actionSchemas[action.type as keyof typeof actionSchemas];
    
    if (schema === undefined) {
      errors.push({
        field: 'type',
        message: `Unsupported action type: ${action.type}`,
        code: 'UNSUPPORTED_ACTION',
      });
      return { valid: false, errors, warnings };
    }

    // Validate action against schema
    schema.parse(action);

    // Additional security validations
    validateEvaluateAction(action, errors, validateJavaScriptCode);

    // Check for warnings
    checkTimeoutWarnings(action, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };

  } catch (error) {
    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })));
    } else {
      errors.push({
        field: 'unknown',
        message: error instanceof Error ? error.message : 'Unknown validation error',
        code: 'UNKNOWN_ERROR',
      });
    }

    return {
      valid: false,
      errors,
      warnings,
    };
  }
}

/**
 * Sanitize selector for safe element queries
 * @param selector - CSS selector to sanitize
 * @returns Sanitized selector
 */
export function sanitizeSelector(selector: string): string {
  // Remove potentially dangerous characters
  const sanitized = selector
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();

  if (sanitized.length === 0) {
    throw new Error('Empty selector after sanitization');
  }

  if (sanitized.length > 1000) {
    throw new Error('Selector is too long');
  }

  return sanitized;
}

/**
 * Validate batch of actions
 * @param actions - Array of actions to validate
 * @returns Array of validation results
 */
export function validateActionBatch(actions: BrowserAction[]): ValidationResult[] {
  if (actions.length === 0) {
    return [];
  }

  if (actions.length > 100) {
    throw new Error('Too many actions in batch (max 100)');
  }

  return actions.map(action => validateAction(action));
}

/**
 * Get validation schema for action type
 * @param actionType - Action type
 * @returns Zod schema or undefined
 */
export function getActionSchema(actionType: string): z.ZodSchema | undefined {
  return actionSchemas[actionType as keyof typeof actionSchemas];
}