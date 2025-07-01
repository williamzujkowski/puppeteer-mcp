# Contributing to Puppeteer MCP

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

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
4. Ensure the test suite passes
5. Make sure your code follows our standards
6. Issue that pull request!

## Code Standards

This project follows [William Zujkowski's standards](https://github.com/williamzujkowski/standards). Key points:

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

1. Update the README.md with details of changes to the interface
2. Update the CHANGELOG.md with your changes
3. Run `npm run standards:check` and ensure it passes
4. The PR will be merged once you have the sign-off of at least one maintainer

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Code Style

We use ESLint and Prettier to maintain code quality:

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Commit Messages

Follow conventional commits:

- `feat(scope): add new feature`
- `fix(scope): fix bug`
- `docs(scope): update documentation`
- `test(scope): add tests`
- `refactor(scope): refactor code`
- `chore(scope): update dependencies`

## Any contributions you make will be under the MIT Software License

When you submit code changes, your submissions are understood to be under the same [MIT License](LICENSE) that covers the project.

## Report bugs using GitHub's [issue tracker](https://github.com/yourusername/puppeteer-mcp/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/yourusername/puppeteer-mcp/issues/new).

## License

By contributing, you agree that your contributions will be licensed under its MIT License.