# Comprehensive MCP Test Report

Generated: 2025-07-06T00:07:40.125Z Duration: 3071ms

## Test Phase Results

### ✅ mcpServerStartup

- Status: success
- Details: { "startupTime": 2006, "pid": 565559, "stderr":
  "{\"level\":\"info\",\"time\":\"2025-07-06T00:07:37.324Z\",\"pid\":565559,\"hostname\":\"framework\",\"name\":\"app\",\"environment\":\"development\",\"service\":\"puppeteer-mcp\",\"msg\":\"Starting
  MCP
  server\",\"transportType\":\"stdio\",\"timestamp\":\"2025-07-06T00:07:37.324Z\"}\n{\"level\":\"info\",\"time\":\"2025-07-06T00:07:37.327Z\",\"pid\":565559,\"hostname\":\"framework\",\"name\":\"app\",\"environment\":\"development\",\"service\":\"puppeteer-mcp\",\"msg\":\"MCP
  server started with stdio transport\",\"timestamp\":\"2025-07-06T00:07:37.327Z\"}\n" }

### ✅ protocolHandshake

- Status: success
- Details: { "handshakeTime": 8, "serverInfo": { "name": "puppeteer-mcp", "version": "0.1.0" },
  "protocolVersion": "2024-11-05", "capabilities": { "resources": {}, "tools": {}, "prompts": {} } }

### ✅ toolDiscovery

- Status: success
- Details: { "discoveryTime": 2, "totalTools": 6, "toolCategories": { "session": [ { "name":
  "create-session", "description": "Create a new session for API interactions", "inputSchema": {
  "type": "object", "properties": { "username": { "type": "string" }, "password": { "type": "string"
  }, "duration": { "type": "number", "description": "Session duration in seconds" } }, "required": [
  "username", "password" ] } }, { "name": "list-sessions", "description": "List active sessions",
  "inputSchema": { "type": "object", "properties": { "userId": { "type": "string" } } } }, { "name":
  "delete-session", "description": "Delete an active session", "inputSchema": { "type": "object",
  "properties": { "sessionId": { "type": "string", "description": "Session ID to delete" } },
  "required": [ "sessionId" ] } } ], "browser": [ { "name": "create-browser-context", "description":
  "Create a Puppeteer browser context", "inputSchema": { "type": "object", "properties": {
  "sessionId": { "type": "string" }, "options": { "type": "object", "properties": { "headless": {
  "type": "boolean" }, "viewport": { "type": "object", "properties": { "width": { "type": "number"
  }, "height": { "type": "number" } } } } } }, "required": [ "sessionId" ] } }, { "name":
  "execute-in-context", "description": "Execute commands in a browser context", "inputSchema": {
  "type": "object", "properties": { "contextId": { "type": "string", "description": "Context ID to
  execute command in" }, "command": { "type": "string", "description": "Command to execute" },
  "parameters": { "type": "object", "description": "Parameters for the command" } }, "required": [
  "contextId", "command" ] } } ], "api": [ { "name": "execute-api", "description": "Execute API
  calls across REST, gRPC, or WebSocket protocols", "inputSchema": { "type": "object", "properties":
  { "protocol": { "type": "string", "enum": [ "rest", "grpc", "websocket" ], "description":
  "Protocol to use" }, "operation": { "type": "object", "description": "Protocol-specific operation
  details" }, "auth": { "type": "object", "properties": { "type": { "type": "string", "enum": [
  "jwt", "apikey", "session" ] }, "credentials": { "type": "string" } } } }, "required": [
  "protocol", "operation" ] } } ], "other": [] }, "tools": [ { "name": "execute-api", "description":
  "Execute API calls across REST, gRPC, or WebSocket protocols", "inputSchema": { "type": "object",
  "properties": { "protocol": { "type": "string", "enum": [ "rest", "grpc", "websocket" ],
  "description": "Protocol to use" }, "operation": { "type": "object", "description":
  "Protocol-specific operation details" }, "auth": { "type": "object", "properties": { "type": {
  "type": "string", "enum": [ "jwt", "apikey", "session" ] }, "credentials": { "type": "string" } }
  } }, "required": [ "protocol", "operation" ] } }, { "name": "create-session", "description":
  "Create a new session for API interactions", "inputSchema": { "type": "object", "properties": {
  "username": { "type": "string" }, "password": { "type": "string" }, "duration": { "type":
  "number", "description": "Session duration in seconds" } }, "required": [ "username", "password" ]
  } }, { "name": "list-sessions", "description": "List active sessions", "inputSchema": { "type":
  "object", "properties": { "userId": { "type": "string" } } } }, { "name": "delete-session",
  "description": "Delete an active session", "inputSchema": { "type": "object", "properties": {
  "sessionId": { "type": "string", "description": "Session ID to delete" } }, "required": [
  "sessionId" ] } }, { "name": "create-browser-context", "description": "Create a Puppeteer browser
  context", "inputSchema": { "type": "object", "properties": { "sessionId": { "type": "string" },
  "options": { "type": "object", "properties": { "headless": { "type": "boolean" }, "viewport": {
  "type": "object", "properties": { "width": { "type": "number" }, "height": { "type": "number" } }
  } } } }, "required": [ "sessionId" ] } }, { "name": "execute-in-context", "description": "Execute
  commands in a browser context", "inputSchema": { "type": "object", "properties": { "contextId": {
  "type": "string", "description": "Context ID to execute command in" }, "command": { "type":
  "string", "description": "Command to execute" }, "parameters": { "type": "object", "description":
  "Parameters for the command" } }, "required": [ "contextId", "command" ] } } ], "resources": [ {
  "uri": "api://catalog", "name": "API Catalog", "description": "Complete catalog of available
  APIs", "mimeType": "application/json" }, { "uri": "api://health", "name": "System Health",
  "description": "Current system health and status", "mimeType": "application/json" } ] }

