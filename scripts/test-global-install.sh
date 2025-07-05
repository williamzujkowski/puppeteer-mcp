#!/bin/bash

# Test script for puppeteer-mcp global installation
# Usage: ./test-global-install.sh

set -e

echo "🧪 Testing puppeteer-mcp global installation..."
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_case() {
    local name="$1"
    local command="$2"
    local expected="$3"
    
    echo -n "📋 $name... "
    
    if eval "$command" > /tmp/test-output.log 2>&1; then
        if [[ -z "$expected" ]] || grep -q "$expected" /tmp/test-output.log; then
            echo -e "${GREEN}✓ PASSED${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}✗ FAILED${NC} (expected output not found)"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (command failed)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Clean up any existing processes
echo "🧹 Cleaning up any existing processes..."
pkill -f puppeteer-mcp 2>/dev/null || true
sleep 1

# Test 1: Check installation
test_case "Check if puppeteer-mcp is installed" "which puppeteer-mcp" ""

# Test 2: Check version
test_case "Check npm package version" "npm list -g puppeteer-mcp" "puppeteer-mcp"

# Test 3: Basic startup
echo ""
echo "🚀 Testing server startup..."
JWT_SECRET=test123 TLS_ENABLED=false PORT=4001 timeout 5 puppeteer-mcp > /tmp/server-log.log 2>&1 || true
test_case "Server starts without errors" "grep -E '(Server started|gRPC server started)' /tmp/server-log.log" "started"

# Test 4: Port conflict handling
echo ""
echo "🔌 Testing port conflict handling..."
JWT_SECRET=test123 TLS_ENABLED=false PORT=4002 puppeteer-mcp > /tmp/server1.log 2>&1 &
PID1=$!
sleep 2

JWT_SECRET=test123 TLS_ENABLED=false PORT=4002 timeout 3 puppeteer-mcp > /tmp/server2.log 2>&1 || true
test_case "Port conflict detection" "grep -i 'already in use' /tmp/server2.log" "already in use"
kill $PID1 2>/dev/null || true

# Test 5: Health endpoint
echo ""
echo "🏥 Testing health endpoint..."
JWT_SECRET=test123 TLS_ENABLED=false PORT=4003 puppeteer-mcp &
PID=$!
sleep 3

test_case "Health endpoint responds" "curl -s http://localhost:4003/health" '{"status":"ok"'
kill $PID 2>/dev/null || true

# Test 6: MCP protocol
echo ""
echo "🔧 Testing MCP protocol..."
RESPONSE=$(echo '{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{}},"id":1}' | JWT_SECRET=test123 TLS_ENABLED=false timeout 3 puppeteer-mcp 2>/dev/null || true)
test_case "MCP protocol responds" "echo '$RESPONSE' | grep -q 'result' && echo 'found'" "found"

# Test 7: Environment variables
echo ""
echo "🔐 Testing environment variables..."
test_case "Missing JWT_SECRET in dev mode" "TLS_ENABLED=false PORT=4004 NODE_ENV=development timeout 3 puppeteer-mcp 2>&1 | grep -E '(JWT_SECRET|started)'" ""

# Test 8: Graceful shutdown
echo ""
echo "🛑 Testing graceful shutdown..."
JWT_SECRET=test123 TLS_ENABLED=false PORT=4005 puppeteer-mcp &
PID=$!
sleep 2
kill -TERM $PID
sleep 1
test_case "Graceful shutdown" "! ps -p $PID > /dev/null && echo 'terminated'" "terminated"

# Test 9: File resolution from different directory
echo ""
echo "📁 Testing file resolution..."
CURRENT_DIR=$(pwd)
cd /tmp
JWT_SECRET=test123 TLS_ENABLED=false PORT=4006 timeout 5 puppeteer-mcp > /tmp/file-test.log 2>&1 || true
cd "$CURRENT_DIR"
test_case "Proto files found from /tmp" "grep -v 'no such file' /tmp/file-test.log | grep -E '(gRPC|started)'" ""

# Cleanup
echo ""
echo "🧹 Cleaning up..."
pkill -f puppeteer-mcp 2>/dev/null || true
rm -f /tmp/test-output.log /tmp/server*.log /tmp/file-test.log

# Summary
echo ""
echo "============================================="
echo "📊 Test Summary:"
echo -e "   Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "   Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! puppeteer-mcp is working correctly.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please check the installation.${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Check Node.js version: node --version (should be 18+)"
    echo "2. Reinstall: npm uninstall -g puppeteer-mcp && npm install -g puppeteer-mcp"
    echo "3. Check npm prefix: npm config get prefix"
    echo "4. Check PATH: echo \$PATH (should include npm's bin directory)"
    exit 1
fi