# Action Validator Modularization

This directory contains the modularized action validation system for Puppeteer MCP.

## Architecture

The validation system has been refactored from a single 653-line file into a modular architecture
using the Strategy and Factory patterns:

### Core Components

1. **base-validator.ts** (233 lines)
   - Abstract base class with common validation functionality
   - Provides utility methods for all validators
   - Implements the `IActionValidator` interface

2. **validator-factory.ts** (123 lines)
   - Factory pattern implementation
   - Manages validator instances
   - Provides methods to get validators by type or action

3. **index.ts** (266 lines)
   - Main orchestrator using Strategy pattern
   - Coordinates multiple validators
   - Provides parallel and sequential execution options

### Structural Validation

4. **structural-validator.ts** (128 lines)
   - Validates basic action structure
   - Validates execution context
   - Checks timeout values

### Security Validation

5. **security-validator.ts** (389 lines)
   - Comprehensive security checks
   - XSS pattern detection
   - SQL injection prevention
   - Command injection prevention
   - Permission validation

### Action-Specific Validators

6. **navigation-validator.ts** (178 lines)
   - URL validation
   - Protocol security checks
   - Navigation options validation

7. **interaction-validator.ts** (340 lines)
   - Click, type, select actions
   - Keyboard and mouse actions
   - Input validation and sanitization

8. **content-validator.ts** (76 lines)
   - Delegates to sub-validators:
     - `content/screenshot-validator.ts` (177 lines)
     - `content/pdf-validator.ts` (251 lines)
     - `content/content-extraction-validator.ts` (146 lines)

9. **control-flow-validator.ts** (402 lines)
   - Wait actions
   - Scroll actions
   - JavaScript evaluation with security checks

10. **data-validator.ts** (405 lines)
    - File upload validation
    - Cookie operations
    - Data security checks

## Design Patterns Used

### Strategy Pattern

- Each validator implements the same interface
- Validators can be swapped or combined dynamically
- The orchestrator selects appropriate validators at runtime

### Factory Pattern

- `ValidatorFactory` creates and manages validator instances
- Supports custom validator registration
- Lazy initialization for performance

### Composite Pattern

- The orchestrator combines results from multiple validators
- Supports both parallel and sequential execution

## Usage

```typescript
import { ValidationOrchestrator } from './validation/index.js';

const orchestrator = new ValidationOrchestrator();
const result = await orchestrator.validate(action, context);
```

## Backward Compatibility

The original `action-validator.ts` file has been updated to maintain backward compatibility by:

- Re-exporting all new modules
- Delegating to the new orchestrator
- Maintaining the same API surface

## NIST Security Annotations

All validators include appropriate NIST control annotations:

- **SI-10**: Information input validation
- **AC-3**: Access enforcement
- **AC-4**: Information flow enforcement
- **SC-18**: Mobile code (for JavaScript evaluation)

## Benefits

1. **Maintainability**: Each validator is focused and under 400 lines
2. **Testability**: Individual validators can be tested in isolation
3. **Extensibility**: New validators can be added easily
4. **Performance**: Validators can run in parallel
5. **Flexibility**: Validators can be enabled/disabled dynamically
