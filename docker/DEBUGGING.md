# Docker Debugging Guide

Advanced debugging techniques for the puppeteer-mcp Docker environment.

## 🐛 Node.js Debugging

### Chrome DevTools Debugging

1. **Start the application with debugging enabled** (already configured in docker-compose.dev.yml):
   ```bash
   ./docker/start.sh
   ```

2. **Open Chrome/Edge DevTools**:
   - Navigate to `chrome://inspect` or `edge://inspect`
   - Click "Configure" and ensure `localhost:9229` is listed
   - You should see the remote target under "Remote Target"
   - Click "inspect" to open DevTools

3. **Set breakpoints**:
   - In DevTools, navigate to the source files
   - Click line numbers to set breakpoints
   - Use the debugger statement in code: `debugger;`

### VS Code Debugging

1. **Create `.vscode/launch.json`**:
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "type": "node",
         "request": "attach",
         "name": "Docker: Attach to Node",
         "remoteRoot": "/app",
         "localRoot": "${workspaceFolder}",
         "protocol": "inspector",
         "port": 9229,
         "restart": true,
         "skipFiles": ["<node_internals>/**"]
       }
     ]
   }
   ```

2. **Start debugging**:
   - Press F5 or click "Run and Debug" in VS Code
   - Set breakpoints in your TypeScript files
   - VS Code will map them to the compiled JavaScript

### Command-Line Debugging

```bash
# Attach to running process
docker-compose exec app node inspect -p $(pgrep -f "node.*server.js")

# Start with debugger
docker-compose exec app node --inspect-brk=0.0.0.0:9229 dist/server.js

# Use built-in debugger
docker-compose exec app node inspect dist/server.js
```

## 🔍 Application Debugging

### Request Tracing

```bash
# Enable debug logging
docker-compose exec app npm run dev -- --log-level=trace

# Monitor HTTP requests
docker-compose logs -f app | grep "HTTP"

# Trace specific request
curl -H "X-Request-ID: debug-123" http://localhost:8443/api/sessions
docker-compose logs app | grep "debug-123"
```

### Memory Profiling

```bash
# Generate heap snapshot
docker-compose exec app node -e "
const v8 = require('v8');
const fs = require('fs');
v8.writeHeapSnapshot('/tmp/heap.heapsnapshot');
console.log('Heap snapshot written');
"

# Copy snapshot to host
docker cp puppeteer-mcp-app:/tmp/heap.heapsnapshot ./heap.heapsnapshot

# Analyze in Chrome DevTools
# 1. Open Chrome DevTools
# 2. Go to Memory tab
# 3. Load the heap snapshot
```

### CPU Profiling

```bash
# Start CPU profiling
docker-compose exec app node --cpu-prof dist/server.js

# Generate flame graph
docker-compose exec app npx 0x dist/server.js

