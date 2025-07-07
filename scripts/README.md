# Scripts Directory

This directory contains utility scripts for the Puppeteer MCP project.

## Version Management Scripts

### update-version.mjs

Updates version numbers across all documentation files to match package.json.

- Usage: `npm run update:version` or `npm run update:version:dry`
- Searches for version patterns in all markdown files
- Updates version references automatically

### version-manager.mjs

Comprehensive version management tool with multiple commands.

- `check` - Verify version consistency
- `sync` - Update all documentation versions
- `bump` - Increment version and update docs
- `release` - Full release process

### version-sync-hook.sh

Git pre-commit hook script that automatically updates documentation when package.json version
changes.

## Other Scripts

### security-check.js

Validates security compliance and NIST control tagging.

### standards-check.js

Ensures code adheres to project standards.

### verify-docs-\*.mjs

Various documentation verification scripts.

### demo-mcp-stdio.ts / test-mcp-browser-stdio.ts

MCP testing and demonstration scripts.

### build.sh / deploy.sh / quick-test.sh

Build and deployment automation scripts.

## Usage

All scripts are typically run through npm scripts defined in package.json:

```bash
npm run version:check    # Check version consistency
npm run version:sync     # Sync documentation versions
npm run security:check   # Run security checks
npm run standards:check  # Check code standards
```
