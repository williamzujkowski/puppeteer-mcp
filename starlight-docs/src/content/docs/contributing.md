---
title: Contributing to Puppeteer MCP
description: 'Version 1.0.10 - Contributing guidelines'
---

# Contributing to Puppeteer MCP

**Version:** 1.0.10  
**Last Updated:** 2025-01-07  
**Status:** Active

Thank you for your interest in contributing to Puppeteer MCP! This guide will help you get started
with contributing to our AI-enabled browser automation platform.

## 🚀 Quick Start

1. **Fork & Clone**: Fork the repository and clone your fork
2. **Install**: Run `npm install` to install dependencies
3. **Build**: Run `npm run build` to verify everything compiles
4. **Test**: Run `npm test` to ensure tests pass
5. **Develop**: Make your changes following our standards
6. **Submit**: Create a pull request with your changes

## 📋 Development Process

### 1. Setting Up Your Environment

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/puppeteer-mcp.git
cd puppeteer-mcp

# Add upstream remote
git remote add upstream https://github.com/williamzujkowski/puppeteer-mcp.git

# Install dependencies
npm install

# Run the development server
npm run dev
```

### 2. Creating a Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 3. Making Changes

Before making changes, ensure you understand:

- [Development Workflow](/puppeteer-mcp/development/workflow.md)
- [Coding Standards](/puppeteer-mcp/development/standards.md)
- [Testing Guide](/puppeteer-mcp/development/testing.md)
- [Architecture Overview](/puppeteer-mcp/architecture/overview.md)

### 4. Testing Your Changes

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- tests/unit/your-test.test.ts

# Run tests in watch mode
npm run test:watch

# Check test coverage
npm run test:coverage
```

### 5. Code Quality Checks

```bash
# TypeScript compilation
npm run typecheck

# ESLint
npm run lint

# Auto-fix ESLint issues
npm run lint:fix

# Format code
npm run format

# Run all checks
npm run typecheck && npm run lint && npm run format:check
```

## 🔧 Development Guidelines

### Code Standards

We follow [William Zujkowski's Standards](https://github.com/williamzujkowski/standards):

- **TypeScript**: Strict mode, ES2020+, ESM modules
- **Functions**: Max complexity of 10, max 4 parameters
- **Files**: Max 300 lines per file
- **Testing**: Minimum 85% coverage for critical paths
- **Security**: NIST compliance with proper tagging

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

Examples:

```
feat(auth): add refresh token rotation
fix(browser): handle page navigation timeout
docs(api): update REST endpoint documentation
test(session): add edge case coverage
```

### Pull Request Process

1. **Update Documentation**: If you changed APIs or added features
2. **Add Tests**: Ensure your changes are tested
3. **Pass CI**: All checks must pass (tests, lint, build)
4. **Request Review**: Tag relevant maintainers
5. **Address Feedback**: Respond to review comments
6. **Squash Commits**: Keep history clean if requested

## 📁 Project Structure

```
puppeteer-mcp/
├── src/                 # Source code
│   ├── auth/           # Authentication system
│   ├── core/           # Core infrastructure
│   ├── puppeteer/      # Browser automation
│   ├── routes/         # REST API routes
│   ├── grpc/           # gRPC services
│   ├── ws/             # WebSocket handlers
│   └── mcp/            # Model Context Protocol
├── tests/              # Test suites
├── docs/               # Documentation
├── scripts/            # Build and utility scripts
└── proto/              # Protocol buffer definitions
```

## 🧪 Testing Requirements

### Test Coverage Targets

| Component           | Required Coverage |
| ------------------- | ----------------- |
| Authentication      | 95%+              |
| Security Components | 95%+              |
| Core Business Logic | 85%+              |
| Utilities           | 80%+              |
| Integration Points  | 70%+              |

### Writing Tests

```typescript
describe('YourFeature', () => {
  // Setup
  beforeEach(() => {
    // Initialize test environment
  });

  it('should perform expected behavior', async () => {
    // Arrange
    const input = createTestInput();

    // Act
    const result = await yourFunction(input);

    // Assert
    expect(result).toMatchExpected();
  });

  // Cleanup
  afterEach(() => {
    // Clean up resources
  });
});
```

## 🔒 Security Considerations

- **Never commit secrets**: Use environment variables
- **Validate inputs**: All user inputs must be validated
- **Follow NIST guidelines**: Tag security functions appropriately
- **Report vulnerabilities**: Use our
  [Security Policy](https://github.com/williamzujkowski/puppeteer-mcp/blob/main/SECURITY.md)

Example NIST tagging:

```typescript
/**
 * @nist ac-3 "Access enforcement"
 * @nist ia-2 "User authentication"
 */
export async function authenticateUser(credentials: Credentials) {
  // Implementation
}
```

## 🐛 Reporting Issues

### Bug Reports

Include:

1. **Description**: Clear description of the issue
2. **Reproduction**: Steps to reproduce
3. **Expected**: What should happen
4. **Actual**: What actually happens
5. **Environment**: Node version, OS, etc.
6. **Logs**: Relevant error messages

### Feature Requests

Include:

1. **Use Case**: Why is this needed?
2. **Proposed Solution**: How should it work?
3. **Alternatives**: Other approaches considered
4. **Impact**: Who benefits from this feature?

## 🌟 Types of Contributions

### Code Contributions

- Bug fixes
- New features
- Performance improvements
- Security enhancements

### Non-Code Contributions

- Documentation improvements
- Bug reports and feature requests
- Code reviews
- Community support

### First-Time Contributors

Look for issues labeled:

- `good first issue`
- `help wanted`
- `documentation`

## 🤝 Code Review Process

Reviewers will check for:

1. **Functionality**: Does it work as intended?
2. **Tests**: Are changes properly tested?
3. **Standards**: Does it follow our coding standards?
4. **Security**: Are there security implications?
5. **Performance**: Will it impact performance?
6. **Documentation**: Is it properly documented?

## 📚 Resources

- [Development Workflow](/puppeteer-mcp/development/workflow.md)
- [Coding Standards](/puppeteer-mcp/development/standards.md)
- [Testing Guide](/puppeteer-mcp/development/testing.md)
- [Architecture Overview](/puppeteer-mcp/architecture/overview.md)
- [API Documentation](/puppeteer-mcp/reference/api-quick-reference.md)

## ❓ Getting Help

- **Discord**: [Join our community](#) (coming soon)
- **GitHub Discussions**: Ask questions and share ideas
- **Issue Tracker**: Report bugs or request features
- **Email**: security@example.com (security issues only)

## 📄 License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

## 🙏 Recognition

Contributors will be:

- Listed in our CONTRIBUTORS file
- Mentioned in release notes
- Given credit in documentation

Thank you for contributing to Puppeteer MCP! 🎉
