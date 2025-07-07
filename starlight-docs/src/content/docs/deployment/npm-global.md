---
title: Global npm Installation Guide
description:
  'This guide provides comprehensive instructions for installing and managing puppeteer-mcp as a
  global npm package'
---

# Global npm Installation Guide

This guide provides comprehensive instructions for installing and managing puppeteer-mcp as a global
npm package, suitable for system administrators and developers who need system-wide access to the
browser automation platform.

## Prerequisites

### System Requirements

#### Node.js Requirements

- **Node.js**: Version 20.0.0 or higher (LTS recommended)
- **npm**: Version 8.0.0 or higher (included with Node.js)
- **Architecture**: x64 or arm64 supported

```bash
# Check Node.js version
node --version  # Should output v20.0.0 or higher

# Check npm version
npm --version   # Should output 8.0.0 or higher

# Check system architecture
node -p "process.arch"  # Should output x64 or arm64
```

#### System Permissions

- **Admin/root access**: Required for global npm installations
- **Write permissions**: To npm global directory
- **Execute permissions**: For binary execution

```bash
# Check npm global directory
npm config get prefix

# On Unix-like systems (default: /usr/local)
# On Windows (default: %APPDATA%\npm)

# Verify write permissions
npm config get prefix | xargs ls -la
```

#### Chrome/Chromium Requirements

Puppeteer requires Chrome or Chromium to be available on the system.

**Option 1: Automatic Download (Default)**

```bash
# Puppeteer will download Chromium automatically during installation
# Requires ~170MB download and ~400MB disk space
```

**Option 2: System Chrome/Chromium**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y chromium-browser chromium-codecs-ffmpeg

# CentOS/RHEL/Fedora
sudo yum install -y chromium

# macOS (using Homebrew)
brew install --cask chromium

# Windows
# Download from https://www.chromium.org/getting-involved/download-chromium/
```

#### Additional System Dependencies

**Linux Systems**

```bash
# Ubuntu/Debian
sudo apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils

# CentOS/RHEL/Fedora
sudo yum install -y \
  alsa-lib.x86_64 \
  atk.x86_64 \
  cups-libs.x86_64 \
  gtk3.x86_64 \
  ipa-gothic-fonts \
  libXcomposite.x86_64 \
  libXcursor.x86_64 \
  libXdamage.x86_64 \
  libXext.x86_64 \
  libXi.x86_64 \
  libXrandr.x86_64 \
  libXScrnSaver.x86_64 \
  libXtst.x86_64 \
  pango.x86_64 \
  xorg-x11-fonts-100dpi \
  xorg-x11-fonts-75dpi \
  xorg-x11-fonts-cyrillic \
  xorg-x11-fonts-misc \
  xorg-x11-fonts-Type1 \
  xorg-x11-utils
```

**macOS**

```bash
# Most dependencies are included with macOS
# Additional fonts may be required for certain operations
brew install --cask font-liberation
```

## Installation Steps

### Basic Global Installation

```bash
# Install puppeteer-mcp globally
sudo npm install -g puppeteer-mcp

# On Windows (run as Administrator)
npm install -g puppeteer-mcp
```

### Installation with Custom npm Prefix

```bash
# Set custom npm prefix (avoid sudo)
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Install without sudo
npm install -g puppeteer-mcp
```

### Installation Behind Proxy

```bash
# Configure npm proxy
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Set Chromium download proxy
export HTTPS_PROXY=http://proxy.company.com:8080
export HTTP_PROXY=http://proxy.company.com:8080

# Install with proxy
npm install -g puppeteer-mcp
```

### Verification Commands

```bash
# Verify installation
puppeteer-mcp --version

# Check installation location
which puppeteer-mcp
# or on Windows
where puppeteer-mcp

# List global packages
npm list -g --depth=0 | grep puppeteer-mcp

# Verify Chrome/Chromium
puppeteer-mcp --check-browser
```

### Troubleshooting Common Installation Issues

#### Permission Denied

```bash
# Fix npm permissions (Linux/macOS)
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}

# Alternative: Use npm prefix
npm config set prefix ~/.npm-global
```

#### Chromium Download Failures

```bash
# Skip Chromium download
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install -g puppeteer-mcp

# Use system Chrome
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

#### Behind Corporate Firewall

