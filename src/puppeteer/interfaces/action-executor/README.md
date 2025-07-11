# Action Executor Interfaces

This directory contains the modularized interfaces for the browser action executor system. The
interfaces have been organized into logical groups to improve maintainability and code organization.

## Structure

### Core Interfaces (`core.interface.ts`)

- `BaseBrowserAction` - Base interface for all browser actions
- `ActionResult` - Standardized result format for action execution
- `ValidationResult` - Result of action validation
- `ActionContext` - Context information for action execution
- `BatchExecutionOptions` - Options for batch execution
- `HistoryQueryOptions` - Options for querying action history
- `ActionMetrics` - Metrics for action execution analysis

### Navigation Actions (`navigation.interface.ts`)

- `NavigateAction` - Navigate to URLs
- `WaitAction` - Wait for various conditions
- `ScrollAction` - Scroll page or elements

### Interaction Actions (`interaction.interface.ts`)

- `ClickAction` - Click on elements
- `TypeAction` - Type text into inputs
- `SelectAction` - Select dropdown options
- `KeyboardAction` - Keyboard input actions
- `MouseAction` - Mouse movement and button actions
- `UploadAction` - Upload files to file inputs
- `HoverAction` - Hover over elements

### Content Actions (`content.interface.ts`)

- `ScreenshotAction` - Capture screenshots
- `PDFAction` - Generate PDFs
- `ContentAction` - Get HTML content
- `GetTextAction` - Extract text from elements
- `GetAttributeAction` - Get element attributes
- `EvaluateAction` - Execute JavaScript

### File Operations (`file-operations.interface.ts`)

- `DownloadAction` - Download files
- `CookieAction` - Manage browser cookies
- `CookieDefinition` - Cookie properties
- `CookieOperation` - Cookie operation types

### Main Executor Interface (`executor.interface.ts`)

- `ActionExecutor` - Core interface for executing browser actions

### Type Utilities (`types.ts`)

- `BrowserAction` - Union type of all browser actions
- `ActionType` - String literal types for actions
- Type guards for each action category

## Usage

Import from the main interface file for backward compatibility:

```typescript
import type {
  BrowserAction,
  ActionExecutor,
  ActionResult,
} from '@/puppeteer/interfaces/action-executor.interface.js';
```

Or import directly from specific modules:

```typescript
import type { NavigateAction } from '@/puppeteer/interfaces/action-executor/navigation.interface.js';
import type { ClickAction } from '@/puppeteer/interfaces/action-executor/interaction.interface.js';
```

## NIST Compliance

All interfaces include appropriate NIST control annotations:

- **AC-3**: Access enforcement
- **AC-4**: Information flow enforcement
- **SI-10**: Information input validation
- **AU-3**: Content of audit records
- **AU-6**: Audit review, analysis, and reporting
- **SC-8**: Transmission confidentiality and integrity
