---
title: Security Architecture
description: 'Comprehensive security model and implementation for Puppeteer MCP.'
---

# Security Architecture

Comprehensive security model and implementation for Puppeteer MCP.

## Security Overview

Puppeteer MCP implements defense-in-depth security with multiple layers:

1. **Network Security** - TLS, firewalls, network isolation
2. **Authentication** - JWT tokens, API keys, OAuth support
3. **Authorization** - Role-based access control (RBAC)
4. **Input Validation** - Zod schemas, sanitization
5. **Session Security** - Isolation, timeouts, resource limits
6. **Browser Security** - Sandboxing, process isolation
7. **Audit Logging** - Comprehensive activity tracking

## NIST Compliance

Following NIST SP 800-53 security controls:

### Access Control (AC)

#### AC-2: Account Management

```typescript
// @NIST-Control: AC-2
interface UserAccount {
  id: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
  createdAt: Date;
  lastLogin: Date;
  status: 'active' | 'suspended' | 'deleted';
}

class AccountManager {
  async createAccount(data: CreateAccountDto): Promise<UserAccount> {
    // Validate input
    const validated = createAccountSchema.parse(data);

    // Check permissions
    if (!this.hasPermission(requester, 'account:create')) {
      throw new ForbiddenError('Insufficient permissions');
    }

    // Create account with audit trail
    const account = await this.db.accounts.create({
      ...validated,
      createdBy: requester.id,
      createdAt: new Date(),
    });

    // Log account creation
    await this.audit.log({
      action: 'account.created',
      actor: requester.id,
      target: account.id,
      timestamp: new Date(),
    });

    return account;
  }
}
```

#### AC-3: Access Enforcement

```typescript
// @NIST-Control: AC-3
class AccessControl {
  async checkAccess(user: User, resource: Resource, action: Action): Promise<boolean> {
    // Check user permissions
    const userPermissions = await this.getUserPermissions(user);

    // Check resource permissions
    const resourcePermissions = await this.getResourcePermissions(resource);

    // Evaluate access policy
    return this.policyEngine.evaluate({
      user,
      userPermissions,
      resource,
      resourcePermissions,
      action,
    });
  }
}
```

### Identification and Authentication (IA)

#### IA-2: Authentication

```typescript
// @NIST-Control: IA-2
class AuthenticationService {
  async authenticate(credentials: Credentials): Promise<AuthResult> {
    // Multi-factor authentication support
    if (credentials.type === 'password') {
      const user = await this.validatePassword(credentials.username, credentials.password);

      if (user.mfaEnabled) {
        return {
          status: 'mfa_required',
          challengeId: await this.createMfaChallenge(user),
        };
      }

      return this.createSession(user);
    }

    if (credentials.type === 'mfa') {
      return this.validateMfaChallenge(credentials.challengeId, credentials.code);
    }
  }
}
```

#### IA-5: Authenticator Management

```typescript
// @NIST-Control: IA-5
class PasswordPolicy {
  static readonly MIN_LENGTH = 12;
  static readonly REQUIRE_UPPERCASE = true;
  static readonly REQUIRE_LOWERCASE = true;
  static readonly REQUIRE_NUMBERS = true;
  static readonly REQUIRE_SPECIAL = true;
  static readonly MAX_AGE_DAYS = 90;
  static readonly HISTORY_COUNT = 5;

  validate(password: string): ValidationResult {
    const errors: string[] = [];

    if (password.length < PasswordPolicy.MIN_LENGTH) {
      errors.push(`Password must be at least ${PasswordPolicy.MIN_LENGTH} characters`);
    }

    if (PasswordPolicy.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letters');
    }

    // Additional checks...

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
```

### System and Communications Protection (SC)

#### SC-8: Transmission Confidentiality

```typescript
// @NIST-Control: SC-8
class SecureTransport {
  private readonly tlsConfig = {
    minVersion: 'TLSv1.2',
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-CHACHA20-POLY1305',
    ],
    honorCipherOrder: true,
    secureOptions:
      constants.SSL_OP_NO_SSLv2 |
      constants.SSL_OP_NO_SSLv3 |
      constants.SSL_OP_NO_TLSv1 |
      constants.SSL_OP_NO_TLSv1_1,
  };

  createSecureServer(): https.Server {
    return https.createServer({
      cert: fs.readFileSync('cert.pem'),
      key: fs.readFileSync('key.pem'),
      ...this.tlsConfig,
    });
  }
}
```

## Authentication Implementation

### JWT Token Management

