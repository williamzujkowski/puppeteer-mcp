#!/bin/bash

# Fix API port in all test files

echo "Fixing API port in all test files..."

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
    
    # Replace the API_BASE default port
    sed -i 's|http://localhost:3000/api|http://localhost:8443/api|g' "$file"
    
    echo "✓ Fixed $file"
  else
    echo "✗ File not found: $file"
  fi
done

echo "All files fixed!"