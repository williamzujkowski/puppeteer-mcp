#!/bin/bash

# Fix all test files to use the correct session endpoint

echo "Fixing session endpoints in all test files..."

# Array of test files
test_files=(
  "test-invalid-urls.js"
  "test-timeout-scenarios.js"
  "test-network-errors.js"
  "test-javascript-errors.js"
  "test-invalid-selectors.js"
  "test-concurrent-operations.js"
)

# Fix each file
for file in "${test_files[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."
    
    # Replace the session endpoint
    sed -i 's|${API_BASE}/sessions|${API_BASE}/v1/sessions/dev-create|g' "$file"
    
    # Update the response handling to use the correct data structure
    sed -i 's|return response\.data\.data\.id;|// Store the token for later use\n    if (response.data.data?.tokens?.accessToken) {\n      process.env.API_TOKEN = response.data.data.tokens.accessToken;\n    }\n    return response.data.data.sessionId;|g' "$file"
    
    # Remove unnecessary request body
    sed -i 's|{ name: '\''[^'\'']*'\'' }|{}|g' "$file"
    
    echo "✓ Fixed $file"
  else
    echo "✗ File not found: $file"
  fi
done

echo "All files fixed!"