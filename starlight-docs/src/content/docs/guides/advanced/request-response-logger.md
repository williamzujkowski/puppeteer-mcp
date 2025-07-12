---
title: Request/Response Logger Middleware
description: Comprehensive HTTP request and response logging with configurable verbosity levels, security features, performance monitoring, and NIST-compliant audit capabilities
---

# Request/Response Logger Middleware

The `request-response-logger` middleware provides comprehensive logging of HTTP requests and responses with configurable verbosity levels, security features, and performance monitoring capabilities.

:::note[Enterprise Logging]
This middleware provides NIST-compliant audit logging with sensitive data redaction, high-precision timing, and comprehensive security event tracking for production environments.
:::

## Features

- **Configurable Verbosity Levels**: Choose from minimal, standard, verbose, or debug logging
- **Security Compliance**: NIST-compliant audit logging with sensitive data redaction
- **Performance Monitoring**: High-precision timing and slow request detection
- **Content Type Filtering**: Selective body logging based on content types
- **Flexible Configuration**: Extensive customization options for different use cases
- **Audit Trail**: Structured logging with security event tracking
- **Error Handling**: Proper error capture and logging
- **Production Ready**: Optimized for high-throughput scenarios

## Installation

The middleware is part of the puppeteer-mcp core middleware package:

```typescript
import {
  createRequestResponseLogger,
  VerbosityLevel,
} from '../src/core/middleware/request-response-logger.js';
```

## Basic Usage

### Quick Start

```typescript
import express from 'express';
import { createRequestResponseLogger } from '../src/core/middleware/request-response-logger.js';

const app = express();

// Use standard logging configuration
app.use(createRequestResponseLogger.standard());

// Your routes here
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});
```

### Verbosity Levels

#### Minimal

Logs only essential information (method, path, status, duration):

```typescript
app.use(createRequestResponseLogger.minimal());
```

#### Standard

Includes basic request/response information with timing:

```typescript
app.use(createRequestResponseLogger.standard());
```

#### Verbose

Includes headers and request bodies (sanitized):

```typescript
app.use(createRequestResponseLogger.verbose());
```

#### Debug

Includes all available information for troubleshooting:

```typescript
app.use(createRequestResponseLogger.debug());
```

## Preset Configurations

### Production

Optimized for production environments with security focus:

```typescript
app.use(
  createRequestResponseLogger.production({
    auditLogging: true,
    includeHeaders: false,
    includeRequestBody: false,
    includeResponseBody: false,
    slowRequestThreshold: 2000,
  }),
);
```

### Development

Verbose logging for development environments:

```typescript
app.use(
  createRequestResponseLogger.development({
    includeHeaders: true,
    includeRequestBody: true,
    includeResponseBody: true,
    slowRequestThreshold: 500,
  }),
);
```

### Security

Enhanced security monitoring with audit logging:

```typescript
app.use(
  createRequestResponseLogger.security({
    auditLogging: true,
    includeHeaders: true,
    includeRequestBody: true,
    includeResponseBody: false,
    skipPaths: [], // Log everything
    highPrecisionTiming: true,
  }),
);
```

### Performance

Minimal logging focused on performance metrics:

```typescript
app.use(
  createRequestResponseLogger.performance({
    verbosity: VerbosityLevel.MINIMAL,
    auditLogging: false,
    includeHeaders: false,
    includeRequestBody: false,
    includeResponseBody: false,
    slowRequestThreshold: 100,
    highPrecisionTiming: true,
  }),
);
```

## Custom Configuration

### Advanced Options

```typescript
import { createLogger } from '../src/utils/logger.js';

const customLogger = createLogger('custom-request-logger');

app.use(
  createRequestResponseLogger.verbose({
    logger: customLogger,
    verbosity: VerbosityLevel.VERBOSE,

    // Content logging
    includeHeaders: true,
    includeResponseHeaders: true,
    includeRequestBody: true,
    includeResponseBody: true,
    maxBodySize: 8192, // 8KB

    // Content type filtering
    loggedContentTypes: ['application/json', 'application/x-www-form-urlencoded', 'text/plain'],

    // Security - sensitive data redaction
    sensitiveHeaders: ['authorization', 'cookie', 'x-api-key', 'x-auth-token'],
    sensitiveBodyFields: ['password', 'token', 'secret', 'apiKey'],

    // Performance monitoring
    highPrecisionTiming: true,
    slowRequestThreshold: 1000, // 1 second

    // Filtering
    skipPaths: ['/health', '/metrics'],
    skipMethods: ['OPTIONS'],
    errorsOnly: false,

    // Audit logging
    auditLogging: true,

    // Custom metadata
    metadataExtractor: (req, res) => ({
      userRole: req.user?.roles?.[0],
      endpoint: req.path,
      apiVersion: req.get('api-version'),
    }),
  }),
);
```

## Configuration Options

### RequestResponseLoggerOptions

