# Comprehensive MCP Test Report

Generated: 2025-07-06T00:06:22.223Z
Duration: 3018ms

## Test Phase Results

### ✅ mcpServerStartup
- Status: success
- Details: {
  "startupTime": 2005,
  "pid": 565339,
  "stderr": "{\"level\":\"info\",\"time\":\"2025-07-06T00:06:19.487Z\",\"pid\":565339,\"hostname\":\"framework\",\"name\":\"app\",\"environment\":\"development\",\"service\":\"puppeteer-mcp\",\"msg\":\"Starting MCP server\",\"transportType\":\"stdio\",\"timestamp\":\"2025-07-06T00:06:19.487Z\"}\n{\"level\":\"info\",\"time\":\"2025-07-06T00:06:19.488Z\",\"pid\":565339,\"hostname\":\"framework\",\"name\":\"app\",\"environment\":\"development\",\"service\":\"puppeteer-mcp\",\"msg\":\"MCP server started with stdio transport\",\"timestamp\":\"2025-07-06T00:06:19.488Z\"}\n"
}

### ❌ protocolHandshake
- Status: failed
- Details: {
  "error": "MCP error: Method not found"
}

### ⏳ toolDiscovery
- Status: pending
- Details: {}

### ⏳ sessionManagement
- Status: pending
- Details: {}

### ⏳ browserAutomation
- Status: pending
- Details: {}

### ⏳ contextManagement
- Status: pending
- Details: {}

### ⏳ resourceAccess
- Status: pending
- Details: {}


## Statistics

- Total MCP Messages: 4
- Average Message Latency: 4.00ms
- Successful Phases: 1
- Failed Phases: 1
- Skipped Phases: 0

## Artifacts

- Screenshots: 0
- HTML Content Files: 0

## Errors

1. [2025-07-06T00:06:21.220Z] protocolHandshake: Protocol handshake failed: MCP error: Method not found
2. [2025-07-06T00:06:21.220Z] General: Test suite failed: MCP error: Method not found