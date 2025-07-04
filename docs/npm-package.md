# NPM Package Documentation

**Package**: puppeteer-mcp  
**Version**: 1.0.0  
**Last Updated**: 2025-01-04  
**Status**: Active

## 1. NPM Package Overview

### Package Information

- **Name**: `puppeteer-mcp`
- **Version**: `1.0.0`
- **License**: MIT
- **Repository**: https://github.com/williamzujkowski/puppeteer-mcp
- **Registry**: https://www.npmjs.com/package/puppeteer-mcp

### Description

A production-ready AI-enabled browser automation platform that provides REST, gRPC, WebSocket, and
Model Context Protocol (MCP) interfaces with unified session management, enterprise-grade security,
and comprehensive Puppeteer integration.

### Key Features

- **Multi-Protocol Support**: REST API, gRPC, WebSocket, and MCP interfaces
- **Browser Automation**: Full Puppeteer integration with session management
- **Enterprise Security**: JWT + API key authentication, NIST compliance
- **AI Integration**: Model Context Protocol (MCP) for AI agent automation
- **TypeScript**: Fully typed with zero compilation errors
- **Production Ready**: Comprehensive error handling and resource management

## 2. Publishing Process

### Pre-Publish Checklist

Before publishing a new version, ensure:

1. **Code Quality**

   ```bash
   npm run typecheck  # Must pass with zero errors
   npm run lint       # Address critical warnings
   npm test           # All tests must pass
   ```

2. **Version Bump**

   ```bash
   # For patch releases (bug fixes)
   npm version patch

   # For minor releases (new features, backward compatible)
   npm version minor

   # For major releases (breaking changes)
   npm version major
   ```

3. **Documentation Updates**
   - Update CHANGELOG.md with release notes
   - Update README.md if features changed
   - Update this file with new version number
   - Verify all examples still work

4. **Dependency Audit**
   ```bash
   npm audit          # Fix any high/critical vulnerabilities
   npm outdated       # Review outdated dependencies
   ```

### Build Steps

1. **Clean Previous Build**

   ```bash
   npm run clean
   ```

2. **Build Distribution**

   ```bash
   npm run build
   ```

3. **Verify Build Output**

   ```bash
   # Check dist/ directory contains:
   ls -la dist/
   # - Compiled JavaScript files
   # - Type definitions (.d.ts)
   # - Source maps (if enabled)
   ```

4. **Test Distribution Locally**
   ```bash
   npm pack  # Creates puppeteer-mcp-1.0.0.tgz
   # Test in another project:
   npm install ../path/to/puppeteer-mcp-1.0.0.tgz
   ```

### Publishing Commands

1. **Dry Run** (Recommended first)

   ```bash
   npm publish --dry-run
   ```

2. **Publish to NPM**

   ```bash
   npm publish
   ```

3. **Publish with Tag** (for pre-releases)

   ```bash
   # For beta releases
   npm publish --tag beta

   # For next major version testing
   npm publish --tag next
   ```

### Post-Publish Steps

1. **Verify on NPM**
   - Check https://www.npmjs.com/package/puppeteer-mcp
   - Verify version number and README display

2. **Create GitHub Release**

   ```bash
   git push origin main --tags
   # Create release on GitHub with changelog
   ```

3. **Announce Release**
   - Update project documentation
   - Notify users of breaking changes (if any)

## 3. Package Contents

### What's Included

The npm package includes:

```
puppeteer-mcp/
├── dist/                 # Compiled JavaScript and type definitions
│   ├── index.js         # Main entry point
│   ├── index.d.ts       # TypeScript definitions
│   ├── bin/             # Executable scripts
│   │   └── puppeteer-mcp.js
│   └── **/*.js|.d.ts    # All compiled modules
├── package.json         # Package manifest
├── README.md           # Package documentation
├── LICENSE             # MIT license
└── CHANGELOG.md        # Version history
```

### Excluded from Package

The following are NOT included (via .npmignore):

```
src/              # Source TypeScript files
test/             # Test files
docs/             # Development documentation
.env*             # Environment files
*.log             # Log files
coverage/         # Test coverage reports
.git/             # Git repository
node_modules/     # Dependencies (installed separately)
```

### Entry Points

1. **Main Entry** (`package.json` → `main`)

   ```javascript
   const { PuppeteerMCP } = require('puppeteer-mcp');
   ```

