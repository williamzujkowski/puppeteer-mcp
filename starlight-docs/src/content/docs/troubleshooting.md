---
title: Troubleshooting Guide
description: Version: 1.0.10  
---

# Troubleshooting Guide

**Version**: 1.0.10  
**Last Updated**: 2025-01-04  
**Status**: Active

This guide addresses common issues users encounter with puppeteer-mcp installation, configuration,
and runtime. Each section provides clear problem descriptions, step-by-step solutions, and
verification methods.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [CLI Command Issues](#cli-command-issues)
3. [Claude Desktop Integration Issues](#claude-desktop-integration-issues)
4. [Runtime Issues](#runtime-issues)
5. [Network Issues](#network-issues)
6. [Browser-Related Issues](#browser-related-issues)
7. [Performance Issues](#performance-issues)
8. [Security Issues](#security-issues)

## Installation Issues

### Global Installation Permission Errors

**Problem**: `npm ERR! code EACCES` when running `npm install -g puppeteer-mcp`

**Symptoms**:

```bash
npm ERR! code EACCES
npm ERR! syscall access
npm ERR! path /usr/local/lib/node_modules
npm ERR! errno -13
```

**Solutions**:

1. **Use npx instead (Recommended)**:

   ```bash
   # No installation needed
   npx puppeteer-mcp
   ```

2. **Fix npm permissions**:

   ```bash
   # Create a directory for global packages
   mkdir ~/.npm-global

   # Configure npm to use the new directory
   npm config set prefix '~/.npm-global'

   # Add to PATH (bash)
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc

   # For zsh users
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
   source ~/.zshrc

   # Now install without sudo
   npm install -g puppeteer-mcp
   ```

3. **Alternative: Change npm's default directory**:

   ```bash
   # Find npm's directory
   npm config get prefix

   # Change ownership (replace USERNAME with your username)
   sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}

   # Install normally
   npm install -g puppeteer-mcp
   ```

**Verification**:

```bash
# Check if installed
puppeteer-mcp --version

# Check installation location
which puppeteer-mcp
```

### Missing Dependencies (Chrome/Chromium)

**Problem**: Puppeteer can't find or download Chrome/Chromium

**Symptoms**:

- `Error: Could not find expected browser`
- `Failed to launch the browser process`
- Download timeouts during installation

**Solutions**:

1. **Let Puppeteer download Chromium automatically**:

   ```bash
   # Clear npm cache first
   npm cache clean --force

   # Reinstall with fresh download
   npm install -g puppeteer-mcp
   ```

2. **Install system Chrome/Chromium**:

   **Ubuntu/Debian**:

   ```bash
   sudo apt-get update
   sudo apt-get install -y chromium-browser chromium-codecs-ffmpeg

   # Install additional dependencies
   sudo apt-get install -y \
     libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
     libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 \
     libgbm1 libgtk-3-0 libasound2
   ```

   **CentOS/RHEL/Fedora**:

   ```bash
   sudo yum install -y chromium
   sudo yum install -y \
     alsa-lib atk cups-libs gtk3 libXcomposite libXdamage \
     libXrandr libgbm libxkbcommon
   ```

   **macOS**:

   ```bash
   # Using Homebrew
   brew install --cask chromium
   ```

   **Windows**:

   ```powershell
   # Download Chrome installer
   # https://www.google.com/chrome/

   # Or use Chocolatey
   choco install chromium
   ```

3. **Skip Chromium download and use system Chrome**:

   ```bash
   # Set environment variables
   export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

   # For Google Chrome
   export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

   # Install without downloading Chromium
   npm install -g puppeteer-mcp
   ```

**Verification**:

```bash
# Check if Chrome/Chromium is available
chromium-browser --version
# or
google-chrome --version

# Test puppeteer-mcp browser detection
puppeteer-mcp --check-browser
```

### Node.js Version Compatibility

**Problem**: Package requires Node.js 20.0.0 or higher

**Symptoms**:

```
npm ERR! engine Unsupported engine
npm ERR! engine Not compatible with your version of node/npm
```

**Solutions**:

1. **Check current Node.js version**:

   ```bash
   node --version
   # Should output v20.0.0 or higher
   ```

2. **Update Node.js using nvm (Node Version Manager)**:

   ```bash
   # Install nvm (if not already installed)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

   # Reload shell
   source ~/.bashrc

   # Install and use Node.js 20
   nvm install 20
   nvm use 20
   nvm alias default 20

   # Verify
   node --version
   ```

3. **Update Node.js using package manager**:

   **Ubuntu/Debian**:

   ```bash
   # Add NodeSource repository
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

   **macOS**:

   ```bash
   # Using Homebrew
   brew update
   brew upgrade node
   ```

**Verification**:

```bash
node --version  # Should be >= 20.0.0
npm --version   # Should be >= 8.0.0
```

### npm Cache Issues

**Problem**: Installation fails due to corrupted npm cache

**Symptoms**:

- `npm ERR! Unexpected end of JSON input`
- `npm ERR! sha512 integrity checksum failed`
- Random installation failures

**Solutions**:

1. **Clear npm cache**:

   ```bash
   npm cache clean --force
   ```

2. **Delete node_modules and package-lock**:

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Use different npm registry**:

   ```bash
   # Temporarily use different registry
   npm install -g puppeteer-mcp --registry https://registry.npmjs.org/

   # Or set permanently
   npm config set registry https://registry.npmjs.org/
   ```

**Verification**:

```bash
# Check npm cache location
npm config get cache

# Verify cache is clean
npm cache verify
```

## CLI Command Issues

### Command Not Found After Global Install

**Problem**: `puppeteer-mcp: command not found` after successful installation

**Solutions**:

1. **Check if npm bin is in PATH**:

   ```bash
   # Find npm global bin directory
   npm config get prefix

   # Check if it's in PATH
   echo $PATH | grep $(npm config get prefix)/bin

   # If not found, add to PATH
   export PATH="$(npm config get prefix)/bin:$PATH"

   # Make permanent (bash)
   echo 'export PATH="'$(npm config get prefix)'/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   ```

2. **Use full path**:

   ```bash
   # Find installation path
   npm list -g puppeteer-mcp

   # Use full path to executable
   $(npm config get prefix)/bin/puppeteer-mcp
   ```

3. **Reinstall with correct prefix**:

   ```bash
   # Set local prefix
   npm config set prefix ~/.npm-global

   # Reinstall
   npm install -g puppeteer-mcp

   # Update PATH
   export PATH=~/.npm-global/bin:$PATH
   ```

**Verification**:

```bash
# Should show the executable path
which puppeteer-mcp

# Should run without errors
puppeteer-mcp --version
```

### PATH Issues

**Problem**: Terminal can't find puppeteer-mcp despite installation

**Solutions by Platform**:

**macOS/Linux**:

```bash
# Add npm global bin to PATH
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# For zsh (macOS default)
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Windows**:

```powershell
# Get npm prefix
npm config get prefix

# Add to PATH (run as Administrator)
[Environment]::SetEnvironmentVariable(
    "Path",
    $env:Path + ";" + (npm config get prefix),
    [EnvironmentVariableTarget]::User
)

# Restart terminal
```

### Executable Permissions

**Problem**: Permission denied when running puppeteer-mcp

**Solutions**:

1. **Fix executable permissions**:

   ```bash
   # Find the executable
   which puppeteer-mcp

   # Make it executable
   chmod +x $(which puppeteer-mcp)
   ```

2. **Check file ownership**:

   ```bash
   # Check ownership
   ls -la $(which puppeteer-mcp)

   # Fix if needed
   sudo chown $(whoami) $(which puppeteer-mcp)
   ```

## Claude Desktop Integration Issues

### Incorrect `claude mcp add` Usage

**Problem**: `claude mcp add` command fails or doesn't work as expected

**Common Mistakes**:

- Using package name instead of executable command
- Missing required arguments
- Incorrect syntax

**Correct Usage**:

1. **Using npx (Recommended)**:

   ```bash
   claude mcp add "npx puppeteer-mcp"
   ```

2. **Using global install**:

   ```bash
   # If globally installed
   claude mcp add "puppeteer-mcp"

   # With full path if needed
   claude mcp add "/home/user/.npm-global/bin/puppeteer-mcp"
   ```

3. **With environment variables**:
   ```bash
   claude mcp add "PUPPETEER_MCP_AUTH_TOKEN=your-token npx puppeteer-mcp"
   ```

**Alternative: Manual Configuration**:

If `claude mcp add` doesn't work, manually edit the config file:

### Configuration File Location Problems

**Problem**: Can't find Claude Desktop configuration file

**File Locations by Platform**:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

**Creating the Configuration**:

1. **Create directory if missing**:

   ```bash
   # macOS
   mkdir -p ~/Library/Application\ Support/Claude

   # Windows (PowerShell)
   New-Item -ItemType Directory -Force -Path "$env:APPDATA\Claude"

   # Linux
   mkdir -p ~/.config/claude
   ```

2. **Create config file**:

   ```json
   {
     "mcpServers": {
       "puppeteer": {
         "command": "npx",
         "args": ["puppeteer-mcp"],
         "env": {
           "PUPPETEER_MCP_AUTH_TOKEN": "your-secret-token-here"
         }
       }
     }
   }
   ```

3. **Set correct permissions**:
   ```bash
   # macOS/Linux
   chmod 600 ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

### MCP Server Not Starting

**Problem**: Claude Desktop doesn't show puppeteer tools

**Diagnostic Steps**:

1. **Test MCP server manually**:

   ```bash
   # Run in terminal to see output
   npx puppeteer-mcp

   # Should show:
   # "MCP server started successfully"
   # "Transport type: stdio"
   ```

2. **Check Claude Desktop logs**:
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%LOCALAPPDATA%\Claude\logs\`
   - Linux: `~/.local/share/claude/logs/`

3. **Common fixes**:

   ```json
   {
     "mcpServers": {
       "puppeteer": {
         "command": "npx",
         "args": ["puppeteer-mcp"],
         "env": {
           "PUPPETEER_MCP_AUTH_TOKEN": "test-token",
           "NODE_ENV": "production",
           "LOG_LEVEL": "debug"
         }
       }
     }
   }
   ```

4. **Restart Claude Desktop**:
   - Completely quit Claude (not just close window)
   - Start Claude again
   - Check if "puppeteer" appears in available tools

### Authentication Token Issues

**Problem**: MCP server starts but authentication fails

**Solutions**:

1. **Generate secure token**:

   ```bash
   # Generate random token
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Set token in config**:

   ```json
   {
     "mcpServers": {
       "puppeteer": {
         "command": "npx",
         "args": ["puppeteer-mcp"],
         "env": {
           "PUPPETEER_MCP_AUTH_TOKEN": "your-generated-token-here"
         }
       }
     }
   }
   ```

3. **Test authentication**:

   ```bash
   # Set token and test
   export PUPPETEER_MCP_AUTH_TOKEN="your-token"
   npx puppeteer-mcp

   # In another terminal, test API
   curl -H "Authorization: Bearer your-token" http://localhost:3000/api/health
   ```

## Runtime Issues

### Proto File Missing Errors

**Problem**: `Error: Cannot find proto file` or similar gRPC-related errors

**Solutions**:

1. **Check if proto files are included**:

   ```bash
   # List package contents
   npm list -g puppeteer-mcp
   ls -la $(npm root -g)/puppeteer-mcp/proto/
   ```

2. **Reinstall to ensure all files**:

   ```bash
   npm uninstall -g puppeteer-mcp
   npm install -g puppeteer-mcp
   ```

3. **Use npx to avoid installation issues**:
   ```bash
   npx puppeteer-mcp
   ```

### Port Conflicts

**Problem**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions**:

1. **Find what's using the port**:

   ```bash
   # macOS/Linux
   lsof -i :3000

   # Windows
   netstat -ano | findstr :3000
   ```

2. **Kill the process**:

   ```bash
   # macOS/Linux
   kill -9 $(lsof -t -i:3000)

   # Windows (using PID from netstat)
   taskkill /PID <PID> /F
   ```

3. **Use different ports**:

   ```bash
   # Set custom ports
   PORT=3001 GRPC_PORT=50052 puppeteer-mcp

   # Or in config
   export PORT=3001
   export GRPC_PORT=50052
   export WS_PORT=8081
   puppeteer-mcp
   ```

### Browser Launch Failures

**Problem**: Chrome/Chromium won't start

**Symptoms**:

- `Failed to launch the browser process`
- `No usable sandbox!`
- Timeout errors

**Solutions**:

1. **Add browser flags**:

   ```bash
   export PUPPETEER_ARGS='["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]'
   puppeteer-mcp
   ```

2. **Check system resources**:

   ```bash
   # Check available memory
   free -h

   # Check disk space
   df -h

   # Limit browser instances
   export BROWSER_POOL_MAX_SIZE=2
   ```

3. **Use headless mode**:
   ```bash
   export PUPPETEER_HEADLESS=true
   puppeteer-mcp
   ```

### Memory Issues

**Problem**: High memory usage or out of memory errors

**Solutions**:

1. **Increase Node.js memory limit**:

   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" puppeteer-mcp
   ```

2. **Reduce concurrent sessions**:

   ```bash
   export MAX_SESSIONS=3
   export BROWSER_POOL_MAX_SIZE=2
   ```

3. **Enable aggressive cleanup**:
   ```bash
   export SESSION_TIMEOUT=300000  # 5 minutes
   export BROWSER_IDLE_TIMEOUT=60000  # 1 minute
   ```

## Network Issues

### Firewall Blocking Connections

**Problem**: Can't connect to puppeteer-mcp server

**Solutions**:

1. **Check firewall rules**:

   ```bash
   # Linux (ufw)
   sudo ufw status
   sudo ufw allow 3000/tcp
   sudo ufw allow 50051/tcp
   sudo ufw allow 8080/tcp

   # Windows Firewall
   netsh advfirewall firewall add rule name="Puppeteer MCP" dir=in action=allow protocol=TCP localport=3000
   ```

2. **Test local connectivity**:

   ```bash
   # Should work locally
   curl http://localhost:3000/api/health

   # Test from another machine
   curl http://SERVER_IP:3000/api/health
   ```

### Corporate Proxy Issues

**Problem**: Can't download packages or Chrome through corporate proxy

**Solutions**:

1. **Configure npm proxy**:

   ```bash
   npm config set proxy http://proxy.company.com:8080
   npm config set https-proxy http://proxy.company.com:8080
   ```

2. **Set system proxy for Chrome download**:

   ```bash
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   export NO_PROXY=localhost,127.0.0.1
   ```

3. **Use pre-installed Chrome**:
   ```bash
   export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
   ```

### SSL Certificate Problems

**Problem**: SSL/TLS errors when downloading or connecting

**Solutions**:

1. **Temporary: Disable strict SSL (not for production)**:

   ```bash
   npm config set strict-ssl false
   ```

2. **Add corporate certificates**:

   ```bash
   # Export certificate
   export NODE_EXTRA_CA_CERTS=/path/to/company-cert.pem

   # Or add to npm
   npm config set cafile /path/to/company-cert.pem
   ```

## Browser-Related Issues

### Sandbox Errors (Linux)

**Problem**: `No usable sandbox!` error on Linux

**Solutions**:

1. **Enable user namespaces**:

   ```bash
   # Check current setting
   cat /proc/sys/kernel/unprivileged_userns_clone

   # Enable (requires root)
   sudo sysctl -w kernel.unprivileged_userns_clone=1

   # Make permanent
   echo 'kernel.unprivileged_userns_clone=1' | sudo tee /etc/sysctl.d/00-local-userns.conf
   ```

2. **Run without sandbox (development only)**:
   ```bash
   export PUPPETEER_ARGS='["--no-sandbox", "--disable-setuid-sandbox"]'
   ```

### Display Issues (Headless)

**Problem**: Screenshots or PDFs are blank or malformed

**Solutions**:

1. **Wait for page load**:

   ```json
   {
     "waitUntil": "networkidle2",
     "timeout": 30000
   }
   ```

2. **Set viewport**:

   ```json
   {
     "defaultViewport": {
       "width": 1920,
       "height": 1080
     }
   }
   ```

3. **Force headless mode**:
   ```bash
   export PUPPETEER_HEADLESS=true
   ```

## Performance Issues

### Slow Startup

**Problem**: Server takes too long to start

**Solutions**:

1. **Pre-install Chrome**:

   ```bash
   export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
   ```

2. **Reduce initial pool size**:
   ```bash
   export BROWSER_POOL_MIN_SIZE=0
   export BROWSER_POOL_MAX_SIZE=3
   ```

### High CPU Usage

**Problem**: Excessive CPU consumption

**Solutions**:

1. **Limit concurrent operations**:

   ```bash
   export MAX_CONCURRENT_SESSIONS=2
   export RATE_LIMIT_MAX_REQUESTS=50
   ```

2. **Enable CPU throttling**:
   ```bash
   export PUPPETEER_ARGS='["--disable-gpu", "--disable-software-rasterizer"]'
   ```

## Security Issues

### Authentication Failures

**Problem**: 401 Unauthorized errors

**Solutions**:

1. **Check token format**:

   ```bash
   # Should include "Bearer " prefix
   curl -H "Authorization: Bearer your-token" http://localhost:3000/api/health
   ```

2. **Verify token matches**:

   ```bash
   # Check server token
   echo $PUPPETEER_MCP_AUTH_TOKEN

   # Should match token in requests
   ```

### CORS Errors

**Problem**: Cross-Origin Resource Sharing blocks requests

**Solutions**:

1. **Configure CORS origin**:

   ```bash
   export CORS_ORIGIN=http://localhost:3001
   # Or multiple origins
   export CORS_ORIGIN='["http://localhost:3001", "https://app.example.com"]'
   ```

2. **Enable credentials**:
   ```json
   {
     "cors": {
       "origin": "http://localhost:3001",
       "credentials": true
     }
   }
   ```

## Getting Further Help

If these solutions don't resolve your issue:

1. **Check logs**:

   ```bash
   # Enable debug logging
   LOG_LEVEL=debug puppeteer-mcp

   # Check system logs
   journalctl -u puppeteer-mcp  # Linux with systemd
   ```

2. **Generate diagnostic report**:

   ```bash
   puppeteer-mcp diagnostic --output report.json
   ```

3. **Search existing issues**:
   - [GitHub Issues](https://github.com/williamzujkowski/puppeteer-mcp/issues)

4. **Create new issue with**:
   - Error message and stack trace
   - Node.js and npm versions
   - Operating system and version
   - Steps to reproduce
   - Diagnostic report

5. **Community resources**:
   - [Discussions](https://github.com/williamzujkowski/puppeteer-mcp/discussions)
   - [Stack Overflow](https://stackoverflow.com/questions/tagged/puppeteer-mcp)

Remember to sanitize any sensitive information (tokens, internal URLs) before sharing logs or
reports publicly.
