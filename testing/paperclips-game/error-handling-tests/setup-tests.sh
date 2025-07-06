#!/bin/bash
# Setup script for error handling tests

echo "Setting up error handling tests..."

# Make test runner executable
chmod +x run-all-error-tests.js

# Create results directory
mkdir -p results

# Generate test token if needed
if [ -z "$API_TOKEN" ]; then
  echo "Generating test token..."
  export API_TOKEN=$(node ../generate-token.js 2>/dev/null || echo "test-token")
  echo "Using token: $API_TOKEN"
fi

# Check if server is running
if ! curl -s http://localhost:3000/health > /dev/null; then
  echo "❌ Error: Puppeteer-MCP server is not running"
  echo "Please start the server with: npm run dev"
  exit 1
fi

echo "✅ Setup complete. Run tests with: ./run-all-error-tests.js"