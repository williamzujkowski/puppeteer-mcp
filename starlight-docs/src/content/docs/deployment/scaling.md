---
title: Scaling Guide
description: 'Learn how to scale Puppeteer MCP for high-traffic production environments.'
---

# Scaling Guide

Learn how to scale Puppeteer MCP for high-traffic production environments.

## Scaling Strategies

### Vertical Scaling (Scale Up)

- Increase CPU cores
- Add more RAM
- Upgrade to faster storage
- Optimize single instance performance

### Horizontal Scaling (Scale Out)

- Add more server instances
- Distribute load across servers
- Implement session affinity
- Use container orchestration

## Architecture Patterns

### Single Server Setup

```
[Clients] → [Puppeteer MCP Server] → [Chrome Pool]
```

**Capacity**: ~10-50 concurrent sessions **Use Case**: Small teams, development

### Load Balanced Setup

```
                    [Load Balancer]
                         |
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
    [Server 1]      [Server 2]      [Server 3]
        |                |                |
    [Chrome Pool]   [Chrome Pool]   [Chrome Pool]
```

**Capacity**: ~50-200 concurrent sessions **Use Case**: Medium traffic, redundancy

### Distributed Architecture

```
    [API Gateway]
         |
    [Load Balancer]
         |
    [MCP Servers]  ←→  [Session Store]  ←→  [Message Queue]
         |
    [Chrome Cluster]
```

**Capacity**: 200+ concurrent sessions **Use Case**: High traffic, enterprise

## Container Orchestration

### Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: puppeteer-mcp
  labels:
    app: puppeteer-mcp
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
              name: http
            - containerPort: 50051
              name: grpc
          env:
            - name: PUPPETEER_MCP_AUTH_TOKEN
              valueFrom:
                secretKeyRef:
                  name: puppeteer-secrets
                  key: auth-token
            - name: REDIS_URL
              value: redis://redis-service:6379
          resources:
            requests:
              memory: '1Gi'
              cpu: '500m'
            limits:
              memory: '2Gi'
              cpu: '2'
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: puppeteer-mcp-service
spec:
  selector:
    app: puppeteer-mcp
  ports:
    - name: http
      port: 80
      targetPort: 3000
    - name: grpc
      port: 50051
      targetPort: 50051
  type: LoadBalancer
```

### Horizontal Pod Autoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: puppeteer-mcp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: puppeteer-mcp
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: active_sessions
        target:
          type: AverageValue
          averageValue: '30'
```

## Session Distribution

### Redis Session Store

```javascript
// session-store.js
const Redis = require('ioredis');

class RedisSessionStore {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
  }

  async createSession(sessionData) {
    const sessionId = generateId();
    await this.redis.setex(`session:${sessionId}`, SESSION_TIMEOUT, JSON.stringify(sessionData));
    return sessionId;
  }

  async getSession(sessionId) {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async updateSession(sessionId, updates) {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const updated = { ...session, ...updates };
    await this.redis.setex(`session:${sessionId}`, SESSION_TIMEOUT, JSON.stringify(updated));
  }

  async deleteSession(sessionId) {
    await this.redis.del(`session:${sessionId}`);
  }
}
```

### Session Affinity

```nginx
# nginx.conf - Sticky sessions
upstream puppeteer_backend {
    ip_hash;  # Session affinity based on client IP
    server server1:3000 max_fails=3 fail_timeout=30s;
    server server2:3000 max_fails=3 fail_timeout=30s;
    server server3:3000 max_fails=3 fail_timeout=30s;
}

# Alternative: Cookie-based affinity
upstream puppeteer_backend {
    sticky cookie srv_id expires=1h;
    server server1:3000;
    server server2:3000;
    server server3:3000;
}
```

## Load Balancing

### HAProxy Configuration

```
# haproxy.cfg
global
    maxconn 4096
    log stdout local0

defaults
    mode http
    timeout connect 5s
    timeout client 30s
    timeout server 30s
    option httplog

frontend puppeteer_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/puppeteer.pem
    redirect scheme https if !{ ssl_fc }

    # Rate limiting
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request deny if { sc_http_req_rate(0) gt 20 }

    default_backend puppeteer_backend

backend puppeteer_backend
    balance leastconn
    option httpchk GET /health

    # Sticky sessions using cookies
    cookie SERVERID insert indirect nocache

    server web1 192.168.1.10:3000 check cookie web1
    server web2 192.168.1.11:3000 check cookie web2
    server web3 192.168.1.12:3000 check cookie web3
```

### AWS Application Load Balancer

