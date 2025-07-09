#!/bin/bash
# Health check script for puppeteer-mcp services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Service endpoints
APP_URL="http://localhost:8443/health"
GRPC_URL="localhost:50051"
REDIS_URL="localhost:6379"
POSTGRES_URL="localhost:5432"
PROMETHEUS_URL="http://localhost:9090/-/healthy"
GRAFANA_URL="http://localhost:3000/api/health"
JAEGER_URL="http://localhost:16686/"

# Check functions
check_http() {
    local url=$1
    local name=$2
    
    if curl -f -s -o /dev/null "$url"; then
        echo -e "${GREEN}✓${NC} $name is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $name is not responding"
        return 1
    fi
}

check_tcp() {
    local host=$1
    local port=$2
    local name=$3
    
    if nc -z "$host" "$port" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $name is listening on port $port"
        return 0
    else
        echo -e "${RED}✗${NC} $name is not listening on port $port"
        return 1
    fi
}

check_redis() {
    if redis-cli -h localhost -a redis-dev-password ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Redis is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} Redis is not responding"
        return 1
    fi
}

check_postgres() {
    if PGPASSWORD=mcp-password psql -h localhost -U mcp -d puppeteer_mcp -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} PostgreSQL is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} PostgreSQL is not responding"
        return 1
    fi
}

# Main health check
echo -e "${BLUE}puppeteer-mcp Health Check${NC}"
echo "=========================="

all_healthy=true

# Check main application
if ! check_http "$APP_URL" "Application API"; then
    all_healthy=false
fi

# Check gRPC
if ! check_tcp "localhost" "50051" "gRPC service"; then
    all_healthy=false
fi

# Check Redis
if ! check_redis; then
    all_healthy=false
fi

# Check PostgreSQL
if ! check_postgres; then
    all_healthy=false
fi

# Check monitoring stack
echo ""
echo -e "${BLUE}Monitoring Stack${NC}"
echo "----------------"

if ! check_http "$PROMETHEUS_URL" "Prometheus"; then
    all_healthy=false
fi

if ! check_http "$GRAFANA_URL" "Grafana"; then
    all_healthy=false
fi

if ! check_http "$JAEGER_URL" "Jaeger"; then
    all_healthy=false
fi

# Summary
echo ""
if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}All services are healthy!${NC}"
    exit 0
else
    echo -e "${RED}Some services are unhealthy${NC}"
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Check container status: docker-compose ps"
    echo "2. View logs: docker-compose logs [service-name]"
    echo "3. Ensure all required ports are available"
    echo "4. Check if services have finished starting up"
    exit 1
fi