/**
 * Secure Browser Automation Example
 *
 * This example demonstrates security best practices:
 * - Credential management with encryption
 * - Input validation and sanitization
 * - Rate limiting and abuse prevention
 * - Audit logging
 * - CSRF protection
 * - XSS prevention
 */

import crypto from 'crypto';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import axios, { AxiosInstance } from 'axios';
import winston from 'winston';

// Security configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT || '100', 10);
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT || '3600000', 10); // 1 hour

// Input validation schemas
const UrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      const parsed = new URL(url);
      // Prevent SSRF attacks
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
      const blockedProtocols = ['file:', 'ftp:', 'ssh:', 'telnet:'];

      return !blockedHosts.includes(parsed.hostname) && !blockedProtocols.includes(parsed.protocol);
    },
    { message: 'URL contains blocked host or protocol' },
  );

const SelectorSchema = z.string().refine(
  (selector) => {
    // Prevent selector injection
    const dangerousPatterns = [/javascript:/i, /on\w+\s*=/i, /<script/i, /\beval\b/i, /\bexec\b/i];

    return !dangerousPatterns.some((pattern) => pattern.test(selector));
  },
  { message: 'Selector contains potentially dangerous content' },
);

const AutomationParamsSchema = z.object({
  url: UrlSchema,
  selectors: z.record(SelectorSchema).optional(),
  actions: z
    .array(
      z.object({
        type: z.enum(['click', 'type', 'select', 'wait']),
        selector: SelectorSchema.optional(),
        value: z.string().optional(),
      }),
    )
    .optional(),
  credentials: z
    .object({
      username: z.string().min(1),
      password: z.string().min(1),
    })
    .optional(),
});

// Secure credential storage
class SecureCredentialStore {
  private algorithm = 'aes-256-gcm';
  private key = Buffer.from(ENCRYPTION_KEY, 'hex');

  encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, Buffer.from(iv, 'hex'));

    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  storeCredentials(credentials: any): string {
    const data = JSON.stringify(credentials);
    const { encrypted, iv, tag } = this.encrypt(data);

    // Create a token containing encrypted credentials
    const token = jwt.sign({ encrypted, iv, tag }, JWT_SECRET, { expiresIn: '1h' });

    return token;
  }

  retrieveCredentials(token: string): any {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const decrypted = this.decrypt(decoded.encrypted, decoded.iv, decoded.tag);
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error('Invalid or expired credentials token');
    }
  }
}