# Copy profile to host
docker cp puppeteer-mcp-app:/app/*.cpuprofile ./
```

## 🌐 Network Debugging

### TCP/HTTP Debugging

```bash
# Monitor all network traffic
docker-compose exec --user root app tcpdump -i any -w /tmp/capture.pcap

# Monitor specific port
docker-compose exec --user root app tcpdump -i any port 8443 -A

# Test with curl verbose
docker-compose exec app curl -v http://localhost:8443/health

# Test with wget debug
docker-compose exec app wget -d -O- http://localhost:8443/health
```

### gRPC Debugging

```bash
# Use grpcurl for testing
docker-compose exec app apk add --no-cache grpcurl

# List services
docker-compose exec app grpcurl -plaintext localhost:50051 list

# Describe service
docker-compose exec app grpcurl -plaintext localhost:50051 describe mcp.SessionService

# Call method
docker-compose exec app grpcurl -plaintext -d '{}' localhost:50051 mcp.HealthService/Check
```

### WebSocket Debugging

```bash
# Install wscat
docker-compose exec app npm install -g wscat

# Connect to WebSocket
docker-compose exec app wscat -c ws://localhost:8443/ws

# Monitor WebSocket traffic
docker-compose logs -f app | grep "WebSocket"
```

## 🗄️ Database Debugging

### PostgreSQL Queries

```bash
# Enable query logging
docker-compose exec postgres psql -U mcp -d puppeteer_mcp -c "
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();
"

# Monitor queries
docker-compose logs -f postgres | grep "LOG:"

# Check slow queries
docker-compose exec postgres psql -U mcp -d puppeteer_mcp -c "
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
"

# Analyze query plan
docker-compose exec postgres psql -U mcp -d puppeteer_mcp -c "
EXPLAIN ANALYZE SELECT * FROM mcp.sessions WHERE status = 'active';
"
```

### Redis Debugging

```bash
# Monitor all Redis commands
docker-compose exec redis redis-cli -a redis-dev-password monitor

# Check slow log
docker-compose exec redis redis-cli -a redis-dev-password slowlog get 10

# Memory analysis
docker-compose exec redis redis-cli -a redis-dev-password --bigkeys

# Debug specific key
docker-compose exec redis redis-cli -a redis-dev-password debug object mykey
```

## 📊 Performance Debugging

### Real-time Metrics

```bash
# CPU and memory usage
docker stats

# Detailed container inspection
docker inspect puppeteer-mcp-app | jq '.[0].State'

# Process monitoring
docker-compose exec app htop

# Network statistics
docker-compose exec app netstat -i
```

### Application Metrics

```bash
# Access Prometheus metrics
curl http://localhost:9464/metrics

# Query specific metrics
curl -s http://localhost:9464/metrics | grep puppeteer_mcp

# Check metrics in Prometheus
open http://localhost:9090
# Query: rate(puppeteer_mcp_http_requests_total[5m])
```

### Load Testing Debug

```bash
# Run k6 with debug output
docker-compose run --rm k6 run --verbose /scripts/load-test.js

# Monitor during load test
watch -n 1 docker stats

# Check application logs during load
docker-compose logs -f app | grep -E "(error|warning|timeout)"
```

## 🧩 Puppeteer Debugging

### Browser Debugging

```bash
# Run with headful browser
docker-compose exec app node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  // Browser will stay open
})();
"

# Enable verbose logging
docker-compose exec app node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    dumpio: true,
    executablePath: '/usr/bin/chromium-browser',
    args: ['--enable-logging', '--v=1']
  });
})();
"
```

### Page Debugging

```javascript
// Add to your Puppeteer scripts for debugging

// Log console messages
page.on('console', msg => console.log('PAGE LOG:', msg.text()));

// Log page errors
page.on('pageerror', error => console.log('PAGE ERROR:', error));

// Log requests
page.on('request', request => console.log('REQUEST:', request.url()));

// Log responses
page.on('response', response => console.log('RESPONSE:', response.status(), response.url()));

// Take screenshot on error
page.on('pageerror', async () => {
  await page.screenshot({ path: 'error.png' });
});
```

## 🔐 Security Debugging

### Check Security Headers

```bash
# Test security headers
curl -I http://localhost:8443/health

# Check CORS
curl -H "Origin: http://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:8443/api/sessions

# Test rate limiting
for i in {1..100}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8443/health
done
```

### JWT Debugging

```bash
# Decode JWT token
docker-compose exec app node -e "
const jwt = require('jsonwebtoken');
const token = 'YOUR_TOKEN_HERE';
console.log(jwt.decode(token, {complete: true}));
"

# Verify JWT token
docker-compose exec app node -e "
const jwt = require('jsonwebtoken');
const token = 'YOUR_TOKEN_HERE';
const secret = process.env.JWT_SECRET;
try {
  const decoded = jwt.verify(token, secret);
  console.log('Valid:', decoded);
} catch (err) {
  console.log('Invalid:', err.message);
}
"
```

## 📝 Logging Debugging

### Enable Debug Logs

```bash
# Set debug environment
docker-compose exec app npm run dev -- --log-level=debug

# Enable specific debug namespaces
docker-compose exec -e DEBUG=puppeteer-mcp:* app npm run dev

# Pretty print logs
docker-compose logs -f app | npx pino-pretty
```

### Structured Log Analysis

```bash
# Extract JSON logs
docker-compose logs app | grep '{"level"' > app-logs.json

# Query logs with jq
docker-compose logs app | grep '{"level"' | jq 'select(.level >= 40)'

# Count errors by type
docker-compose logs app | grep '{"level"' | jq -r '.err.type' | sort | uniq -c
```

## 🎯 Debugging Workflows

### Issue Investigation Workflow

1. **Reproduce the issue**
   ```bash
   # Clear logs
   docker-compose logs --tail=0 -f app > debug.log &
   
   # Reproduce issue
   # ...
   
   # Stop logging
   kill %1
   ```

2. **Analyze logs**
   ```bash
   # Find errors
   grep -i error debug.log
   
   # Find specific request
   grep "request-id" debug.log
   ```

3. **Enable detailed logging**
   ```bash
   docker-compose exec -e LOG_LEVEL=trace app npm run dev
   ```

4. **Attach debugger and set breakpoints**

5. **Collect metrics and traces**

### Performance Investigation

1. **Start monitoring**
   ```bash
   # Terminal 1: System stats
   watch -n 1 docker stats
   
   # Terminal 2: Application logs
   docker-compose logs -f app
   
   # Terminal 3: Database queries
   docker-compose logs -f postgres
   ```

2. **Generate load**
   ```bash
   docker-compose run --rm k6
   ```

3. **Analyze results**
   - Check Grafana dashboards
   - Review Jaeger traces
   - Analyze Prometheus metrics

## 🛠️ Debug Tools Installation

```bash
# Install additional debugging tools in container
docker-compose exec --user root app sh -c '
apk add --no-cache \
  strace \
  ltrace \
  gdb \
  valgrind \
  tcpdump \
  wireshark \
  iperf3 \
  curl \
  wget \
  bind-tools \
  net-tools \
  htop \
  iotop \
  sysstat
'
```

## 📚 Resources

- [Node.js Debugging Guide](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- [Chrome DevTools Documentation](https://developers.google.com/web/tools/chrome-devtools)
- [Docker Debugging Best Practices](https://docs.docker.com/config/containers/logging/)
- [Puppeteer Debugging](https://pptr.dev/guides/debugging)