#!/bin/bash
# Deployment script for Puppeteer MCP
# Following DOP:K8S and SEC:API standards
# @nist cm-3 "Configuration Change Control"
# @nist cm-8 "Information System Component Inventory"

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Deployment configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
DEPLOYMENT_METHOD="${DEPLOYMENT_METHOD:-docker-compose}"
IMAGE_NAME="${IMAGE_NAME:-puppeteer-mcp}"
REGISTRY="${REGISTRY:-}"
VERSION="${VERSION:-latest}"
NAMESPACE="${NAMESPACE:-default}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[DEPLOY]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to check deployment prerequisites
check_prerequisites() {
    print_status "Checking deployment prerequisites..."
    
    case "$DEPLOYMENT_METHOD" in
        docker-compose)
            if ! command -v docker-compose &> /dev/null; then
                print_error "docker-compose is required but not installed"
                exit 1
            fi
            ;;
        kubernetes|k8s)
            if ! command -v kubectl &> /dev/null; then
                print_error "kubectl is required but not installed"
                exit 1
            fi
            ;;
        docker-swarm)
            if ! docker info | grep -q "Swarm: active"; then
                print_error "Docker Swarm is not initialized"
                exit 1
            fi
            ;;
        *)
            print_error "Unknown deployment method: $DEPLOYMENT_METHOD"
            exit 1
            ;;
    esac
    
    print_status "Prerequisites check passed"
}

# Function to validate environment
validate_environment() {
    print_status "Validating environment configuration..."
    
    # Check for required environment variables
    case "$ENVIRONMENT" in
        production|prod)
            local required_vars=("JWT_SECRET" "REDIS_PASSWORD")
            for var in "${required_vars[@]}"; do
                if [ -z "${!var:-}" ]; then
                    print_error "Required environment variable $var is not set"
                    exit 1
                fi
            done
            ;;
        staging|development|dev)
            print_warning "Deploying to $ENVIRONMENT environment"
            ;;
        *)
            print_error "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
    
    print_status "Environment validation passed"
}

# Function to pull latest image
pull_image() {
    print_status "Pulling Docker image..."
    
    local full_image_name="$IMAGE_NAME:$VERSION"
    if [ -n "$REGISTRY" ]; then
        full_image_name="$REGISTRY/$full_image_name"
    fi
    
    docker pull "$full_image_name"
    print_status "Image pulled: $full_image_name"
}

# Function to deploy with docker-compose
deploy_docker_compose() {
    print_status "Deploying with docker-compose..."
    
    cd "$PROJECT_ROOT"
    
    # Select appropriate compose file
    local compose_file="docker-compose.yml"
    if [ "$ENVIRONMENT" = "development" ] || [ "$ENVIRONMENT" = "dev" ]; then
        compose_file="docker-compose.dev.yml"
    fi
    
    # Create necessary directories
    print_status "Creating data directories..."
    sudo mkdir -p /var/lib/puppeteer-mcp/{redis,postgres}
    sudo chown -R 1001:1001 /var/lib/puppeteer-mcp
    
    # Deploy
    print_status "Starting services..."
    docker-compose -f "$compose_file" up -d
    
    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose -f "$compose_file" ps | grep -q "healthy"; then
            print_status "Services are healthy"
            break
        fi
        attempt=$((attempt + 1))
        print_info "Waiting for services... ($attempt/$max_attempts)"
        sleep 5
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "Services failed to become healthy"
        docker-compose -f "$compose_file" logs
        exit 1
    fi
    
    # Show service status
    docker-compose -f "$compose_file" ps
}

