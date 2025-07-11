# Docker Development Environment

This directory contains the Docker Compose setup for local development of puppeteer-mcp with a full
observability stack.

## 🚀 Quick Start

```bash
# Start all services
./docker/start.sh

# Start with additional tools (Adminer, Redis Commander)
./docker/start.sh --profile tools

# Start with monitoring exporters
./docker/start.sh --profile monitoring

# Start with everything
./docker/start.sh --profile tools --profile monitoring

# Stop all services
./docker/stop.sh

# Stop and remove volumes
./docker/stop.sh --volumes
```

## 📦 Services

### Core Services

| Service  | Port              | Description                    |
| -------- | ----------------- | ------------------------------ |
| app      | 8443, 50051, 9229 | Main puppeteer-mcp application |
| redis    | 6379              | Session storage and caching    |
| postgres | 5432              | Database for persistent data   |

### Observability Stack

| Service    | Port  | URL                    | Description                           |
| ---------- | ----- | ---------------------- | ------------------------------------- |
| prometheus | 9090  | http://localhost:9090  | Metrics collection                    |
| grafana    | 3000  | http://localhost:3000  | Dashboards (admin/admin-dev-password) |
| jaeger     | 16686 | http://localhost:16686 | Distributed tracing                   |

### Development Tools (--profile tools)

| Service         | Port | URL                   | Description                                 |
| --------------- | ---- | --------------------- | ------------------------------------------- |
| adminer         | 8080 | http://localhost:8080 | Database management                         |
| redis-commander | 8081 | http://localhost:8081 | Redis management (admin/admin-dev-password) |

### Monitoring Exporters (--profile monitoring)

| Service           | Port | Description        |
| ----------------- | ---- | ------------------ |
| node-exporter     | 9100 | System metrics     |
| redis-exporter    | 9121 | Redis metrics      |
| postgres-exporter | 9187 | PostgreSQL metrics |

### Load Testing (--profile load-test)

| Service | Description       |
| ------- | ----------------- |
| k6      | Load testing tool |

## 🔧 Configuration

### Environment Variables

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. For Docker-specific settings, use `.env.docker` which is automatically loaded

3. Key environment variables:
   - `JWT_SECRET`: JWT signing secret (min 32 chars)
   - `SESSION_SECRET`: Session secret (min 32 chars)
   - `DATABASE_URL`: PostgreSQL connection string
   - `REDIS_URL`: Redis connection string

### Volumes

Persistent data is stored in Docker volumes:

- `redis-data`: Redis persistence
- `postgres-data`: PostgreSQL data
- `jaeger-data`: Trace storage
- `prometheus-data`: Metrics storage
- `grafana-data`: Dashboard configurations
- `node_modules`: NPM dependencies (development)
- `dist`: Build output (development)

## 🛠️ Development Workflow

### Starting Development

```bash
# 1. Start services
./docker/start.sh --profile tools

# 2. Check health
./docker/health-check.sh

# 3. Seed database (optional)
./docker/seed-db.sh

# 4. View logs
docker-compose logs -f app
```

### Debugging

The application runs with Node.js inspector enabled:

1. Open Chrome/Edge
2. Navigate to `chrome://inspect`
3. Click "Configure" and add `localhost:9229`
4. Click "inspect" on the remote target

### Running Tests

```bash
# Unit tests
docker-compose exec app npm test

# Integration tests
docker-compose exec app npm run test:integration

# E2E tests
docker-compose exec app npm run test:e2e

# With coverage
docker-compose exec app npm run test:coverage
```

### Hot Reload

The development setup includes hot reloading:

- Source code changes in `/src` trigger automatic restart
- TypeScript compilation happens on-the-fly
- Logs show compilation errors immediately

### Database Management

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U mcp -d puppeteer_mcp

# Backup database
docker-compose exec postgres pg_dump -U mcp puppeteer_mcp > backup.sql

