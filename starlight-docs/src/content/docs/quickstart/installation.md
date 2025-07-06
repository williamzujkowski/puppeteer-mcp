---
title: Installation Guide
description: 'Version 1.0.10 - Installation guide for Puppeteer MCP'
---

# Installation Guide

**Version**: 1.0.10  
**Last Updated**: 2025-01-06  
**Reading Time**: 5 minutes

## Prerequisites

Before installing, ensure you have:

- **Node.js 18.0.0+** (20.0.0+ recommended)
- **npm 9.0.0+** (10.0.0+ recommended)

Check your versions:

```bash
node --version  # Should show v18.0.0 or higher
npm --version   # Should show 9.0.0 or higher
```

## Installation Methods

### 🚀 Method 1: Quick Try (No Installation)

Perfect for testing or one-time use:

```bash
npx puppeteer-mcp
```

This downloads and runs the latest version automatically.

### 📦 Method 2: Global Installation

Best for CLI usage and Claude Desktop integration:

```bash
npm install -g puppeteer-mcp
```

After installation, run from anywhere:

```bash
puppeteer-mcp
```

### 🔧 Method 3: Project Installation

For integration into your Node.js application:

```bash
npm install puppeteer-mcp
```

Add to your code:

```javascript
const { PuppeteerMCP } = require('puppeteer-mcp');
// or
import { PuppeteerMCP } from 'puppeteer-mcp';
```

### 🐳 Method 4: Docker Installation

For containerized deployments:

```bash
# Using pre-built image (when available)
docker pull puppeteer-mcp:latest
docker run -p 3000:3000 puppeteer-mcp

# Or build from source
git clone https://github.com/williamzujkowski/puppeteer-mcp.git
cd puppeteer-mcp
docker build -t puppeteer-mcp .
docker run -p 3000:3000 -p 50051:50051 puppeteer-mcp
```

### 📁 Method 5: From Source

For development or customization:

```bash
# Clone the repository
git clone https://github.com/williamzujkowski/puppeteer-mcp.git
cd puppeteer-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

## Platform-Specific Instructions

### 🐧 Linux

<details>
<summary>Ubuntu/Debian Dependencies</summary>

Chrome requires additional system libraries:

```bash
sudo apt-get update
sudo apt-get install -y \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libgtk-3-0 \
  libasound2
```

</details>

<details>
<summary>CentOS/RHEL/Fedora Dependencies</summary>

```bash
sudo yum install -y \
  alsa-lib \
  atk \
  cups-libs \
  gtk3 \
  libXcomposite \
  libXdamage \
  libXrandr \
  libgbm \
  libxkbcommon \
  pango
```

</details>

<details>
<summary>Alpine Linux (Docker)</summary>

```dockerfile
# Add to your Dockerfile
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  freetype-dev \
  harfbuzz \
  ca-certificates \
  ttf-freefont
```

</details>

### 🍎 macOS

Chrome dependencies are typically handled automatically. If you encounter issues:

```bash
# Install Xcode Command Line Tools if needed
xcode-select --install

# Using Homebrew (optional)
brew install --cask google-chrome
```

### 🪟 Windows

<details>
<summary>Windows Setup</summary>

1. **Use PowerShell as Administrator**
2. **Install via npm**:

   ```powershell
   npm install -g puppeteer-mcp
   ```

3. **For WSL2 (Recommended)**:
   - Install WSL2: `wsl --install`
   - Follow Linux instructions inside WSL2

</details>

## Verify Installation

### Check Installation

```bash
# For global install
puppeteer-mcp --version

# For project install
npx puppeteer-mcp --version
```

### Test Server Startup

```bash
# Start the server
puppeteer-mcp

# In another terminal, check health
curl http://localhost:3000/api/v1/health
```

Expected response:

```json
{
  "status": "healthy",
  "version": "1.0.10",
  "uptime": 12.345,
  "timestamp": "2025-01-05T12:00:00.000Z"
}
```

## Troubleshooting

### Common Issues

<details>
<summary>❌ Permission Denied (EACCES)</summary>

**Problem**: `npm ERR! code EACCES`

**Solutions**:

1. **Use npx instead**:

   ```bash
   npx puppeteer-mcp
   ```

2. **Fix npm permissions**:

   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   npm install -g puppeteer-mcp
   ```

3. **Use a Node version manager** (recommended):
   ```bash
   # Install nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   # Install Node.js
   nvm install 20
   nvm use 20
   npm install -g puppeteer-mcp
   ```

</details>

<details>
<summary>❌ Chrome Download Failed</summary>

**Problem**: Puppeteer can't download Chrome

**Solutions**:

1. **Behind a proxy**:

   ```bash
   export HTTPS_PROXY=http://proxy.company.com:8080
   export HTTP_PROXY=http://proxy.company.com:8080
   npm install puppeteer-mcp
   ```

2. **Use system Chrome**:

   ```bash
   export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
   npm install puppeteer-mcp
   ```

3. **Change download host**:
   ```bash
   export PUPPETEER_DOWNLOAD_HOST=https://storage.googleapis.com
   npm install puppeteer-mcp
   ```

</details>

<details>
<summary>❌ Chrome Won't Start</summary>

**Problem**: "Failed to launch the browser process"

**Solution**: Install missing dependencies

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y $(cat <<EOF
libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0
libgbm1 libasound2 libatspi2.0-0 libxshmfence1
EOF
)

# Or run in Docker which includes all dependencies
```

</details>

<details>
<summary>❌ Port Already in Use</summary>

**Problem**: `Error: listen EADDRINUSE`

**Solutions**:

1. **Find and kill the process**:

   ```bash
   # Linux/macOS
   lsof -i :3000
   kill -9 <PID>

   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

2. **Use different port**:
   ```bash
   PORT=3001 puppeteer-mcp
   ```

</details>

### Advanced Troubleshooting

<details>
<summary>🔍 Debug Mode</summary>

Enable verbose logging:

```bash
DEBUG=puppeteer:* NODE_ENV=development puppeteer-mcp
```

</details>

<details>
<summary>🧹 Clean Installation</summary>

If all else fails, try a clean installation:

```bash
# Remove global package
npm uninstall -g puppeteer-mcp

# Clear npm cache
npm cache clean --force

# Remove node_modules in project
rm -rf node_modules package-lock.json

# Reinstall
npm install -g puppeteer-mcp
```

</details>

## Next Steps

✅ Installation complete! Now:

1. **[Configure your environment](/puppeteer-mcp/./configuration.md)** - Set up authentication and
   customize settings
2. **[Try your first automation](/puppeteer-mcp/./first-steps.md)** - Run basic examples
3. **[Set up Claude Desktop](/puppeteer-mcp/./claude-desktop.md)** - Enable AI-powered automation

## Getting Help

- 📚 Check the [FAQ](#) for common questions
- 💬 Open an [issue on GitHub](https://github.com/williamzujkowski/puppeteer-mcp/issues)
- 🔍 Search existing issues for solutions

---

**Tip**: Having issues? Try `npx puppeteer-mcp` first - it often resolves installation problems! 🎯
