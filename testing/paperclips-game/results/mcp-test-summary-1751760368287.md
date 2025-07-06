# Comprehensive MCP Test Report

Generated: 2025-07-06T00:06:08.287Z
Duration: 3012ms

## Test Phase Results

### ❌ mcpServerStartup
- Status: failed
- Details: {
  "error": "MCP process exited with code 1\nstderr: Configuration validation failed: [\n  {\n    \"code\": \"too_small\",\n    \"minimum\": 32,\n    \"type\": \"string\",\n    \"inclusive\": true,\n    \"exact\": false,\n    \"message\": \"String must contain at least 32 character(s)\",\n    \"path\": [\n      \"JWT_SECRET\"\n    ]\n  }\n]\nfile:///home/william/git/puppeteer-mcp/dist/core/config.js:237\n        throw new Error('Invalid configuration');\n              ^\n\nError: Invalid configuration\n    at parseConfig (file:///home/william/git/puppeteer-mcp/dist/core/config.js:237:15)\n    at file:///home/william/git/puppeteer-mcp/dist/core/config.js:240:23\n    at ModuleJob.run (node:internal/modules/esm/module_job:273:25)\n    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:600:26)\n    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:98:5)\n\nNode.js v23.9.0\n"
}

### ⏳ protocolHandshake
- Status: pending
- Details: {}

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

- Total MCP Messages: 0
- Average Message Latency: 0.00ms
- Successful Phases: 0
- Failed Phases: 1
- Skipped Phases: 0

## Artifacts

- Screenshots: 0
- HTML Content Files: 0

## Errors

1. [2025-07-06T00:06:07.283Z] mcpServerStartup: MCP server startup failed: MCP process exited with code 1
stderr: Configuration validation failed: [
  {
    "code": "too_small",
    "minimum": 32,
    "type": "string",
    "inclusive": true,
    "exact": false,
    "message": "String must contain at least 32 character(s)",
    "path": [
      "JWT_SECRET"
    ]
  }
]
file:///home/william/git/puppeteer-mcp/dist/core/config.js:237
        throw new Error('Invalid configuration');
              ^

Error: Invalid configuration
    at parseConfig (file:///home/william/git/puppeteer-mcp/dist/core/config.js:237:15)
    at file:///home/william/git/puppeteer-mcp/dist/core/config.js:240:23
    at ModuleJob.run (node:internal/modules/esm/module_job:273:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:600:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:98:5)

Node.js v23.9.0

2. [2025-07-06T00:06:07.283Z] General: Test suite failed: MCP process exited with code 1
stderr: Configuration validation failed: [
  {
    "code": "too_small",
    "minimum": 32,
    "type": "string",
    "inclusive": true,
    "exact": false,
    "message": "String must contain at least 32 character(s)",
    "path": [
      "JWT_SECRET"
    ]
  }
]
file:///home/william/git/puppeteer-mcp/dist/core/config.js:237
        throw new Error('Invalid configuration');
              ^

Error: Invalid configuration
    at parseConfig (file:///home/william/git/puppeteer-mcp/dist/core/config.js:237:15)
    at file:///home/william/git/puppeteer-mcp/dist/core/config.js:240:23
    at ModuleJob.run (node:internal/modules/esm/module_job:273:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:600:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:98:5)

Node.js v23.9.0