# Restore database
docker-compose exec -T postgres psql -U mcp puppeteer_mcp < backup.sql

# Access Adminer UI
open http://localhost:8080
# Server: postgres
# Username: mcp
# Password: mcp-password
# Database: puppeteer_mcp
```

### Redis Management

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli -a redis-dev-password

# Monitor Redis commands
docker-compose exec redis redis-cli -a redis-dev-password monitor

# Access Redis Commander
open http://localhost:8081
# Username: admin
# Password: admin-dev-password
```

## 📊 Monitoring

### Prometheus

Access at http://localhost:9090

Useful queries:

- `up`: Service health
- `rate(puppeteer_mcp_http_requests_total[5m])`: Request rate
- `puppeteer_mcp_browser_pool_available`: Available browsers
- `process_resident_memory_bytes`: Memory usage

### Grafana

Access at http://localhost:3000

- Username: admin
- Password: admin-dev-password

Pre-configured dashboards:

- puppeteer-mcp Overview: Main application metrics
- Browser Pool: Browser resource utilization
- API Performance: Request latencies and error rates

### Jaeger

Access at http://localhost:16686

Features:

- Distributed trace viewing
- Service dependency graph
- Performance analysis
- Error tracking

## 🧪 Load Testing

Run load tests with k6:

```bash
# Run default load test
docker-compose run --rm k6

# Run custom test
docker-compose run --rm k6 run /scripts/custom-test.js

# Run with specific stages
docker-compose run --rm k6 run --stage 5s:10,2m:10,5s:0 /scripts/load-test.js
```

## 🔒 Security

### Development Credentials

⚠️ **These are for development only! Never use in production!**

- JWT Secret: `dev-jwt-secret-change-in-production-min-32-characters`
- Session Secret: `dev-session-secret-change-in-production-32+`
- Redis Password: `redis-dev-password`
- PostgreSQL Password: `mcp-password`
- Grafana: `admin` / `admin-dev-password`
- Redis Commander: `admin` / `admin-dev-password`

### Network Security

- Services communicate over an isolated bridge network
- Only necessary ports are exposed to the host
- Inter-container communication is enabled for development

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**

   ```bash
   # Check what's using a port
   lsof -i :8443

   # Change port in docker-compose.override.yml
   ```

2. **Service won't start**

   ```bash
   # Check logs
   docker-compose logs [service-name]

   # Restart specific service
   docker-compose restart [service-name]
   ```

3. **Database connection issues**

   ```bash
   # Check PostgreSQL is running
   docker-compose ps postgres

   # Test connection
   docker-compose exec postgres pg_isready
   ```

4. **Out of memory**

   ```bash
   # Increase Docker memory allocation
   # Docker Desktop > Preferences > Resources

   # Or reduce service limits in docker-compose.yml
   ```

### Cleanup

```bash
# Stop and remove everything
./docker/stop.sh --all

# Remove unused Docker resources
docker system prune -a

# Remove specific volumes
docker volume rm puppeteer-mcp_redis-data
docker volume rm puppeteer-mcp_postgres-data
```

## 📁 Directory Structure

```
docker/
├── grafana/
│   ├── provisioning/     # Grafana auto-configuration
│   └── dashboards/       # Pre-built dashboards
├── k6/
│   └── scripts/          # Load test scripts
├── postgres/
│   └── init/             # Database initialization
├── prometheus/           # Prometheus configuration
├── redis/                # Redis configuration
├── health-check.sh       # Service health verification
├── seed-db.sh           # Database seeding
├── start.sh             # Start script
└── stop.sh              # Stop script
```

## 🔄 Updating

When updating the Docker setup:

1. Pull latest changes
2. Rebuild images: `./docker/start.sh --build`
3. Update volumes if needed: `./docker/stop.sh --volumes`
4. Check for new environment variables in `.env.example`

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [k6 Documentation](https://k6.io/docs/)