```typescript
// jwt.service.ts
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

interface TokenPayload {
  sub: string; // Subject (user ID)
  iat: number; // Issued at
  exp: number; // Expiration
  jti: string; // JWT ID
  roles: string[];
  permissions: string[];
}

class JwtService {
  private readonly secret: string;
  private readonly issuer = 'puppeteer-mcp';
  private readonly audience = 'puppeteer-mcp-api';

  constructor() {
    this.secret = process.env.JWT_SECRET || this.generateSecret();
  }

  private generateSecret(): string {
    return randomBytes(64).toString('hex');
  }

  async sign(userId: string, roles: string[], permissions: string[]): Promise<string> {
    const payload: TokenPayload = {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
      jti: randomBytes(16).toString('hex'),
      roles,
      permissions,
    };

    return jwt.sign(payload, this.secret, {
      algorithm: 'HS256',
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  async verify(token: string): Promise<TokenPayload> {
    try {
      return jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
      }) as TokenPayload;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }

  async revoke(tokenId: string): Promise<void> {
    await this.tokenBlacklist.add(tokenId);
  }
}
```

### API Key Management

```typescript
// api-key.service.ts
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

class ApiKeyService {
  private readonly keyPrefix = 'pmcp_';
  private readonly keyLength = 32;

  async generate(name: string, permissions: string[]): Promise<ApiKey> {
    // Generate random key
    const rawKey = randomBytes(this.keyLength);
    const key = `${this.keyPrefix}${rawKey.toString('hex')}`;

    // Hash for storage
    const hash = await this.hash(key);

    // Store in database
    const apiKey = await this.db.apiKeys.create({
      name,
      hash,
      permissions,
      createdAt: new Date(),
      lastUsed: null,
    });

    return {
      id: apiKey.id,
      key, // Only returned once
      name,
      permissions,
    };
  }

  async hash(key: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = (await scryptAsync(key, salt, 64)) as Buffer;
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }

  async verify(key: string, hash: string): Promise<boolean> {
    const [salt, storedHash] = hash.split(':');
    const saltBuffer = Buffer.from(salt, 'hex');
    const storedHashBuffer = Buffer.from(storedHash, 'hex');

    const derivedHash = (await scryptAsync(key, saltBuffer, 64)) as Buffer;
    return timingSafeEqual(storedHashBuffer, derivedHash);
  }
}
```

## Input Validation

### Zod Schema Validation

```typescript
// validation.schemas.ts
import { z } from 'zod';

// URL validation with restrictions
const urlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      const parsed = new URL(url);
      // Prevent SSRF attacks
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
      const blockedProtocols = ['file:', 'ftp:', 'ssh:'];

      return !blockedHosts.includes(parsed.hostname) && !blockedProtocols.includes(parsed.protocol);
    },
    {
      message: 'Invalid or blocked URL',
    },
  );

// Session creation schema
export const createSessionSchema = z.object({
  baseUrl: urlSchema,
  viewport: z
    .object({
      width: z.number().min(320).max(3840),
      height: z.number().min(240).max(2160),
    })
    .optional(),
  userAgent: z.string().max(500).optional(),
  cookies: z
    .array(
      z.object({
        name: z.string().max(100),
        value: z.string().max(4096),
        domain: z.string().max(255),
        path: z.string().max(255),
        secure: z.boolean(),
        httpOnly: z.boolean(),
        sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
      }),
    )
    .max(100)
    .optional(),
});

// JavaScript execution schema
export const evaluateScriptSchema = z.object({
  sessionId: z.string().uuid(),
  script: z
    .string()
    .max(10000)
    .refine(
      (script) => {
        // Basic XSS prevention
        const dangerous = [
          'document.cookie',
          'localStorage',
          'sessionStorage',
          'fetch(',
          'XMLHttpRequest',
          'eval(',
        ];

        return !dangerous.some((pattern) => script.includes(pattern));
      },
      {
        message: 'Script contains potentially dangerous code',
      },
    ),
  args: z.array(z.any()).max(10).optional(),
});
```

### Request Sanitization

```typescript
// sanitization.middleware.ts
import DOMPurify from 'isomorphic-dompurify';
import { Request, Response, NextFunction } from 'express';

export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize string inputs
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove HTML tags and scripts
      return DOMPurify.sanitize(value, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });
    }

    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }

    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }

    return value;
  };

  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);

  next();
}
```

## Session Security

### Session Isolation

