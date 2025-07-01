# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-protocol API platform (MCP) built with Node.js and TypeScript that provides REST, gRPC, and WebSocket interfaces with unified session management and authentication.

## 🤖 Working Philosophy: Delegate to Subagents

**IMPORTANT**: When working on this project, prefer delegating complex tasks to specialized subagents using the Task tool. This approach ensures:
- Parallel execution of independent tasks
- Specialized analysis for different aspects
- Comprehensive coverage of standards and best practices
- Reduced context switching

### When to Delegate:
- Searching for patterns across multiple files
- Implementing features that span multiple layers
- Security audits and compliance checks
- Complex refactoring operations
- Testing strategy implementation
- Performance optimization analysis

## 📋 Standards Implementation

This project follows William Zujkowski's standards (https://github.com/williamzujkowski/standards). Key standards to apply:

### Code Standards (CS:TS)
- **TypeScript/ESM Configuration**: Target ES2020+, strict mode enabled
- **File Organization**: Max 300-500 lines per file, 50 lines per function
- **Naming Conventions**: PascalCase for classes/interfaces, camelCase for functions/variables
- **Documentation**: JSDoc for all public APIs with examples
- **Architecture**: SOLID principles, dependency injection, clear separation of concerns

### Testing Standards (TS:JEST)
- **Coverage Requirements**: 
  - 85%+ overall coverage
  - 95%+ for auth/security components
  - 100% for utility functions
- **Test Types**:
  - Hypothesis tests for behavior validation
  - Regression tests for bug fixes
  - Benchmark tests with performance SLAs
  - Property-based tests for edge cases
- **Test-First Development**: Write tests before implementation

### Security Standards (SEC:API)
- **Zero Trust Architecture**: Never trust, always verify
- **Authentication**: JWT with proper verification, refresh tokens
- **API Security**:
  ```typescript
  // Required security headers
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'same-origin' }
  }));
  ```
- **Input Validation**: Strict validation on all endpoints
- **Rate Limiting**: Implement per-endpoint rate limits

### NIST Compliance (NIST-IG)
Tag all security-related code with NIST controls:
```typescript
/**
 * @nist ia-2 "User authentication"
 * @nist ac-3 "Access enforcement"
 * @evidence code, test
 */
export async function authenticateRequest(req: Request): Promise<User> {
  // Implementation
}
```

### Container Standards (CN:DOCKER)
- Multi-stage builds with security scanning
- Non-root user execution
- Health checks and graceful shutdown
- Read-only root filesystem where possible

## 🏗️ Architecture

### Core Components
- **Session Store** (src/store/)
  - In-memory implementation with Redis-ready interface
  - Implement @nist au-3 audit logging for all operations
  
- **Authentication Middleware** (src/auth/)
  - Shared JWT validation across all protocols
  - OAuth2 flow support
  - API key management
  - @nist ia-2, ia-5 compliance required

- **Shared Models** (src/core/)
  - TypeScript interfaces with strict validation
  - Zod schemas for runtime validation
  - Shared error types and utilities

### Protocol Layers

1. **REST API** (src/routes/)
   - Express/Fastify with HTTP/2
   - OpenAPI 3.0 specification
   - Versioned under /v1
   - Comprehensive error handling

2. **gRPC Services** (src/grpc/)
   - Protocol buffers in proto/
   - TypeScript stubs via @grpc/proto-loader
   - Interceptors for auth/logging
   - Streaming support for real-time data

3. **WebSocket** (src/ws/)
   - JWT auth via connection params
   - Message envelope with versioning
   - Reconnection strategies
   - Event-based architecture

## 🚀 Development Workflow

### Initial Setup (When package.json exists)
```bash
# Install with security audit
npm ci && npm audit fix --audit-level=high

# Development with hot reload
npm run dev

# Run full test suite with coverage
npm run test:coverage

# Type checking
npm run typecheck

# Linting and formatting
npm run lint:fix
npm run format

# Security checks
npm run security:check
npm run standards:check
```

### Testing Strategy
```bash
# Unit tests for specific modules
npm test -- src/store/

# Integration tests
npm run test:integration

# E2E tests across protocols
npm run test:e2e

# Performance benchmarks
npm run test:benchmark

# Watch mode for TDD
npm run test:watch
```

### Git Workflow
```bash
# Pre-commit hooks via Husky will run:
# - ESLint with security plugin
# - Prettier formatting
# - TypeScript compilation
# - Unit tests for changed files

# Commit message format
# type(scope): subject
# Examples:
# feat(auth): add JWT refresh token support
# fix(grpc): handle connection timeout properly
# test(session): add edge case coverage
# docs(api): update OpenAPI spec
```

## 📝 Implementation Approach

Following the Kickstart.md methodology:

1. **Start with Tests**: Write failing tests that define behavior
2. **Minimal Implementation**: Write just enough code to pass
3. **Wire into System**: Integrate with existing components
4. **Verify Standards**: Ensure compliance with all applicable standards
5. **Document**: Update relevant documentation and API specs

### Task Delegation Pattern

When implementing features, delegate to subagents:

```typescript
// Example: Implementing a new API endpoint
// Delegate these tasks to subagents:

// Task 1: "Search for existing auth middleware patterns"
// Task 2: "Analyze current session store implementation"
// Task 3: "Generate OpenAPI spec for new endpoint"
// Task 4: "Create comprehensive test suite following TS:JEST"
// Task 5: "Implement endpoint with SEC:API compliance"
// Task 6: "Add NIST control tags to security functions"
```

## 🔒 Security Checklist

Before any commit:
- [ ] All inputs validated with Zod schemas
- [ ] Authentication required on all endpoints (except /health)
- [ ] Rate limiting configured
- [ ] Security headers implemented
- [ ] No secrets in code (use env vars)
- [ ] NIST controls tagged on security functions
- [ ] Security tests written and passing
- [ ] Dependencies audited for vulnerabilities

## 🎯 Performance Standards

- REST API response time: < 100ms p95
- gRPC unary calls: < 50ms p95
- WebSocket latency: < 10ms for echo
- Memory usage: < 512MB under normal load
- Startup time: < 3 seconds
- Graceful shutdown: < 30 seconds

## 📚 Additional Resources

- Project Standards: https://github.com/williamzujkowski/standards
- NIST Controls: https://csrc.nist.gov/projects/risk-management/sp800-53-controls
- TypeScript Best Practices: https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html
- Node.js Security: https://nodejs.org/en/docs/guides/security/

## 🔄 Keeping CLAUDE.md Updated

This file should be updated when:
- New architectural decisions are made
- Development commands change
- New standards are adopted
- Performance requirements change
- Security requirements evolve

Use the Kickstart.md template for major updates and ensure all changes align with the standards repository.