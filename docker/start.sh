#!/bin/bash
# Start script for puppeteer-mcp Docker development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    log_warning ".env file not found. Creating from .env.example..."
    cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
    log_info "Please edit .env file with your configuration"
fi

# Parse arguments
PROFILE=""
BUILD=false
CLEAN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        --build)
            BUILD=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --profile <name>  Include Docker Compose profile (tools, monitoring, load-test)"
            echo "  --build          Force rebuild of images"
            echo "  --clean          Clean volumes before starting"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Clean volumes if requested
if [ "$CLEAN" = true ]; then
    log_info "Cleaning existing volumes..."
    docker-compose down -v
    log_success "Volumes cleaned"
fi

# Build command
COMPOSE_CMD="docker-compose -f docker-compose.yml -f docker-compose.dev.yml"

if [ -n "$PROFILE" ]; then
    COMPOSE_CMD="$COMPOSE_CMD --profile $PROFILE"
fi

# Build images if requested
if [ "$BUILD" = true ]; then
    log_info "Building Docker images..."
    $COMPOSE_CMD build
    log_success "Images built successfully"
fi

# Start services
log_info "Starting puppeteer-mcp development environment..."
$COMPOSE_CMD up -d

# Wait for services to be healthy
log_info "Waiting for services to be healthy..."
sleep 5

# Check service health
services=("app" "redis" "postgres" "jaeger" "prometheus" "grafana")
all_healthy=true

for service in "${services[@]}"; do
    if docker-compose ps | grep -q "puppeteer-mcp-$service.*healthy"; then
        log_success "$service is healthy"
    else
        log_warning "$service is not healthy yet"
        all_healthy=false
    fi
done

if [ "$all_healthy" = true ]; then
    log_success "All services are healthy!"
else
    log_warning "Some services are still starting. Check with: docker-compose ps"
fi

# Display service URLs
echo ""
log_info "Service URLs:"
echo "  - Application:     http://localhost:8443"
echo "  - gRPC:           localhost:50051"
echo "  - Node Debugger:  chrome://inspect -> localhost:9229"
echo "  - Prometheus:     http://localhost:9090"
echo "  - Grafana:        http://localhost:3000 (admin/admin-dev-password)"
echo "  - Jaeger UI:      http://localhost:16686"

if [[ "$PROFILE" == *"tools"* ]]; then
    echo "  - Adminer:        http://localhost:8080"
    echo "  - Redis Commander: http://localhost:8081 (admin/admin-dev-password)"
fi

echo ""
log_info "Useful commands:"
echo "  - View logs:        docker-compose logs -f [service]"
echo "  - Enter container:  docker-compose exec app /bin/bash"
echo "  - Run tests:        docker-compose exec app npm test"
echo "  - Stop services:    docker-compose down"
echo ""

log_success "Development environment is ready!"