```typescript
// session-isolation.ts
class SessionIsolation {
  async createIsolatedSession(options: SessionOptions): Promise<Session> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        // Process isolation
        '--site-per-process',
        '--isolate-origins',
        // Disable features
        '--disable-webgl',
        '--disable-webgl2',
        '--disable-3d-apis',
        '--disable-plugins',
        '--disable-java',
        // Security
        '--enable-strict-mixed-content-checking',
        '--block-new-web-contents',
      ],
    });

    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();

    // Disable dangerous features
    await page.evaluateOnNewDocument(() => {
      // @ts-ignore
      delete window.WebAssembly;
      delete window.Worker;
      delete window.SharedWorker;

      // Override dangerous APIs
      window.eval = () => {
        throw new Error('eval is disabled');
      };
      window.Function = () => {
        throw new Error('Function constructor is disabled');
      };
    });

    // Set resource limits
    await page.setCacheEnabled(false);
    await page.setBypassCSP(false);

    return {
      id: generateSessionId(),
      browser,
      context,
      page,
      createdAt: new Date(),
      lastActivity: new Date(),
    };
  }
}
```

### Resource Limits

```typescript
// resource-limits.ts
class ResourceLimiter {
  private readonly limits = {
    maxMemoryMB: 512,
    maxCpuPercent: 50,
    maxNetworkBandwidthKbps: 10000,
    maxDiskUsageMB: 100,
  };

  async enforceMemoryLimit(page: Page): Promise<void> {
    const metrics = await page.metrics();

    if (metrics.JSHeapUsedSize > this.limits.maxMemoryMB * 1024 * 1024) {
      throw new ResourceLimitError('Memory limit exceeded');
    }
  }

  async enforceNetworkLimit(page: Page): Promise<void> {
    // Throttle network
    const client = await page.target().createCDPSession();
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (this.limits.maxNetworkBandwidthKbps * 1024) / 8,
      uploadThroughput: (this.limits.maxNetworkBandwidthKbps * 1024) / 8,
      latency: 0,
    });
  }

  async enforceTimeout(page: Page, timeout: number): Promise<void> {
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
  }
}
```

## Security Headers

```typescript
// security-headers.middleware.ts
import helmet from 'helmet';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
      blockAllMixedContent: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: false,
});

// Additional security headers
export function additionalSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.removeHeader('X-Powered-By');
  next();
}
```

## Audit Logging

```typescript
// audit-logger.ts
interface AuditLog {
  id: string;
  timestamp: Date;
  actor: {
    id: string;
    ip: string;
    userAgent: string;
  };
  action: string;
  resource: {
    type: string;
    id: string;
  };
  result: 'success' | 'failure';
  metadata?: Record<string, any>;
}

class AuditLogger {
  async log(event: AuditEvent): Promise<void> {
    const log: AuditLog = {
      id: generateId(),
      timestamp: new Date(),
      actor: {
        id: event.userId,
        ip: event.ip,
        userAgent: event.userAgent,
      },
      action: event.action,
      resource: {
        type: event.resourceType,
        id: event.resourceId,
      },
      result: event.result,
      metadata: event.metadata,
    };

    // Store in database
    await this.db.auditLogs.create(log);

    // Send to SIEM if configured
    if (this.siemEnabled) {
      await this.sendToSiem(log);
    }

    // Alert on suspicious activity
    if (this.isSuspicious(log)) {
      await this.alertSecurityTeam(log);
    }
  }

  private isSuspicious(log: AuditLog): boolean {
    // Multiple failed auth attempts
    // Unusual access patterns
    // Privilege escalation attempts
    // Data exfiltration indicators
    return false; // Implement detection logic
  }
}
```

## Security Best Practices

### 1. Secure Configuration

```typescript
// config.security.ts
export const securityConfig = {
  // Authentication
  auth: {
    tokenExpiry: '24h',
    refreshTokenExpiry: '7d',
    maxLoginAttempts: 5,
    lockoutDuration: '15m',
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecial: true,
      maxAge: 90,
      historyCount: 5,
    },
  },

  // Session security
  session: {
    timeout: 30 * 60 * 1000, // 30 minutes
    maxConcurrent: 5,
    isolateBrowserContexts: true,
    disableJavaScript: false,
    blockNewWindows: true,
  },

  // Network security
  network: {
    allowedProtocols: ['http:', 'https:'],
    blockedHosts: [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '169.254.169.254', // AWS metadata
      '*.internal',
      '*.local',
    ],
    maxRedirects: 5,
    timeout: 30000,
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    skipSuccessfulRequests: false,
    keyGenerator: (req: Request) => {
      return req.ip || req.headers['x-forwarded-for'] || 'unknown';
    },
  },
};
```

