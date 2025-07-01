#!/bin/bash
# Security audit script for Puppeteer MCP
# Following SEC:API and NIST-IG standards
# @nist ca-2 "Security Assessments"
# @nist ra-5 "Vulnerability Scanning"
# @nist si-2 "Flaw Remediation"

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

# Security check configuration
AUDIT_LEVEL="${AUDIT_LEVEL:-high}"
FAIL_ON_VULNERABILITY="${FAIL_ON_VULNERABILITY:-true}"
CHECK_DEPLOYED="${1:-}"

# Security report
SECURITY_REPORT=""
VULNERABILITIES_FOUND=0
WARNINGS_COUNT=0

# Function to print colored output
print_status() {
    echo -e "${GREEN}[SECURITY]${NC} $1"
}

print_error() {
    echo -e "${RED}[VULNERABILITY]${NC} $1" >&2
    VULNERABILITIES_FOUND=$((VULNERABILITIES_FOUND + 1))
    SECURITY_REPORT+="\n❌ $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    WARNINGS_COUNT=$((WARNINGS_COUNT + 1))
    SECURITY_REPORT+="\n⚠️  $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    SECURITY_REPORT+="\n✅ $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to check npm vulnerabilities
check_npm_vulnerabilities() {
    print_status "Checking npm dependencies for vulnerabilities..."
    
    cd "$PROJECT_ROOT"
    
    # Run npm audit
    if npm audit --production --audit-level="$AUDIT_LEVEL" --json > npm-audit-results.json 2>&1; then
        print_success "No npm vulnerabilities found at $AUDIT_LEVEL level"
    else
        local vulnerabilities=$(jq '.metadata.vulnerabilities' npm-audit-results.json)
        print_error "npm vulnerabilities found: $vulnerabilities"
        
        # Show details
        npm audit --production --audit-level="$AUDIT_LEVEL" || true
    fi
    
    # Check for outdated packages
    print_status "Checking for outdated packages..."
    if command -v npm-check-updates &> /dev/null; then
        npm-check-updates --dep prod || true
    fi
}

# Function to scan Docker image
check_docker_security() {
    print_status "Scanning Docker images for vulnerabilities..."
    
    local image_name="${IMAGE_NAME:-puppeteer-mcp}:${VERSION:-latest}"
    
    if ! docker image inspect "$image_name" &> /dev/null; then
        print_warning "Docker image $image_name not found, skipping scan"
        return
    fi
    
    # Scan with Trivy if available
    if command -v trivy &> /dev/null; then
        print_status "Running Trivy scan..."
        if trivy image --severity HIGH,CRITICAL --exit-code 1 "$image_name"; then
            print_success "No critical vulnerabilities in Docker image"
        else
            print_error "Critical vulnerabilities found in Docker image"
        fi
    fi
    
    # Check Dockerfile best practices
    if [ -f "$PROJECT_ROOT/Dockerfile" ]; then
        print_status "Checking Dockerfile best practices..."
        
        # Check for non-root user
        if grep -q "USER nodejs" "$PROJECT_ROOT/Dockerfile"; then
            print_success "Docker container runs as non-root user"
        else
            print_error "Docker container may run as root user"
        fi
        
        # Check for security updates
        if grep -q "apk upgrade" "$PROJECT_ROOT/Dockerfile"; then
            print_success "Docker image includes security updates"
        else
            print_warning "Docker image may not include latest security updates"
        fi
    fi
}

# Function to check source code security
check_source_code_security() {
    print_status "Scanning source code for security issues..."
    
    cd "$PROJECT_ROOT"
    
    # Check for hardcoded secrets
    print_status "Checking for hardcoded secrets..."
    local secret_patterns=(
        "password.*=.*['\"].*['\"]"
        "api[_-]?key.*=.*['\"].*['\"]"
        "secret.*=.*['\"].*['\"]"
        "token.*=.*['\"].*['\"]"
    )
    
    for pattern in "${secret_patterns[@]}"; do
        if grep -r -i "$pattern" src/ --include="*.ts" --include="*.js" 2>/dev/null | grep -v -E "(test|spec|mock)"; then
            print_error "Potential hardcoded secrets found"
        fi
    done
    
    # Check for NIST compliance tags
    print_status "Checking NIST compliance tags..."
    local nist_files=$(grep -r "@nist" src/ --include="*.ts" --include="*.js" 2>/dev/null | wc -l)
    if [ "$nist_files" -gt 0 ]; then
        print_success "Found $nist_files files with NIST compliance tags"
    else
        print_warning "No NIST compliance tags found in source code"
    fi
    
    # Check security headers implementation
    print_status "Checking security headers implementation..."
    if grep -r "helmet" src/ --include="*.ts" --include="*.js" &>/dev/null; then
        print_success "Security headers middleware (helmet) is implemented"
    else
        print_error "Security headers middleware not found"
    fi
    
    # Check authentication implementation
    if grep -r "jwt|JWT" src/ --include="*.ts" --include="*.js" &>/dev/null; then
        print_success "JWT authentication is implemented"
    else
        print_warning "JWT authentication implementation not found"
    fi
}

# Function to check deployed security
check_deployed_security() {
    if [ "$CHECK_DEPLOYED" != "--deployed" ]; then
        return
    fi
    
    print_status "Checking deployed application security..."
    
    local base_url="http://localhost:8443"
    
    # Check security headers
    print_status "Checking security headers..."
    if command -v curl &> /dev/null; then
        local headers=$(curl -s -I "$base_url/health" 2>/dev/null || echo "")
        
        # Check for important security headers
        local security_headers=(
            "X-Content-Type-Options"
            "X-Frame-Options"
            "X-XSS-Protection"
            "Strict-Transport-Security"
        )
        
        for header in "${security_headers[@]}"; do
            if echo "$headers" | grep -qi "$header"; then
                print_success "Security header present: $header"
            else
                print_error "Missing security header: $header"
            fi
        done
    fi
    
    # Check SSL/TLS configuration
    if command -v openssl &> /dev/null; then
        print_status "Checking TLS configuration..."
        # Note: This would need actual TLS endpoint
        print_info "TLS check skipped (requires HTTPS endpoint)"
    fi
}

# Function to check compliance
check_compliance() {
    print_status "Checking compliance requirements..."
    
    # Check for required documentation
    local required_docs=(
        "SECURITY.md"
        "LICENSE"
        ".github/SECURITY.md"
    )
    
    for doc in "${required_docs[@]}"; do
        if [ -f "$PROJECT_ROOT/$doc" ]; then
            print_success "Required documentation found: $doc"
        else
            print_warning "Missing documentation: $doc"
        fi
    done
    
    # Check for security policies
    if [ -f "$PROJECT_ROOT/.github/workflows/security.yml" ]; then
        print_success "Security scanning workflow is configured"
    else
        print_warning "Security scanning workflow not found"
    fi
}

# Function to generate security report
generate_security_report() {
    print_status "Generating security report..."
    
    local report_file="$PROJECT_ROOT/security-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" <<EOF
# Security Audit Report

Generated on: $(date)

## Summary

- Total Vulnerabilities: $VULNERABILITIES_FOUND
- Total Warnings: $WARNINGS_COUNT
- Audit Level: $AUDIT_LEVEL

## Detailed Results
$SECURITY_REPORT

## NIST Compliance

The following NIST controls are implemented:
- @nist ca-2 "Security Assessments" - This security audit
- @nist ra-5 "Vulnerability Scanning" - Automated vulnerability scanning
- @nist si-2 "Flaw Remediation" - Vulnerability patching process
- @nist si-3 "Malicious Code Protection" - Docker image scanning
- @nist cm-2 "Baseline Configuration" - Security baseline checks

## Recommendations

1. Address all critical vulnerabilities immediately
2. Review and fix security warnings
3. Ensure all security headers are properly configured
4. Keep dependencies up to date
5. Implement missing NIST controls

## Next Steps

1. Run \`npm audit fix\` to automatically fix vulnerabilities
2. Update Docker base images to latest versions
3. Review and update security policies
4. Schedule regular security audits

---
End of Report
EOF
    
    print_status "Security report saved to: $report_file"
}

# Main security check process
main() {
    print_status "Starting security audit..."
    print_info "Audit Level: $AUDIT_LEVEL"
    
    # Run security checks
    check_npm_vulnerabilities
    check_docker_security
    check_source_code_security
    check_deployed_security
    check_compliance
    
    # Generate report
    generate_security_report
    
    # Summary
    echo ""
    print_status "Security Audit Summary:"
    echo "  - Vulnerabilities Found: $VULNERABILITIES_FOUND"
    echo "  - Warnings: $WARNINGS_COUNT"
    
    # Exit with error if vulnerabilities found and fail flag is set
    if [ "$VULNERABILITIES_FOUND" -gt 0 ] && [ "$FAIL_ON_VULNERABILITY" = "true" ]; then
        print_error "Security audit failed with $VULNERABILITIES_FOUND vulnerabilities"
        exit 1
    else
        print_success "Security audit completed"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --audit-level)
            AUDIT_LEVEL="$2"
            shift 2
            ;;
        --no-fail)
            FAIL_ON_VULNERABILITY="false"
            shift
            ;;
        --deployed)
            CHECK_DEPLOYED="--deployed"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --audit-level LEVEL   Set npm audit level (low|moderate|high|critical)"
            echo "  --no-fail            Don't exit with error on vulnerabilities"
            echo "  --deployed           Also check deployed application security"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main