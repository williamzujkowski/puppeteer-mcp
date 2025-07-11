# Evaluation Execution Module

**Version**: 1.0.0  
**Author**: AI Assistant  
**Created**: 2025-07-10

## Overview

This module provides modularized execution strategies for JavaScript evaluation and content
injection operations in the Puppeteer MCP platform. It replaces the monolithic
`evaluation-executor.ts` with focused, specialized modules following SOLID principles and security
best practices.

## Architecture

### Module Structure

```
src/puppeteer/actions/execution/evaluation/
├── types.ts                    # Base types and interfaces
├── security-validator.ts       # Security validation for JS/CSS
├── code-executor.ts            # Page.evaluate operations
├── handle-executor.ts          # Page.evaluateHandle operations
├── injection-executor.ts       # Script/CSS injection operations
├── strategy-factory.ts         # Factory pattern for strategy selection
├── index.ts                    # Public API exports
└── README.md                   # This documentation
```

### Design Patterns

1. **Strategy Pattern**: Different execution strategies for various evaluation types
2. **Factory Pattern**: Centralized creation and management of strategies
3. **Dependency Injection**: Security validators and loggers are injected
4. **Command Pattern**: Each strategy encapsulates an operation

## Security Features

### NIST Compliance

All modules include appropriate NIST control annotations:

- **AC-3**: Access Enforcement - All operations require proper authorization
- **SC-18**: Mobile Code - JavaScript/CSS validation and sandboxing
- **SI-10**: Information Input Validation - Comprehensive input validation
- **SI-11**: Error Handling - Secure error handling without information disclosure

### Security Validations

The `SecurityValidator` provides comprehensive validation for:

#### JavaScript Code

- Dangerous pattern detection (eval, Function, setTimeout, etc.)
- Size limits (50KB maximum)
- Bracket balance validation
- Syntax error detection
- Nesting depth limits

#### CSS Code

- JavaScript injection prevention (javascript:, expression())
- Malicious URL detection in @import statements
- Size limits (100KB maximum)
- Complexity limits (max 1000 selectors)

## Usage Examples

### Basic Code Evaluation

```typescript
import { createStrategyForAction } from './evaluation/index.js';

// Create strategy for code evaluation
const strategy = createStrategyForAction('evaluate');

// Configure evaluation
const config = {
  functionToEvaluate: '() => document.title',
  args: [],
  timeout: 5000,
};

// Execute with security validation
const result = await strategy.execute(config, page, context);
```

### Handle Management

```typescript
import { createStrategyForAction } from './evaluation/index.js';

// Create strategy for handle operations
const strategy = createStrategyForAction('evaluateHandle');

// Execute and get handle
const result = await strategy.execute(config, page, context);

// Cleanup handles when done
if (strategy instanceof HandleExecutionStrategy) {
  await strategy.cleanupSessionHandles(sessionId);
}
```

### Content Injection

```typescript
import { createStrategyForAction } from './evaluation/index.js';

// Script injection
const scriptStrategy = createStrategyForAction('injectScript');
const scriptResult = await scriptStrategy.execute(
  {
    content: 'console.log("Hello World");',
    type: 'script',
    timeout: 10000,
  },
  page,
  context,
);

// CSS injection
const cssStrategy = createStrategyForAction('injectCSS');
const cssResult = await cssStrategy.execute(
  {
    content: 'body { background-color: #f0f0f0; }',
    type: 'css',
    timeout: 5000,
  },
  page,
  context,
);
```

## API Reference

### Core Interfaces

#### BaseEvaluationStrategy

Abstract base class for all evaluation strategies.

```typescript
abstract class BaseEvaluationStrategy {
  abstract execute(
    config: BaseEvaluationConfig,
    page: Page,
    context: ActionContext,
  ): Promise<ActionResult>;
  abstract validateConfig(config: BaseEvaluationConfig): SecurityValidationResult;
  abstract getSupportedTypes(): string[];
}
```

#### SecurityValidator

Interface for code security validation.

