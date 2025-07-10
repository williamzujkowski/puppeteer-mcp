# Error Handling Module

This directory contains the modularized error handling components for Puppeteer action execution.

## Architecture

The error handling system has been broken down into focused modules following SOLID principles and design patterns:

### Components

1. **error-classifier.ts** (~180 lines)
   - Classifies errors into specific types
   - Extracts relevant context from error messages
   - Determines if errors are retryable
   - Pattern: Strategy pattern for error classification

2. **retry-strategy.ts** (~200 lines)
   - Implements multiple retry strategies (Exponential, Linear, Fibonacci, Adaptive)
   - Calculates retry delays
   - Pattern: Strategy pattern with factory

3. **security-event-handler.ts** (~250 lines)
   - Handles security event logging
   - Analyzes errors for security implications
   - Detects potential attack patterns
   - Pattern: Observer pattern for security events

4. **error-recovery.ts** (~280 lines)
   - Implements recovery strategies for different error types
   - Attempts to recover from specific failures
   - Pattern: Chain of Responsibility pattern

5. **retry-executor.ts** (~295 lines)
   - Coordinates retry execution with recovery
   - Manages retry lifecycle
   - Pattern: Template Method pattern

6. **error-result-factory.ts** (~200 lines)
   - Creates standardized error results
   - Ensures consistent error response format
   - Pattern: Factory pattern

## Design Patterns Applied

- **Strategy Pattern**: Used for retry strategies and error classification
- **Factory Pattern**: Used for creating retry strategies and error results
- **Chain of Responsibility**: Used for error recovery attempts
- **Observer Pattern**: Used for security event notifications
- **Template Method**: Used in retry execution flow

## Usage

The original `ActionErrorHandler` class in `error-handler.ts` maintains backward compatibility while delegating to these specialized modules:

```typescript
import { ActionErrorHandler } from './error-handler.js';

const errorHandler = new ActionErrorHandler({
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000,
  backoffMultiplier: 2,
});

// Handle validation failure
const result = await errorHandler.handleValidationFailure(action, context, validationResult, duration);

// Execute with retry
const result = await errorHandler.executeWithRetry(handler, action, page, context);
```

## Security Features

- NIST-compliant security event logging
- Attack pattern detection (XSS, SQL injection, path traversal)
- Comprehensive audit trails
- Security-aware error classification

## Benefits

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Testability**: Smaller, focused modules are easier to test
3. **Maintainability**: Changes to one aspect don't affect others
4. **Extensibility**: New strategies can be added without modifying existing code
5. **Reusability**: Components can be used independently
6. **Type Safety**: Full TypeScript support with proper types
7. **Performance**: Optimized retry strategies with configurable backoff