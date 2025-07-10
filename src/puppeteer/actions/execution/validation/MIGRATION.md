# Action Validator Migration Guide

## Overview

The action validation system has been modularized from a single 653-line file into multiple focused modules. This guide helps you migrate to the new structure.

## Breaking Changes

None - the existing API is maintained for backward compatibility.

## Migration Steps

### Option 1: No Changes Required (Backward Compatible)

If you're currently using:
```typescript
import { ActionValidator } from './action-validator.js';

const validator = new ActionValidator();
await validator.validate(action, context);
```

This will continue to work without any changes.

### Option 2: Use the New Orchestrator (Recommended)

For new code or when refactoring:
```typescript
import { ValidationOrchestrator } from './validation/index.js';

const orchestrator = new ValidationOrchestrator();
await orchestrator.validate(action, context);
```

### Option 3: Use Specific Validators

For fine-grained control:
```typescript
import { 
  ValidatorFactory, 
  ValidatorType 
} from './validation/validator-factory.js';

// Get a specific validator
const navValidator = ValidatorFactory.getValidator(ValidatorType.NAVIGATION);
await navValidator.validate(action, context);

// Or get all validators for an action
const validators = ValidatorFactory.getValidatorsForAction(action);
```

## New Features

### 1. Parallel Validation
```typescript
const result = await orchestrator.validate(action, context, {
  parallel: true,
  timeout: 3000
});
```

### 2. Selective Validation
```typescript
const result = await orchestrator.validate(action, context, {
  skipValidators: ['SecurityValidator']
});
```

### 3. Stop on First Error
```typescript
const result = await orchestrator.validate(action, context, {
  stopOnFirstError: true
});
```

### 4. Custom Validators
```typescript
import { BaseValidator, IActionValidator } from './validation/base-validator.js';

class CustomValidator extends BaseValidator implements IActionValidator {
  async validate(action: BrowserAction, context: ActionContext): Promise<ValidationResult> {
    // Custom validation logic
  }
  
  canValidate(action: BrowserAction): boolean {
    return action.type === 'custom';
  }
}

// Register the validator
ValidatorFactory.registerValidator('custom', new CustomValidator());
```

## Performance Improvements

- Validators can run in parallel
- Lazy initialization reduces memory usage
- Focused validators are more efficient

## Testing

The modular structure makes testing easier:

```typescript
import { NavigationValidator } from './validation/navigation-validator.js';

describe('NavigationValidator', () => {
  const validator = new NavigationValidator();
  
  it('should validate URLs', async () => {
    const result = await validator.validate(action, context);
    expect(result.valid).toBe(true);
  });
});
```

## Deprecation Notice

The `ActionValidator` class is now deprecated and will be removed in a future version. Please migrate to `ValidationOrchestrator` when convenient.