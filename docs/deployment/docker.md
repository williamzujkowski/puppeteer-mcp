# Docker Deployment

Deploy Puppeteer MCP using Docker for consistent, isolated environments.

## Quick Start

### Using Pre-built Image

```bash
# Pull latest image
docker pull williamzujkowski/puppeteer-mcp:latest

# Run container
docker run -d \
  --name puppeteer-mcp \
  -p 3000:3000 \
  -p 50051:50051 \
  -e PUPPETEER_MCP_AUTH_TOKEN=your-secure-token \
  williamzujkowski/puppeteer-mcp:latest
```

### Using Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  puppeteer-mcp:
    image: williamzujkowski/puppeteer-mcp:latest
    container_name: puppeteer-mcp
    ports:
      - '3000:3000'
      - '50051:50051'
    environment:
      - PUPPETEER_MCP_AUTH_TOKEN=${AUTH_TOKEN}
      - NODE_ENV=production
      - MAX_SESSIONS=10
    restart: unless-stopped
    volumes:
      - ./config:/app/config
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2'
```

Run with:

```bash
docker-compose up -d
```

## Building Custom Image

### Basic Dockerfile

```dockerfile
FROM node:20-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application
COPY . .

# Set Chrome path
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user
RUN useradd -m -u 1001 puppeteer && \
    chown -R puppeteer:puppeteer /app

USER puppeteer

# Expose ports
EXPOSE 3000 50051

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
```

### Production Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies
RUN npm ci

# Copy source
COPY src ./src

# Build application
RUN npm run build

# Runtime stage
FROM node:20-slim

# Install Chrome and dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    curl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Set environment
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user
RUN groupadd -r puppeteer && useradd -r -g puppeteer -G audio,video puppeteer \
    && mkdir -p /home/puppeteer/Downloads \
    && chown -R puppeteer:puppeteer /home/puppeteer \
    && chown -R puppeteer:puppeteer /app

# Switch to non-root user
USER puppeteer

# Expose ports
EXPOSE 3000 50051

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
```

## Docker Compose Examples

### Development Setup

```yaml
version: '3.8'

services:
  puppeteer-mcp:
    build: .
    container_name: puppeteer-mcp-dev
    ports:
      - '3000:3000'
      - '50051:50051'
      - '9229:9229' # Debug port
    environment:
      - NODE_ENV=development
      - PUPPETEER_MCP_AUTH_TOKEN=dev-token
      - PUPPETEER_HEADLESS=false
      - DEBUG=puppeteer:*
    volumes:
      - ./src:/app/src
      - ./config:/app/config
    command: npm run dev
```

### Production Setup

```yaml
version: '3.8'

services:
  puppeteer-mcp:
    image: williamzujkowski/puppeteer-mcp:latest
    container_name: puppeteer-mcp
    restart: always
    ports:
      - '3000:3000'
      - '50051:50051'
    environment:
      - NODE_ENV=production
      - PUPPETEER_MCP_AUTH_TOKEN=${AUTH_TOKEN}
      - MAX_SESSIONS=20
      - SESSION_TIMEOUT=1800000
      - LOG_LEVEL=error
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 2G
          cpus: '2'
        reservations:
          memory: 1G
          cpus: '1'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    container_name: puppeteer-nginx
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - puppeteer-mcp
```

## Container Configuration

### Environment Variables

```bash
# Required
PUPPETEER_MCP_AUTH_TOKEN=your-secure-token

# Browser configuration
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox"

# Server configuration
PORT=3000
GRPC_PORT=50051
NODE_ENV=production

# Session management
MAX_SESSIONS=10
SESSION_TIMEOUT=1800000

# Security
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_MAX=100
```

### Volume Mounts

```yaml
volumes:
  # Configuration files (read-only)
  - ./config:/app/config:ro

  # Logs (read-write)
  - ./logs:/app/logs

  # Temporary files
  - /tmp/puppeteer:/tmp/puppeteer

  # Chrome user data (optional)
  - ./chrome-data:/home/puppeteer/.config/chromium
```

### Resource Limits

```yaml
deploy:
  resources:
    limits:
      memory: 2G # Maximum memory
      cpus: '2' # Maximum CPU cores
    reservations:
      memory: 1G # Minimum memory
      cpus: '0.5' # Minimum CPU cores
```

## Security Considerations

### 1. Run as Non-Root

```dockerfile
# Create non-root user
RUN useradd -m -u 1001 puppeteer
USER puppeteer
```

### 2. Minimal Base Image

```dockerfile
# Use slim or alpine variants
FROM node:20-slim
# or
FROM node:20-alpine
```

### 3. Security Scanning

```bash
# Scan image for vulnerabilities
docker scout cves williamzujkowski/puppeteer-mcp:latest

# Or use Trivy
trivy image williamzujkowski/puppeteer-mcp:latest
```

### 4. Network Security

```yaml
networks:
  backend:
    driver: bridge
    internal: true # No external access
  frontend:
    driver: bridge
```

## Troubleshooting

### Chrome Won't Start

```bash
# Error: Failed to launch chrome!

# Solution 1: Add Chrome flags
ENV PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"

# Solution 2: Increase shared memory
docker run --shm-size=1gb ...

# Solution 3: Check dependencies
docker exec -it puppeteer-mcp ldd /usr/bin/chromium | grep "not found"
```

### Memory Issues

```bash
# Monitor memory usage
docker stats puppeteer-mcp

# Limit Chrome memory
ENV PUPPETEER_ARGS="--max-old-space-size=1024"

# Use memory limits
docker run -m 2g ...
```

### Permission Errors

```bash
# Fix volume permissions
docker exec -it puppeteer-mcp chown -R puppeteer:puppeteer /app/logs

# Or in Dockerfile
RUN mkdir -p /app/logs && chown -R puppeteer:puppeteer /app/logs
```

## Kubernetes Deployment

### Basic Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: puppeteer-mcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: puppeteer-mcp
  template:
    metadata:
      labels:
        app: puppeteer-mcp
    spec:
      containers:
        - name: puppeteer-mcp
          image: williamzujkowski/puppeteer-mcp:latest
          ports:
            - containerPort: 3000
            - containerPort: 50051
          env:
            - name: PUPPETEER_MCP_AUTH_TOKEN
              valueFrom:
                secretKeyRef:
                  name: puppeteer-secrets
                  key: auth-token
          resources:
            limits:
              memory: '2Gi'
              cpu: '2'
            requests:
              memory: '1Gi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
```

## Best Practices

1. **Use Multi-Stage Builds** - Reduce image size
2. **Pin Versions** - Avoid unexpected updates
3. **Health Checks** - Ensure container health
4. **Resource Limits** - Prevent resource exhaustion
5. **Security Scanning** - Regular vulnerability checks
6. **Logging** - Centralized log collection
7. **Monitoring** - Track performance metrics

## Monitoring

### Prometheus Metrics

```yaml
# docker-compose.yml addition
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - '9090:9090'
```

### Log Aggregation

```yaml
# docker-compose.yml addition
fluentd:
  image: fluent/fluentd
  volumes:
    - ./fluent.conf:/fluentd/etc/fluent.conf
    - ./logs:/var/log/puppeteer
```

## Next Steps

- Set up [Production Deployment](production.md)
- Configure [Monitoring](production.md#monitoring)
- Implement [Scaling Strategies](scaling.md)
- Review [Security Best Practices](../architecture/security.md)
