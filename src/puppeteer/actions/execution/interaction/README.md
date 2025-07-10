# Interaction Action Handlers

This directory contains modularized interaction handlers for browser automation actions. The modularization follows SOLID principles and uses design patterns for better maintainability.

## Architecture

The interaction handling system uses the following design patterns:

- **Strategy Pattern**: Each interaction type has its own handler implementing a common interface
- **Factory Pattern**: `InteractionHandlerFactory` manages handler creation and registration
- **Singleton Pattern**: The factory maintains a single instance for consistent handler management

## Directory Structure

```
interaction/
├── base-handler.ts       # Abstract base class and interface
├── click-handler.ts      # Click action handler
├── type-handler.ts       # Type/input action handler
├── select-handler.ts     # Select dropdown handler
├── keyboard-handler.ts   # Keyboard action handler
├── mouse-handler.ts      # Mouse action handler
├── hover-handler.ts      # Hover action handler
├── handler-factory.ts    # Factory for managing handlers
└── index.ts             # Module exports
```

## Usage

### Basic Usage

```typescript
import { InteractionHandlerFactory } from './handler-factory.js';
import { ClickHandler } from './click-handler.js';

// Get factory instance
const factory = InteractionHandlerFactory.getInstance();

// Get handler for action
const handler = factory.getHandlerForAction(clickAction);
const result = await handler.execute(clickAction, page, context);
```

### Custom Handler Registration

```typescript
import { BaseInteractionHandler } from './base-handler.js';

class CustomHandler extends BaseInteractionHandler<CustomAction> {
  protected actionType = 'custom';
  
  async execute(action: CustomAction, page: Page, context: ActionContext): Promise<ActionResult> {
    // Implementation
  }
}

// Register custom handler
factory.registerHandler(new CustomHandler());
```

## Handler Responsibilities

Each handler is responsible for:
1. Validating action parameters
2. Preparing elements for interaction (visibility, enabled state)
3. Executing the specific interaction
4. Handling errors appropriately
5. Returning standardized results
6. Logging execution details

## Security Considerations

All handlers implement NIST security controls:
- **AC-3**: Access enforcement through proper validation
- **SI-10**: Information input validation for all parameters
- **AU-3**: Comprehensive audit logging

## File Size Guidelines

Each handler file is kept under 200-300 lines following the modularization requirements:
- Base handler: ~150 lines
- Individual handlers: 100-150 lines each
- Factory: ~180 lines

## Backward Compatibility

The original `interaction-executor.ts` maintains backward compatibility by:
1. Re-exporting all handlers and types
2. Maintaining deprecated methods that delegate to handlers
3. Supporting the same public API