### 2. Security Monitoring

```typescript
// security-monitor.ts
class SecurityMonitor {
  private readonly alerts = new EventEmitter();

  async detectAnomalies(metrics: SecurityMetrics): Promise<void> {
    // Unusual authentication patterns
    if (metrics.failedLogins > 10) {
      this.alerts.emit('security:alert', {
        type: 'brute_force_attempt',
        severity: 'high',
        details: metrics,
      });
    }

    // Suspicious API usage
    if (metrics.apiCallsPerMinute > 1000) {
      this.alerts.emit('security:alert', {
        type: 'api_abuse',
        severity: 'medium',
        details: metrics,
      });
    }

    // Resource exhaustion
    if (metrics.activeSessionsPerUser > 50) {
      this.alerts.emit('security:alert', {
        type: 'resource_exhaustion',
        severity: 'high',
        details: metrics,
      });
    }
  }
}
```

### 3. Incident Response

```typescript
// incident-response.ts
class IncidentResponse {
  async handleSecurityIncident(incident: SecurityIncident): Promise<void> {
    // 1. Contain the threat
    await this.containThreat(incident);

    // 2. Assess the damage
    const impact = await this.assessImpact(incident);

    // 3. Notify stakeholders
    await this.notifyStakeholders(incident, impact);

    // 4. Collect evidence
    const evidence = await this.collectEvidence(incident);

    // 5. Remediate
    await this.remediate(incident, impact);

    // 6. Document lessons learned
    await this.documentIncident(incident, impact, evidence);
  }

  private async containThreat(incident: SecurityIncident): Promise<void> {
    switch (incident.type) {
      case 'account_compromise':
        await this.lockAccount(incident.affectedAccounts);
        await this.revokeTokens(incident.affectedAccounts);
        break;

      case 'api_abuse':
        await this.blockIpAddresses(incident.sourceIps);
        await this.revokeApiKeys(incident.compromisedKeys);
        break;

      case 'data_breach':
        await this.isolateAffectedSystems(incident.systems);
        await this.rotateCredentials();
        break;
    }
  }
}
```

## Compliance & Regulations

### GDPR Compliance

```typescript
// gdpr-compliance.ts
class GdprCompliance {
  // Right to access
  async exportUserData(userId: string): Promise<UserData> {
    const data = await this.collectUserData(userId);
    return this.anonymizeSensitiveData(data);
  }

  // Right to be forgotten
  async deleteUserData(userId: string): Promise<void> {
    await this.db.transaction(async (trx) => {
      // Delete personal data
      await trx.users.delete(userId);
      await trx.sessions.deleteByUser(userId);
      await trx.auditLogs.anonymizeByUser(userId);

      // Log deletion
      await trx.dataRetention.create({
        action: 'user_deletion',
        userId: userId,
        timestamp: new Date(),
        reason: 'gdpr_request',
      });
    });
  }

  // Data minimization
  async cleanupOldData(): Promise<void> {
    const retentionPeriod = 90 * 24 * 60 * 60 * 1000; // 90 days
    const cutoffDate = new Date(Date.now() - retentionPeriod);

    await this.db.auditLogs.deleteOlderThan(cutoffDate);
    await this.db.sessions.deleteInactiveOlderThan(cutoffDate);
  }
}
```

## Security Checklist

- [ ] **Authentication**
  - [ ] Strong password policy enforced
  - [ ] MFA available for all accounts
  - [ ] Token rotation implemented
  - [ ] Session timeouts configured

- [ ] **Authorization**
  - [ ] RBAC implemented
  - [ ] Least privilege principle
  - [ ] Regular permission audits
  - [ ] API scoping

- [ ] **Input Validation**
  - [ ] All inputs validated
  - [ ] SQL injection prevention
  - [ ] XSS protection
  - [ ] CSRF tokens

- [ ] **Network Security**
  - [ ] TLS 1.2+ only
  - [ ] Strong cipher suites
  - [ ] Certificate pinning
  - [ ] Firewall rules

- [ ] **Monitoring**
  - [ ] Security alerts configured
  - [ ] Audit logging enabled
  - [ ] Anomaly detection
  - [ ] Regular security scans

- [ ] **Incident Response**
  - [ ] Response plan documented
  - [ ] Contact list updated
  - [ ] Backup procedures tested
  - [ ] Recovery time objectives
