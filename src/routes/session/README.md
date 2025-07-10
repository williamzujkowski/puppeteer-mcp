# Session Route Handlers Module

This module contains the refactored session route handlers, organized following SOLID principles and design patterns.

## Architecture

The session handlers have been modularized into focused components:

### Handler Factories (Factory Pattern)
- `SessionCreationHandlerFactory` - Handles session creation operations
- `SessionRetrievalHandlerFactory` - Handles session retrieval operations  
- `SessionUpdateHandlerFactory` - Handles token refresh/revoke operations
- `SessionDeletionHandlerFactory` - Handles session termination operations

### Supporting Modules
- `schemas.ts` - Zod validation schemas for request validation
- `validation-middleware.ts` - Reusable middleware for authentication and authorization
- `response-formatter.ts` - Consistent response formatting utilities
- `error-handler.ts` - Centralized error handling with security logging

## Design Patterns Used

1. **Factory Pattern**: Each handler factory creates specialized handlers for different operations
2. **Middleware Pattern**: Validation middleware for authentication, authorization, and parameter validation
3. **Chain of Responsibility**: Error handling flows through middleware chain
4. **Single Responsibility**: Each module has a focused, single purpose

## Usage

The main `session-handlers.ts` file maintains backward compatibility by wrapping the factory methods:

```typescript
import { SessionCreationHandlerFactory } from './session/index.js';

export function handleDevCreateSession(
  req: Request,
  res: Response,
  next: NextFunction,
  sessionStore: SessionStore,
): void {
  const factory = new SessionCreationHandlerFactory(sessionStore);
  asyncHandler(factory.createDevSessionHandler())(req, res, next);
}
```

## Security Features

- NIST control annotations on all security-relevant operations
- Security event logging for all session operations
- Input validation using Zod schemas
- Proper authentication and authorization checks

## File Structure

```
src/routes/session/
├── creation-handlers.ts     # Session creation operations
├── deletion-handlers.ts     # Session termination operations
├── retrieval-handlers.ts    # Session retrieval operations
├── update-handlers.ts       # Token refresh/revoke operations
├── error-handler.ts         # Error handling utilities
├── response-formatter.ts    # Response formatting utilities
├── schemas.ts              # Validation schemas
├── validation-middleware.ts # Reusable middleware
├── index.ts                # Module exports
└── README.md               # This file
```

## Module Sizes

All modules are kept under 200-300 lines as required:
- creation-handlers.ts: ~65 lines
- deletion-handlers.ts: ~170 lines
- retrieval-handlers.ts: ~65 lines
- update-handlers.ts: ~45 lines
- error-handler.ts: ~105 lines
- response-formatter.ts: ~50 lines
- schemas.ts: ~35 lines
- validation-middleware.ts: ~65 lines

## ESLint Compliance

All modules follow ESLint rules:
- Using `??` instead of `||` for nullish coalescing
- Unused parameters prefixed with `_`
- Maximum 4 parameters per function
- Proper TypeScript types throughout