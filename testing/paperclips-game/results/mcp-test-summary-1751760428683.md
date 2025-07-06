# Comprehensive MCP Test Report

Generated: 2025-07-06T00:07:08.684Z
Duration: 3032ms

## Test Phase Results

### ✅ mcpServerStartup
- Status: success
- Details: {
  "startupTime": 2004,
  "pid": 565464,
  "stderr": "{\"level\":\"info\",\"time\":\"2025-07-06T00:07:05.919Z\",\"pid\":565464,\"hostname\":\"framework\",\"name\":\"app\",\"environment\":\"development\",\"service\":\"puppeteer-mcp\",\"msg\":\"Starting MCP server\",\"transportType\":\"stdio\",\"timestamp\":\"2025-07-06T00:07:05.919Z\"}\n{\"level\":\"info\",\"time\":\"2025-07-06T00:07:05.920Z\",\"pid\":565464,\"hostname\":\"framework\",\"name\":\"app\",\"environment\":\"development\",\"service\":\"puppeteer-mcp\",\"msg\":\"MCP server started with stdio transport\",\"timestamp\":\"2025-07-06T00:07:05.920Z\"}\n"
}

### ✅ protocolHandshake
- Status: success
- Details: {
  "handshakeTime": 7,
  "serverInfo": {
    "name": "puppeteer-mcp",
    "version": "0.1.0"
  },
  "protocolVersion": "2024-11-05",
  "capabilities": {
    "resources": {},
    "tools": {},
    "prompts": {}
  }
}

