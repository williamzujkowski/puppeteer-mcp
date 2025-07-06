---
title: Development Workflow
description: Version: 1.0.10  
---

# Development Workflow

**Version**: 1.0.10  
**Last Updated**: 2025-01-03  
**Status**: Active  
**Category**: Development Process

## Table of Contents

1. [Overview](#overview)
2. [Development Setup](#development-setup)
3. [Build Process](#build-process)
4. [Testing Strategy](#testing-strategy)
5. [Git Workflow](#git-workflow)
6. [Implementation Methodology](#implementation-methodology)
7. [Current Priorities](#current-priorities)
8. [Debugging Guide](#debugging-guide)
9. [Performance Optimization](#performance-optimization)

## Overview

This document outlines the development workflow for the puppeteer-mcp project, including setup,
build processes, testing strategies, and implementation methodologies that have proven successful.

### Current Project Status

- **Build Status**: ✅ Clean builds, zero TypeScript errors
- **Test Status**: ✅ 20/20 test suites passing
- **ESLint Status**: ✅ 78 warnings, 0 errors
- **Beta Release**: ✅ All systems operational

## Development Setup

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+
- Chrome/Chromium (for Puppeteer)
- Git with configured hooks

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/puppeteer-mcp.git
cd puppeteer-mcp

# Install dependencies (includes Puppeteer)
npm install

# Verify setup
npm run typecheck  # Should show 0 errors
npm run lint       # Should show warnings only
npm test           # Should pass all tests

# Start development server
npm run dev
```

### Environment Configuration

Create a `.env` file for local development:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Security
JWT_SECRET=your-secret-key-for-development
API_KEY_SALT=your-salt-for-development

# Browser Automation
PUPPETEER_HEADLESS=true
BROWSER_POOL_MAX_SIZE=5
BROWSER_IDLE_TIMEOUT=300000

# Feature Flags
ENABLE_MCP=true
ENABLE_GRPC=true
ENABLE_WEBSOCKET=true
```

## Build Process

### Current Build Status

All build commands are working and produce clean output:

```bash
npm run build      # ✅ Production build
npm run dev        # ✅ Development server with hot reload
npm run typecheck  # ✅ TypeScript compilation check
npm run lint       # ✅ ESLint with security plugin
npm run format     # ✅ Prettier formatting
```

### Build Commands Explained

#### TypeScript Compilation

```bash
npm run typecheck
# Runs: tsc --noEmit
# Checks types without generating files
# Current status: 0 errors ✅
```

#### Linting

```bash
npm run lint
# Runs: eslint src tests --ext .ts,.tsx
# Current status: 78 warnings, 0 errors ✅
# Target: <50 warnings

# Fix auto-fixable issues
npm run lint:fix
```

#### Development Server

```bash
npm run dev
# Runs: tsx watch src/index.ts
# Features:
# - Hot reload on file changes
# - Source map support
# - Debug logging enabled
# - Browser pool initialized
```

#### Production Build

```bash
npm run build
# Runs: tsc && tsc-alias
# Outputs to: dist/
# Features:
# - Optimized for production
# - Path aliases resolved
# - Source maps included
```

## Testing Strategy

### Test Organization

```
tests/
├── unit/           # Unit tests for individual components
├── integration/    # Integration tests for subsystems
├── e2e/            # End-to-end tests across protocols
└── fixtures/       # Test data and mocks
```

### Running Tests

```bash
# Run all tests
npm test           # ✅ 20/20 test suites passing

# Run specific test suites
npm test -- src/auth/
npm test -- src/puppeteer/

# Run tests in watch mode (TDD)
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test types
npm run test:unit
npm run test:integration  # Currently disabled for stability
npm run test:e2e

# Run performance benchmarks
npm run test:benchmark
```

### Test Categories

#### Unit Tests

Fast, isolated tests for individual functions:

```bash
# Browser automation unit tests
npm test -- tests/unit/puppeteer/

# Auth system unit tests
npm test -- tests/unit/auth/
```

#### Integration Tests

Test component interactions:

```bash
# Currently disabled for stability
# npm run test:integration

# When re-enabled, will test:
# - Protocol integrations
# - Database interactions
# - External service calls
```

#### E2E Tests

Full system tests across all protocols:

```bash
npm run test:e2e

# Tests include:
# - REST API workflows
# - gRPC service calls
# - WebSocket connections
# - MCP tool execution
# - Browser automation flows
```

### Coverage Requirements

```json
{
  "global": {
    "branches": 80,
    "functions": 85,
    "lines": 85,
    "statements": 85
  },
  "auth": {
    "branches": 95,
    "functions": 95,
    "lines": 95,
    "statements": 95
  },
  "utils": {
    "branches": 100,
    "functions": 100,
    "lines": 100,
    "statements": 100
  }
}
```

## Git Workflow

### Branch Strategy

```bash
main              # Beta release code
├── develop       # Integration branch
├── feature/*     # New features
├── fix/*         # Bug fixes
├── refactor/*    # Code improvements
└── test/*        # Test improvements
```

### Commit Process

Pre-commit hooks automatically run via Husky:

1. **ESLint** - Checks for code quality issues
2. **Prettier** - Formats code consistently
3. **TypeScript** - Compiles without errors
4. **Tests** - Runs tests for changed files

### Commit Message Format

Follow conventional commits:

```bash
# Format: type(scope): subject

# Types:
feat     # New feature
fix      # Bug fix
docs     # Documentation only
style    # Formatting, missing semicolons, etc
refactor # Code change that neither fixes a bug nor adds a feature
perf     # Performance improvement
test     # Adding missing tests
chore    # Changes to build process or auxiliary tools

# Examples:
feat(auth): add JWT refresh token support
fix(grpc): handle connection timeout properly
test(session): add edge case coverage
docs(api): update OpenAPI spec
refactor(browser): extract pool management logic
perf(ws): optimize message serialization
```

### Pull Request Process

1. **Create feature branch**

   ```bash
   git checkout -b feature/new-browser-action
   ```

2. **Make changes following standards**
   - Write tests first (TDD)
   - Implement feature
   - Ensure standards compliance

3. **Commit changes**

   ```bash
   git add .
   git commit -m "feat(browser): add pdf generation action"
   ```

4. **Push and create PR**

   ```bash
   git push -u origin feature/new-browser-action
   # Create PR via GitHub
   ```

5. **PR Checklist**
   - [ ] Tests pass
   - [ ] TypeScript compiles
   - [ ] ESLint warnings not increased
   - [ ] Documentation updated
   - [ ] NIST tags added (if security-related)

## Implementation Methodology

### Proven Implementation Approach

This methodology has been proven successful in this project:

1. **Start with Tests**

   ```typescript
   // Write failing test that defines behavior
   it('should generate PDF from page', async () => {
     const result = await executor.execute({
       type: 'pdf',
       params: { format: 'A4' },
     });
     expect(result.buffer).toBeInstanceOf(Buffer);
   });
   ```

2. **Minimal Implementation**

   ```typescript
   // Write just enough code to pass
   async function executePdf(params: PdfParams): Promise<Buffer> {
     const page = await this.getPage();
     return page.pdf(params);
   }
   ```

3. **Wire into System**

   ```typescript
   // Integrate with existing components
   ACTION_HANDLERS.set('pdf', executePdf);
   ```

4. **Verify Standards**
   - Function complexity ≤10
   - File size ≤300 lines
   - Security validation added
   - NIST tags applied

5. **Document**
   - Update API documentation
   - Add usage examples
   - Update changelog

### Task Delegation Pattern

For complex features, delegate to subagents:

```typescript
// Example: Implementing new WebSocket feature
// Delegate these tasks in parallel:

Task 1: "Search for existing WebSocket message patterns"
Task 2: "Design message schema with Zod validation"
Task 3: "Implement handler following existing patterns"
Task 4: "Create comprehensive test suite"
Task 5: "Add security validation and NIST tags"
Task 6: "Update MCP tools to support new feature"
```

## Current Priorities

### High Priority ⚠️

#### 1. Test Stability

**Goal**: Fix 64 failing tests **Focus**: Browser automation teardown issues

```bash
# Identify failing tests
npm test -- --listTests | grep fail

# Debug specific test
npm test -- --runInBand path/to/test.ts

# Common issues:
# - Resource cleanup in afterEach
# - Browser pool not releasing
# - Async operations not awaited
```

#### 2. ESLint Cleanup

**Goal**: Reduce warnings from 78 to <50 **Approach**: Systematic, targeted fixes

```bash
# Get warning summary
npm run lint -- --format=compact

# Fix specific rule violations
npm run lint:fix -- --rule=@typescript-eslint/no-explicit-any

# Priority rules to fix:
# - no-explicit-any
# - prefer-const
# - no-unused-vars
```

#### 3. Browser Test Reliability

**Goal**: Improve Puppeteer test cleanup **Focus**: Resource management

```typescript
// Ensure proper cleanup
afterEach(async () => {
  await page?.close();
  await browser?.close();
  await pool?.drain();
});
```

### Medium Priority 🔄

#### 1. Type Safety Enhancement

**Goal**: Eliminate remaining `any` types

```bash
# Find any usage
grep -r "any" src/ --include="*.ts" | grep -v "// eslint-disable"

# Replace with proper types
# Before: any
# After: unknown | specific type
```

#### 2. Performance Monitoring

**Goal**: Add browser operation metrics

```typescript
// Add timing to all browser actions
const start = performance.now();
const result = await executeAction(action);
const duration = performance.now() - start;

metrics.histogram('browser.action.duration', duration, {
  action: action.type,
});
```

#### 3. Documentation Generation

**Goal**: Create OpenAPI specs from code

```bash
# Generate OpenAPI from routes
npm run generate:openapi

# Generate TypeDoc
npm run generate:docs
```

### Future Enhancements 🚀

1. **Visual Regression Testing**
   - Screenshot comparison framework
   - Baseline management
   - Diff visualization

2. **Multi-browser Support**
   - Firefox via Playwright
   - Safari via Playwright
   - Cross-browser testing

3. **Advanced Monitoring**
   - Distributed tracing (OpenTelemetry)
   - Custom dashboards
   - Alert rules

4. **Performance Optimization**
   - Browser warm pools
   - Connection reuse
   - Caching strategies

### Maintenance Tasks 🔧

#### Weekly

- Dependency updates: `npm update`
- Security audit: `npm audit`
- Performance benchmarks: `npm run test:benchmark`

#### Monthly

- Full ESLint review
- Test coverage analysis
- Documentation review
- Performance profiling

## Debugging Guide

### Common Issues and Solutions

#### Browser Won't Start

```bash
# Check Chrome installation
which chromium-browser || which chrome || which google-chrome

# Test Puppeteer directly
node -e "const p = require('puppeteer'); p.launch().then(b => b.close())"

# Enable debug logging
DEBUG=puppeteer:* npm run dev
```

#### Memory Leaks

```bash
# Monitor memory usage
npm run dev -- --inspect

# Use Chrome DevTools
# 1. Open chrome://inspect
# 2. Click "inspect" on Node process
# 3. Take heap snapshots
# 4. Look for retained objects
```

#### Test Failures

```bash
# Run single test with debugging
node --inspect-brk node_modules/.bin/jest path/to/test.ts

# Enable verbose logging
npm test -- --verbose --runInBand

# Common fixes:
# 1. Add proper async/await
# 2. Increase timeouts for browser tests
# 3. Ensure cleanup in afterEach
# 4. Check for race conditions
```

#### TypeScript Errors

```bash
# Get detailed error info
npm run typecheck -- --listFiles

# Check specific file
npx tsc --noEmit src/specific/file.ts

# Common fixes:
# 1. Add explicit types
# 2. Use type assertions carefully
# 3. Update tsconfig paths
```

### Debug Commands

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Test specific endpoint
curl -X POST http://localhost:3000/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user"}'

# Monitor WebSocket
wscat -c ws://localhost:3000/ws

# Test gRPC service
grpcurl -plaintext localhost:50051 list
```

## Performance Optimization

### Current Performance Metrics

- REST API: <100ms p95 ✅
- gRPC calls: <50ms p95 ✅
- WebSocket: <10ms echo ✅
- Browser actions: <5s p95 ✅
- Startup time: <3s ✅

### Optimization Strategies

#### 1. Browser Pool Optimization

```typescript
// Implement warm pool
const warmPool = new WarmBrowserPool({
  min: 2, // Always keep 2 browsers ready
  max: 10, // Scale up to 10 under load
});

// Pre-launch browsers
await warmPool.initialize();
```

#### 2. Caching Strategy

```typescript
// Cache frequently accessed data
const cache = new LRUCache<string, Session>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
});

// Use cache with fallback
async function getSession(id: string): Promise<Session> {
  return cache.get(id) || (await store.getSession(id));
}
```

#### 3. Query Optimization

```typescript
// Batch operations when possible
async function getSessions(ids: string[]): Promise<Session[]> {
  // Instead of N queries
  // return Promise.all(ids.map(id => store.get(id)));

  // Single batch query
  return store.getBatch(ids);
}
```

### Performance Monitoring

```bash
# Run benchmarks
npm run test:benchmark

# Profile CPU usage
node --prof dist/index.js
node --prof-process isolate-*.log > profile.txt

# Monitor in production
# - Use APM tools (DataDog, New Relic)
# - Custom metrics with Prometheus
# - Real user monitoring (RUM)
```

## Summary

This workflow has been refined through the successful implementation of a beta browser automation
platform. Key principles:

1. **Standards First**: Always check and follow standards
2. **Test-Driven**: Write tests before implementation
3. **Incremental**: Small, focused changes
4. **Automated**: Let tools handle formatting and checks
5. **Documented**: Keep docs in sync with code

For additional context:

- Standards details: `docs/development/standards.md`
- AI patterns: `docs/ai/routing-patterns.md`
- Lessons learned: `docs/lessons/implementation.md`