```yaml
# terraform/alb.tf
resource "aws_lb" "puppeteer_alb" { name               = "puppeteer-mcp-alb" internal           =
false load_balancer_type = "application" security_groups    = [aws_security_group.alb.id]
subnets           = aws_subnet.public[*].id

enable_deletion_protection = true enable_http2              = true

tags = { Name = "puppeteer-mcp-alb" } }

resource "aws_lb_target_group" "puppeteer" { name     = "puppeteer-mcp-tg" port     = 3000 protocol
= "HTTP" vpc_id   = aws_vpc.main.id

health_check { enabled             = true healthy_threshold   = 2 unhealthy_threshold = 2
timeout             = 5 interval            = 30 path                = "/health"
matcher             = "200" }

stickiness { type            = "lb_cookie" cookie_duration = 86400 enabled         = true } }
```

## Chrome Browser Pooling

### Browser Pool Implementation

```javascript
// browser-pool.js
class BrowserPool {
  constructor(options = {}) {
    this.minSize = options.minSize || 2;
    this.maxSize = options.maxSize || 10;
    this.browsers = [];
    this.available = [];
    this.busy = new Map();
  }

  async initialize() {
    // Pre-warm pool with minimum browsers
    for (let i = 0; i < this.minSize; i++) {
      const browser = await this.createBrowser();
      this.available.push(browser);
    }
  }

  async acquire() {
    // Return available browser or create new one
    if (this.available.length > 0) {
      const browser = this.available.pop();
      this.busy.set(browser, Date.now());
      return browser;
    }

    if (this.browsers.length < this.maxSize) {
      const browser = await this.createBrowser();
      this.busy.set(browser, Date.now());
      return browser;
    }

    // Wait for available browser
    return new Promise((resolve) => {
      const checkAvailable = setInterval(() => {
        if (this.available.length > 0) {
          clearInterval(checkAvailable);
          resolve(this.acquire());
        }
      }, 100);
    });
  }

  async release(browser) {
    this.busy.delete(browser);

    // Check if browser is still healthy
    try {
      await browser.version();
      this.available.push(browser);
    } catch (error) {
      // Browser is dead, remove it
      await this.removeBrowser(browser);

      // Maintain minimum pool size
      if (this.browsers.length < this.minSize) {
        const newBrowser = await this.createBrowser();
        this.available.push(newBrowser);
      }
    }
  }

  async createBrowser() {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    this.browsers.push(browser);
    return browser;
  }

  async shutdown() {
    await Promise.all(this.browsers.map((b) => b.close()));
    this.browsers = [];
    this.available = [];
    this.busy.clear();
  }
}
```

## Performance Optimization

### Caching Strategy

```javascript
// cache-layer.js
const NodeCache = require('node-cache');

class CacheLayer {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 600, // 10 minutes
      checkperiod: 120,
      useClones: false,
    });
  }

  async getCachedOrExecute(key, executor) {
    const cached = this.cache.get(key);
    if (cached) return cached;

    const result = await executor();
    this.cache.set(key, result);
    return result;
  }

  invalidate(pattern) {
    const keys = this.cache.keys();
    keys.forEach((key) => {
      if (key.match(pattern)) {
        this.cache.del(key);
      }
    });
  }
}

// Usage
const cache = new CacheLayer();

app.get('/api/static-content/:page', async (req, res) => {
  const content = await cache.getCachedOrExecute(`content:${req.params.page}`, async () => {
    // Expensive operation
    return await fetchPageContent(req.params.page);
  });
  res.json(content);
});
```

### Connection Pooling

```javascript
// connection-pool.js
const genericPool = require('generic-pool');

const factory = {
  create: async () => {
    const browser = await puppeteer.launch(browserOptions);
    return browser;
  },
  destroy: async (browser) => {
    await browser.close();
  },
  validate: async (browser) => {
    try {
      await browser.version();
      return true;
    } catch (error) {
      return false;
    }
  },
};

const pool = genericPool.createPool(factory, {
  min: 2,
  max: 10,
  testOnBorrow: true,
  acquireTimeoutMillis: 30000,
  evictionRunIntervalMillis: 60000,
  idleTimeoutMillis: 300000,
});

// Usage
async function executeBrowserAction(action) {
  const browser = await pool.acquire();
  try {
    return await action(browser);
  } finally {
    await pool.release(browser);
  }
}
```

## Monitoring at Scale

### Prometheus Metrics

```javascript
// metrics.js
const promClient = require('prom-client');

// Custom metrics
const activeSessionsGauge = new promClient.Gauge({
  name: 'puppeteer_active_sessions',
  help: 'Number of active browser sessions',
  labelNames: ['server_id'],
});

const browserPoolSizeGauge = new promClient.Gauge({
  name: 'puppeteer_browser_pool_size',
  help: 'Current browser pool size',
  labelNames: ['server_id', 'state'],
});

const actionDurationHistogram = new promClient.Histogram({
  name: 'puppeteer_action_duration_seconds',
  help: 'Duration of browser actions',
  labelNames: ['action', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Update metrics
function updateMetrics(pool, sessions) {
  activeSessionsGauge.set({ server_id: SERVER_ID }, sessions.size);
  browserPoolSizeGauge.set({ server_id: SERVER_ID, state: 'available' }, pool.available.length);
  browserPoolSizeGauge.set({ server_id: SERVER_ID, state: 'busy' }, pool.busy.size);
}
```

