# Contributing to Puppeteer MCP

We love your input! We want to make contributing to this project as easy and transparent as
possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure TypeScript compilation passes (`npm run typecheck`)
5. Make sure your code follows our standards
6. Issue that pull request!

### Development Commands

```bash
# Start development server
npm run dev

# Build the project
npm run build

# Run the production server
npm start

# Check everything is working
npm run typecheck && npm run lint && npm run format:check
```

## Code Standards

This project follows [William Zujkowski's standards](https://github.com/williamzujkowski/standards).
Key points:

### TypeScript

- Target ES2020+ with strict mode enabled
- Use ESM modules
- Follow naming conventions:
  - PascalCase for classes/interfaces
  - camelCase for functions/variables
  - UPPER_SNAKE_CASE for constants

### Testing

- Write tests before implementation (TDD)
- Maintain 85%+ overall coverage
- 95%+ coverage for auth/security modules
- 100% coverage for utility functions

### Security

- Tag security functions with NIST controls
- Validate all inputs with Zod schemas
- Never store secrets in code
- Use environment variables for configuration

### Documentation

- Document all public APIs with JSDoc
- Include examples for complex functions
- Keep README.md updated

## Pull Request Process

1. Ensure your code passes TypeScript compilation (`npm run typecheck`)
2. Address any new ESLint errors (warnings are acceptable with justification)
3. Update documentation for any API changes or new features
4. Write tests for new functionality (aim for 85%+ coverage)
5. Add or update integration tests for cross-protocol features
6. Update CLAUDE.md if the change affects development workflow
7. Follow the commit message format and include NIST control tags for security changes
8. Run `npm run standards:check` and `npm run security:check`
9. Ensure the development server starts successfully (`npm run dev`)
10. The PR will be merged once approved and checks pass

### Pre-commit Checklist

- [ ] `npm run typecheck` passes (0 errors required)
- [ ] `npm run lint` shows no new errors
- [ ] `npm run format:check` passes
- [ ] New functionality has tests
- [ ] Documentation updated if needed
- [ ] Security functions tagged with NIST controls

## Testing

**Current Status**: ✅ All tests passing! 332 tests across 20 test suites

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:integration
npm run test:e2e
npm run test:benchmark
```

### Test Suite Status

- **Total Tests**: 332 tests (all passing ✅)
- **Test Suites**: 20/20 passing
- **Key Areas Tested**: Auth, Utils, Store, Routes, gRPC, MCP, Puppeteer browser automation
- **Recent Fixes**: Critical page ID management bug resolved, test stability improved
- **Coverage Target**: 85%+ overall, 95%+ for auth/security modules

### Testing Guidelines

- Write tests for all new functionality
- Focus on unit tests for core business logic
- Integration tests for cross-protocol features
- Mock external dependencies (Puppeteer, network calls)
- Ensure proper cleanup in async tests
- All tests must pass before merging PRs

## Code Style

We use ESLint and Prettier to maintain code quality. The project currently has **0 ESLint errors**
and **78 warnings** (significantly reduced from 768 issues through systematic improvements). These
warnings are primarily style preferences that don't affect functionality:

```bash
# Check linting (currently shows 0 errors, 78 warnings)
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking (currently 0 errors)
npm run typecheck

# Security check
npm run security:check
```

### ESLint Compliance Strategy

- ✅ **Zero ESLint errors achieved** - maintain this standard
- 78 warnings remaining (primarily style preferences)
- Focus on maintaining functionality while gradually improving code style
- Prioritize security, type safety, and critical issues
- For architectural issues (complexity, file length), either refactor or document the decision
- Avoid adding new ESLint violations
- Use `eslint-disable` sparingly and with justification comments

## Commit Messages

Follow conventional commits:

- `feat(scope): add new feature`
- `fix(scope): fix bug`
- `docs(scope): update documentation`
- `test(scope): add tests`
- `refactor(scope): refactor code`
- `chore(scope): update dependencies`

## Pre-commit Hooks

The project uses Husky for pre-commit validation, which automatically runs formatting and linting
checks:

```bash
# Pre-commit hooks automatically run:
# - Prettier formatting
# - ESLint checks
# - TypeScript compilation verification

# Manual validation (if needed)
npm run lint:fix    # Fix linting issues
npm run format      # Format code
npm run typecheck   # Check TypeScript compilation
```

### Pre-commit Workflow

The pre-commit hooks ensure code quality:

1. Make your changes
2. Write or update tests for your changes
3. Run tests locally: `npm test`
4. Commit your changes - pre-commit hooks will run automatically
5. If pre-commit fails, fix the issues and try again
6. All checks must pass for the commit to succeed

## Any contributions you make will be under the MIT Software License

When you submit code changes, your submissions are understood to be under the same
[MIT License](LICENSE) that covers the project.

## Report bugs using GitHub's [issue tracker](https://github.com/williamzujkowski/puppeteer-mcp/issues)

We use GitHub issues to track public bugs. Report a bug by
[opening a new issue](https://github.com/williamzujkowski/puppeteer-mcp/issues/new).

## Current Build Status

✅ **Production Ready**: The project maintains **0 ESLint errors** and **0 TypeScript compilation
errors**.

### Current Status Overview:

- **TypeScript Compilation**: ✅ 0 errors
- **ESLint**: ✅ 0 errors, 78 warnings (down from 768)
- **Tests**: ✅ 332 passing, 0 failing (all tests pass!)
- **Build Process**: ✅ Successful compilation
- **Development Server**: ✅ Starts successfully
- **Security**: ✅ No vulnerabilities detected
- **Pre-commit Hooks**: ✅ Working and enforcing standards

### Code Quality Standards Maintained:

- ✅ All functions have complexity ≤ 10 (refactored from up to 28)
- ✅ All files are < 300 lines (modularized from up to 457 lines)
- ✅ All functions have ≤ 4 parameters (using interface patterns)
- ✅ All functions are properly sized (< 100 lines)
- ✅ Zero security vulnerabilities
- ✅ Minimal `any` types (only where required for gRPC/Puppeteer integration)

### Development Workflow Status:

- **Core Platform**: Fully functional with comprehensive test coverage
- **Puppeteer Integration**: Fully functional with all tests passing
- **MCP Integration**: Fully operational with complete test coverage
- **CI/CD**: Local development workflows and pre-commit hooks working
- **Production Ready**: All critical bugs fixed, tests passing

New contributions should maintain these high standards. Use the patterns established in the codebase
for:

- Helper function extraction to manage complexity
- Module splitting by responsibility
- Parameter interfaces for grouped data
- Early returns and guard clauses
- Proper async resource cleanup

## Troubleshooting

### Common Development Issues

#### TypeScript Compilation Errors

```bash
# Check for TypeScript errors
npm run typecheck

# Common fixes:
# - Missing type definitions
# - Incorrect import paths
# - Type mismatches in function signatures
```

#### ESLint Errors

```bash
# Fix automatically fixable issues
npm run lint:fix

# For remaining issues:
# - Fix strict-boolean-expressions by adding explicit comparisons
# - Replace 'any' types with proper types where possible
# - Add eslint-disable comments only when necessary
```

#### Test Failures

```bash
# Run specific test files
npm test -- tests/unit/auth/

# Common test issues:
# - Async resource cleanup (use proper afterEach/afterAll)
# - Mock cleanup between tests
# - Puppeteer browser instances not properly closed
```

#### Development Server Issues

```bash
# Clear any cached builds
rm -rf dist/

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Start with verbose logging
DEBUG=* npm run dev
```

### Getting Help

- Check existing issues in the GitHub repository
- Look at the CLAUDE.md file for project-specific guidance
- Review the standards repository for coding guidelines
- Ask questions in issues or pull requests

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