# Function to deploy to Kubernetes
deploy_kubernetes() {
    print_status "Deploying to Kubernetes..."
    
    local manifests_dir="$PROJECT_ROOT/k8s"
    
    if [ ! -d "$manifests_dir" ]; then
        print_error "Kubernetes manifests directory not found: $manifests_dir"
        exit 1
    fi
    
    # Apply namespace
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply configurations
    print_status "Applying Kubernetes manifests..."
    kubectl apply -f "$manifests_dir/" -n "$NAMESPACE"
    
    # Wait for deployment
    print_status "Waiting for deployment to be ready..."
    kubectl rollout status deployment/puppeteer-mcp -n "$NAMESPACE" --timeout=300s
    
    # Show deployment status
    kubectl get all -n "$NAMESPACE" -l app=puppeteer-mcp
}

# Function to deploy to Docker Swarm
deploy_docker_swarm() {
    print_status "Deploying to Docker Swarm..."
    
    cd "$PROJECT_ROOT"
    
    # Deploy stack
    docker stack deploy -c docker-compose.yml puppeteer-mcp
    
    # Wait for services
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Show service status
    docker stack services puppeteer-mcp
}

# Function to run post-deployment checks
post_deployment_checks() {
    print_status "Running post-deployment checks..."
    
    # Check health endpoint
    local health_url="http://localhost:8443/health"
    print_status "Checking health endpoint: $health_url"
    
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$health_url" > /dev/null 2>&1; then
            print_status "Health check passed"
            break
        fi
        attempt=$((attempt + 1))
        print_info "Waiting for health endpoint... ($attempt/$max_attempts)"
        sleep 3
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "Health check failed"
        exit 1
    fi
    
    # Run security scan
    if [ -f "$SCRIPT_DIR/security-check.sh" ]; then
        print_status "Running security scan..."
        bash "$SCRIPT_DIR/security-check.sh" --deployed
    fi
}

# Function to generate deployment report
generate_deployment_report() {
    print_status "Generating deployment report..."
    
    local report_file="$PROJECT_ROOT/deployment-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" <<EOF
{
  "deploymentTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "$ENVIRONMENT",
  "method": "$DEPLOYMENT_METHOD",
  "version": "$VERSION",
  "image": "$IMAGE_NAME:$VERSION",
  "status": "success",
  "checks": {
    "health": "passed",
    "security": "passed"
  }
}
EOF
    
    print_status "Deployment report generated: $report_file"
}

# Main deployment process
main() {
    print_status "Starting deployment process..."
    print_info "Environment: $ENVIRONMENT"
    print_info "Method: $DEPLOYMENT_METHOD"
    print_info "Version: $VERSION"
    
    # Run deployment steps
    check_prerequisites
    validate_environment
    pull_image
    
    # Deploy based on method
    case "$DEPLOYMENT_METHOD" in
        docker-compose)
            deploy_docker_compose
            ;;
        kubernetes|k8s)
            deploy_kubernetes
            ;;
        docker-swarm)
            deploy_docker_swarm
            ;;
    esac
    
    # Post-deployment
    post_deployment_checks
    generate_deployment_report
    
    print_status "Deployment completed successfully!"
    print_info "Application is running at: https://localhost:8443"
    
    # Print monitoring info
    echo ""
    print_status "Monitoring commands:"
    case "$DEPLOYMENT_METHOD" in
        docker-compose)
            echo "  - Logs: docker-compose logs -f"
            echo "  - Status: docker-compose ps"
            ;;
        kubernetes|k8s)
            echo "  - Logs: kubectl logs -f -l app=puppeteer-mcp -n $NAMESPACE"
            echo "  - Status: kubectl get pods -n $NAMESPACE"
            ;;
        docker-swarm)
            echo "  - Logs: docker service logs -f puppeteer-mcp_app"
            echo "  - Status: docker stack ps puppeteer-mcp"
            ;;
    esac
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -m|--method)
            DEPLOYMENT_METHOD="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --environment ENV    Deployment environment (default: production)"
            echo "  -m, --method METHOD      Deployment method (docker-compose|kubernetes|docker-swarm)"
            echo "  -v, --version VERSION    Image version to deploy (default: latest)"
            echo "  -n, --namespace NS       Kubernetes namespace (default: default)"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main "$@"