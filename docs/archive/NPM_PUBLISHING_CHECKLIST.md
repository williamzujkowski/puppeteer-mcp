# NPM Publishing Checklist for puppeteer-mcp

## ✅ Completed Preparations

1. **Package Configuration**
   - ✅ Added `bin` entry for CLI usage (`puppeteer-mcp`)
   - ✅ Added `files` field to include only necessary files
   - ✅ Added repository, homepage, and bugs URLs
   - ✅ Updated version to 1.0.10
   - ✅ Added author information

2. **File Management**
   - ✅ Created `.npmignore` to exclude unnecessary files
   - ✅ Verified LICENSE file exists (MIT license)
   - ✅ Fixed TypeScript path aliases for compiled JavaScript

3. **Documentation**
   - ✅ Updated README.md with npm installation instructions
   - ✅ Added usage examples for npx and Claude MCP

4. **Testing**
   - ✅ Successfully built TypeScript project
   - ✅ Created and tested npm package with `npm pack`
   - ✅ Verified CLI works with `npx puppeteer-mcp`
   - ✅ Confirmed MCP stdio transport functions correctly

## 📦 Publishing Steps

### 1. Final Pre-publish Checks

```bash
# Ensure all tests pass
npm test

# Check package contents
npm pack --dry-run

# Test local installation
npm install -g ./puppeteer-mcp-1.0.0.tgz
puppeteer-mcp --version
npm uninstall -g puppeteer-mcp
```

### 2. NPM Account Setup

```bash
# Login to npm (create account at npmjs.com if needed)
npm login

# Verify you're logged in
npm whoami
```

### 3. Publish to NPM

```bash
# Publish the package
npm publish

# Or publish with public access (if scoped)
npm publish --access public
```

### 4. Post-publish Verification

```bash
# Test installation from npm
npm install -g puppeteer-mcp
puppeteer-mcp

# Test with npx
npx puppeteer-mcp

# Test with Claude MCP (if you have Claude Desktop)
claude mcp add puppeteer-mcp
```

## 🚀 Usage After Publishing

### Global Installation

```bash
npm install -g puppeteer-mcp
puppeteer-mcp
```

### Using with npx (no installation)

```bash
npx puppeteer-mcp
```

### Claude Desktop Integration

```bash
claude mcp add puppeteer-mcp
```

### Programmatic Usage

```javascript
import { createMCPServer } from 'puppeteer-mcp';

const server = createMCPServer({
  // options
});

await server.start();
```

## 📝 Important Notes

1. **Package Name**: `puppeteer-mcp` is available on npm
2. **Entry Point**: `dist/mcp/start-mcp.js` (CLI) and `dist/server.js` (programmatic)
3. **Node Version**: Requires Node.js 20+
4. **Dependencies**: Puppeteer will download Chromium automatically if not present

## 🔄 Future Updates

When updating the package:

1. Update version in `package.json`
2. Update CHANGELOG (if maintained)
3. Run tests
4. Build project (`npm run build`)
5. Publish with `npm publish`

## 🐛 Troubleshooting

If the package doesn't work after publishing:

1. Check that all imports use relative paths (not TypeScript aliases)
2. Ensure `dist/` folder is included in the published package
3. Verify the shebang line in `dist/mcp/start-mcp.js`
4. Check that all dependencies are in `dependencies` (not `devDependencies`)
