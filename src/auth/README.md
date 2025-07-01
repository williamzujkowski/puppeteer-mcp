# Authentication Module

This module provides JWT-based authentication and authorization for the MCP platform.

## Features

- JWT token generation and verification
- Access and refresh token support
- Session management integration
- Role-based access control (RBAC)
- API key authentication
- Audit logging for all security events
- NIST compliance (IA-2, AC-3, IA-5, SC-13)

## Usage

### JWT Authentication

```typescript
import { generateTokenPair, verifyToken } from './auth/jwt.js';

// Generate tokens for a user
const tokens = generateTokenPair(userId, username, roles, sessionId);
// Returns: { accessToken, refreshToken, expiresIn }

// Verify a token
const payload = await verifyToken(token, 'access');
```

### Middleware

```typescript
import { createAuthMiddleware, requireRoles } from './auth/middleware.js';

// Apply authentication to routes
router.use(createAuthMiddleware(sessionStore));

// Require specific roles
router.get('/admin', requireRoles('admin'), handler);

// Optional authentication
router.get('/public', optionalAuth(sessionStore), handler);
```

### Token Refresh

```typescript
import { refreshAccessToken } from './auth/refresh.js';

// Refresh an access token
const newTokens = await refreshAccessToken(
  { refreshToken, accessToken },
  sessionStore,
  { ip, userAgent }
);
```

## Security Considerations

1. **Token Storage**: Never store tokens in localStorage. Use httpOnly cookies or secure session storage.
2. **Token Rotation**: Implement refresh token rotation for enhanced security.
3. **Rate Limiting**: Apply rate limiting to authentication endpoints.
4. **Audit Logging**: All authentication events are logged for compliance.

## Configuration

Configure authentication via environment variables:

- `JWT_SECRET`: Secret key for signing tokens (required in production)
- `JWT_EXPIRY`: Access token expiry (default: 24h)
- `JWT_REFRESH_EXPIRY`: Refresh token expiry (default: 7d)
- `JWT_ALGORITHM`: JWT signing algorithm (default: HS512)

## API Key Authentication

For machine-to-machine authentication:

```typescript
import { createApiKeyMiddleware } from './auth/middleware.js';

const validateApiKey = async (key: string) => {
  // Implement your API key validation logic
  return {
    key,
    name: 'api-key-name',
    permissions: ['read', 'write'],
    expiresAt: '2024-12-31T23:59:59Z'
  };
};

router.use(createApiKeyMiddleware(validateApiKey));
```

## Testing

See `tests/unit/auth/` and `tests/integration/` for comprehensive test coverage.