```typescript
interface SecurityValidator {
  validateJavaScript(code: string): SecurityValidationResult;
  validateCSS(css: string): SecurityValidationResult;
  checkDangerousPatterns(code: string, patterns: RegExp[]): SecurityIssue[];
}
```

### Strategy Factory

#### createStrategyForAction(actionType: string)

Creates appropriate strategy for the given action type.

**Supported Action Types:**

- `evaluate` - JavaScript code evaluation
- `evaluateHandle` - JavaScript handle evaluation
- `injectScript` - Script injection
- `injectCSS` - CSS injection

### Configuration Types

#### CodeEvaluationConfig

```typescript
interface CodeEvaluationConfig extends BaseEvaluationConfig {
  functionToEvaluate: string;
  args?: unknown[];
}
```

#### InjectionConfig

```typescript
interface InjectionConfig extends BaseEvaluationConfig {
  content: string;
  type: 'script' | 'css';
}
```

## Performance Considerations

### Memory Management

- Handle cleanup is automatic and tracked per session
- Large results are automatically truncated (>100KB)
- Argument size limits prevent memory exhaustion

### Timeout Management

- Different timeouts for different operation types:
  - Code evaluation: 3 seconds
  - Handle operations: 5 seconds
  - Script injection: 10 seconds
  - CSS injection: 5 seconds

### Caching

- Stateless strategies are cached for reuse
- Handle strategies are created fresh to maintain state isolation

## Error Handling

### Error Types

- **ValidationError**: Security validation failures
- **TimeoutError**: Operation timeouts
- **ExecutionError**: JavaScript execution failures
- **InjectionError**: Content injection failures

### Error Response Format

```typescript
{
  success: false,
  actionType: string,
  error: string,
  duration: number,
  timestamp: Date,
  metadata: {
    sessionId: string,
    contextId: string,
    // Additional context-specific metadata
  }
}
```

## Testing

### Unit Testing

Each module includes comprehensive unit tests covering:

- Security validation edge cases
- Error handling scenarios
- Performance benchmarks
- Memory leak detection

### Integration Testing

- End-to-end evaluation workflows
- Cross-strategy compatibility
- Handle lifecycle management

## Migration Guide

### From evaluation-executor.ts

The original `evaluation-executor.ts` maintains backward compatibility:

```typescript
// Old usage (still supported)
const executor = new EvaluationExecutor();
const result = await executor.executeEvaluate(action, page, context);

// New usage (recommended)
const strategy = createStrategyForAction('evaluate');
const result = await strategy.execute(config, page, context);
```

### Breaking Changes

None. All existing APIs remain functional.

### Deprecation Notices

- Direct instantiation of `EvaluationExecutor` is deprecated
- Use strategy factory instead for new code

## Security Considerations

### Input Validation

All code inputs undergo rigorous security validation:

- Pattern-based dangerous code detection
- Size and complexity limits
- Syntax validation
- Type checking

### Sandboxing

- JavaScript execution is sandboxed within Puppeteer's context
- No access to Node.js APIs from evaluated code
- CSP-compliant CSS injection

### Logging

All security events are logged with appropriate detail levels:

- Validation failures
- Execution attempts
- Error conditions
- Performance metrics

## Dependencies

### Internal Dependencies

- `../../../utils/logger.js` - Logging utilities
- `../../interfaces/action-executor.interface.js` - Core interfaces
- `../types.js` - Shared execution types

### External Dependencies

- `puppeteer` - Browser automation
- No additional external dependencies

## Contributing

### Code Standards

- TypeScript strict mode enabled
- ESLint compliance required
- Maximum function complexity: 10
- Maximum file length: 300 lines
- NIST security annotations required

### Security Requirements

- All user inputs must be validated
- Security patterns must be documented
- Threat modeling for new features
- Regular security audits

## Changelog

### 1.0.0 (2025-07-10)

- Initial modularization from `evaluation-executor.ts`
- Implemented strategy pattern with factory
- Added comprehensive security validation
- Enhanced error handling and logging
- Backward compatibility maintained

## License

This module is part of the puppeteer-mcp project and follows the same licensing terms.
