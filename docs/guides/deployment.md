# Deployment Guide

This guide provides comprehensive instructions for deploying the Puppeteer MCP platform to
production environments.

## Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- SSL/TLS certificates (Let's Encrypt or commercial)
- Domain name with DNS configuration
- Minimum 4GB RAM, 2 CPU cores
- Chrome/Chromium dependencies for Puppeteer

## Production Deployment Checklist

### Pre-deployment

- [ ] Review and update environment variables
- [ ] Generate secure JWT secrets and API keys
- [ ] Configure SSL/TLS certificates
- [ ] Set up monitoring infrastructure
- [ ] Configure log aggregation
- [ ] Review security headers configuration
- [ ] Test backup and recovery procedures
- [ ] Verify browser dependencies installed

### Security

- [ ] Enable all security headers via Helmet
- [ ] Configure rate limiting thresholds
- [ ] Set secure cookie flags
- [ ] Disable debug mode
- [ ] Review CORS configuration
- [ ] Validate input sanitization
- [ ] Enable audit logging
- [ ] Configure firewall rules

### Performance

- [ ] Configure browser pool size
- [ ] Set appropriate timeouts
- [ ] Enable response compression
- [ ] Configure CDN if applicable
- [ ] Set up health check endpoints
- [ ] Configure graceful shutdown
- [ ] Review memory limits

## Docker Deployment

### Production Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs
EXPOSE 3000 50051 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"
CMD ["node", "dist/index.js"]
```

### Docker Compose Production

```yaml
version: '3.8'

services:
  puppeteer-mcp:
    build: .
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      GRPC_PORT: 50051
      WS_PORT: 8080
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      PUPPETEER_HEADLESS: 'true'
      BROWSER_POOL_MAX_SIZE: '10'
      BROWSER_IDLE_TIMEOUT: '300000'
    ports:
      - '3000:3000'
      - '50051:50051'
      - '8080:8080'
    volumes:
      - ./logs:/app/logs
      - /dev/shm:/dev/shm
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - puppeteer-mcp
```

## Environment Configuration

### Required Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000
GRPC_PORT=50051
WS_PORT=8080

# Security
JWT_SECRET=<generate-secure-256-bit-key>
JWT_REFRESH_SECRET=<generate-secure-256-bit-key>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
API_KEY_PREFIX=pmcp_

# Browser Configuration
PUPPETEER_HEADLESS=true
BROWSER_POOL_MAX_SIZE=10
BROWSER_IDLE_TIMEOUT=300000
PUPPETEER_CACHE_ENABLED=true
CHROME_BIN=/usr/bin/chromium-browser

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
AUDIT_LOG_ENABLED=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Generate Secure Secrets

```bash
# Generate JWT secrets
openssl rand -hex 32

# Generate API key
echo "pmcp_$(openssl rand -hex 24)"
```

## SSL/TLS Setup

### Nginx SSL Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    location /api/ {
        proxy_pass http://puppeteer-mcp:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://puppeteer-mcp:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

### Let's Encrypt Setup

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate
certbot --nginx -d api.example.com

# Auto-renewal
echo "0 0,12 * * * root certbot renew --quiet" >> /etc/crontab
```

## Monitoring and Logging

### Health Monitoring

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'puppeteer-mcp'
    static_configs:
      - targets: ['puppeteer-mcp:3000']
    metrics_path: '/metrics'
```

### Log Aggregation

```yaml
# fluentd.conf
<source> @type tail path /var/log/puppeteer-mcp/*.log pos_file /var/log/td-agent/puppeteer-mcp.pos
tag puppeteer.mcp <parse> @type json </parse> </source>

<match puppeteer.mcp> @type elasticsearch host elasticsearch port 9200 logstash_format true
logstash_prefix puppeteer-mcp </match>
```

### Monitoring Alerts

```yaml
# alertmanager.yml
groups:
  - name: puppeteer-mcp
    rules:
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes{name="puppeteer-mcp"} > 3.5e+9
        for: 5m
      - alert: BrowserPoolExhausted
        expr: browser_pool_available == 0
        for: 1m
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
```

## Scaling Considerations

### Horizontal Scaling

```yaml
# docker-compose.scale.yml
services:
  puppeteer-mcp:
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure

  haproxy:
    image: haproxy:alpine
    volumes:
      - ./haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro
    ports:
      - '3000:3000'
      - '50051:50051'
```

### Resource Optimization

```bash
# Tune kernel parameters
echo "vm.max_map_count=262144" >> /etc/sysctl.conf
echo "fs.file-max=65536" >> /etc/sysctl.conf
sysctl -p

# Configure shared memory for Chrome
mount -t tmpfs -o rw,nosuid,nodev,noexec,relatime,size=2G tmpfs /dev/shm
```

### Session Affinity

```nginx
upstream puppeteer_backend {
    ip_hash;
    server puppeteer-mcp-1:3000;
    server puppeteer-mcp-2:3000;
    server puppeteer-mcp-3:3000;
}
```

## Deployment Commands

```bash
# Build and deploy
docker-compose build --no-cache
docker-compose up -d

# Rolling update
docker-compose up -d --no-deps --build puppeteer-mcp

# View logs
docker-compose logs -f puppeteer-mcp

# Scale service
docker-compose up -d --scale puppeteer-mcp=3

# Health check
curl https://api.example.com/api/v1/health

# Graceful shutdown
docker-compose stop -t 30
```

## Troubleshooting

### Common Issues

1. **Chrome crashes**: Increase shared memory size
2. **Memory leaks**: Adjust browser pool size and idle timeout
3. **Connection refused**: Check firewall rules and port bindings
4. **SSL errors**: Verify certificate chain and permissions
5. **Performance degradation**: Monitor browser pool metrics

### Debug Mode

```bash
# Enable debug logging
docker-compose run -e DEBUG=puppeteer:* puppeteer-mcp

# Check browser installation
docker-compose exec puppeteer-mcp chromium-browser --version
```

## Security Hardening

### Additional Measures

```bash
# Restrict network access
iptables -A INPUT -p tcp --dport 3000 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP

# Enable SELinux/AppArmor
setenforce 1

# Regular security updates
apt-get update && apt-get upgrade -y
```

## Backup and Recovery

```bash
# Backup configuration
tar -czf backup-$(date +%Y%m%d).tar.gz docker-compose.yml .env nginx.conf

# Backup persistent data
docker-compose exec puppeteer-mcp npm run backup

# Restore from backup
docker-compose down
tar -xzf backup-20250703.tar.gz
docker-compose up -d
```

This deployment guide ensures a secure, scalable, and maintainable production deployment of the
Puppeteer MCP platform with comprehensive browser automation capabilities.