```bash
# Disable strict SSL (not recommended for production)
npm config set strict-ssl false

# Use alternative registry
npm config set registry https://registry.npmjs.org/
```

## Configuration

### Default Configuration Paths

```bash
# Global configuration directory
# Linux/macOS: /etc/puppeteer-mcp/
# Windows: %PROGRAMDATA%\puppeteer-mcp\

# User configuration directory
# Linux/macOS: ~/.config/puppeteer-mcp/
# Windows: %APPDATA%\puppeteer-mcp\
```

### Environment Variable Setup

Create a system-wide configuration file:

```bash
# /etc/puppeteer-mcp/env (Linux/macOS)
# or %PROGRAMDATA%\puppeteer-mcp\env.bat (Windows)

# Server Configuration
export NODE_ENV=production
export PORT=3000
export GRPC_PORT=50051
export WS_PORT=8080

# Security Configuration
export JWT_SECRET=$(openssl rand -hex 32)
export JWT_REFRESH_SECRET=$(openssl rand -hex 32)
export API_KEY_PREFIX=pmcp_

# Browser Configuration
export PUPPETEER_HEADLESS=true
export BROWSER_POOL_MAX_SIZE=5
export BROWSER_IDLE_TIMEOUT=300000
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Logging Configuration
export LOG_LEVEL=info
export LOG_DIR=/var/log/puppeteer-mcp
export AUDIT_LOG_ENABLED=true

# Performance Configuration
export MAX_CONCURRENT_SESSIONS=10
export SESSION_TIMEOUT=3600000
export RATE_LIMIT_WINDOW_MS=60000
export RATE_LIMIT_MAX_REQUESTS=100
```

### Custom Configuration Files

Create a JSON configuration file:

```json
{
  "server": {
    "port": 3000,
    "grpcPort": 50051,
    "wsPort": 8080,
    "cors": {
      "origin": ["http://localhost:3000", "https://app.example.com"],
      "credentials": true
    }
  },
  "auth": {
    "jwtSecret": "your-secret-here",
    "jwtExpiresIn": "15m",
    "apiKeyPrefix": "pmcp_"
  },
  "browser": {
    "headless": true,
    "poolSize": 5,
    "idleTimeout": 300000,
    "args": ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  },
  "logging": {
    "level": "info",
    "format": "json",
    "directory": "/var/log/puppeteer-mcp"
  }
}
```

Load custom configuration:

```bash
# Using environment variable
export PUPPETEER_MCP_CONFIG=/etc/puppeteer-mcp/config.json
puppeteer-mcp

# Using command line argument
puppeteer-mcp --config /etc/puppeteer-mcp/config.json
```

## Usage Patterns

### Running as a Service

#### systemd Service (Linux)

Create `/etc/systemd/system/puppeteer-mcp.service`:

```ini
[Unit]
Description=Puppeteer MCP Browser Automation Service
After=network.target

[Service]
Type=simple
User=puppeteer
Group=puppeteer
WorkingDirectory=/var/lib/puppeteer-mcp
Environment="NODE_ENV=production"
Environment="PATH=/usr/local/bin:/usr/bin"
EnvironmentFile=/etc/puppeteer-mcp/env
ExecStart=/usr/local/bin/puppeteer-mcp
Restart=always
RestartSec=10
StandardOutput=append:/var/log/puppeteer-mcp/service.log
StandardError=append:/var/log/puppeteer-mcp/error.log

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/puppeteer-mcp /var/log/puppeteer-mcp

[Install]
WantedBy=multi-user.target
```

Manage the service:

```bash
# Create service user
sudo useradd -r -s /bin/false puppeteer
sudo mkdir -p /var/lib/puppeteer-mcp /var/log/puppeteer-mcp
sudo chown -R puppeteer:puppeteer /var/lib/puppeteer-mcp /var/log/puppeteer-mcp

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable puppeteer-mcp
sudo systemctl start puppeteer-mcp
sudo systemctl status puppeteer-mcp

# View logs
sudo journalctl -u puppeteer-mcp -f
```

#### Windows Service

Using NSSM (Non-Sucking Service Manager):

