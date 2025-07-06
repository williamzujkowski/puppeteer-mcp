#!/bin/bash

# Performance Test Runner Script
# Runs comprehensive performance tests for puppeteer-mcp

set -e

echo "🚀 puppeteer-mcp Performance Test Suite"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${2}${1}${NC}"
}

# Function to check if puppeteer-mcp server is running
check_server() {
    print_status "Checking if puppeteer-mcp server is running..." $BLUE
    
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:8443/health" | grep -q "200"; then
        print_status "✅ Server is running and responsive" $GREEN
        return 0
    else
        print_status "❌ Server is not running or not responsive" $RED
        return 1
    fi
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..." $BLUE
    
    if [ ! -d "node_modules" ]; then
        npm install
    else
        print_status "✅ Dependencies already installed" $GREEN
    fi
}

# Function to create results directory
create_results_dir() {
    print_status "Creating results directory..." $BLUE
    mkdir -p results
    print_status "✅ Results directory ready" $GREEN
}

# Function to run individual test
run_test() {
    local test_name=$1
    local test_file=$2
    local test_args=$3
    
    print_status "Running ${test_name}..." $BLUE
    
    if tsx "$test_file" $test_args; then
        print_status "✅ ${test_name} completed successfully" $GREEN
        return 0
    else
        print_status "❌ ${test_name} failed" $RED
        return 1
    fi
}

# Function to run all tests
run_all_tests() {
    local failed_tests=()
    
    print_status "Starting performance test suite..." $YELLOW
    
    # Test 1: Concurrent Session Test
    if ! run_test "Concurrent Session Test" "concurrent-session-test.ts" "8"; then
        failed_tests+=("Concurrent Session Test")
    fi
    
    echo ""
    
    # Test 2: Scalability Test
    if ! run_test "Scalability Test" "scalability-test.ts"; then
        failed_tests+=("Scalability Test")
    fi
    
    echo ""
    
    # Test 3: Resource Monitoring Test
    if ! run_test "Resource Monitoring Test" "resource-monitoring-test.ts" "5 60000"; then
        failed_tests+=("Resource Monitoring Test")
    fi
    
    echo ""
    
    # Test 4: Stress Test
    print_status "⚠️  Starting Stress Test - This may push the system to its limits" $YELLOW
    if ! run_test "Stress Test" "stress-test.ts"; then
        failed_tests+=("Stress Test")
    fi
    
    echo ""
    
    # Test 5: Comprehensive Test
    if ! run_test "Comprehensive Performance Test" "comprehensive-performance-test.ts"; then
        failed_tests+=("Comprehensive Performance Test")
    fi
    
    # Report results
    echo ""
    print_status "Performance Test Suite Results:" $YELLOW
    echo "================================"
    
    if [ ${#failed_tests[@]} -eq 0 ]; then
        print_status "🎉 All tests completed successfully!" $GREEN
        return 0
    else
        print_status "❌ ${#failed_tests[@]} test(s) failed:" $RED
        for test in "${failed_tests[@]}"; do
            echo "  - $test"
        done
        return 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [test_type] [args...]"
    echo ""
    echo "Available test types:"
    echo "  concurrent [sessions]     - Test concurrent session handling"
    echo "  scalability              - Test system scalability limits"
    echo "  stress                   - Test system under extreme stress"
    echo "  resource [sessions] [duration] - Monitor resource usage"
    echo "  comprehensive            - Run complete test suite"
    echo "  all                      - Run all tests sequentially"
    echo ""
    echo "Examples:"
    echo "  $0 concurrent 10         - Test with 10 concurrent sessions"
    echo "  $0 scalability           - Run scalability analysis"
    echo "  $0 resource 5 120000     - Monitor 5 sessions for 2 minutes"
    echo "  $0 comprehensive         - Run comprehensive test suite"
    echo "  $0 all                   - Run all tests"
}

# Function to show system requirements
show_requirements() {
    print_status "System Requirements:" $BLUE
    echo "- Node.js 20.0.0 or higher"
    echo "- puppeteer-mcp server running on localhost:8443"
    echo "- At least 2GB RAM available"
    echo "- At least 2 CPU cores recommended"
    echo ""
    print_status "Current System:" $BLUE
    echo "- Node.js version: $(node --version)"
    echo "- Available memory: $(free -h | awk '/^Mem:/ { print $2 }' 2>/dev/null || echo 'N/A')"
    echo "- CPU cores: $(nproc 2>/dev/null || echo 'N/A')"
}

# Main execution
main() {
    local test_type=${1:-"help"}
    
    case $test_type in
        "concurrent")
            check_server && install_dependencies && create_results_dir
            run_test "Concurrent Session Test" "concurrent-session-test.ts" "${2:-8}"
            ;;
        "scalability")
            check_server && install_dependencies && create_results_dir
            run_test "Scalability Test" "scalability-test.ts"
            ;;
        "stress")
            check_server && install_dependencies && create_results_dir
            print_status "⚠️  Starting Stress Test - This may push the system to its limits" $YELLOW
            run_test "Stress Test" "stress-test.ts"
            ;;
        "resource")
            check_server && install_dependencies && create_results_dir
            run_test "Resource Monitoring Test" "resource-monitoring-test.ts" "${2:-5} ${3:-60000}"
            ;;
        "comprehensive")
            check_server && install_dependencies && create_results_dir
            run_test "Comprehensive Performance Test" "comprehensive-performance-test.ts"
            ;;
        "all")
            check_server && install_dependencies && create_results_dir
            run_all_tests
            ;;
        "requirements")
            show_requirements
            ;;
        "help"|*)
            show_usage
            ;;
    esac
}

# Check if server is running before starting
if [ "$1" != "help" ] && [ "$1" != "requirements" ] && [ "$1" != "" ]; then
    print_status "Checking prerequisites..." $BLUE
    
    # Check if tsx is available
    if ! command -v tsx &> /dev/null; then
        print_status "❌ tsx not found. Installing dependencies..." $YELLOW
        npm install
    fi
    
    # Check server connectivity
    if ! check_server; then
        print_status "❌ Cannot connect to puppeteer-mcp server" $RED
        print_status "Please make sure the server is running on localhost:8443" $YELLOW
        print_status "You can start it with: npm run dev" $YELLOW
        exit 1
    fi
fi

# Run main function
main "$@"