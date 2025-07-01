#!/bin/bash
# Production build script for Puppeteer MCP
# Following CN:DOCKER and SEC:API standards
# @nist cm-2 "Baseline Configuration"
# @nist cm-4 "Security Impact Analysis"

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Build configuration
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
VERSION=$(git describe --tags --always 2>/dev/null || echo "dev")
IMAGE_NAME="${IMAGE_NAME:-puppeteer-mcp}"
REGISTRY="${REGISTRY:-}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[BUILD]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check for required commands
    local required_commands=("docker" "npm" "node" "git")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            print_error "$cmd is required but not installed"
            exit 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="20.0.0"
    if ! printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1 | grep -q "$required_version"; then
        print_error "Node.js version must be >= $required_version (current: $node_version)"
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Function to run security checks
run_security_checks() {
    print_status "Running security checks..."
    
    cd "$PROJECT_ROOT"
    
    # Run npm audit
    print_status "Running npm audit..."
    if ! npm audit --production --audit-level=high; then
        print_error "Security vulnerabilities found. Please fix before building."
        exit 1
    fi
    
    # Run security check script
    if [ -f "$SCRIPT_DIR/security-check.sh" ]; then
        print_status "Running custom security checks..."
        bash "$SCRIPT_DIR/security-check.sh"
    fi
    
    print_status "Security checks passed"
}

# Function to build the application
build_application() {
    print_status "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Clean previous builds
    print_status "Cleaning previous builds..."
    rm -rf dist/
    
    # Install dependencies
    print_status "Installing dependencies..."
    npm ci --prefer-offline
    
    # Run linting
    print_status "Running linting..."
    npm run lint
    
    # Run type checking
    print_status "Running type checking..."
    npm run typecheck
    
    # Run tests
    print_status "Running tests..."
    npm test
    
    # Build TypeScript
    print_status "Building TypeScript..."
    npm run build
    
    # Verify build output
    if [ ! -d "dist" ]; then
        print_error "Build failed: dist directory not found"
        exit 1
    fi
    
    print_status "Application build completed"
}

# Function to build Docker image
build_docker_image() {
    print_status "Building Docker image..."
    
    cd "$PROJECT_ROOT"
    
    local full_image_name="$IMAGE_NAME:$VERSION"
    if [ -n "$REGISTRY" ]; then
        full_image_name="$REGISTRY/$full_image_name"
    fi
    
    # Build multi-stage Docker image
    docker build \
        --build-arg BUILD_DATE="$BUILD_DATE" \
        --build-arg VCS_REF="$VCS_REF" \
        --build-arg VERSION="$VERSION" \
        --tag "$full_image_name" \
        --tag "$IMAGE_NAME:latest" \
        --file Dockerfile \
        .
    
    print_status "Docker image built: $full_image_name"
    
    # Scan Docker image for vulnerabilities
    if command -v trivy &> /dev/null; then
        print_status "Scanning Docker image for vulnerabilities..."
        trivy image --severity HIGH,CRITICAL "$full_image_name"
    else
        print_warning "Trivy not installed, skipping vulnerability scan"
    fi
}

# Function to generate build artifacts
generate_artifacts() {
    print_status "Generating build artifacts..."
    
    local artifacts_dir="$PROJECT_ROOT/build-artifacts"
    mkdir -p "$artifacts_dir"
    
    # Generate build info
    cat > "$artifacts_dir/build-info.json" <<EOF
{
  "version": "$VERSION",
  "buildDate": "$BUILD_DATE",
  "vcsRef": "$VCS_REF",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)",
  "dockerVersion": "$(docker --version | cut -d' ' -f3 | tr -d ',')",
  "platform": "$(uname -s)",
  "architecture": "$(uname -m)"
}
EOF
    
    # Generate SBOM (Software Bill of Materials)
    if command -v syft &> /dev/null; then
        print_status "Generating SBOM..."
        syft "$IMAGE_NAME:latest" -o json > "$artifacts_dir/sbom.json"
    fi
    
    # Copy important files
    cp "$PROJECT_ROOT/package.json" "$artifacts_dir/"
    cp "$PROJECT_ROOT/package-lock.json" "$artifacts_dir/"
    
    print_status "Build artifacts generated in $artifacts_dir"
}

# Main build process
main() {
    print_status "Starting production build process..."
    print_status "Project: $PROJECT_ROOT"
    print_status "Version: $VERSION"
    print_status "Build Date: $BUILD_DATE"
    
    # Run build steps
    check_prerequisites
    run_security_checks
    build_application
    build_docker_image
    generate_artifacts
    
    print_status "Build completed successfully!"
    print_status "Docker image: $IMAGE_NAME:$VERSION"
    
    # Print next steps
    echo ""
    print_status "Next steps:"
    echo "  1. Test the image: docker run -p 8443:8443 $IMAGE_NAME:latest"
    echo "  2. Push to registry: docker push $IMAGE_NAME:$VERSION"
    echo "  3. Deploy using: ./scripts/deploy.sh"
}

# Run main function
main "$@"