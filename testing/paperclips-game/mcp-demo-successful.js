#!/usr/bin/env node

/**
 * MCP Successful Operations Demo
 * Demonstrates what works correctly in the MCP interface
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class MCPSuccessDemo {
  constructor() {
    this.mcpProcess = null;
    this.messageId = 1;
  }

  log(message, emoji = '📌') {
    console.log(`${emoji} ${message}`);
  }

  async sendMCPMessage(method, params = {}, isNotification = false) {
    return new Promise((resolve, reject) => {
      const message = {
        jsonrpc: '2.0',
        method,
        params
      };
      
      if (!isNotification) {
        message.id = this.messageId++;
      }

      const messageString = JSON.stringify(message) + '\n';
      
      if (isNotification) {
        this.mcpProcess.stdin.write(messageString);
        resolve(null);
        return;
      }

      let responseBuffer = '';
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for response to ${method}`));
      }, 10000);

      const dataHandler = (data) => {
        responseBuffer += data.toString();
        const lines = responseBuffer.split('\n');
        
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const response = JSON.parse(line);
              if (response.id === message.id) {
                clearTimeout(timeout);
                this.mcpProcess.stdout.removeListener('data', dataHandler);
                
                if (response.error) {
                  reject(new Error(response.error.message));
                } else {
                  resolve(response.result);
                }
                return;
              }
            } catch (e) {
              // Continue to next line
            }
          }
        }
        responseBuffer = lines[lines.length - 1];
      };

      this.mcpProcess.stdout.on('data', dataHandler);
      this.mcpProcess.stdin.write(messageString);
    });
  }

  async startMCP() {
    this.log('Starting MCP server...', '🚀');
    
    this.mcpProcess = spawn('node', ['dist/mcp/start-mcp.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '..', '..'),
      env: {
        ...process.env,
        MCP_TRANSPORT: 'stdio',
        NODE_ENV: 'development',
        JWT_SECRET: 'test-secret-for-mcp-demo-with-minimum-32-chars',
        API_KEY_SECRET: 'test-api-key-secret-with-minimum-32-chars'
      }
    });

    // Capture stderr but don't display unless there's an error
    let stderrBuffer = '';
    this.mcpProcess.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (this.mcpProcess.exitCode !== null) {
      console.error('MCP server failed to start:', stderrBuffer);
      throw new Error('MCP server startup failed');
    }

    this.log('MCP server started successfully', '✅');
  }

  async runDemo() {
    try {
      await this.startMCP();

      // 1. Protocol Handshake
      this.log('\n=== Protocol Handshake ===', '🤝');
      const initResult = await this.sendMCPMessage('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {}
        },
        clientInfo: {
          name: 'mcp-demo-client',
          version: '1.0.0'
        }
      });
      
      this.log(`Connected to: ${initResult.serverInfo.name} v${initResult.serverInfo.version}`, '✅');
      
      await this.sendMCPMessage('notifications/initialized', {}, true);
      this.log('Protocol handshake complete', '✅');

      // 2. Tool Discovery
      this.log('\n=== Available Tools ===', '🔧');
      const tools = await this.sendMCPMessage('tools/list');
      
      tools.tools.forEach(tool => {
        this.log(`• ${tool.name}: ${tool.description}`, '  ');
      });

      // 3. Resource Discovery
      this.log('\n=== Available Resources ===', '📚');
      const resources = await this.sendMCPMessage('resources/list');
      
      resources.resources.forEach(resource => {
        this.log(`• ${resource.name} (${resource.uri})`, '  ');
      });

      // 4. Create Session
      this.log('\n=== Session Management ===', '🔐');
      this.log('Creating session with demo user...', '🔄');
      
      const sessionResult = await this.sendMCPMessage('tools/call', {
        name: 'create-session',
        arguments: {
          username: 'demo',
          password: 'demo123!',
          duration: 3600
        }
      });
      
      const sessionData = JSON.parse(sessionResult.content[0].text);
      this.log(`Session created: ${sessionData.sessionId}`, '✅');
      this.log(`User: ${sessionData.username} (${sessionData.userId})`, '  ');
      this.log(`Expires: ${new Date(sessionData.expiresAt).toLocaleString()}`, '  ');

      // 5. List Sessions
      this.log('\nListing active sessions...', '🔄');
      const listResult = await this.sendMCPMessage('tools/call', {
        name: 'list-sessions',
        arguments: {
          userId: sessionData.userId
        }
      });
      
      const sessionsList = JSON.parse(listResult.content[0].text);
      this.log(`Found ${sessionsList.sessions.length} active session(s)`, '✅');

      // 6. Create Browser Context
      this.log('\n=== Browser Context Creation ===', '🌐');
      this.log('Creating browser context...', '🔄');
      
      const contextResult = await this.sendMCPMessage('tools/call', {
        name: 'create-browser-context',
        arguments: {
          sessionId: sessionData.sessionId,
          options: {
            headless: true,
            viewport: {
              width: 1920,
              height: 1080
            }
          }
        }
      });
      
      const contextData = JSON.parse(contextResult.content[0].text);
      this.log(`Browser context created: ${contextData.contextId}`, '✅');
      this.log(`Type: ${contextData.type}`, '  ');
      this.log(`Status: ${contextData.status}`, '  ');

      // 7. Read System Health
      this.log('\n=== System Resources ===', '💻');
      this.log('Reading system health...', '🔄');
      
      const healthResult = await this.sendMCPMessage('resources/read', {
        uri: 'api://health'
      });
      
      const health = JSON.parse(healthResult.contents[0].text);
      this.log(`System status: ${health.status}`, '✅');
      this.log(`Uptime: ${Math.floor(health.uptime / 60)} minutes`, '  ');
      
      if (health.components) {
        Object.entries(health.components).forEach(([component, status]) => {
          this.log(`• ${component}: ${status}`, '  ');
        });
      }

      // 8. Read API Catalog
      this.log('\nReading API catalog...', '🔄');
      const catalogResult = await this.sendMCPMessage('resources/read', {
        uri: 'api://catalog'
      });
      
      const catalog = JSON.parse(catalogResult.contents[0].text);
      this.log(`API Catalog loaded`, '✅');
      if (catalog.protocols) {
        this.log(`Protocols: ${catalog.protocols.join(', ')}`, '  ');
      }
      if (catalog.endpoints) {
        this.log(`Endpoints: ${Object.keys(catalog.endpoints).length}`, '  ');
      }

      // 9. Cleanup
      this.log('\n=== Cleanup ===', '🧹');
      this.log('Deleting session...', '🔄');
      
      await this.sendMCPMessage('tools/call', {
        name: 'delete-session',
        arguments: {
          sessionId: sessionData.sessionId
        }
      });
      
      this.log('Session deleted', '✅');

      // Summary
      this.log('\n=== Demo Complete ===', '🎉');
      this.log('All MCP operations completed successfully!', '✅');
      this.log('\nNote: Browser automation operations require the full server mode.', '⚠️');
      this.log('The MCP interface successfully handles:', '  ');
      this.log('• Protocol handshake and discovery', '  ');
      this.log('• Session management and authentication', '  ');
      this.log('• Context creation (metadata only)', '  ');
      this.log('• Resource access and system health', '  ');

    } catch (error) {
      this.log(`\nError: ${error.message}`, '❌');
    } finally {
      if (this.mcpProcess) {
        this.log('\nShutting down MCP server...', '🔄');
        this.mcpProcess.kill();
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.log('MCP server stopped', '✅');
      }
    }
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new MCPSuccessDemo();
  demo.runDemo().catch(console.error);
}

export { MCPSuccessDemo };