# CI/CD Pipeline Documentation

## Overview

The puppeteer-mcp project uses a comprehensive automated release pipeline built with GitHub Actions.
This pipeline ensures code quality, security, and reliable releases.

## Pipeline Components

### 1. Continuous Integration (CI)

**Workflow**: `.github/workflows/ci-enhanced.yml`

- **Triggers**: Push to main/develop, Pull requests, Merge groups
- **Features**:
  - Multi-version Node.js testing (20.x, 22.x)
  - Code quality checks (ESLint, TypeScript, Prettier)
  - Comprehensive test suite (unit, integration, acceptance)
  - Security scanning (Trivy, npm audit)
  - Performance benchmarks
  - Docker image validation
  - Breaking change detection

### 2. Automated Release Pipeline

**Workflow**: `.github/workflows/release-automated.yml`

- **Triggers**: Manual workflow dispatch
- **Features**:
  - Semantic versioning with automatic version bumping
  - Changelog generation from commit messages
  - Release candidate testing
  - NPM package publishing
  - Docker image building and pushing
  - GitHub release creation
  - Documentation updates

### 3. Dependency Updates

**Workflow**: `.github/workflows/dependency-updates.yml`

- **Triggers**: Weekly schedule (Mondays 9 AM UTC), Manual dispatch
- **Features**:
  - Automated dependency analysis
  - Security vulnerability patching
  - Grouped update PRs
  - Test validation before merging

### 4. Hotfix Workflow

**Workflow**: `.github/workflows/hotfix.yml`

- **Triggers**: Manual dispatch for critical issues
- **Features**:
  - Fast-track critical fixes
  - Isolated testing environment
  - Automatic backporting
  - Rollback procedures

### 5. Performance Monitoring

**Workflow**: `.github/workflows/performance-monitoring.yml`

- **Triggers**: Push to main/develop, PRs, Daily schedule
- **Features**:
  - Startup time benchmarks
  - Browser pool performance
  - Memory usage tracking
  - API response time monitoring
  - Historical trend analysis

### 6. Documentation Updates

**Workflow**: `.github/workflows/docs-update.yml`

- **Triggers**: Code changes, Release events, Manual dispatch
- **Features**:
  - API documentation generation
  - Guide updates
  - Starlight site building
  - GitHub Pages deployment

## Release Process

### 1. Pre-Release Checklist

Run the release checklist to ensure everything is ready:

```bash
npm run release:checklist
```

This validates:

- All tests passing
- No security vulnerabilities
- Documentation updated
- Version consistency
- Clean git state

### 2. Creating a Release

#### Option A: Automated Release (Recommended)

1. Go to GitHub Actions
2. Select "Automated Release Pipeline"
3. Click "Run workflow"
4. Choose release type (patch/minor/major)
5. Review and approve the generated PR

#### Option B: Local Release

```bash
# Dry run to preview changes
npm run release:dry-run

# Create release
npm run release         # Auto-detect version bump
npm run release:patch   # Patch release (1.0.0 → 1.0.1)
npm run release:minor   # Minor release (1.0.0 → 1.1.0)
npm run release:major   # Major release (1.0.0 → 2.0.0)
```

### 3. Pre-release Versions

For beta/alpha releases:

```bash
npm run release:prerelease -- --prerelease beta
```

### 4. Hotfix Process

For critical issues in production:

1. Trigger the hotfix workflow
2. Specify the affected version
3. Describe the issue
4. The workflow will:
   - Create a hotfix branch
   - Run isolated tests
   - Deploy the fix
   - Merge back to main/develop

## Rollback Procedures

If a release causes issues:

```bash
npm run release:rollback
```

This will:

1. List recent releases
2. Let you select a version to rollback to
3. Deprecate the problematic version on NPM
4. Re-publish the previous version as latest
5. Create documentation about the rollback

## Semantic Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes (feat!: or BREAKING CHANGE:)
- **MINOR**: New features (feat:)
- **PATCH**: Bug fixes (fix:)

### Commit Message Format

```
type(scope): subject

body

footer
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test changes
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes

## Security Measures

### Automated Security Scanning

- **Trivy**: Container and filesystem vulnerability scanning
- **npm audit**: Dependency vulnerability checking
- **CodeQL**: Static code analysis
- **OWASP Dependency Check**: Additional vulnerability detection

### Security Gates

1. No high/critical vulnerabilities allowed in production dependencies
2. Security scans on every PR
3. Daily security monitoring
4. Automated dependency updates for security patches

## Performance Monitoring

### Metrics Tracked

- Startup time
- Browser pool initialization
- Memory usage
- API response times
- Bundle size

### Performance Thresholds

- Startup time: < 5 seconds
- Memory usage: < 512MB
- API response: < 100ms average
- Bundle size: < 50MB

## Quality Gates

### Required Checks

All PRs must pass:

1. All test suites
2. TypeScript compilation
3. ESLint (no errors)
4. Security scans
5. Performance benchmarks

### Optional Checks

- Code coverage (target: 80%)
- Documentation generation
- Bundle size analysis

## Monitoring and Notifications

### Release Monitoring

After each release:

1. NPM package availability check
2. Docker image pull verification
3. Installation testing
4. Performance baseline comparison

### Notifications

- GitHub Issues for release reports
- PR comments with benchmark results
- Release notifications in GitHub

## Troubleshooting

### Common Issues

1. **Release fails at NPM publish**
   - Check NPM_TOKEN secret
   - Verify package.json is valid
   - Ensure version doesn't already exist

2. **Docker build fails**
   - Check Dockerfile syntax
   - Verify base image availability
   - Review multi-platform compatibility

3. **Tests fail in CI but pass locally**
   - Check environment variables
   - Review service dependencies
   - Verify Node.js version match

### Debug Mode

Enable debug logging in workflows:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

## Best Practices

1. **Always run the release checklist** before creating a release
2. **Use semantic commit messages** for automatic versioning
3. **Test releases in pre-release** before going to production
4. **Monitor releases** for 24-48 hours after deployment
5. **Document rollback reasons** if needed
6. **Keep dependencies updated** weekly
7. **Review performance trends** regularly

## Scripts Reference

| Script                      | Description                  |
| --------------------------- | ---------------------------- |
| `npm run release:checklist` | Run pre-release validations  |
| `npm run release`           | Create a new release         |
| `npm run release:dry-run`   | Preview release changes      |
| `npm run release:rollback`  | Rollback to previous version |
| `npm run changelog`         | Generate changelog           |
| `npm run version:check`     | Check version consistency    |
| `npm run security:check`    | Run security validations     |

## GitHub Secrets Required

- `NPM_TOKEN`: NPM authentication token
- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password
- `CODECOV_TOKEN`: Codecov integration token
- `APP_ID`: GitHub App ID for automated PRs
- `APP_PRIVATE_KEY`: GitHub App private key

## Maintenance

### Weekly Tasks

- Review dependency updates
- Check performance trends
- Review security alerts

### Monthly Tasks

- Audit CI/CD pipeline performance
- Review and update documentation
- Clean up old artifacts
- Review rollback history

### Quarterly Tasks

- Review and update security policies
- Performance baseline updates
- CI/CD pipeline optimization
- Dependency major version updates