### ✅ toolDiscovery
- Status: success
- Details: {
  "discoveryTime": 2,
  "totalTools": 6,
  "toolCategories": {
    "session": [
      {
        "name": "create-session",
        "description": "Create a new session for API interactions",
        "inputSchema": {
          "type": "object",
          "properties": {
            "username": {
              "type": "string"
            },
            "password": {
              "type": "string"
            },
            "duration": {
              "type": "number",
              "description": "Session duration in seconds"
            }
          },
          "required": [
            "username",
            "password"
          ]
        }
      },
      {
        "name": "list-sessions",
        "description": "List active sessions",
        "inputSchema": {
          "type": "object",
          "properties": {
            "userId": {
              "type": "string"
            }
          }
        }
      },
      {
        "name": "delete-session",
        "description": "Delete an active session",
        "inputSchema": {
          "type": "object",
          "properties": {
            "sessionId": {
              "type": "string",
              "description": "Session ID to delete"
            }
          },
          "required": [
            "sessionId"
          ]
        }
      }
    ],
    "browser": [
      {
        "name": "create-browser-context",
        "description": "Create a Puppeteer browser context",
        "inputSchema": {
          "type": "object",
          "properties": {
            "sessionId": {
              "type": "string"
            },
            "options": {
              "type": "object",
              "properties": {
                "headless": {
                  "type": "boolean"
                },
                "viewport": {
                  "type": "object",
                  "properties": {
                    "width": {
                      "type": "number"
                    },
                    "height": {
                      "type": "number"
                    }
                  }
                }
              }
            }
          },
          "required": [
            "sessionId"
          ]
        }
      },
      {
        "name": "execute-in-context",
        "description": "Execute commands in a browser context",
        "inputSchema": {
          "type": "object",
          "properties": {
            "contextId": {
              "type": "string",
              "description": "Context ID to execute command in"
            },
            "command": {
              "type": "string",
              "description": "Command to execute"
            },
            "parameters": {
              "type": "object",
              "description": "Parameters for the command"
            }
          },
          "required": [
            "contextId",
            "command"
          ]
        }
      }
    ],
    "api": [
      {
        "name": "execute-api",
        "description": "Execute API calls across REST, gRPC, or WebSocket protocols",
        "inputSchema": {
          "type": "object",
          "properties": {
            "protocol": {
              "type": "string",
              "enum": [
                "rest",
                "grpc",
                "websocket"
              ],
              "description": "Protocol to use"
            },
            "operation": {
              "type": "object",
              "description": "Protocol-specific operation details"
            },
            "auth": {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "jwt",
                    "apikey",
                    "session"
                  ]
                },
                "credentials": {
                  "type": "string"
                }
              }
            }
          },
          "required": [
            "protocol",
            "operation"
          ]
        }
      }
    ],
    "other": []
  },
  "tools": [
    {
      "name": "execute-api",
      "description": "Execute API calls across REST, gRPC, or WebSocket protocols",
      "inputSchema": {
        "type": "object",
        "properties": {
          "protocol": {
            "type": "string",
            "enum": [
              "rest",
              "grpc",
              "websocket"
            ],
            "description": "Protocol to use"
          },
          "operation": {
            "type": "object",
            "description": "Protocol-specific operation details"
          },
          "auth": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "enum": [
                  "jwt",
                  "apikey",
                  "session"
                ]
              },
              "credentials": {
                "type": "string"
              }
            }
          }
        },
        "required": [
          "protocol",
          "operation"
        ]
      }
    },
    {
      "name": "create-session",
      "description": "Create a new session for API interactions",
      "inputSchema": {
        "type": "object",
        "properties": {
          "username": {
            "type": "string"
          },
          "password": {
            "type": "string"
          },
          "duration": {
            "type": "number",
            "description": "Session duration in seconds"
          }
        },
        "required": [
          "username",
          "password"
        ]
      }
    },
    {
      "name": "list-sessions",
      "description": "List active sessions",
      "inputSchema": {
        "type": "object",
        "properties": {
          "userId": {
            "type": "string"
          }
        }
      }
    },
    {
      "name": "delete-session",
      "description": "Delete an active session",
      "inputSchema": {
        "type": "object",
        "properties": {
          "sessionId": {
            "type": "string",
            "description": "Session ID to delete"
          }
        },
        "required": [
          "sessionId"
        ]
      }
    },
    {
      "name": "create-browser-context",
      "description": "Create a Puppeteer browser context",
      "inputSchema": {
        "type": "object",
        "properties": {
          "sessionId": {
            "type": "string"
          },
          "options": {
            "type": "object",
            "properties": {
              "headless": {
                "type": "boolean"
              },
              "viewport": {
                "type": "object",
                "properties": {
                  "width": {
                    "type": "number"
                  },
                  "height": {
                    "type": "number"
                  }
                }
              }
            }
          }
        },
        "required": [
          "sessionId"
        ]
      }
    },
    {
      "name": "execute-in-context",
      "description": "Execute commands in a browser context",
      "inputSchema": {
        "type": "object",
        "properties": {
          "contextId": {
            "type": "string",
            "description": "Context ID to execute command in"
          },
          "command": {
            "type": "string",
            "description": "Command to execute"
          },
          "parameters": {
            "type": "object",
            "description": "Parameters for the command"
          }
        },
        "required": [
          "contextId",
          "command"
        ]
      }
    }
  ],
  "resources": [
    {
      "uri": "api://catalog",
      "name": "API Catalog",
      "description": "Complete catalog of available APIs",
      "mimeType": "application/json"
    },
    {
      "uri": "api://health",
      "name": "System Health",
      "description": "Current system health and status",
      "mimeType": "application/json"
    }
  ]
}

### ✅ sessionManagement
- Status: success
- Details: {
  "operationTime": 7,
  "sessionData": {
    "error": "Invalid username or password",
    "code": "AUTH_FAILED"
  },
  "activeSessions": 0
}

### ⏭️ browserAutomation
- Status: skipped
- Details: {
  "reason": "No session available"
}

### ⏭️ contextManagement
- Status: skipped
- Details: {
  "reason": "No context available"
}

### ✅ resourceAccess
- Status: success
- Details: {
  "operationTime": 3,
  "results": {
    "apiCatalog": {
      "success": true,
      "endpointCount": 0,
      "protocols": []
    },
    "systemHealth": {
      "success": true,
      "status": "healthy",
      "components": []
    }
  }
}


## Statistics

- Total MCP Messages: 15
- Average Message Latency: 2.29ms
- Successful Phases: 5
- Failed Phases: 0
- Skipped Phases: 2

## Artifacts

- Screenshots: 0
- HTML Content Files: 0

## Warnings

1. [2025-07-06T00:07:07.674Z] browserAutomation: No session available, skipping browser tests
2. [2025-07-06T00:07:07.674Z] contextManagement: No context available, skipping context tests