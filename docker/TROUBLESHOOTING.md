# Docker Troubleshooting Guide

This guide helps diagnose and resolve common issues with the puppeteer-mcp Docker development
environment.

## 🔍 Diagnostic Commands

### Quick Health Check

```bash
# Run comprehensive health check
./docker/health-check.sh

# Check container status
docker-compose ps

# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Service Logs

```bash
# View all logs
docker-compose logs

# Follow logs for specific service
docker-compose logs -f app

# View last 100 lines
docker-compose logs --tail=100 app

# View logs with timestamps
docker-compose logs -t app
```

## 🚨 Common Issues

### 1. Application Won't Start

**Symptoms:**

- Container exits immediately
- Health check fails
- Can't access http://localhost:8443

**Solutions:**

```bash
# Check logs for errors
docker-compose logs app | grep -i error

# Verify environment variables
docker-compose exec app env | grep -E "(JWT|SESSION|REDIS|DATABASE)"

# Check if ports are already in use
lsof -i :8443
lsof -i :50051

# Rebuild the image
docker-compose build --no-cache app

# Start with fresh volumes
./docker/stop.sh --volumes
./docker/start.sh --build
```

### 2. Database Connection Errors

**Symptoms:**

- "ECONNREFUSED" errors
- "connection refused" in logs
- Database migrations fail

**Solutions:**

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test database connection
docker-compose exec postgres pg_isready -U mcp -d puppeteer_mcp

# View PostgreSQL logs
docker-compose logs postgres

# Connect manually
docker-compose exec postgres psql -U mcp -d puppeteer_mcp -c "SELECT 1"

# Reset database
docker-compose down -v
docker-compose up -d postgres
./docker/seed-db.sh
```

### 3. Redis Connection Issues

**Symptoms:**

- Session storage errors
- "Redis connection failed"
- Rate limiting not working

**Solutions:**

```bash
# Check Redis is running
docker-compose ps redis

# Test Redis connection
docker-compose exec redis redis-cli -a redis-dev-password ping

# Check Redis memory
docker-compose exec redis redis-cli -a redis-dev-password info memory

# Clear Redis data
docker-compose exec redis redis-cli -a redis-dev-password FLUSHALL

# Monitor Redis commands
docker-compose exec redis redis-cli -a redis-dev-password monitor
```

### 4. Browser/Puppeteer Issues

**Symptoms:**

- "Browser disconnected"
- "Failed to launch browser"
- Timeout errors

**Solutions:**

```bash
# Check Chromium installation
docker-compose exec app which chromium-browser

# Test Puppeteer
docker-compose exec app node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  console.log('Browser launched successfully');
  await browser.close();
})();
"

# Increase memory limits
# Edit docker-compose.yml and increase:
# deploy.resources.limits.memory: 1G
```

### 5. Memory/Performance Issues

**Symptoms:**

- Containers getting killed
- "OOMKilled" status
- Slow response times

**Solutions:**

```bash
# Check memory usage
docker stats

# Check Docker daemon resources
docker system df

# Clean up unused resources
docker system prune -a --volumes

# Monitor application memory
docker-compose exec app node -e "
setInterval(() => {
  const usage = process.memoryUsage();
  console.log({
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heap: Math.round(usage.heapUsed / 1024 / 1024) + 'MB'
  });
}, 1000);
"

# Increase Docker Desktop memory allocation
# Docker Desktop > Preferences > Resources > Memory
```

### 6. Network Issues

**Symptoms:**

- Services can't communicate
- "Name or service not known"
- Connection timeouts

**Solutions:**

```bash
# List networks
docker network ls

# Inspect network
docker network inspect puppeteer-mcp_mcp-network

# Test connectivity between containers
docker-compose exec app ping -c 3 redis
docker-compose exec app ping -c 3 postgres

# Recreate network
docker-compose down
docker network prune -f
docker-compose up -d
```

### 7. Volume Permission Issues

**Symptoms:**