2. **TypeScript Entry** (`package.json` → `types`)

   ```typescript
   import { PuppeteerMCP } from 'puppeteer-mcp';
   ```

3. **Binary Entry** (`package.json` → `bin`)
   ```bash
   npx puppeteer-mcp --help
   ```

### Package.json Configuration

Key fields in package.json:

```json
{
  "name": "puppeteer-mcp",
  "version": "1.0.0",
  "description": "AI-enabled browser automation platform with MCP support",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "puppeteer-mcp": "./dist/bin/puppeteer-mcp.js"
  },
  "files": ["dist/**/*", "README.md", "LICENSE", "CHANGELOG.md"],
  "scripts": {
    "prepublishOnly": "npm run clean && npm run build && npm test"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": ["puppeteer", "mcp", "browser-automation", "ai", "typescript"]
}
```

## 4. Maintenance

### Version Management

Follow Semantic Versioning (SemVer):

- **MAJOR.MINOR.PATCH** (e.g., 1.0.0)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### Version Update Guidelines

1. **Patch Version** (1.0.0 → 1.0.1)
   - Bug fixes
   - Security patches
   - Documentation updates
   - Dependency updates (non-breaking)

2. **Minor Version** (1.0.0 → 1.1.0)
   - New features
   - New API endpoints
   - Performance improvements
   - Deprecation notices (without removal)

3. **Major Version** (1.0.0 → 2.0.0)
   - Breaking API changes
   - Removed deprecated features
   - Major architectural changes
   - Node.js version requirement changes

### Changelog Management

Update CHANGELOG.md for every release:

```markdown
## [1.0.1] - 2025-01-05

### Fixed

- Fixed memory leak in browser session management
- Resolved WebSocket connection timeout issues

### Security

- Updated puppeteer to 21.7.0 (security patch)

### Changed

- Improved error messages for authentication failures
```

### Deprecation Policy

1. **Deprecation Notice**
   - Add deprecation warnings in minor release
   - Document in CHANGELOG.md
   - Update documentation with migration guide

   ```typescript
   /**
    * @deprecated Since version 1.1.0. Will be removed in 2.0.0.
    * Use `newMethod()` instead.
    */
   oldMethod() {
     console.warn('oldMethod() is deprecated. Use newMethod() instead.');
     return this.newMethod();
   }
   ```

2. **Grace Period**
   - Maintain deprecated features for at least one minor version
   - Provide clear migration path
   - Announce in release notes

3. **Removal**
   - Remove in next major version
   - Document breaking changes prominently
   - Provide migration script if possible

### Release Schedule

- **Patch Releases**: As needed for bugs/security
- **Minor Releases**: Monthly or bi-monthly
- **Major Releases**: Annually or as needed

### Security Updates

1. **Critical Security Fixes**
   - Publish patch immediately
   - Announce on GitHub
   - Consider backporting to previous major versions

2. **Dependency Updates**

   ```bash
   # Regular security audit
   npm audit fix

   # Update specific vulnerable dependency
   npm update package-name
   ```

### Package Health Monitoring

1. **Weekly Checks**
   - npm audit results
   - Download statistics
   - Issue tracker review

2. **Monthly Reviews**
   - Dependency updates
   - Performance benchmarks
   - User feedback integration

3. **Quarterly Planning**
   - Feature roadmap
   - Breaking change planning
   - Major version planning

## Best Practices

1. **Always Test Before Publishing**
   - Run full test suite
   - Test package installation
   - Verify binary execution

2. **Use Prerelease Versions**

   ```bash
   # For testing major changes
   npm version 2.0.0-beta.1
   npm publish --tag beta
   ```

3. **Maintain Backward Compatibility**
   - Avoid breaking changes in minor/patch releases
   - Provide deprecation warnings
   - Document migration paths

4. **Clear Communication**
   - Detailed CHANGELOG entries
   - GitHub release notes
   - Migration guides for breaking changes

5. **Emergency Procedures**

   ```bash
   # If you need to unpublish (within 72 hours)
   npm unpublish puppeteer-mcp@1.0.1

   # Deprecate a version
   npm deprecate puppeteer-mcp@1.0.1 "Critical bug, please upgrade to 1.0.2"
   ```

---

For questions about the publishing process or package maintenance, refer to the npm documentation at
https://docs.npmjs.com/