| Option                   | Type             | Default                   | Description                      |
| ------------------------ | ---------------- | ------------------------- | -------------------------------- |
| `verbosity`              | `VerbosityLevel` | `STANDARD`                | Logging verbosity level          |
| `logger`                 | `Logger`         | Auto-generated            | Custom Pino logger instance      |
| `includeHeaders`         | `boolean`        | Varies by verbosity       | Include request headers          |
| `includeResponseHeaders` | `boolean`        | Varies by verbosity       | Include response headers         |
| `includeRequestBody`     | `boolean`        | Varies by verbosity       | Include request body             |
| `includeResponseBody`    | `boolean`        | Varies by verbosity       | Include response body            |
| `maxBodySize`            | `number`         | `8192`                    | Maximum body size to log (bytes) |
| `loggedContentTypes`     | `string[]`       | JSON, form, text          | Content types to log body for    |
| `sensitiveHeaders`       | `string[]`       | auth, cookie, etc.        | Headers to redact                |
| `sensitiveBodyFields`    | `string[]`       | password, token, etc.     | Body fields to redact            |
| `auditLogging`           | `boolean`        | `true`                    | Enable audit trail logging       |
| `requestIdHeader`        | `string`         | `'x-request-id'`          | Request ID header name           |
| `highPrecisionTiming`    | `boolean`        | `false`                   | Use high-resolution timing       |
| `skipPaths`              | `string[]`       | `['/health', '/metrics']` | Paths to skip logging            |
| `skipMethods`            | `string[]`       | `[]`                      | HTTP methods to skip             |
| `slowRequestThreshold`   | `number`         | `1000`                    | Slow request threshold (ms)      |
| `errorsOnly`             | `boolean`        | `false`                   | Log only error responses         |
| `metadataExtractor`      | `Function`       | `undefined`               | Custom metadata extractor        |

## Security Features

### NIST Compliance

The middleware implements several NIST controls:

- **AU-2**: Audit events - Comprehensive event logging
- **AU-3**: Content of audit records - Structured log format
- **AU-4**: Audit storage capacity - Configurable log retention
- **AU-8**: Time stamps - Precise timing information
- **AU-10**: Non-repudiation - Immutable audit trail
- **IA-5**: Authenticator management - Credential redaction

### Sensitive Data Redaction

Automatically redacts sensitive information:

```typescript
// Headers redacted by default
const DEFAULT_SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'x-session-token',
  'x-csrf-token',
  'bearer',
  'set-cookie',
];

// Body fields redacted by default
const DEFAULT_SENSITIVE_BODY_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'auth',
  'authorization',
  'credential',
  'apiKey',
  'sessionId',
  'refreshToken',
  'accessToken',
  'jwt',
  'privateKey',
  'signature',
];
```

### Audit Trail

Security events are logged to the audit trail:

```typescript
await logSecurityEvent(SecurityEventType.HTTP_REQUEST_COMPLETED, {
  userId: req.user?.userId,
  resource: req.path,
  action: req.method,
  result: res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failure',
  metadata: {
    requestId,
    statusCode: res.statusCode,
    duration,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  },
});
```

:::caution[Security Best Practices]
Always customize sensitive field lists for your specific data model and regularly review audit logs for security events and compliance requirements.
:::

## Performance Considerations

### High-Throughput Optimization

- **Conditional Logging**: Skip logging for specified paths/methods
- **Size Limits**: Configurable body size limits
- **Content Type Filtering**: Log only relevant content types
- **Async Processing**: Non-blocking audit logging
- **Memory Efficient**: Streaming JSON parsing

### Monitoring Slow Requests

```typescript
app.use(
  createRequestResponseLogger.standard({
    slowRequestThreshold: 1000, // 1 second
    highPrecisionTiming: true,
    metadataExtractor: (req, res) => ({
      endpoint: req.path,
      userAgent: req.get('user-agent'),
    }),
  }),
);
```

## Integration Examples

### With Authentication Middleware

```typescript
import { authMiddleware } from '../src/auth/middleware.js';
import { createRequestResponseLogger } from '../src/core/middleware/request-response-logger.js';

app.use(authMiddleware());
app.use(
  createRequestResponseLogger.security({
    metadataExtractor: (req, res) => ({
      userId: req.user?.userId,
      userRole: req.user?.roles?.[0],
      sessionId: req.user?.sessionId,
    }),
  }),
);
```

### With Rate Limiting

```typescript
import { rateLimiter } from '../src/core/middleware/rate-limiter.js';
import { createRequestResponseLogger } from '../src/core/middleware/request-response-logger.js';

app.use(rateLimiter());
app.use(
  createRequestResponseLogger.verbose({
    metadataExtractor: (req, res) => ({
      rateLimitRemaining: res.get('x-ratelimit-remaining'),
      rateLimitReset: res.get('x-ratelimit-reset'),
    }),
  }),
);
```

## Log Output Examples