### ✅ sessionManagement

- Status: success
- Details: { "operationTime": 43, "sessionId": "32cbd7b0-d8dd-45b9-bdcf-72ee0f69ab43",
  "sessionData": { "sessionId": "32cbd7b0-d8dd-45b9-bdcf-72ee0f69ab43", "userId": "user-demo-001",
  "username": "demo", "roles": [ "user" ], "createdAt": "2025-07-06T00:07:39.110Z", "expiresAt":
  "2025-07-06T01:07:39.110Z", "tokens": { "accessToken":
  "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWRlbW8tMDAxIiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZXMiOlsidXNlciJdLCJzZXNzaW9uSWQiOiIzMmNiZDdiMC1kOGRkLTQ1YjktYmRjZi03MmVlMGY2OWFiNDMiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzUxNzYwNDU5LCJleHAiOjE3NTE4NDY4NTl9.\_AMs3zqy98ZjcxLOwoGYsWu5RabaqEMkH3manmLf-EyfwxrxE06CN16DD0taA-1A6um41rCr6f-2lODXrbgTcQ",
  "refreshToken":
  "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWRlbW8tMDAxIiwidXNlcm5hbWUiOiJkZW1vIiwicm9sZXMiOlsidXNlciJdLCJzZXNzaW9uSWQiOiIzMmNiZDdiMC1kOGRkLTQ1YjktYmRjZi03MmVlMGY2OWFiNDMiLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTc1MTc2MDQ1OSwiZXhwIjoxNzUyMzY1MjU5fQ.bfvlWXMn1w7jXEHeabHU1nD6h13V9G6lMG9qXqK5pvaCgcSMgffJAmCEFO4QY7UcHhRRKdrQ3W5y4NI5oBbQRA",
  "expiresIn": 86400 } }, "activeSessions": 1 }

### ❌ browserAutomation

- Status: failed
- Details: { "error": "MCP error: MCP error -32600: REST adapter not initialized. Express app
  required." }

### ⏳ contextManagement

- Status: pending
- Details: {}

### ⏳ resourceAccess

- Status: pending
- Details: {}

## Statistics

- Total MCP Messages: 19
- Average Message Latency: 6.22ms
- Successful Phases: 4
- Failed Phases: 1
- Skipped Phases: 0

## Artifacts

- Screenshots: 0
- HTML Content Files: 0

## Errors

1. [2025-07-06T00:07:39.116Z] browserAutomation: Browser automation test failed: MCP error: MCP
   error -32600: REST adapter not initialized. Express app required.
2. [2025-07-06T00:07:39.116Z] General: Test suite failed: MCP error: MCP error -32600: REST adapter
   not initialized. Express app required.

## Warnings

1. [2025-07-06T00:07:39.119Z] General: Failed to close browser context: MCP error: MCP error -32600:
   REST adapter not initialized. Express app required.
