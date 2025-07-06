---
title: NPM Package Deployment
description: Complete guide for deploying Puppeteer MCP as an npm package.
---

# NPM Package Deployment

Complete guide for deploying Puppeteer MCP as an npm package.

## Package Overview

- **Name**: `puppeteer-mcp`
- **Current Version**: 1.0.10
- **License**: MIT
- **Registry**: [npmjs.com/package/puppeteer-mcp](https://www.npmjs.com/package/puppeteer-mcp)

## Installation Methods

### Global Installation

Best for system-wide CLI access:

```bash
# Install globally
npm install -g puppeteer-mcp

# Verify installation
puppeteer-mcp --version

# Run the server
puppeteer-mcp
```

### Local Project Installation

Best for project-specific usage:

```bash
# Add to project
npm install puppeteer-mcp

# Add to package.json scripts
{
  "scripts": {
    "mcp": "puppeteer-mcp",
    "mcp:dev": "puppeteer-mcp --dev"
  }
}

# Run via npm
npm run mcp
```

### Using NPX

Best for one-time usage or testing:

```bash
# Run latest version
npx puppeteer-mcp

# Run specific version
npx puppeteer-mcp@1.0.0

# Run with arguments
npx puppeteer-mcp --port 3001
```

## Package Contents

### What's Included

```
puppeteer-mcp/
├── dist/              # Compiled JavaScript
│   ├── index.js      # Main entry point
│   ├── cli.js        # CLI entry point
│   └── **/*.js       # All modules
├── package.json      # Package manifest
├── README.md         # Package documentation
├── LICENSE           # MIT license
└── CHANGELOG.md      # Version history
```

### Binary Entry Points

```json
{
  "bin": {
    "puppeteer-mcp": "./dist/cli.js"
  }
}
```

## Publishing Process

### 1. Pre-Publish Checklist

```bash
# Run all checks
npm run prepublish-check

# Individual checks
npm run typecheck   # TypeScript compilation
npm run lint        # ESLint checks
npm test           # All tests pass
npm audit          # Security audit
```

### 2. Version Management

```bash
# Patch release (1.0.0 → 1.0.1)
npm version patch -m "fix: %s"

# Minor release (1.0.0 → 1.1.0)
npm version minor -m "feat: %s"

# Major release (1.0.0 → 2.0.0)
npm version major -m "breaking: %s"

# Pre-release
npm version prerelease --preid=beta
# Results in: 1.0.1-beta.0
```

### 3. Build Package

```bash
# Clean build directory
npm run clean

# Build TypeScript
npm run build

# Verify build output
ls -la dist/
```

### 4. Test Package Locally

```bash
# Create package archive
npm pack

# Test in another directory
cd /tmp
npm install /path/to/puppeteer-mcp-1.0.0.tgz
npx puppeteer-mcp --version
```

### 5. Publish to NPM

```bash
# Dry run first
npm publish --dry-run

# Publish to registry
npm publish

# Publish with tag
npm publish --tag beta
npm publish --tag next
```

## Configuration

### Package.json Configuration

```json
{
  "name": "puppeteer-mcp",
  "version": "1.0.10",
  "description": "AI-enabled browser automation platform",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "puppeteer-mcp": "./dist/cli.js"
  },
  "files": ["dist/**/*", "README.md", "LICENSE", "CHANGELOG.md"],
  "scripts": {
    "prepublishOnly": "npm run clean && npm run build && npm test"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "keywords": ["puppeteer", "mcp", "browser-automation", "ai", "typescript"],
  "repository": {
    "type": "git",
    "url": "https://github.com/williamzujkowski/puppeteer-mcp.git"
  }
}
```

### NPM Configuration

```bash
# Set registry (if using private)
npm config set registry https://registry.npmjs.org/

# Set auth token
npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN

# Set scope (if scoped package)
npm config set @yourscope:registry https://registry.npmjs.org/
```

## Usage Examples

### CLI Usage

```bash
# Basic usage
puppeteer-mcp

# With custom port
puppeteer-mcp --port 3001

# With config file
puppeteer-mcp --config ./config.json

# Development mode
puppeteer-mcp --dev

# Help
puppeteer-mcp --help
```

### Programmatic Usage

```javascript
// CommonJS
const { PuppeteerMCP } = require('puppeteer-mcp');

// ES Modules
import { PuppeteerMCP } from 'puppeteer-mcp';

// Create instance
const mcp = new PuppeteerMCP({
  auth: {
    token: 'your-token',
  },
  server: {
    port: 3000,
  },
});

// Start server
await mcp.start();

// Stop server
await mcp.stop();
```

### Integration Examples

```javascript
// Express middleware
const express = require('express');
const { middleware } = require('puppeteer-mcp');

const app = express();
app.use(
  '/browser',
  middleware({
    auth: { token: process.env.AUTH_TOKEN },
  }),
);
```

## Troubleshooting

### Installation Issues

#### Permission Denied

```bash
# Error: EACCES: permission denied
npm ERR! code EACCES

# Solution 1: Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc

# Solution 2: Use npx instead
npx puppeteer-mcp
```

#### Puppeteer Download Failed

```bash
# Error: Failed to download Chromium

# Solution 1: Skip download
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# Solution 2: Use proxy
export HTTPS_PROXY=http://proxy.company.com:8080
```

#### Platform-Specific Issues

```bash
# Linux: Missing dependencies
sudo apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0

# macOS: Code signing
xattr -d com.apple.quarantine /path/to/chrome

# Windows: Path issues
set PATH=%PATH%;C:\path\to\chrome
```

### Runtime Issues

#### Port Already in Use

```bash
# Find process
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Use different port
PORT=3001 puppeteer-mcp
```

#### Memory Issues

```bash
# Increase Node.js memory
node --max-old-space-size=4096 $(which puppeteer-mcp)

# Limit browser sessions
MAX_SESSIONS=5 puppeteer-mcp
```

## Maintenance

### Version Updates

```bash
# Check for updates
npm outdated -g puppeteer-mcp

# Update to latest
npm update -g puppeteer-mcp

# Update to specific version
npm install -g puppeteer-mcp@1.1.0
```

### Security Audits

```bash
# Run security audit
npm audit

# Fix vulnerabilities
npm audit fix

# Force fixes (careful!)
npm audit fix --force
```

### Deprecation Notices

```bash
# Deprecate old version
npm deprecate puppeteer-mcp@0.9.0 "Please upgrade to 1.0.0"

# Check deprecation
npm view puppeteer-mcp deprecated
```

## Best Practices

### 1. Semantic Versioning

- Use SemVer strictly
- Document breaking changes
- Maintain compatibility

### 2. Documentation

- Keep README updated
- Include migration guides
- Provide examples

### 3. Testing

- Test before publishing
- Include integration tests
- Verify on multiple platforms

### 4. Security

- Regular security audits
- Quick patch releases
- Responsible disclosure

### 5. Community

- Respond to issues
- Accept contributions
- Maintain changelog

## Distribution Channels

### NPM Registry

- Primary distribution
- Version management
- Download statistics

### GitHub Releases

- Source code archives
- Release notes
- Binary attachments

### Docker Hub

- Container images
- Multi-arch support
- Version tags

### CDN Distribution

- For browser usage
- Minified versions
- Integrity hashes

## Metrics & Analytics

### NPM Statistics

```bash
# View download stats
npm view puppeteer-mcp

# Detailed stats at:
# https://www.npmjs.com/package/puppeteer-mcp
```

### Usage Tracking

- Download counts
- Version adoption
- Platform distribution
- Dependency usage

## Future Considerations

### Planned Features

- TypeScript declarations
- ESM support
- Smaller bundle size
- Plugin system

### Breaking Changes

- API redesign
- Dependency updates
- Node.js requirements
- Configuration format
