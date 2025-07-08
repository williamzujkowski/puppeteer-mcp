# Post-Installation Tests for puppeteer-mcp

After installing puppeteer-mcp globally via npm, run these tests to verify everything is working
correctly.

## 1. Basic Installation Check

```bash
# Check if the command is available
which puppeteer-mcp

# Check the installed version
npm list -g puppeteer-mcp
```

## 2. Start Server Test

```bash
# Test 1: Basic startup with minimal config
JWT_SECRET=test123 TLS_ENABLED=false PORT=3001 puppeteer-mcp &
SERVER_PID=$!
sleep 3

# Check if server is running
ps -p $SERVER_PID > /dev/null && echo "✓ Server started successfully" || echo "✗ Server failed to start"

# Kill the test server
kill $SERVER_PID
```

## 3. Health Check Test

```bash
# Start server in background
JWT_SECRET=test123 TLS_ENABLED=false PORT=3001 puppeteer-mcp &
SERVER_PID=$!
sleep 3

# Test health endpoint
curl -s http://localhost:3001/health | grep -q "ok" && echo "✓ Health check passed" || echo "✗ Health check failed"

# Kill the server
kill $SERVER_PID
```

## 4. Port Conflict Test

```bash
# Start first instance
JWT_SECRET=test123 TLS_ENABLED=false PORT=3002 puppeteer-mcp &
PID1=$!
sleep 2

# Try to start second instance on same port (should fail with helpful error)
JWT_SECRET=test123 TLS_ENABLED=false PORT=3002 puppeteer-mcp 2>&1 | grep -q "already in use" && echo "✓ Port conflict detected correctly" || echo "✗ Port conflict detection failed"

# Cleanup
kill $PID1 2>/dev/null
```

## 5. MCP Protocol Test

```bash
# Test MCP over stdio (should respond to initialization)
echo '{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{}},"id":1}' | JWT_SECRET=test123 TLS_ENABLED=false puppeteer-mcp 2>/dev/null | grep -q "result" && echo "✓ MCP protocol responds" || echo "✗ MCP protocol failed"
```

## 6. Environment Variable Tests

```bash
# Test missing JWT_SECRET (should generate one in dev mode)
TLS_ENABLED=false PORT=3003 NODE_ENV=development puppeteer-mcp &
PID=$!
sleep 2
ps -p $PID > /dev/null && echo "✓ Runs without JWT_SECRET in dev mode" || echo "✗ Failed without JWT_SECRET"
kill $PID 2>/dev/null

# Test with custom log level
JWT_SECRET=test123 TLS_ENABLED=false PORT=3004 LOG_LEVEL=debug puppeteer-mcp 2>&1 | head -5 | grep -q "debug" && echo "✓ Log level configuration works" || echo "✗ Log level configuration failed"
```

## 7. API Endpoints Test

```bash
# Start server
JWT_SECRET=test123 TLS_ENABLED=false PORT=3005 puppeteer-mcp &
SERVER_PID=$!
sleep 3

# Test various endpoints
ENDPOINTS=(
  "http://localhost:3005/health"
  "http://localhost:3005/api/v1/sessions"
  "http://localhost:3005/api/v1/contexts"
)

for endpoint in "${ENDPOINTS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $endpoint)
  if [[ $STATUS -eq 200 ]] || [[ $STATUS -eq 401 ]] || [[ $STATUS -eq 404 ]]; then
    echo "✓ Endpoint $endpoint responding (HTTP $STATUS)"
  else
    echo "✗ Endpoint $endpoint failed (HTTP $STATUS)"
  fi
done

# Cleanup
kill $SERVER_PID
```

## 8. Graceful Shutdown Test

```bash
# Start server
JWT_SECRET=test123 TLS_ENABLED=false PORT=3006 puppeteer-mcp &
SERVER_PID=$!
sleep 2

# Send SIGTERM for graceful shutdown
kill -TERM $SERVER_PID
sleep 2

# Check if process terminated cleanly
ps -p $SERVER_PID > /dev/null && echo "✗ Graceful shutdown failed" || echo "✓ Graceful shutdown successful"
```

## 9. File Path Resolution Test

```bash
# Test from different directory (should still find proto files)
cd /tmp
JWT_SECRET=test123 TLS_ENABLED=false PORT=3007 puppeteer-mcp &
SERVER_PID=$!
sleep 3

# Check if gRPC server started (would fail if proto files not found)
ps -p $SERVER_PID > /dev/null && echo "✓ File paths resolved correctly" || echo "✗ File path resolution failed"

# Cleanup
kill $SERVER_PID 2>/dev/null
cd -
```

## 10. Comprehensive Integration Test

```bash
#!/bin/bash
# Save this as test-puppeteer-mcp.sh and run it

echo "Running puppeteer-mcp installation tests..."
FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_cmd=$2

    echo -n "Testing $test_name... "
    if eval "$test_cmd" > /dev/null 2>&1; then
        echo "✓ PASSED"
    else
        echo "✗ FAILED"
        FAILED=$((FAILED + 1))
    fi
}

# Run all tests
run_test "command availability" "which puppeteer-mcp"
run_test "help output" "puppeteer-mcp --help 2>&1 | grep -q puppeteer"

# Start a test server for remaining tests
JWT_SECRET=test123 TLS_ENABLED=false PORT=3008 puppeteer-mcp > /tmp/puppeteer-test.log 2>&1 &
TEST_PID=$!
sleep 3

run_test "server startup" "ps -p $TEST_PID"
run_test "health endpoint" "curl -s http://localhost:3008/health | grep -q ok"
run_test "log output" "grep -q 'Server started' /tmp/puppeteer-test.log"

# Cleanup
kill $TEST_PID 2>/dev/null
rm -f /tmp/puppeteer-test.log

# Report
echo ""
if [ $FAILED -eq 0 ]; then
    echo "✅ All tests passed! puppeteer-mcp is installed correctly."
else
    echo "❌ $FAILED tests failed. Please check the installation."
fi
```

## Quick Test Command

For a quick verification, run this one-liner:

```bash
# Quick test that server starts and responds
JWT_SECRET=test TLS_ENABLED=false PORT=3009 timeout 5 puppeteer-mcp 2>&1 | grep -q "Server started" && echo "✅ puppeteer-mcp is working!" || echo "❌ Something went wrong"
```

## Expected Results

When all tests pass, you should see:

- ✓ Server starts without errors
- ✓ Health endpoint responds
- ✓ Proper error messages for port conflicts
- ✓ MCP protocol responds to initialization
- ✓ Graceful shutdown works
- ✓ File paths resolve correctly from any directory

## Troubleshooting

If tests fail:

1. **Check Node.js version**: `node --version` (should be 18+ for ES modules)
2. **Check npm global path**: `npm config get prefix`
3. **Check installation**: `npm list -g puppeteer-mcp`
4. **Check for errors**: `npm install -g puppeteer-mcp --verbose`
5. **Check permissions**: Ensure you have write access to npm's global directory

## Testing with MCP Clients

To test with Claude Desktop or other MCP clients:

1. Add to your MCP client configuration:

```json
{
  "puppeteer": {
    "command": "puppeteer-mcp",
    "env": {
      "JWT_SECRET": "your-secret-key",
      "TLS_ENABLED": "false"
    }
  }
}
```

2. Restart your MCP client and check if the puppeteer tools are available.