### Distributed Tracing

```javascript
// tracing.js
const opentelemetry = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

const provider = new NodeTracerProvider();
const exporter = new JaegerExporter({
  serviceName: 'puppeteer-mcp',
  endpoint: 'http://jaeger:14268/api/traces',
});

provider.addSpanProcessor(new opentelemetry.BatchSpanProcessor(exporter));
provider.register();

const tracer = opentelemetry.trace.getTracer('puppeteer-mcp');

// Usage
async function tracedAction(name, action) {
  const span = tracer.startSpan(name);
  try {
    const result = await action();
    span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: opentelemetry.SpanStatusCode.ERROR,
      message: error.message,
    });
    throw error;
  } finally {
    span.end();
  }
}
```

## Disaster Recovery

### Backup Strategy

```yaml
# kubernetes/backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: puppeteer-backup
spec:
  schedule: '0 2 * * *' # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: alpine:latest
              command:
                - /bin/sh
                - -c
                - |
                  # Backup Redis data
                  redis-cli --rdb /backup/redis-$(date +%Y%m%d).rdb

                  # Backup configuration
                  kubectl get configmap puppeteer-config -o yaml > /backup/config-$(date +%Y%m%d).yaml

                  # Upload to S3
                  aws s3 sync /backup s3://backup-bucket/puppeteer-mcp/

                  # Clean old backups
                  find /backup -mtime +30 -delete
              volumeMounts:
                - name: backup
                  mountPath: /backup
          volumes:
            - name: backup
              persistentVolumeClaim:
                claimName: backup-pvc
          restartPolicy: OnFailure
```

### Failover Strategy

```javascript
// failover.js
class FailoverManager {
  constructor(servers) {
    this.servers = servers;
    this.primary = servers[0];
    this.healthCheckInterval = 5000;
  }

  async healthCheck(server) {
    try {
      const response = await fetch(`${server}/health`, {
        timeout: 3000,
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async findHealthyServer() {
    for (const server of this.servers) {
      if (await this.healthCheck(server)) {
        return server;
      }
    }
    throw new Error('No healthy servers available');
  }

  async execute(action) {
    try {
      return await action(this.primary);
    } catch (error) {
      console.error(`Primary server failed: ${error.message}`);
      this.primary = await this.findHealthyServer();
      return await action(this.primary);
    }
  }
}
```

## Cost Optimization

### Resource Optimization

```yaml
# Pod Disruption Budget
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: puppeteer-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: puppeteer-mcp
---
# Vertical Pod Autoscaler
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: puppeteer-vpa
spec:
  targetRef:
    apiVersion: 'apps/v1'
    kind: Deployment
    name: puppeteer-mcp
  updatePolicy:
    updateMode: 'Auto'
  resourcePolicy:
    containerPolicies:
      - containerName: puppeteer-mcp
        minAllowed:
          cpu: 100m
          memory: 128Mi
        maxAllowed:
          cpu: 2
          memory: 2Gi
```

### Spot Instance Usage

```yaml
# terraform/spot-instances.tf
resource "aws_launch_template" "puppeteer_spot" { name_prefix   = "puppeteer-spot-" image_id      =
data.aws_ami.ubuntu.id instance_type = "t3.large"

instance_market_options { market_type = "spot" spot_options { max_price = "0.05" spot_instance_type
= "persistent" } }

user_data = base64encode(templatefile("${path.module}/userdata.sh", { auth_token = var.auth_token
})) }

resource "aws_autoscaling_group" "puppeteer_spot" { name               = "puppeteer-spot-asg"
vpc_zone_identifier = aws_subnet.private[*].id target_group_arns  =
[aws_lb_target_group.puppeteer.arn] health_check_type  = "ELB" min_size          = 1
max_size          = 10 desired_capacity  = 3

mixed_instances_policy { instances_distribution { on_demand_percentage_above_base_capacity = 20
spot_allocation_strategy = "lowest-price" }

launch_template { launch_template_specification { launch_template_id =
aws_launch_template.puppeteer_spot.id } } } }
```

## Best Practices

1. **Session Affinity**: Use sticky sessions for stateful operations
2. **Health Checks**: Implement comprehensive health monitoring
3. **Graceful Shutdown**: Handle SIGTERM properly
4. **Resource Limits**: Set appropriate CPU/memory limits
5. **Monitoring**: Track all critical metrics
6. **Caching**: Cache static content aggressively
7. **Circuit Breakers**: Prevent cascade failures
8. **Documentation**: Keep deployment docs updated

## Next Steps

- Review [Production Deployment](/puppeteer-mcp/production.md)
- Implement [Security Best Practices](/puppeteer-mcp/../architecture/security.md)
- Set up [Monitoring Dashboard](/puppeteer-mcp/production.md#monitoring)
- Plan [Disaster Recovery](/puppeteer-mcp/production.md#backup-strategy)
