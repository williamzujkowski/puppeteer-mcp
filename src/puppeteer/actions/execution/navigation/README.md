# Navigation Module

**Status**: Production Ready  
**Version**: 1.0.0  
**Security**: NIST-compliant with SSRF protection

## Overview

The Navigation module provides a modular, secure, and performant system for handling browser
navigation operations in the Puppeteer MCP integration. It replaces the monolithic
`navigation-executor.ts` with a well-architected system following SOLID principles and security best
practices.

## Architecture

### Core Principles

- **Single Responsibility**: Each module handles one specific aspect of navigation
- **Strategy Pattern**: Pluggable navigation strategies for different action types
- **Security-First**: Built-in SSRF protection and URL validation
- **Performance Monitoring**: Comprehensive metrics and monitoring
- **Type Safety**: Full TypeScript support with proper type definitions

### Module Structure

```
navigation/
├── index.ts                    # Public API and factory functions
├── navigation-executor.ts      # Main orchestration layer
├── navigation-factory.ts       # Strategy pattern implementation
├── page-navigator.ts          # page.goto() operations
├── history-navigator.ts       # back/forward/refresh operations
├── viewport-manager.ts        # viewport management
├── url-validator.ts           # URL validation with SSRF protection
├── performance-monitor.ts     # navigation performance tracking
└── README.md                  # This file
```

## Security Features

### NIST Compliance

- **AC-3**: Access enforcement for all navigation operations
- **AU-3**: Comprehensive audit records for navigation events
- **SI-10**: Input validation for all URLs and parameters
- **SC-7**: Boundary protection against SSRF attacks

### SSRF Protection

The `UrlValidator` provides comprehensive protection against Server-Side Request Forgery:

```typescript
// Automatic validation for all navigation requests
const result = await pageNavigator.navigate(action, page, context);

// Custom validation
const validation = await urlValidator.validateUrl('https://example.com');
if (!validation.isValid) {
  console.error(validation.error);
}
```

**Protected Against**:

- Private network access (127.0.0.1, 192.168.x.x, etc.)
- Localhost bypasses
- AWS metadata endpoints
- URL encoding bypasses
- Redirect-based bypasses

## Usage Examples

### Basic Usage

```typescript
import { createNavigationExecutor } from './navigation/index.js';

// Create executor with default security settings
const executor = createNavigationExecutor();

// Execute navigation
const result = await executor.execute(action, page, context);
```

### Security-Focused Configuration

```typescript
import { createSecureNavigationExecutor } from './navigation/index.js';

// Enhanced security configuration
const executor = createSecureNavigationExecutor();
// - Only HTTPS allowed
// - No private networks
// - Strict timeouts
// - Full validation
```

### Performance-Optimized Configuration

```typescript
import { createPerformanceOptimizedNavigationExecutor } from './navigation/index.js';

// Performance-focused configuration
const executor = createPerformanceOptimizedNavigationExecutor();
// - Faster DOM loading
// - Reduced logging
// - Higher concurrency
```

### Custom Configuration

```typescript
import { createNavigationExecutor } from './navigation/index.js';

const executor = createNavigationExecutor({
  enablePerformanceMonitoring: true,
  enableUrlValidation: true,
  maxConcurrentNavigations: 5,
  urlValidation: {
    allowedProtocols: ['https:'],
    allowPrivateNetworks: false,
    maxLength: 2048,
  },
  pageNavigation: {
    defaultTimeout: 30000,
    defaultWaitUntil: 'load',
  },
});
```

## API Reference

### NavigationExecutor

Main orchestration class that coordinates all navigation operations.

**Methods**:

- `execute(action, page, context)` - Execute any navigation action
- `executeNavigate(action, page, context)` - Navigate to URL
- `executeGoBack(page, context, timeout?)` - Go back in history
- `executeGoForward(page, context, timeout?)` - Go forward in history
- `executeRefresh(page, context, timeout?)` - Refresh current page
- `executeSetViewport(page, context, width, height, scale?)` - Set viewport

### NavigationFactory

Strategy pattern implementation for action routing.

**Methods**:

- `execute(action, page, context)` - Route action to appropriate strategy
- `registerStrategy(strategy)` - Register custom navigation strategy
- `getSupportedActions()` - Get list of supported action types
- `validateAction(action)` - Pre-validate action before execution