### Standard Request Log

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:00.000Z",
  "type": "HTTP_REQUEST",
  "eventType": "HTTP_REQUEST_STARTED",
  "requestId": "req-123e4567-e89b-12d3-a456-426614174000",
  "method": "POST",
  "url": "/api/users",
  "path": "/api/users",
  "query": {},
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "contentType": "application/json",
  "contentLength": "156",
  "userId": "user-123",
  "sessionId": "session-456"
}
```

### Standard Response Log

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:00.150Z",
  "type": "HTTP_RESPONSE",
  "eventType": "HTTP_REQUEST_COMPLETED",
  "requestId": "req-123e4567-e89b-12d3-a456-426614174000",
  "method": "POST",
  "url": "/api/users",
  "path": "/api/users",
  "statusCode": 201,
  "statusMessage": "Created",
  "duration": 150.25,
  "contentLength": "89",
  "contentType": "application/json",
  "userId": "user-123",
  "sessionId": "session-456",
  "isSlowRequest": false
}
```

### Verbose Request Log with Headers and Body

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:00.000Z",
  "type": "HTTP_REQUEST",
  "eventType": "HTTP_REQUEST_STARTED",
  "requestId": "req-123e4567-e89b-12d3-a456-426614174000",
  "method": "POST",
  "url": "/api/users",
  "path": "/api/users",
  "query": {},
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "contentType": "application/json",
  "contentLength": "156",
  "userId": "user-123",
  "sessionId": "session-456",
  "headers": {
    "host": "api.example.com",
    "content-type": "application/json",
    "authorization": "[REDACTED]",
    "user-agent": "Mozilla/5.0...",
    "accept": "application/json"
  },
  "body": {
    "username": "john.doe",
    "email": "john@example.com",
    "password": "[REDACTED]"
  }
}
```

## Error Handling

The middleware includes comprehensive error handling:

```typescript
// Error in request processing
{
  "level": "error",
  "time": "2024-01-15T10:30:00.000Z",
  "type": "HTTP_ERROR",
  "requestId": "req-123e4567-e89b-12d3-a456-426614174000",
  "method": "POST",
  "url": "/api/users",
  "path": "/api/users",
  "error": "Database connection failed",
  "stack": "Error: Database connection failed\n    at ...",
  "userId": "user-123"
}
```

## Best Practices

:::tip[Best Practice Guidelines]

### Production Deployment

1. **Use Production Preset**: Start with the production configuration
2. **Limit Body Logging**: Set reasonable `maxBodySize` limits
3. **Skip Health Checks**: Exclude `/health` and `/metrics` endpoints
4. **Enable Audit Logging**: Always enable for compliance
5. **Configure Sensitive Fields**: Customize for your data model

### Development Environment

1. **Use Development Preset**: More verbose for debugging
2. **Include Bodies**: Log request/response bodies for debugging
3. **Lower Thresholds**: Detect slow requests earlier
4. **Custom Metadata**: Add debugging information

### Security Considerations

1. **Regular Updates**: Keep sensitive field lists updated
2. **Audit Reviews**: Regularly review audit logs
3. **Access Control**: Secure log file access
4. **Retention Policies**: Implement appropriate log retention
:::

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Reduce `maxBodySize` or limit logged content types
2. **Performance Impact**: Use minimal verbosity in high-throughput scenarios
3. **Log Noise**: Adjust `skipPaths` to exclude noisy endpoints
4. **Missing Logs**: Check verbosity level and filtering options

### Debug Mode

Enable debug mode for detailed logging:

```typescript
app.use(
  createRequestResponseLogger.debug({
    skipPaths: [], // Log everything
    includeHeaders: true,
    includeRequestBody: true,
    includeResponseBody: true,
    maxBodySize: 32768, // 32KB
  }),
);
```

## Related Documentation

- [Architecture Overview](/architecture/) for system design context
- [Security Testing](/testing/security-testing) for security validation
- [Operations Guide](/operations/) for production deployment
- [Telemetry](/operations/telemetry) for observability integration

## Use Cases

### Compliance and Auditing

The middleware provides comprehensive audit trails for:
- Financial services compliance (SOX, PCI-DSS)
- Healthcare compliance (HIPAA)
- Government compliance (NIST, FedRAMP)
- Data protection compliance (GDPR, CCPA)

### Performance Monitoring

Track application performance with:
- Request duration monitoring
- Slow request detection
- Throughput analysis
- Error rate tracking

### Security Monitoring

Monitor security events including:
- Authentication attempts
- Authorization failures
- Suspicious request patterns
- Data access auditing

## Contributing

When contributing to the middleware:

1. Follow existing code style and patterns
2. Add comprehensive tests for new features
3. Update documentation for configuration changes
4. Consider performance impact of new features
5. Maintain NIST compliance for security features

## Conclusion

The request/response logger middleware provides enterprise-grade HTTP logging capabilities with comprehensive security features, performance monitoring, and NIST compliance. By offering multiple verbosity levels and extensive configuration options, it adapts to various deployment scenarios from development debugging to production compliance monitoring.