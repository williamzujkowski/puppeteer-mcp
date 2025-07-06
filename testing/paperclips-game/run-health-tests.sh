#!/bin/bash

# Browser Pool Health Monitoring Test Runner
# Runs all health monitoring tests and collects results

echo "🚀 Browser Pool Health Monitoring Test Suite"
echo "=========================================="
echo "Time: $(date)"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results directory
RESULTS_DIR="./test-results-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

# Check if server is running
check_server() {
    echo -n "Checking if puppeteer-mcp server is running... "
    if curl -s -H "x-api-key: test-api-key" http://localhost:3000/health > /dev/null; then
        echo -e "${GREEN}✓ Server is running${NC}"
        return 0
    else
        echo -e "${RED}✗ Server is not running${NC}"
        echo ""
        echo "Please start the server first:"
        echo "  cd /home/william/git/puppeteer-mcp"
        echo "  npm run dev"
        echo ""
        return 1
    fi
}

# Function to run a test
run_test() {
    local test_name=$1
    local test_file=$2
    local output_file="$RESULTS_DIR/${test_name}.log"
    
    echo ""
    echo -e "${YELLOW}Running: $test_name${NC}"
    echo "Output: $output_file"
    
    # Compile and run the test
    npx tsx "$test_file" > "$output_file" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Test completed successfully${NC}"
        # Extract key metrics
        grep -E "(PASSED|FAILED|Success Rate:|Average Test Duration:)" "$output_file" | tail -5
    else
        echo -e "${RED}✗ Test failed${NC}"
        tail -10 "$output_file"
    fi
}

# Check if TypeScript is installed
check_typescript() {
    echo -n "Checking TypeScript setup... "
    if command -v npx > /dev/null && npx tsx --version > /dev/null 2>&1; then
        echo -e "${GREEN}✓ TypeScript runtime available${NC}"
        return 0
    else
        echo -e "${RED}✗ TypeScript runtime not found${NC}"
        echo "Installing tsx..."
        npm install -D tsx
    fi
}

# Main execution
main() {
    echo "📋 Pre-flight checks"
    echo "==================="
    
    # Check server
    if ! check_server; then
        exit 1
    fi
    
    # Check TypeScript
    check_typescript
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install axios
    fi
    
    echo ""
    echo "🧪 Running Health Monitoring Tests"
    echo "================================="
    
    # Run main health monitoring tests
    run_test "health-monitoring" "browser-pool-health-test.ts"
    
    # Wait a bit between test suites
    sleep 5
    
    # Run crash simulation tests
    run_test "crash-simulation" "browser-crash-simulation.ts"
    
    # Generate summary report
    echo ""
    echo "📊 Test Summary Report"
    echo "===================="
    echo "Results saved to: $RESULTS_DIR"
    echo ""
    
    # Count passed/failed tests from logs
    TOTAL_PASSED=$(grep -h "✅" "$RESULTS_DIR"/*.log | wc -l)
    TOTAL_FAILED=$(grep -h "❌" "$RESULTS_DIR"/*.log | wc -l)
    TOTAL_TESTS=$((TOTAL_PASSED + TOTAL_FAILED))
    
    echo "Total Tests Run: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$TOTAL_PASSED${NC}"
    echo -e "Failed: ${RED}$TOTAL_FAILED${NC}"
    
    if [ $TOTAL_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    else
        echo -e "\n${RED}⚠️  Some tests failed. Check logs for details.${NC}"
    fi
    
    # Create a summary file
    cat > "$RESULTS_DIR/summary.txt" << EOF
Browser Pool Health Monitoring Test Results
==========================================
Date: $(date)
Total Tests: $TOTAL_TESTS
Passed: $TOTAL_PASSED
Failed: $TOTAL_FAILED
Success Rate: $(echo "scale=1; $TOTAL_PASSED * 100 / $TOTAL_TESTS" | bc)%

Test Files:
- browser-pool-health-test.ts: Main health monitoring tests
- browser-crash-simulation.ts: Crash recovery tests

Key Features Tested:
✓ Browser health monitoring
✓ Automatic crash recovery
✓ Memory leak prevention
✓ Pool capacity management
✓ Idle browser cleanup
✓ Health metrics accuracy
✓ Process crash recovery
✓ Unresponsive browser handling
EOF
    
    echo ""
    echo "Summary saved to: $RESULTS_DIR/summary.txt"
}

# Run main function
main

# Exit with appropriate code
if [ $TOTAL_FAILED -eq 0 ]; then
    exit 0
else
    exit 1
fi