### Individual Navigators

#### PageNavigator

Handles `page.goto()` operations with URL validation and performance monitoring.

#### HistoryNavigator

Manages browser history operations (back, forward, refresh) with state validation.

#### ViewportManager

Handles viewport configuration with predefined presets and validation.

### Monitoring and Security

#### UrlValidator

Provides SSRF protection and URL validation:

- Protocol validation
- Private network blocking
- Suspicious pattern detection
- URL normalization

#### PerformanceMonitor

Tracks navigation performance metrics:

- Navigation timing
- Success/failure rates
- Memory usage
- Detailed browser metrics

## Migration from Legacy System

### Backward Compatibility

The original `navigation-executor.ts` now acts as a compatibility wrapper:

```typescript
// Legacy usage still works
import { NavigationExecutor } from './navigation-executor.js';
const executor = new NavigationExecutor();

// Recommended: Use modular system
import { createNavigationExecutor } from './navigation/index.js';
const executor = createNavigationExecutor();
```

### Migration Steps

1. **Phase 1**: Update imports to use modular system
2. **Phase 2**: Leverage new security and performance features
3. **Phase 3**: Remove legacy wrapper (optional)

### Breaking Changes

- None - full backward compatibility maintained
- Deprecation warnings for legacy usage

## Configuration Options

### Core Configuration

```typescript
interface NavigationExecutorConfig {
  enablePerformanceMonitoring?: boolean; // Default: true
  enableUrlValidation?: boolean; // Default: true
  enableRequestLogging?: boolean; // Default: true
  enableExecutionMetrics?: boolean; // Default: true
  maxConcurrentNavigations?: number; // Default: 5
}
```

### URL Validation

```typescript
interface UrlValidationConfig {
  allowedProtocols?: string[]; // Default: ['http:', 'https:']
  blockedHosts?: string[]; // Default: localhost, private IPs
  allowPrivateNetworks?: boolean; // Default: false
  maxLength?: number; // Default: 2048
  allowFileProtocol?: boolean; // Default: false
}
```

### Performance Monitoring

```typescript
interface PerformanceConfig {
  enableDetailedMetrics?: boolean; // Default: true
  enableMemoryTracking?: boolean; // Default: true
  maxMetricsHistory?: number; // Default: 1000
  retentionPeriod?: number; // Default: 24 hours
}
```

## Best Practices

### Security

1. **Always validate URLs** in production environments
2. **Use HTTPS-only** for sensitive applications
3. **Block private networks** unless specifically needed
4. **Monitor for suspicious patterns** in URL validation warnings

### Performance

1. **Use appropriate wait conditions** (`domcontentloaded` vs `load`)
2. **Set reasonable timeouts** based on your use case
3. **Monitor navigation metrics** to identify bottlenecks
4. **Limit concurrent navigations** to prevent resource exhaustion

### Error Handling

1. **Check validation results** before execution
2. **Handle SSRF violations** appropriately
3. **Monitor performance statistics** for trends
4. **Log security events** for audit purposes

## Testing

The modular system includes comprehensive test coverage:

```bash
# Run navigation-specific tests
npm test -- --testPathPattern=navigation

# Type checking
npm run typecheck

# ESLint validation
npm run lint
```

## Performance Metrics

The system provides detailed performance monitoring:

- **Navigation timing**: DNS, TCP, TLS, TTFB
- **Page metrics**: FCP, LCP, CLS, TTI
- **Memory usage**: JS heap utilization
- **Success rates**: Overall and by action type
- **Error tracking**: Detailed failure analysis

## Security Audit

Regular security reviews ensure:

- SSRF protection effectiveness
- URL validation completeness
- Audit log comprehensiveness
- NIST compliance adherence

## Future Enhancements

Planned improvements:

- **Custom validation rules**: User-defined URL patterns
- **Rate limiting**: Per-session navigation limits
- **Caching**: Intelligent navigation caching
- **Plugins**: Extensible middleware system

## Support

For issues or questions:

1. Check existing tests for usage examples
2. Review error logs for security violations
3. Monitor performance statistics for bottlenecks
4. Consult NIST documentation for compliance requirements

---

**Security Notice**: This module implements NIST security controls and should not be modified
without security review.
