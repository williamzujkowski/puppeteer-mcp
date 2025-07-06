---
title: Development Documentation
description: 'Everything you need to know to develop and contribute to Puppeteer MCP.'
---

# Development Documentation

Everything you need to know to develop and contribute to Puppeteer MCP.

## Development Guides

### [Development Workflow](/puppeteer-mcp/workflow.md)

Standard development practices:

- Setup instructions
- Development cycle
- Code review process
- Release procedures
- Maintenance tasks

### [Coding Standards](/puppeteer-mcp/standards.md)

William Zujkowski's coding standards:

- TypeScript standards
- Testing requirements
- Security standards
- Documentation standards
- Code quality metrics

### [Testing Guide](/puppeteer-mcp/testing.md)

Comprehensive testing practices:

- Unit testing
- Integration testing
- E2E testing
- Performance testing
- Test coverage requirements

### [AI Patterns](/puppeteer-mcp/../ai/routing-patterns.md)

AI-assisted development patterns:

- Task delegation
- Subagent patterns
- Context management
- Code generation
- Review workflows

## Quick Start Development

### 1. Clone Repository

```bash
git clone https://github.com/williamzujkowski/puppeteer-mcp.git
cd puppeteer-mcp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment

```bash
# Copy example environment
cp .env.example .env

# Edit with your settings
nano .env
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Run Tests

```bash
npm test
npm run test:watch  # Watch mode
npm run test:coverage  # With coverage
```

## Development Commands

### Build & Compile

```bash
npm run build       # Build project
npm run typecheck   # Check TypeScript
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint issues
```

### Testing

```bash
npm test                 # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
```

### Development Tools

```bash
npm run dev         # Start dev server
npm run debug       # Start with debugging
npm run watch       # Watch for changes
npm run clean       # Clean build artifacts
```

## Project Structure

```
puppeteer-mcp/
├── src/                 # Source code
│   ├── auth/           # Authentication
│   ├── grpc/           # gRPC implementation
│   ├── mcp/            # MCP server
│   ├── puppeteer/      # Browser automation
│   ├── routes/         # REST API routes
│   ├── store/          # Session management
│   ├── utils/          # Utilities
│   └── ws/             # WebSocket server
├── test/               # Test files
│   ├── unit/          # Unit tests
│   ├── integration/   # Integration tests
│   └── e2e/           # End-to-end tests
├── docs/               # Documentation
├── scripts/            # Build scripts
└── config/             # Configuration
```

## Code Quality Standards

### TypeScript Requirements

- ✅ Strict mode enabled
- ✅ No `any` types (migrate to `unknown`)
- ✅ All functions documented
- ✅ Interfaces over type aliases
- ✅ Explicit return types

### Testing Requirements

- ✅ 85%+ code coverage
- ✅ Test-first development
- ✅ Descriptive test names
- ✅ Isolated unit tests
- ✅ Comprehensive E2E tests

### Security Requirements

- ✅ Input validation (Zod)
- ✅ Authentication on all endpoints
- ✅ NIST control tags
- ✅ Security headers
- ✅ Rate limiting

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes
# Write tests first (TDD)
# Implement feature
# Update documentation

# Run checks
npm run typecheck
npm run lint
npm test
```

### 2. Code Review

- Create pull request
- Ensure CI passes
- Request review
- Address feedback
- Merge when approved

### 3. Release Process

```bash
# Update version
npm version patch|minor|major

# Build and test
npm run build
npm test

# Publish
npm publish
```

## Common Development Tasks

### Adding a New API Endpoint

1. Define route in `src/routes/`
2. Add validation schema (Zod)
3. Implement business logic
4. Add tests
5. Update OpenAPI spec
6. Document in API reference

### Adding a New MCP Tool

1. Define tool in `src/mcp/tools/`
2. Add parameter schema
3. Implement tool logic
4. Add to tool registry
5. Write tests
6. Update MCP documentation

### Fixing a Bug

1. Write failing test
2. Fix the bug
3. Ensure test passes
4. Check for regressions
5. Update changelog

## Debugging

### Enable Debug Logging

```bash
# All debug output
DEBUG=* npm run dev

# Specific namespaces
DEBUG=puppeteer:* npm run dev
DEBUG=mcp:*,session:* npm run dev
```

### Chrome DevTools

```javascript
// Enable DevTools in development
const browser = await puppeteer.launch({
  headless: false,
  devtools: true,
});
```

### VS Code Debugging

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/src/index.ts",
      "preLaunchTask": "tsc: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "DEBUG": "*"
      }
    }
  ]
}
```

## Contributing

### Before Contributing

1. Read [Contributing Guide](/puppeteer-mcp/../contributing.md)
2. Review [Coding Standards](/puppeteer-mcp/standards.md)
3. Check existing issues
4. Discuss major changes

### Contribution Process

1. Fork repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request
5. Address review feedback

## Resources

### Internal Documentation

- [Development Workflow](/puppeteer-mcp/workflow.md) - Detailed workflow
- [Coding Standards](/puppeteer-mcp/standards.md) - Code quality standards
- [Testing Guide](/puppeteer-mcp/testing.md) - Testing best practices
- [AI Patterns](/puppeteer-mcp/../ai/routing-patterns.md) - AI development

### External Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Puppeteer Documentation](https://pptr.dev/)
- [Jest Documentation](https://jestjs.io/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## Getting Help

- Check existing documentation
- Search GitHub issues
- Ask in discussions
- Contact maintainers