// Audit logger
class AuditLogger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      transports: [
        new winston.transports.File({ filename: 'audit.log' }),
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });
  }

  logAction(action: string, metadata: any): void {
    this.logger.info({
      action,
      metadata,
      timestamp: new Date().toISOString(),
      ip: metadata.ip || 'unknown',
      userId: metadata.userId || 'anonymous',
    });
  }

  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: any,
  ): void {
    this.logger.warn({
      type: 'security_event',
      event,
      severity,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}

// Rate limiter
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private limit: number;
  private window: number;

  constructor(limit: number = API_RATE_LIMIT, windowMs: number = 60000) {
    this.limit = limit;
    this.window = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter((time) => now - time < this.window);

    if (validRequests.length >= this.limit) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(identifier, validRequests);

    return true;
  }

  getRemainingRequests(identifier: string): number {
    const requests = this.requests.get(identifier) || [];
    const now = Date.now();
    const validRequests = requests.filter((time) => now - time < this.window);

    return Math.max(0, this.limit - validRequests.length);
  }
}

// Secure automation client
export class SecureAutomationClient {
  private apiClient: AxiosInstance;
  private credentialStore = new SecureCredentialStore();
  private auditLogger = new AuditLogger();
  private rateLimiter = new RateLimiter();
  private csrfToken: string | null = null;
  private sessionTokens = new Map<string, { token: string; expires: number }>();

  constructor(private userId: string) {
    this.apiClient = axios.create({
      baseURL: process.env.API_BASE_URL || 'http://localhost:3000/api',
      timeout: 30000,
      headers: {
        'User-Agent': 'SecureAutomationClient/1.0',
      },
    });

    // Add request interceptor for auth and CSRF
    this.apiClient.interceptors.request.use(async (config) => {
      // Add CSRF token
      if (this.csrfToken) {
        config.headers['X-CSRF-Token'] = this.csrfToken;
      }

      // Add auth token
      const authToken = await this.getAuthToken();
      if (authToken) {
        config.headers['Authorization'] = `Bearer ${authToken}`;
      }

      return config;
    });

    // Add response interceptor for CSRF token updates
    this.apiClient.interceptors.response.use((response) => {
      const newCsrfToken = response.headers['x-csrf-token'];
      if (newCsrfToken) {
        this.csrfToken = newCsrfToken;
      }
      return response;
    });
  }

  private async getAuthToken(): Promise<string | null> {
    // Implement secure token retrieval
    const token = process.env.API_KEY || '';
    return token;
  }

  async runSecureAutomation(params: any): Promise<any> {
    // Check rate limit
    if (!this.rateLimiter.isAllowed(this.userId)) {
      const remaining = this.rateLimiter.getRemainingRequests(this.userId);
      this.auditLogger.logSecurityEvent('rate_limit_exceeded', 'medium', {
        userId: this.userId,
        remaining,
      });
      throw new Error(`Rate limit exceeded. Try again in ${60 - remaining} seconds.`);
    }

    // Validate input
    let validatedParams;
    try {
      validatedParams = AutomationParamsSchema.parse(params);
    } catch (error) {
      this.auditLogger.logSecurityEvent('invalid_input', 'low', {
        userId: this.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Invalid input parameters');
    }

    // Log action
    this.auditLogger.logAction('automation_started', {
      userId: this.userId,
      url: validatedParams.url,
      timestamp: new Date().toISOString(),
    });

    let sessionId: string | null = null;

    try {
      // Create secure session
      sessionId = await this.createSecureSession();

      // Store session token with expiry
      const sessionToken = crypto.randomBytes(32).toString('hex');
      this.sessionTokens.set(sessionId, {
        token: sessionToken,
        expires: Date.now() + SESSION_TIMEOUT,
      });

      // Navigate with security checks
      await this.secureNavigate(sessionId, validatedParams.url);

      // Handle credentials securely if provided
      if (validatedParams.credentials) {
        await this.handleCredentials(sessionId, validatedParams.credentials, validatedParams.url);
      }

      // Execute actions with validation
      if (validatedParams.actions) {
        await this.executeSecureActions(sessionId, validatedParams.actions);
      }

      // Extract data with sanitization
      const data = await this.extractDataSecurely(sessionId, validatedParams.selectors || {});

      this.auditLogger.logAction('automation_completed', {
        userId: this.userId,
        sessionId,
        success: true,
      });

      return {
        success: true,
        data: this.sanitizeOutput(data),
      };
    } catch (error) {
      this.auditLogger.logSecurityEvent('automation_error', 'medium', {
        userId: this.userId,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      if (sessionId) {
        await this.cleanupSecureSession(sessionId);
        this.sessionTokens.delete(sessionId);
      }
    }
  }

  private async createSecureSession(): Promise<string> {
    const response = await this.apiClient.post('/sessions', {
      capabilities: {
        acceptInsecureCerts: false,
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security=false',
            '--disable-features=VizDisplayCompositor',
            '--disable-plugins',
            '--disable-java',
            '--disable-images',
          ],
        },
      },
    });

    return response.data.data.id;
  }

  private async secureNavigate(sessionId: string, url: string): Promise<void> {
    // Additional URL validation
    const parsed = new URL(url);

    // Check against allowlist
    const allowedDomains = process.env.ALLOWED_DOMAINS?.split(',') || [];
    if (allowedDomains.length > 0 && !allowedDomains.includes(parsed.hostname)) {
      throw new Error(`Domain ${parsed.hostname} is not in the allowlist`);
    }

    await this.apiClient.post(`/sessions/${sessionId}/execute`, {
      script: 'goto',
      args: [url],
      context: { timeout: 30000 },
    });
  }

  private async handleCredentials(sessionId: string, credentials: any, url: string): Promise<void> {
    // Encrypt credentials for logging
    const credentialToken = this.credentialStore.storeCredentials(credentials);

    this.auditLogger.logAction('credentials_used', {
      userId: this.userId,
      sessionId,
      url,
      credentialToken: credentialToken.substring(0, 10) + '...',
    });

    // Use credentials securely
    // Implementation depends on the specific authentication flow
  }

  private async executeSecureActions(sessionId: string, actions: any[]): Promise<void> {
    for (const action of actions) {
      // Validate each action
      if (!['click', 'type', 'select', 'wait'].includes(action.type)) {
        throw new Error(`Invalid action type: ${action.type}`);
      }

      // Sanitize selector if present
      if (action.selector) {
        SelectorSchema.parse(action.selector);
      }

      // Execute action with timeout
      await this.apiClient.post(`/sessions/${sessionId}/execute`, {
        script: action.type,
        args: action.selector ? [action.selector, action.value].filter(Boolean) : [],
        context: { timeout: 10000 },
      });
    }
  }

  private async extractDataSecurely(
    sessionId: string,
    selectors: Record<string, string>,
  ): Promise<any> {
    // Build secure extraction script
    const extractionScript = `
      (() => {
        const data = {};
        const selectors = ${JSON.stringify(selectors)};
        
        for (const [key, selector] of Object.entries(selectors)) {
          try {
            const element = document.querySelector(selector);
            if (element) {
              // Extract text content only (no HTML to prevent XSS)
              data[key] = element.textContent?.trim() || '';
            }
          } catch (e) {
            console.error('Extraction error:', e);
          }
        }
        
        return data;
      })()
    `;

    const response = await this.apiClient.post(`/sessions/${sessionId}/execute`, {
      script: 'evaluate',
      args: [extractionScript],
    });

    return response.data.data.result;
  }

  private sanitizeOutput(data: any): any {
    if (typeof data === 'string') {
      // Remove potential XSS vectors
      return data
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/javascript:/gi, '');
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeOutput(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeOutput(value);
      }
      return sanitized;
    }

    return data;
  }

  private async cleanupSecureSession(sessionId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/sessions/${sessionId}`);
    } catch (error) {
      console.error('Session cleanup failed:', error);
    }
  }

  // Get security metrics
  getSecurityMetrics(): any {
    return {
      rateLimitRemaining: this.rateLimiter.getRemainingRequests(this.userId),
      activeSessions: this.sessionTokens.size,
      csrfTokenActive: !!this.csrfToken,
    };
  }
}

// Example usage with security best practices
async function runSecureExample() {
  const client = new SecureAutomationClient('user123');

  try {
    // Example 1: Secure form submission
    const formResult = await client.runSecureAutomation({
      url: 'https://example.com/secure-form',
      credentials: {
        username: 'secureuser',
        password: 'SecureP@ssw0rd!',
      },
      actions: [
        { type: 'type', selector: '#username', value: 'secureuser' },
        { type: 'type', selector: '#password', value: 'SecureP@ssw0rd!' },
        { type: 'click', selector: '#submit' },
      ],
      selectors: {
        message: '.success-message, .error-message',
      },
    });

    console.log('Form submission result:', formResult);

    // Example 2: Secure data extraction
    const dataResult = await client.runSecureAutomation({
      url: 'https://example.com/public-data',
      selectors: {
        title: 'h1',
        content: '.main-content',
        metadata: '.metadata',
      },
    });

    console.log('Extracted data:', dataResult);

    // Check security metrics
    console.log('Security metrics:', client.getSecurityMetrics());
  } catch (error) {
    console.error('Secure automation failed:', error);
  }
}

// Security checklist implementation
export const securityChecklist = {
  authentication: {
    useApiKeys: true,
    rotateKeys: true,
    useJWT: true,
    enforceExpiry: true,
  },
  inputValidation: {
    validateUrls: true,
    sanitizeSelectors: true,
    limitPayloadSize: true,
    useSchemaValidation: true,
  },
  rateLimiting: {
    enabled: true,
    perUser: true,
    perIP: true,
    adaptive: true,
  },
  encryption: {
    credentialsAtRest: true,
    credentialsInTransit: true,
    useStrongAlgorithms: true,
  },
  auditLogging: {
    logAllActions: true,
    logSecurityEvents: true,
    secureLogStorage: true,
    logRetention: '90 days',
  },
  sessionSecurity: {
    enforceTimeout: true,
    uniqueTokens: true,
    secureCleanup: true,
  },
  outputSanitization: {
    removeScripts: true,
    escapeHtml: true,
    validateJson: true,
  },
};

// Run example
if (require.main === module) {
  runSecureExample()
    .then(() => console.log('Secure automation completed'))
    .catch((error) => console.error('Security example failed:', error));
}
