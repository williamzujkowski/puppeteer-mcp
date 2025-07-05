# Contributing to Puppeteer MCP

Thank you for your interest in contributing to Puppeteer MCP! This guide will help you get started.

## Ways to Contribute

### [How to Contribute](../contributing.md)

Complete contribution guide:

- Getting started
- Development setup
- Submission process
- Review guidelines
- Recognition

### [Code of Conduct](code-of-conduct.md)

Our community standards:

- Expected behavior
- Unacceptable behavior
- Reporting process
- Enforcement
- Attribution

### [Security Policy](../security.md)

Reporting security issues:

- Vulnerability disclosure
- Security updates
- Best practices
- Contact information

## Quick Start Contributing

### 1. Find Something to Work On

- Check [open issues](https://github.com/williamzujkowski/puppeteer-mcp/issues)
- Look for `good first issue` labels
- Review the [roadmap](../project/roadmap.md)
- Propose new features

### 2. Set Up Development Environment

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/puppeteer-mcp.git
cd puppeteer-mcp

# Install dependencies
npm install

# Set up git hooks
npm run prepare
```

### 3. Make Your Changes

```bash
# Create a branch
git checkout -b feature/your-feature

# Make changes
# Write tests
# Update docs

# Verify everything works
npm run typecheck
npm run lint
npm test
```

### 4. Submit Pull Request

- Push your branch
- Open PR with clear description
- Link related issues
- Wait for review

## Types of Contributions

### 🐛 Bug Reports

Help us improve by reporting bugs:

- Use issue templates
- Provide reproduction steps
- Include environment details
- Share error messages

### ✨ Feature Requests

Suggest new features:

- Explain use case
- Provide examples
- Consider implementation
- Discuss alternatives

### 📝 Documentation

Improve our docs:

- Fix typos
- Add examples
- Clarify explanations
- Translate content

### 🧪 Testing

Enhance test coverage:

- Write unit tests
- Add integration tests
- Create E2E scenarios
- Fix flaky tests

### 🔧 Code Contributions

Submit code improvements:

- Fix bugs
- Add features
- Refactor code
- Optimize performance

## Contribution Guidelines

### Code Style

Follow our [coding standards](../development/standards.md):

- TypeScript strict mode
- ESLint rules
- Prettier formatting
- Naming conventions

### Testing

All code must be tested:

- Write tests first (TDD)
- Maintain 85%+ coverage
- Include edge cases
- Document test purpose

### Documentation

Update relevant docs:

- API documentation
- README updates
- Code comments
- Usage examples

### Commit Messages

Use conventional commits:

```
feat: add new browser action
fix: resolve memory leak in session manager
docs: update API reference
test: add unit tests for auth module
chore: update dependencies
```

## Pull Request Process

### 1. Before Submitting

- [ ] Tests pass locally
- [ ] Code follows standards
- [ ] Documentation updated
- [ ] Changelog entry added
- [ ] No merge conflicts

### 2. PR Description

Include:

- What changes were made
- Why they were needed
- How to test them
- Related issues

### 3. Code Review

- Respond to feedback
- Make requested changes
- Ask questions if unclear
- Be patient and respectful

### 4. After Merge

- Delete your branch
- Update your fork
- Celebrate! 🎉

## Development Tips

### Running Specific Tests

```bash
# Run single test file
npm test -- auth.test.ts

# Run tests in watch mode
npm run test:watch

# Debug tests
node --inspect-brk node_modules/.bin/jest
```

### Useful Scripts

```bash
# Format code
npm run format

# Check types
npm run typecheck

# Build project
npm run build

# Run all checks
npm run verify
```

## Getting Help

### Resources

- [Development Guide](../development/)
- [Architecture Docs](../architecture/)
- [API Reference](../reference/)

### Communication

- GitHub Issues - Bug reports and features
- GitHub Discussions - Questions and ideas
- Pull Requests - Code contributions

## Recognition

### Contributors

We value all contributions! Contributors are:

- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Given credit in commits

### Core Contributors

Regular contributors may become core contributors with:

- Write access to repository
- Review responsibilities
- Architecture decisions

## Thank You!

Your contributions make Puppeteer MCP better for everyone. We appreciate your time and effort in
improving this project.

Ready to contribute? Check out our
[open issues](https://github.com/williamzujkowski/puppeteer-mcp/issues) and get started!
