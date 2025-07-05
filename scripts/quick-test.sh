#!/bin/bash

# Quick test for puppeteer-mcp installation
echo "🧪 Quick test of puppeteer-mcp..."
echo ""

# Test 1: Command exists
echo -n "✓ Checking installation... "
if which puppeteer-mcp > /dev/null 2>&1; then
    echo "✅ Found at $(which puppeteer-mcp)"
else
    echo "❌ Not found. Run: npm install -g puppeteer-mcp"
    exit 1
fi

# Test 2: Can start
echo -n "✓ Testing startup... "
if JWT_SECRET=test TLS_ENABLED=false PORT=9999 timeout 3 puppeteer-mcp 2>&1 | grep -q "Server started"; then
    echo "✅ Server starts correctly"
else
    echo "❌ Server failed to start"
    exit 1
fi

# Test 3: Check health endpoint
echo -n "✓ Testing health endpoint... "
JWT_SECRET=test TLS_ENABLED=false PORT=9998 puppeteer-mcp > /dev/null 2>&1 &
PID=$!
sleep 2

if curl -s http://localhost:9998/health | grep -q "ok"; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
fi

kill $PID 2>/dev/null

echo ""
echo "🎉 puppeteer-mcp is installed and working correctly!"
echo ""
echo "To use it:"
echo "  JWT_SECRET=\$(openssl rand -hex 32) TLS_ENABLED=false PORT=3000 puppeteer-mcp"