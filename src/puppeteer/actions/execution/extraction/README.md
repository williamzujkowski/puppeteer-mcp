# Extraction Module Architecture

This directory contains the modularized extraction components for the Puppeteer MCP project. The extraction system has been refactored to follow SOLID principles and design patterns for better maintainability and extensibility.

## Module Structure

### Core Components

- **`screenshot-extractor.ts`** - Handles screenshot capture operations
  - Element screenshots
  - Full page screenshots  
  - Various image formats (PNG, JPEG, WebP)

- **`pdf-extractor.ts`** - Manages PDF generation
  - Configurable page formats
  - Header/footer templates
  - Print settings

- **`content-extractor.ts`** - Extracts HTML/text content
  - Full page HTML
  - Element content
  - Input values

- **`text-extractor.ts`** - Specialized text extraction
  - Element text content
  - Input/textarea values
  - Trimmed text output

- **`attribute-extractor.ts`** - Element attribute extraction
  - Get any HTML attribute
  - Null-safe handling

### Factory Pattern

- **`extraction-factory.ts`** - Central factory for creating extractors
  - Type-safe handler creation
  - Action type validation
  - Centralized error handling

## Design Patterns Applied

### 1. **Factory Pattern**
The `ExtractionFactory` class provides a centralized way to create appropriate extraction handlers based on action type.

### 2. **Strategy Pattern**
Each extractor implements a common execution strategy, allowing them to be used interchangeably.

### 3. **Single Responsibility Principle**
Each extractor class has a single, well-defined responsibility:
- Screenshot extraction
- PDF generation
- Content extraction
- Text extraction
- Attribute extraction

## Usage Examples

### Direct Usage (Recommended for New Code)

```typescript
import { ExtractionFactory } from './extraction/extraction-factory.js';

const factory = new ExtractionFactory();
const result = await factory.execute(action, page, context);
```

### Using Individual Extractors

```typescript
import { ScreenshotExtractor } from './extraction/screenshot-extractor.js';

const extractor = new ScreenshotExtractor();
const result = await extractor.execute(screenshotAction, page, context);
```

### Backward Compatibility

The original `ExtractionExecutor` class maintains backward compatibility by delegating to the new modular components:

```typescript
import { ExtractionExecutor } from './extraction-executor.js';

const executor = new ExtractionExecutor();
const result = await executor.executeScreenshot(action, page, context);
```

## Security Annotations

All modules include NIST security control annotations:
- **AC-3**: Access enforcement
- **AU-3**: Content of audit records
- **SI-10**: Information input validation

## Benefits of Modularization

1. **Maintainability**: Each module is focused and under 300 lines
2. **Testability**: Individual components can be tested in isolation
3. **Extensibility**: New extraction types can be added easily
4. **Type Safety**: Strong TypeScript typing throughout
5. **Performance**: Lazy loading of only needed extractors

## Adding New Extraction Types

To add a new extraction type:

1. Create a new extractor class in this directory
2. Implement the extraction logic following the existing pattern
3. Add the new type to `ExtractionActionType` enum
4. Update the factory's `getHandler` method
5. Export from `index.ts`

## Migration Guide

For existing code using the old `ExtractionExecutor`:

1. No immediate changes required - backward compatibility is maintained
2. For new features, consider using `ExtractionFactory` directly
3. Individual extractors can be imported for specialized use cases

## Performance Considerations

- Extractors are instantiated once and reused
- Minimal overhead from factory pattern
- Type checking happens at compile time