#!/bin/bash

# CI-optimized test script
set -e

echo "🚀 Running CI-optimized tests..."

# Set environment variables for better CI performance
export NODE_ENV=test
export CI=true
export USE_DATA_URLS=true
export FORCE_COLOR=0
export NO_COLOR=1

# Reduce logging verbosity
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Run tests with optimized settings
npm test -- \
  --no-coverage \
  --maxWorkers=2 \
  --maxConcurrency=4 \
  --bail=1 \
  --verbose=false \
  --silent=true \
  --testTimeout=15000 \
  --forceExit

echo "✅ CI tests completed"
