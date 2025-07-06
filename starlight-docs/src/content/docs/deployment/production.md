---
title: Production Deployment
description: Comprehensive guide for deploying Puppeteer MCP in production environments.
---

# Production Deployment

Comprehensive guide for deploying Puppeteer MCP in production environments.

## Production Checklist

### Pre-Deployment

- [ ] Security audit completed
- [ ] Performance testing done
- [ ] Backup strategy defined
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Rollback plan ready

### Infrastructure

- [ ] SSL/TLS certificates
- [ ] Load balancer configured
- [ ] Database backups
- [ ] CDN setup (if needed)
- [ ] DNS configuration
- [ ] Firewall rules

### Application

- [ ] Environment variables set
- [ ] Secrets management
- [ ] Error tracking
- [ ] Logging configured
- [ ] Health checks
- [ ] Graceful shutdown

## Infrastructure Requirements

### Minimum Production Setup

- **Servers**: 2+ instances for HA
- **CPU**: 4 cores per instance
- **RAM**: 8GB per instance
- **Storage**: 50GB SSD
- **Network**: 1Gbps
- **OS**: Ubuntu 22.04 LTS

### Recommended Setup

- **Servers**: 3+ instances across AZs
- **CPU**: 8 cores per instance
- **RAM**: 16GB per instance
- **Storage**: 100GB SSD with backups
- **Network**: 10Gbps
- **Load Balancer**: Application LB

## Deployment Architecture

### High Availability Setup

```
                    ┌─────────────┐
                    │   Route 53  │
                    │     DNS     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   CloudFront│
                    │     CDN     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Application │
                    │Load Balancer│
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐    ┌─────▼─────┐   ┌─────▼─────┐
    │  Server 1 │    │  Server 2 │   │  Server 3 │
    │  (AZ-1)   │    │  (AZ-2)   │   │  (AZ-3)   │
    └───────────┘    └───────────┘   └───────────┘
```

## Server Configuration

### System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y \
  curl \
  git \
  build-essential \
  nginx \
  certbot \
  python3-certbot-nginx \
  chromium-browser \
  chromium-codecs-ffmpeg \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgcc1 \
  libgconf-2-4 \
  libgdk-pixbuf2.0-0 \
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

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Create application user
sudo useradd -m -s /bin/bash puppeteer
sudo usermod -aG audio,video puppeteer
```

### Application Setup

```bash
# Switch to app user
sudo su - puppeteer

# Clone repository
git clone https://github.com/williamzujkowski/puppeteer-mcp.git
cd puppeteer-mcp

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Create systemd service
sudo tee /etc/systemd/system/puppeteer-mcp.service << EOF
[Unit]
Description=Puppeteer MCP Server
After=network.target

[Service]
Type=simple
User=puppeteer
WorkingDirectory=/home/puppeteer/puppeteer-mcp
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PUPPETEER_MCP_AUTH_TOKEN=your-secure-token
Environment=PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/puppeteer/puppeteer-mcp/logs

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable puppeteer-mcp
sudo systemctl start puppeteer-mcp
```

## SSL/TLS Configuration

### Using Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/puppeteer-mcp
upstream puppeteer_backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s backup;
}

upstream grpc_backend {
    least_conn;
    server 127.0.0.1:50051 max_fails=3 fail_timeout=30s;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # REST API and WebSocket
    location / {
        proxy_pass http://puppeteer_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # gRPC
    location /grpc {
        grpc_pass grpc://grpc_backend;
        error_page 502 = /grpc_error502;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://puppeteer_backend/health;
    }
}
```

## Environment Configuration

### Production Environment Variables

```bash
# /home/puppeteer/puppeteer-mcp/.env.production
NODE_ENV=production

# Authentication
PUPPETEER_MCP_AUTH_TOKEN=your-very-secure-token-here
JWT_SECRET=your-jwt-secret-here

# Server
PORT=3000
GRPC_PORT=50051
HOST=0.0.0.0

# Browser
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage

# Sessions
MAX_SESSIONS=50
SESSION_TIMEOUT=1800000
SESSION_CHECK_INTERVAL=60000

# Security
CORS_ORIGIN=https://app.yourdomain.com
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=1000

# Logging
LOG_LEVEL=error
LOG_FILE=/home/puppeteer/puppeteer-mcp/logs/app.log

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
```

## Monitoring

### Prometheus Setup

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'puppeteer-mcp'
    static_configs:
      - targets: ['localhost:9090']
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance
        replacement: 'server-1'
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Puppeteer MCP Monitoring",
    "panels": [
      {
        "title": "Active Sessions",
        "targets": [
          {
            "expr": "puppeteer_active_sessions"
          }
        ]
      },
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_errors_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)"
          }
        ]
      }
    ]
  }
}
```

### Health Checks

```bash
# Basic health check
curl -f https://api.yourdomain.com/health

