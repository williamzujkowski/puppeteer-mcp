# Core Components

This directory contains the core infrastructure components for the multi-protocol API platform.

## Components

### Configuration (`config.ts`)

- **Purpose**: Centralized configuration management with Zod validation
- **Features**:
  - Environment variable parsing and validation
  - Type-safe configuration access
  - Production configuration validation
  - NIST control tags: CM-6, CM-7, SC-8, SC-13

### Error Handling (`errors.ts`, `errors/`)

- **Purpose**: Comprehensive error handling system
- **Features**:
  - Custom error classes for different scenarios
  - Error serialization for REST, gRPC, and WebSocket
  - Consistent error codes across protocols
  - NIST control tags: SI-11

### Middleware (`middleware/`)

- **Components**:
  - `error-handler.ts`: Global error handling middleware
  - `request-id.ts`: Request ID generation and tracking
  - `request-logger.ts`: Request/response logging
  - `security-headers.ts`: Security headers configuration
- **NIST control tags**: AU-2, AU-3, AU-10, SC-8, SC-13, AC-4

## Usage

### Configuration

```typescript
import { config } from '@core/config';

// Access configuration values
console.log(config.PORT);
console.log(config.JWT_SECRET);

// Validate production config
import { validateProductionConfig } from '@core/config';
validateProductionConfig();
```

### Error Handling

```typescript
import {
  AppError,
  ValidationError,
  serializeErrorForREST,
  serializeErrorForGRPC,
  serializeErrorForWebSocket,
} from '@core/errors';

// Throw custom errors
throw new ValidationError('Invalid input', { field: 'email' });

// Serialize errors for different protocols
const restError = serializeErrorForREST(error, requestId);
const grpcError = serializeErrorForGRPC(error);
const wsError = serializeErrorForWebSocket(error, messageId);
```

### Middleware

```typescript
import {
  errorHandler,
  requestIdMiddleware,
  requestLogger,
  createSecurityHeaders,
  additionalSecurityHeaders,
  createCORSMiddleware,
} from '@core/middleware';

// Apply middleware to Express app
app.use(requestIdMiddleware());
app.use(requestLogger(logger));
app.use(createSecurityHeaders());
app.use(additionalSecurityHeaders());
app.use(createCORSMiddleware());

// Error handler must be last
app.use(errorHandler(logger));
```

## Security Considerations

1. **Configuration Security**:
   - JWT secrets must be set in production
   - TLS must be enabled in production
   - Audit logging must be enabled in production

2. **Error Handling**:
   - Sensitive information is not exposed in production
   - All errors are logged with appropriate context
   - Error responses follow consistent format

3. **Middleware Security**:
   - Request IDs enable request tracking
   - Security headers protect against common attacks
   - CORS is configured restrictively
   - All requests are logged for audit trail

## NIST Compliance

The core components implement the following NIST controls:

- **AC-4**: Information flow enforcement (CORS)
- **AU-2**: Audit events (logging)
- **AU-3**: Content of audit records (structured logging)
- **AU-10**: Non-repudiation (request tracking)
- **CM-6**: Configuration settings
- **CM-7**: Least functionality
- **SC-5**: Denial of service protection (rate limiting)
- **SC-8**: Transmission confidentiality and integrity
- **SC-13**: Cryptographic protection
- **SI-11**: Error handling