- "Permission denied" errors
- Can't write to mounted volumes
- Missing files

**Solutions:**

```bash
# Check volume permissions
docker-compose exec app ls -la /app

# Fix ownership
docker-compose exec --user root app chown -R nodejs:nodejs /app

# Check mounted volumes
docker-compose exec app df -h

# Reset volumes
docker-compose down -v
docker volume prune -f
docker-compose up -d
```

### 8. Hot Reload Not Working

**Symptoms:**

- Changes not reflected
- Need to restart containers
- TypeScript compilation errors

**Solutions:**

```bash
# Check nodemon is running
docker-compose exec app ps aux | grep nodemon

# Check file watching
docker-compose exec app ls -la /app/src

# Restart with verbose logging
docker-compose exec app npm run dev -- --verbose

# Check for TypeScript errors
docker-compose exec app npm run typecheck
```

## 🔧 Advanced Debugging

### Shell Access

```bash
# Access application container
docker-compose exec app /bin/sh

# Access as root
docker-compose exec --user root app /bin/sh

# Run commands
docker-compose exec app npm list
docker-compose exec app node --version
```

### Network Debugging

```bash
# Install network tools
docker-compose exec --user root app apk add --no-cache curl wget netcat-openbsd

# Test endpoints
docker-compose exec app curl -v http://localhost:8443/health
docker-compose exec app nc -zv redis 6379
docker-compose exec app nc -zv postgres 5432
```

### Process Debugging

```bash
# List processes
docker-compose exec app ps aux

# Check port bindings
docker-compose exec app netstat -tlpn

# Strace a process (requires debug image)
docker-compose exec app strace -p $(pgrep node)
```

### Environment Debugging

```bash
# Check all environment variables
docker-compose exec app env | sort

# Verify secrets are loaded
docker-compose exec app node -e "
console.log({
  JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
  REDIS_URL: process.env.REDIS_URL,
  DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET'
});
"
```

## 📋 Debugging Checklist

When encountering issues, go through this checklist:

1. **Check Docker is running**

   ```bash
   docker version
   docker-compose version
   ```

2. **Verify all services are up**

   ```bash
   docker-compose ps
   ./docker/health-check.sh
   ```

3. **Check logs for errors**

   ```bash
   docker-compose logs | grep -i error
   docker-compose logs | grep -i warning
   ```

4. **Verify environment configuration**

   ```bash
   cat .env
   docker-compose config
   ```

5. **Test network connectivity**

   ```bash
   docker-compose exec app ping redis
   docker-compose exec app ping postgres
   ```

6. **Check resource usage**

   ```bash
   docker stats
   docker system df
   ```

7. **Verify file permissions**

   ```bash
   docker-compose exec app ls -la /app
   ```

8. **Test basic functionality**
   ```bash
   curl http://localhost:8443/health
   ```

## 🆘 Getting Help

If you're still experiencing issues:

1. **Collect diagnostic information**

   ```bash
   docker-compose logs > docker-logs.txt
   docker-compose ps > docker-status.txt
   docker version > docker-version.txt
   ```

2. **Check existing issues**
   - [GitHub Issues](https://github.com/williamzujkowski/puppeteer-mcp/issues)

3. **Create detailed bug report**
   - Environment details (OS, Docker version)
   - Steps to reproduce
   - Error messages and logs
   - What you've already tried

## 🔄 Reset Everything

If all else fails, completely reset the environment:

```bash
# Stop everything
./docker/stop.sh --all

# Clean Docker system
docker system prune -a --volumes -f

# Remove project containers
docker ps -a | grep puppeteer-mcp | awk '{print $1}' | xargs docker rm -f

# Remove project images
docker images | grep puppeteer-mcp | awk '{print $3}' | xargs docker rmi -f

# Remove project volumes
docker volume ls | grep puppeteer-mcp | awk '{print $2}' | xargs docker volume rm

# Start fresh
./docker/start.sh --build
```
