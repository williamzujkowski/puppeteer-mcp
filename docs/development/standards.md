# Development Standards

**Version**: 1.0.0  
**Last Updated**: 2025-01-03  
**Status**: Active  
**Category**: Development Standards

## Table of Contents

1. [Overview](#overview)
2. [Code Standards (CS:TS)](#code-standards-csts)
3. [Testing Standards (TS:JEST)](#testing-standards-tsjest)
4. [Security Standards (SEC:API)](#security-standards-secapi)
5. [NIST Compliance (NIST-IG)](#nist-compliance-nist-ig)
6. [Container Standards (CN:DOCKER)](#container-standards-cndocker)
7. [Browser Automation Standards](#browser-automation-standards)
8. [Quick Reference](#quick-reference)

## Overview

This document details the coding and security standards for the puppeteer-mcp project. All code must
comply with these standards, which are based on William Zujkowski's standards repository
(https://github.com/williamzujkowski/standards).

### Compliance Status

- **Code Standards**: ✅ ACHIEVED
- **Testing Standards**: ✅ IMPLEMENTED
- **Security Standards**: ✅ COMPREHENSIVE IMPLEMENTATION
- **NIST Compliance**: ✅ FULLY IMPLEMENTED
- **Container Standards**: ✅ BETA RELEASE

## Code Standards (CS:TS)

### TypeScript Configuration

```typescript
// tsconfig.json requirements
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### File Organization

- **Maximum Lines**: 300 lines per file
- **Single Responsibility**: One primary export per file
- **Barrel Exports**: Use index.ts for public APIs

```typescript
// GOOD: Focused file with single responsibility
// auth-handler.ts (250 lines)
export class AuthHandler {
  // Implementation
}

// BAD: Multiple responsibilities in one file
// everything.ts (500+ lines)
export class AuthHandler {}
export class SessionManager {}
export class TokenValidator {}
```

### Function Complexity

- **Maximum Complexity**: 10 (cyclomatic complexity)
- **Extract Helper Functions**: Break down complex logic

```typescript
// GOOD: Extracted helper functions
function validateBrowserAction(action: BrowserAction): ValidationResult {
  if (!isValidActionType(action.type)) {
    return { valid: false, error: 'Invalid action type' };
  }

  if (!hasRequiredParams(action)) {
    return { valid: false, error: 'Missing required parameters' };
  }

  return validateActionSecurity(action);
}

// Helper functions keep complexity low
function isValidActionType(type: string): boolean {
  return VALID_ACTION_TYPES.includes(type);
}

function hasRequiredParams(action: BrowserAction): boolean {
  const schema = ACTION_SCHEMAS[action.type];
  return schema ? schema.safeParse(action.params).success : false;
}
```

### Parameter Count

- **Maximum Parameters**: 4
- **Use Interfaces**: Group related parameters

```typescript
// GOOD: Interface for grouped parameters
interface CreateSessionOptions {
  userId: string;
  permissions: Permission[];
  metadata?: SessionMetadata;
  expiresIn?: number;
}

function createSession(options: CreateSessionOptions): Session {
  // Implementation
}

// BAD: Too many parameters
function createSession(
  userId: string,
  permissions: Permission[],
  metadata: SessionMetadata,
  expiresIn: number,
  ipAddress: string,
  userAgent: string,
): Session {
  // Hard to use and maintain
}
```

### Naming Conventions

```typescript
// Classes and Interfaces: PascalCase
class BrowserPool {}
interface SessionStore {}

// Functions and Variables: camelCase
function executeAction() {}
const maxRetries = 3;

// Constants: UPPER_SNAKE_CASE
const MAX_POOL_SIZE = 5;
const DEFAULT_TIMEOUT = 30000;

// Private members: underscore prefix
class Service {
  private _internalState: State;
}

// Type parameters: single letter or descriptive
type Result<T> = { data: T } | { error: Error };
type KeyValue<TKey, TValue> = Map<TKey, TValue>;
```

### Documentation

All public APIs must have JSDoc documentation:

````typescript
/**
 * Executes a browser action within a security context
 *
 * @param sessionId - The session requesting the action
 * @param action - The browser action to execute
 * @returns Promise resolving to action result
 * @throws {SecurityError} If action validation fails
 * @throws {ResourceError} If browser pool is exhausted
 *
 * @example
 * ```typescript
 * const result = await executeAction('session-123', {
 *   type: 'navigate',
 *   params: { url: 'https://example.com' }
 * });
 * ```
 */
export async function executeAction(
  sessionId: string,
  action: BrowserAction,
): Promise<ActionResult> {
  // Implementation
}
````

### Architecture Principles

1. **SOLID Principles**
   - Single Responsibility
   - Open/Closed
   - Liskov Substitution
   - Interface Segregation
   - Dependency Inversion

2. **Dependency Injection**

   ```typescript
   // GOOD: Dependencies injected
   class SessionService {
     constructor(
       private store: SessionStore,
       private auth: AuthService,
       private logger: Logger,
     ) {}
   }
   ```

3. **Clear Separation of Concerns**
   - Business logic separate from infrastructure
   - Protocol handlers separate from core logic
   - Security checks in dedicated middleware

## Testing Standards (TS:JEST)

### Coverage Requirements

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 85,
        "lines": 85,
        "statements": 85
      },
      "./src/auth/**/*.ts": {
        "branches": 95,
        "functions": 95,
        "lines": 95,
        "statements": 95
      },
      "./src/utils/**/*.ts": {
        "branches": 100,
        "functions": 100,
        "lines": 100,
        "statements": 100
      }
    }
  }
}
```

### Test Types

#### 1. Hypothesis Tests

Test specific behaviors and assumptions:

```typescript
describe('SessionStore', () => {
  it('should create unique session IDs', async () => {
    const store = new SessionStore();
    const ids = await Promise.all(
      Array(1000)
        .fill(0)
        .map(() => store.createSession()),
    );
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(1000);
  });
});
```

#### 2. Regression Tests

Prevent bugs from reoccurring:

```typescript
describe('PageManager', () => {
  it('should use consistent page- prefix for IDs (regression #123)', () => {
    const pageId = pageManager.generatePageId();
    expect(pageId).toMatch(/^page-[a-z0-9]+$/);
    // Bug: Was returning 'browser-' prefix
  });
});
```

#### 3. Benchmark Tests

Ensure performance SLAs:

```typescript
describe('Performance', () => {
  it('should acquire browser in <1s', async () => {
    const start = Date.now();
    const browser = await pool.acquire();
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000);
    await pool.release(browser);
  });
});
```

#### 4. Property-Based Tests

Test edge cases with generated data:

```typescript
describe('Input Validation', () => {
  it.each([
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
    ['XSS attempt', '<script>alert(1)</script>'],
    ['SQL injection', "'; DROP TABLE users; --"],
  ])('should reject invalid input: %s', (_, input) => {
    expect(() => validateInput(input)).toThrow();
  });
});
```

### Test-First Development

1. **Write failing test first**

   ```typescript
   it('should authenticate API key', async () => {
     const result = await authenticateApiKey('valid-key');
     expect(result.authenticated).toBe(true);
   });
   ```

2. **Implement minimal code to pass**

   ```typescript
   async function authenticateApiKey(key: string) {
     return { authenticated: true };
   }
   ```

3. **Refactor and enhance**
   ```typescript
   async function authenticateApiKey(key: string) {
     const apiKey = await store.getApiKey(key);
     if (!apiKey || apiKey.revoked) {
       return { authenticated: false };
     }
     return { authenticated: true, userId: apiKey.userId };
   }
   ```

## Security Standards (SEC:API)

### Zero Trust Architecture

Never trust any input or caller:

```typescript
// Every request must be authenticated
app.use('/api/*', authenticate);

// Every action must be authorized
app.use('/api/*', authorize);

// Every input must be validated
app.use('/api/*', validateInput);
```

### Authentication Implementation

```typescript
// JWT with proper verification
import jwt from 'jsonwebtoken';

export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: '24h',
    }) as TokenPayload;
  } catch (error) {
    throw new AuthenticationError('Invalid token');
  }
}

// API Key authentication
export async function verifyApiKey(key: string): Promise<ApiKeyInfo> {
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const apiKey = await store.getApiKeyByHash(hash);

  if (!apiKey || apiKey.revoked || apiKey.expiresAt < new Date()) {
    throw new AuthenticationError('Invalid API key');
  }

  return apiKey;
}
```

### Required Security Headers

```typescript
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' },
    permissionsPolicy: {
      features: {
        geolocation: ["'none'"],
        camera: ["'none'"],
        microphone: ["'none'"],
      },
    },
  }),
);
```

### Input Validation

All inputs must be validated with Zod schemas:

```typescript
import { z } from 'zod';

// Define schemas for all inputs
const CreateSessionSchema = z.object({
  userId: z.string().uuid(),
  permissions: z.array(z.enum(['read', 'write', 'admin'])),
  metadata: z
    .object({
      ipAddress: z.string().ip(),
      userAgent: z.string().max(500),
    })
    .optional(),
});

// Validation middleware
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues,
      });
    }
    req.body = result.data;
    next();
  };
}

// Usage
app.post('/sessions', validateBody(CreateSessionSchema), async (req, res) => {
  // req.body is now typed and validated
});
```

### Rate Limiting

Implement per-endpoint rate limits:

```typescript
import rateLimit from 'express-rate-limit';

// Global rate limit
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests',
  }),
);

// Strict limit for auth endpoints
app.use(
  '/auth/*',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
  }),
);

// Lenient limit for read operations
app.use(
  '/api/*/read',
  rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
  }),
);
```

## NIST Compliance (NIST-IG)

### Required Control Tags

All security-related functions must be tagged with NIST controls:

```typescript
/**
 * Authenticates a user request
 *
 * @nist ia-2 "Identification and Authentication (Organizational Users)"
 * @nist ia-5 "Authenticator Management"
 * @nist ac-3 "Access Enforcement"
 * @evidence code - JWT validation implementation
 * @evidence test - auth.test.ts covers all paths
 */
export async function authenticateRequest(req: Request): Promise<User> {
  const token = extractToken(req);
  const payload = await verifyToken(token);
  return getUserFromPayload(payload);
}

/**
 * Logs security events
 *
 * @nist au-3 "Content of Audit Records"
 * @nist au-4 "Audit Storage Capacity"
 * @nist au-9 "Protection of Audit Information"
 * @evidence code - Structured logging with tamper protection
 * @evidence test - audit-log.test.ts
 */
export function logSecurityEvent(event: SecurityEvent): void {
  logger.security({
    timestamp: new Date().toISOString(),
    eventType: event.type,
    userId: event.userId,
    ipAddress: event.ipAddress,
    outcome: event.outcome,
    details: event.details,
  });
}
```

### Common NIST Controls

| Control | Description                       | Implementation                  |
| ------- | --------------------------------- | ------------------------------- |
| AC-3    | Access Enforcement                | Role-based access control       |
| AU-3    | Content of Audit Records          | Structured security logging     |
| IA-2    | Identification and Authentication | Multi-factor authentication     |
| IA-5    | Authenticator Management          | Password policies, key rotation |
| SC-18   | Mobile Code                       | JavaScript execution controls   |
| SI-10   | Information Input Validation      | Zod schemas, sanitization       |

## Container Standards (CN:DOCKER)

### Multi-Stage Builds

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Security scan stage
FROM builder AS security
RUN npm audit --production
RUN npm install -g snyk
RUN snyk test

# Production stage
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### Security Best Practices

1. **Non-root user execution**

   ```dockerfile
   USER nodejs
   ```

2. **Health checks**

   ```dockerfile
   HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
     CMD node healthcheck.js
   ```

3. **Graceful shutdown**

   ```typescript
   process.on('SIGTERM', async () => {
     logger.info('SIGTERM received, shutting down gracefully');
     await server.close();
     await browserPool.shutdown();
     process.exit(0);
   });
   ```

4. **Read-only root filesystem**
   ```dockerfile
   # In docker-compose.yml
   services:
     app:
       read_only: true
       tmpfs:
         - /tmp
         - /app/logs
   ```

## Browser Automation Standards

### Security Validation

All browser actions must be validated:

```typescript
/**
 * @nist si-10 "Information Input Validation"
 * @nist sc-18 "Mobile Code"
 */
export function validateBrowserAction(action: BrowserAction): ValidationResult {
  // Check action type
  if (!ALLOWED_ACTIONS.includes(action.type)) {
    return { valid: false, error: 'Forbidden action type' };
  }

  // Validate parameters
  const schema = ACTION_SCHEMAS[action.type];
  const result = schema.safeParse(action.params);

  if (!result.success) {
    return { valid: false, error: 'Invalid parameters' };
  }

  // Security checks for evaluate action
  if (action.type === 'evaluate') {
    const script = action.params.script;
    if (containsDangerousCode(script)) {
      return { valid: false, error: 'Potentially dangerous code detected' };
    }
  }

  return { valid: true };
}

function containsDangerousCode(script: string): boolean {
  const dangerous = [
    'eval',
    'Function',
    'setTimeout',
    'setInterval',
    'document.write',
    'innerHTML',
    'outerHTML',
  ];
  return dangerous.some((keyword) => script.includes(keyword));
}
```

### Resource Management

```typescript
// Browser pool configuration
export const BROWSER_POOL_CONFIG = {
  maxSize: 5, // Maximum concurrent browsers
  minSize: 1, // Minimum ready browsers
  acquireTimeout: 30000, // Max wait for browser
  createTimeout: 30000, // Max time to launch browser
  idleTimeout: 300000, // Idle browser cleanup
  validateOnBorrow: true, // Health check before use
};

// Automatic cleanup
export async function cleanupIdleBrowsers(): Promise<void> {
  const idleBrowsers = await pool.getIdleBrowsers();

  for (const browser of idleBrowsers) {
    if (browser.idleTime > BROWSER_POOL_CONFIG.idleTimeout) {
      await browser.close();
      pool.remove(browser);
    }
  }
}
```

### Performance Monitoring

```typescript
// Track all browser actions
export async function trackAction(action: BrowserAction, duration: number): Promise<void> {
  metrics.histogram('browser.action.duration', duration, {
    action: action.type,
  });

  if (duration > ACTION_SLA[action.type]) {
    logger.warn('Browser action exceeded SLA', {
      action: action.type,
      duration,
      sla: ACTION_SLA[action.type],
    });
  }
}
```

## Quick Reference

### Pre-Commit Checklist

Before committing code, ensure:

- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no errors
- [ ] All tests pass
- [ ] Functions have complexity ≤10
- [ ] Files have ≤300 lines
- [ ] Public APIs have JSDoc comments
- [ ] Security functions have NIST tags
- [ ] Inputs are validated with Zod
- [ ] No secrets in code
- [ ] Dependencies audited

### Common Commands

```bash
# Check TypeScript compilation
npm run typecheck

# Run ESLint
npm run lint

# Run tests with coverage
npm run test:coverage

# Audit dependencies
npm audit

# Check function complexity
npm run complexity

# Full pre-commit check
npm run precommit
```

### Standards Compliance

| Standard  | Status | Key Requirements                                   |
| --------- | ------ | -------------------------------------------------- |
| CS:TS     | ✅     | TypeScript strict, ≤300 lines/file, ≤10 complexity |
| TS:JEST   | ✅     | 85%+ coverage, test-first development              |
| SEC:API   | ✅     | Zero trust, Zod validation, rate limiting          |
| NIST-IG   | ✅     | Control tags on security functions                 |
| CN:DOCKER | ✅     | Multi-stage builds, non-root user                  |

For additional context and examples, see:

- `docs/lessons/implementation.md` - Real-world examples
- `docs/development/workflow.md` - Development process
- Project Standards Repository: https://github.com/williamzujkowski/standards
