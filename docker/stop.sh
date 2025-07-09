#!/bin/bash
# Stop script for puppeteer-mcp Docker development environment

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

# Parse arguments
REMOVE_VOLUMES=false
REMOVE_IMAGES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --volumes|-v)
            REMOVE_VOLUMES=true
            shift
            ;;
        --images|-i)
            REMOVE_IMAGES=true
            shift
            ;;
        --all|-a)
            REMOVE_VOLUMES=true
            REMOVE_IMAGES=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -v, --volumes    Remove volumes"
            echo "  -i, --images     Remove images"
            echo "  -a, --all        Remove volumes and images"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Stop containers
log_info "Stopping puppeteer-mcp containers..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

if [ "$REMOVE_VOLUMES" = true ]; then
    log_info "Removing volumes..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v
    log_success "Volumes removed"
fi

if [ "$REMOVE_IMAGES" = true ]; then
    log_info "Removing images..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml down --rmi local
    log_success "Images removed"
fi

log_success "puppeteer-mcp environment stopped!"

# Show disk usage
if [ "$REMOVE_VOLUMES" = true ] || [ "$REMOVE_IMAGES" = true ]; then
    echo ""
    log_info "Docker disk usage:"
    docker system df
fi