```powershell
# Download NSSM
# https://nssm.cc/download

# Install service
nssm install PuppeteerMCP "C:\Program Files\nodejs\node.exe" "C:\Users\%USERNAME%\AppData\Roaming\npm\node_modules\puppeteer-mcp\dist\mcp\start-mcp.js"

# Configure service
nssm set PuppeteerMCP AppDirectory "C:\ProgramData\puppeteer-mcp"
nssm set PuppeteerMCP AppEnvironmentExtra NODE_ENV=production
nssm set PuppeteerMCP AppStdout "C:\ProgramData\puppeteer-mcp\logs\service.log"
nssm set PuppeteerMCP AppStderr "C:\ProgramData\puppeteer-mcp\logs\error.log"

# Start service
nssm start PuppeteerMCP
```

### Integration with Other Tools

#### Docker Integration

```dockerfile
FROM node:20-alpine

# Install Chromium and dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Puppeteer environment
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install puppeteer-mcp globally
RUN npm install -g puppeteer-mcp

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000 50051 8080

CMD ["puppeteer-mcp"]
```

#### PM2 Process Manager

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start puppeteer-mcp --name "puppeteer-mcp" \
  --max-memory-restart 1G \
  --log /var/log/puppeteer-mcp/pm2.log \
  --time

# Configure auto-startup
pm2 startup
pm2 save