# Detailed health check
curl -H "Authorization: Bearer $TOKEN" \
  https://api.yourdomain.com/api/status

# Monitor with uptime services
# - Pingdom
# - UptimeRobot
# - StatusCake
```

## Logging

### Centralized Logging

```bash
# Install Fluentd
curl -L https://toolbelt.treasuredata.com/sh/install-ubuntu-focal-td-agent4.sh | sh

# Configure Fluentd
sudo tee /etc/td-agent/td-agent.conf << EOF
<source>
  @type tail
  path /home/puppeteer/puppeteer-mcp/logs/*.log
  pos_file /var/log/td-agent/puppeteer-mcp.pos
  tag puppeteer.mcp
  <parse>
    @type json
  </parse>
</source>

<match puppeteer.**>
  @type elasticsearch
  host elasticsearch.yourdomain.com
  port 9200
  logstash_format true
  logstash_prefix puppeteer
  include_tag_key true
  tag_key @log_name
</match>
EOF
```

### Log Rotation

```bash
# /etc/logrotate.d/puppeteer-mcp
/home/puppeteer/puppeteer-mcp/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 puppeteer puppeteer
    sharedscripts
    postrotate
        systemctl reload puppeteer-mcp >/dev/null 2>&1
    endscript
}
```

## Backup Strategy

### Application Backup

```bash
#!/bin/bash
# /home/puppeteer/backup.sh

BACKUP_DIR="/backup/puppeteer-mcp"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application
tar -czf $BACKUP_DIR/app_$DATE.tar.gz \
  --exclude='node_modules' \
  --exclude='logs' \
  /home/puppeteer/puppeteer-mcp

# Backup configuration
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
  /etc/nginx/sites-available/puppeteer-mcp \
  /etc/systemd/system/puppeteer-mcp.service

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

# Sync to S3 (optional)
aws s3 sync $BACKUP_DIR s3://your-backup-bucket/puppeteer-mcp/
```

### Database Backup

If using session persistence:

```bash
# PostgreSQL backup
pg_dump -h localhost -U puppeteer puppeteer_mcp | \
  gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Redis backup
redis-cli --rdb $BACKUP_DIR/redis_$DATE.rdb
```

## Security Hardening

### Firewall Configuration

```bash
# UFW configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow from 10.0.0.0/8 to any port 3000
sudo ufw allow from 10.0.0.0/8 to any port 50051
sudo ufw --force enable
```

### System Security

```bash
# Fail2ban for SSH
sudo apt install fail2ban
sudo systemctl enable fail2ban

# Automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Performance Tuning

### System Limits

```bash
# /etc/security/limits.d/puppeteer.conf
puppeteer soft nofile 65535
puppeteer hard nofile 65535
puppeteer soft nproc 32768
puppeteer hard nproc 32768
```

### Kernel Parameters

```bash
# /etc/sysctl.d/99-puppeteer.conf
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
fs.file-max = 65535
```

## Maintenance

### Zero-Downtime Deployment

```bash
#!/bin/bash
# deploy.sh

# Pull latest code
cd /home/puppeteer/puppeteer-mcp
git pull origin main

# Install dependencies
npm ci --only=production

# Build
npm run build

# Graceful restart
sudo systemctl reload puppeteer-mcp
```

### Health Monitoring Script

```bash
#!/bin/bash
# monitor.sh

URL="https://api.yourdomain.com/health"
WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

if ! curl -sf $URL > /dev/null; then
  curl -X POST $WEBHOOK \
    -H 'Content-type: application/json' \
    --data '{"text":"Puppeteer MCP is down!"}'
fi
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**

   ```bash
   # Check memory
   free -h

   # Find memory leaks
   sudo -u puppeteer node --inspect dist/index.js
   ```

2. **Chrome Crashes**

   ```bash
   # Check Chrome
   chromium-browser --version

   # Test Chrome
   chromium-browser --headless --disable-gpu --dump-dom https://example.com
   ```

3. **Performance Issues**

   ```bash
   # Profile application
   sudo -u puppeteer node --prof dist/index.js

   # Analyze profile
   node --prof-process isolate-*.log > profile.txt
   ```

## Next Steps

- Implement [Scaling Strategies](/puppeteer-mcp/scaling.md)
- Set up [Disaster Recovery](/puppeteer-mcp/scaling.md#disaster-recovery)
- Configure [Advanced Monitoring](/puppeteer-mcp/scaling.md#monitoring)
- Review [Security Best Practices](/puppeteer-mcp/../architecture/security.md)
