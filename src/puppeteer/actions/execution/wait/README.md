# Wait Executor Module Architecture

## Overview

The wait executor module has been refactored from a single 647-line file into a modular architecture
using the Strategy and Factory design patterns. This improves maintainability, testability, and
extensibility while maintaining backward compatibility.

## Architecture

### Design Patterns Applied

1. **Strategy Pattern**: Each wait type (selector, navigation, timeout, function, etc.) is
   implemented as a separate strategy
2. **Factory Pattern**: A factory creates and manages strategy instances
3. **Template Method Pattern**: Base strategy class provides common behavior with abstract methods
   for specialization

### Module Structure

```
wait/
├── types.ts                 # Common types and interfaces
├── base-strategy.ts         # Abstract base strategy class
├── selector-strategy.ts     # Wait for DOM selectors
├── navigation-strategy.ts   # Wait for page navigation
├── timeout-strategy.ts      # Wait for specific duration
├── function-strategy.ts     # Wait for JavaScript functions
├── load-strategy.ts         # Wait for page load states
├── strategy-factory.ts      # Factory for creating strategies
├── wait-executor.ts         # Main executor using strategies
└── index.ts                 # Module exports
```

### Key Components

#### 1. Base Strategy (`base-strategy.ts`)

- Abstract class implementing common wait behavior
- Handles logging, error handling, and result formatting
- Enforces consistent interface for all strategies

#### 2. Individual Strategies

- **SelectorWaitStrategy**: Waits for DOM elements with visibility options
- **NavigationWaitStrategy**: Waits for page navigation events
- **TimeoutWaitStrategy**: Simple delay implementation
- **FunctionWaitStrategy**: Evaluates JavaScript with security validation
- **LoadStateWaitStrategy**: Waits for document ready states
- **NetworkIdleWaitStrategy**: Waits for network to become idle

#### 3. Strategy Factory (`strategy-factory.ts`)

- Creates and manages strategy instances
- Supports custom strategy registration
- Provides configuration options (e.g., security validation)

#### 4. Wait Executor (`wait-executor.ts`)

- Main entry point maintaining backward compatibility
- Routes wait actions to appropriate strategies
- Supports both generic wait actions and specific wait methods

## Security Features

### Function Validation

The `FunctionWaitStrategy` includes comprehensive security validation:

- Dangerous pattern detection (eval, Function constructor, etc.)
- Unicode character validation
- Function size limits
- Can be disabled for testing environments

### NIST Compliance

All modules include appropriate NIST control annotations:

- **AC-3**: Access enforcement
- **AU-3**: Content of audit records
- **SI-10**: Information input validation

## Usage Examples

### Basic Usage

```typescript
import { WaitExecutor } from './wait-executor.js';

const executor = new WaitExecutor();
const result = await executor.executeWaitForSelector(
  '#my-element',
  page,
  context,
  5000, // timeout
  true, // visible
);
```

### Using Strategies Directly

```typescript
import { SelectorWaitStrategy } from './selector-strategy.js';

const strategy = new SelectorWaitStrategy();
const result = await strategy.execute(
  page,
  {
    type: 'selector',
    selector: '#my-element',
    visible: true,
    duration: 5000,
  },
  context,
);
```

### Custom Strategy Registration

```typescript
import { WaitStrategyFactory } from './strategy-factory.js';
import { BaseWaitStrategy } from './base-strategy.js';

class CustomWaitStrategy extends BaseWaitStrategy {
  // Implementation
}

const factory = new WaitStrategyFactory();
factory.registerStrategy('custom', new CustomWaitStrategy());
```

## Backward Compatibility

The original `wait-executor.ts` file now re-exports the modularized implementation:

```typescript
export { ModularWaitExecutor as WaitExecutor } from './wait/wait-executor.js';
```

This ensures existing code continues to work without modification.

## Benefits

1. **Maintainability**: Each strategy is focused and under 200 lines
2. **Testability**: Strategies can be tested independently
3. **Extensibility**: New wait types can be added as new strategies
4. **Security**: Centralized security validation for function execution
5. **Performance**: No runtime overhead from modularization

## Migration Notes

No migration is required for existing code. The module maintains full backward compatibility through
re-exports.