# Monitor
pm2 monit
```

#### Nginx Reverse Proxy

```nginx
upstream puppeteer_mcp {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://puppeteer_mcp;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

### Security Considerations

#### File System Permissions

```bash
# Restrict configuration files
sudo chmod 600 /etc/puppeteer-mcp/env
sudo chown root:root /etc/puppeteer-mcp/env

# Secure log directory
sudo chmod 750 /var/log/puppeteer-mcp
sudo chown puppeteer:puppeteer /var/log/puppeteer-mcp

# Restrict service directory
sudo chmod 750 /var/lib/puppeteer-mcp
sudo chown puppeteer:puppeteer /var/lib/puppeteer-mcp
```

#### Network Security

```bash
# Firewall rules (UFW)
sudo ufw allow from 10.0.0.0/8 to any port 3000
sudo ufw allow from 172.16.0.0/12 to any port 3000
sudo ufw deny 3000

# iptables
sudo iptables -A INPUT -p tcp --dport 3000 -s 10.0.0.0/8 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3000 -j DROP
```

#### API Key Management

```bash
# Generate secure API keys
openssl rand -hex 32 | sed 's/^/pmcp_/'

# Store in environment
echo "API_KEYS=pmcp_abc123...,pmcp_def456..." >> /etc/puppeteer-mcp/env

# Rotate keys regularly
puppeteer-mcp rotate-keys --backup
```

## Updates and Maintenance

### Updating the Global Package

```bash
# Check current version
npm list -g puppeteer-mcp

# Check for updates
npm outdated -g puppeteer-mcp

# Update to latest version
sudo npm update -g puppeteer-mcp

# Update to specific version
sudo npm install -g puppeteer-mcp@1.2.3

# Force reinstall
sudo npm install -g puppeteer-mcp --force
```

### Managing Multiple Versions

#### Using nvm (Node Version Manager)

```bash
# Install different Node.js versions
nvm install 20
nvm install 22

# Install puppeteer-mcp for each version
nvm use 20
npm install -g puppeteer-mcp@1.0.0

nvm use 22
npm install -g puppeteer-mcp@2.0.0

# Switch between versions
nvm use 20
puppeteer-mcp --version  # 1.0.13

nvm use 22
puppeteer-mcp --version  # 2.0.0
```

#### Using Docker for Version Isolation

```bash
# Create version-specific images
docker build -t puppeteer-mcp:1.0.0 --build-arg VERSION=1.0.0 .
docker build -t puppeteer-mcp:2.0.0 --build-arg VERSION=2.0.0 .

# Run specific versions
docker run -d --name pmcp-v1 -p 3001:3000 puppeteer-mcp:1.0.0
docker run -d --name pmcp-v2 -p 3002:3000 puppeteer-mcp:2.0.0
```

### Maintenance Tasks

#### Log Rotation

Create `/etc/logrotate.d/puppeteer-mcp`:

```
/var/log/puppeteer-mcp/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 puppeteer puppeteer
    sharedscripts
    postrotate
        systemctl reload puppeteer-mcp > /dev/null 2>&1 || true
    endscript
}
```

#### Health Monitoring

```bash
# Create health check script
cat > /usr/local/bin/check-puppeteer-mcp.sh << 'EOF'
#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health)
if [ $response -eq 200 ]; then
    echo "Puppeteer MCP is healthy"
    exit 0
else
    echo "Puppeteer MCP is unhealthy (HTTP $response)"
    systemctl restart puppeteer-mcp
    exit 1
fi
EOF

chmod +x /usr/local/bin/check-puppeteer-mcp.sh

# Add to crontab
echo "*/5 * * * * /usr/local/bin/check-puppeteer-mcp.sh" | crontab -
```

#### Backup Configuration

```bash
# Backup script
cat > /usr/local/bin/backup-puppeteer-mcp.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/puppeteer-mcp/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Backup configuration
cp -r /etc/puppeteer-mcp $BACKUP_DIR/
cp -r ~/.config/puppeteer-mcp $BACKUP_DIR/

# Backup logs
tar -czf $BACKUP_DIR/logs.tar.gz /var/log/puppeteer-mcp

# Keep only last 30 days
find /backup/puppeteer-mcp -type d -mtime +30 -exec rm -rf {} +
EOF

chmod +x /usr/local/bin/backup-puppeteer-mcp.sh

# Schedule daily backup
echo "0 2 * * * /usr/local/bin/backup-puppeteer-mcp.sh" | crontab -
```

### Uninstallation

```bash
# Stop service
sudo systemctl stop puppeteer-mcp
sudo systemctl disable puppeteer-mcp

# Remove global package
sudo npm uninstall -g puppeteer-mcp

# Clean up configuration
sudo rm -rf /etc/puppeteer-mcp
rm -rf ~/.config/puppeteer-mcp

# Remove service files
sudo rm /etc/systemd/system/puppeteer-mcp.service
sudo systemctl daemon-reload

# Remove logs (optional)
sudo rm -rf /var/log/puppeteer-mcp

# Remove service user (optional)
sudo userdel -r puppeteer
```

## Troubleshooting

### Common Issues and Solutions

#### Browser Launch Failures

```bash
# Check Chrome installation
which chromium-browser || which google-chrome

# Test Chrome directly
chromium-browser --version

# Run with debug logging
DEBUG=puppeteer:* puppeteer-mcp

# Common fixes
export PUPPETEER_ARGS='["--no-sandbox", "--disable-setuid-sandbox"]'
```

#### Memory Issues

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" puppeteer-mcp

# Monitor memory usage
ps aux | grep puppeteer-mcp
top -p $(pgrep -f puppeteer-mcp)

# Adjust browser pool size
export BROWSER_POOL_MAX_SIZE=3
```

#### Permission Errors

```bash
# Fix npm permissions
npm config set unsafe-perm true

# Fix Chrome sandbox issues
sudo sysctl -w kernel.unprivileged_userns_clone=1

# Run without sandbox (development only)
export PUPPETEER_ARGS='["--no-sandbox"]'
```

### Debug Mode

```bash
# Enable all debug output
DEBUG=* puppeteer-mcp

# Specific debug namespaces
DEBUG=puppeteer:*,mcp:* puppeteer-mcp

# Verbose logging
LOG_LEVEL=debug puppeteer-mcp

# Trace mode
NODE_ENV=development LOG_LEVEL=trace puppeteer-mcp
```

### Getting Help

```bash
# Built-in help
puppeteer-mcp --help

# Version information
puppeteer-mcp --version

# Check system compatibility
puppeteer-mcp doctor

# Generate diagnostic report
puppeteer-mcp diagnostic --output report.json
```

## Best Practices

1. **Security First**: Always use proper authentication and run as non-root user
2. **Resource Management**: Monitor and limit browser pool size based on system resources
3. **Regular Updates**: Keep the package updated for security patches
4. **Monitoring**: Implement health checks and alerting
5. **Backup**: Regular configuration and log backups
6. **Documentation**: Maintain deployment-specific documentation

## Additional Resources

- [Project Repository](https://github.com/williamzujkowski/puppeteer-mcp)
- [API Documentation](https://williamzujkowski.github.io/puppeteer-mcp/)
- [npm Package Page](https://www.npmjs.com/package/puppeteer-mcp)
- [Issue Tracker](https://github.com/williamzujkowski/puppeteer-mcp/issues)
- [Security Policy](https://github.com/williamzujkowski/puppeteer-mcp/security)

---

This guide ensures secure, scalable, and maintainable global installation of puppeteer-mcp for
system-wide browser automation capabilities.
