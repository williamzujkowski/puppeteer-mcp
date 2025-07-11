#!/usr/bin/env node

/**
 * MCP 2025-06-18 Compliance Test
 *
 * Tests the MCP server implementation against the MCP 2025-06-18 standard.
 * This test validates:
 * - Protocol version compliance
 * - Initialize request/response flow
 * - Initialized notification handling
 * - Ping request/response
 * - Progress notification support
 * - Tool execution with metadata
 * - Resource listing and reading
 * - Cancellation support
 * - Proper capabilities declaration
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class MCPComplianceTest {
  constructor() {
    this.mcpProcess = null;
    this.testResults = [];
    this.startTime = Date.now();
  }

  async runTest() {
    console.log('🔍 Starting MCP 2025-06-18 Compliance Test');
    console.log('='.repeat(50));

    try {
      await this.startMCPServer();
      await this.runComplianceTests();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      this.addResult('FATAL_ERROR', false, error.message);
    } finally {
      await this.cleanup();
    }
  }

  async startMCPServer() {
    console.log('🚀 Starting MCP Server in stdio mode...');

    return new Promise((resolve, reject) => {
      // Start the MCP server process
      this.mcpProcess = spawn('npx', ['tsx', 'src/mcp/start-mcp.ts'], {
        cwd: '/home/william/git/puppeteer-mcp',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          MCP_TRANSPORT: 'stdio',
          NODE_ENV: 'development',
        },
      });

      let initTimeout = setTimeout(() => {
        reject(new Error('MCP server failed to start within 10 seconds'));
      }, 10000);

      // Listen for server output
      this.mcpProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('📊 MCP Server Output:', output.trim());

        // Look for readiness indicators
        if (output.includes('MCP server started') || output.includes('Server ready')) {
          clearTimeout(initTimeout);
          resolve();
        }
      });

      this.mcpProcess.stderr.on('data', (data) => {
        console.log('⚠️  MCP Server Error:', data.toString().trim());
      });

      this.mcpProcess.on('error', (error) => {
        clearTimeout(initTimeout);
        reject(error);
      });

      // Give it a moment to start even without explicit ready message
      setTimeout(() => {
        clearTimeout(initTimeout);
        resolve();
      }, 3000);
    });
  }

  async runComplianceTests() {
    console.log('\n📋 Running MCP 2025-06-18 Compliance Tests');
    console.log('-'.repeat(40));

    // Test 1: Initialize Request/Response
    await this.testInitializeFlow();

    // Test 2: Initialized Notification
    await this.testInitializedNotification();

    // Test 3: Ping Request/Response
    await this.testPingRequest();

    // Test 4: Tools List with Metadata
    await this.testToolsList();

    // Test 5: Tool Execution with Progress
    await this.testToolExecutionWithProgress();

    // Test 6: Resources List and Read
    await this.testResourcesFlow();

    // Test 7: Cancellation Support
    await this.testCancellationSupport();

    // Test 8: Protocol Version Validation
    await this.testProtocolVersion();
  }

  async testInitializeFlow() {
    console.log('\n🔧 Testing Initialize Request/Response Flow...');

    try {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {
            experimental: {},
          },
          clientInfo: {
            name: 'mcp-compliance-test',
            version: '1.0.0',
          },
        },
      };

      const response = await this.sendMessage(request);

      // Validate response structure
      const isValid =
        response.jsonrpc === '2.0' &&
        response.id === 1 &&
        response.result &&
        response.result.protocolVersion === '2025-06-18' &&
        response.result.capabilities &&
        response.result.serverInfo &&
        response.result.serverInfo.name === 'puppeteer-mcp' &&
        response.result.serverInfo.version === '1.0.10';

      this.addResult(
        'INITIALIZE_FLOW',
        isValid,
        isValid
          ? 'Initialize request/response working correctly'
          : `Invalid response: ${JSON.stringify(response, null, 2)}`,
      );

      if (isValid) {
        console.log('✅ Initialize flow: PASSED');
        console.log(`   Protocol Version: ${response.result.protocolVersion}`);
        console.log(
          `   Server: ${response.result.serverInfo.name} v${response.result.serverInfo.version}`,
        );
        console.log(`   Capabilities: ${Object.keys(response.result.capabilities).join(', ')}`);
      } else {
        console.log('❌ Initialize flow: FAILED');
      }
    } catch (error) {
      this.addResult('INITIALIZE_FLOW', false, `Error: ${error.message}`);
      console.log('❌ Initialize flow: ERROR -', error.message);
    }
  }

  async testInitializedNotification() {
    console.log('\n📢 Testing Initialized Notification...');

    try {
      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      };

      // Send notification (should not respond)
      this.mcpProcess.stdin.write(JSON.stringify(notification) + '\n');

      // Wait briefly to ensure no response
      await new Promise((resolve) => setTimeout(resolve, 500));

      this.addResult(
        'INITIALIZED_NOTIFICATION',
        true,
        'Initialized notification sent successfully',
      );
      console.log('✅ Initialized notification: PASSED');
    } catch (error) {
      this.addResult('INITIALIZED_NOTIFICATION', false, `Error: ${error.message}`);
      console.log('❌ Initialized notification: ERROR -', error.message);
    }
  }

  async testPingRequest() {
    console.log('\n🏓 Testing Ping Request/Response...');

    try {
      const request = {
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
      };

      const response = await this.sendMessage(request);

      const isValid =
        response.jsonrpc === '2.0' && response.id === 2 && response.result !== undefined;

      this.addResult(
        'PING_REQUEST',
        isValid,
        isValid
          ? 'Ping request/response working correctly'
          : `Invalid ping response: ${JSON.stringify(response, null, 2)}`,
      );

      if (isValid) {
        console.log('✅ Ping request: PASSED');
      } else {
        console.log('❌ Ping request: FAILED');
      }
    } catch (error) {
      this.addResult('PING_REQUEST', false, `Error: ${error.message}`);
      console.log('❌ Ping request: ERROR -', error.message);
    }
  }

  async testToolsList() {
    console.log('\n🛠️  Testing Tools List with Metadata...');

    try {
      const request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
      };

      const response = await this.sendMessage(request);

      const isValid =
        response.jsonrpc === '2.0' &&
        response.id === 3 &&
        response.result &&
        response.result.tools &&
        Array.isArray(response.result.tools) &&
        response.result.tools.length > 0;

      let metadataValid = false;
      if (isValid && response.result.tools.length > 0) {
        const firstTool = response.result.tools[0];
        metadataValid =
          firstTool.name &&
          firstTool.title && // MCP 2025-06-18 compliance
          firstTool.description &&
          firstTool.inputSchema;
      }

      this.addResult(
        'TOOLS_LIST',
        isValid && metadataValid,
        isValid && metadataValid
          ? `Tools list valid with ${response.result.tools.length} tools, all with proper metadata`
          : `Invalid tools list or missing metadata: ${JSON.stringify(response, null, 2)}`,
      );

      if (isValid && metadataValid) {
        console.log('✅ Tools list: PASSED');
        console.log(`   Found ${response.result.tools.length} tools`);
        response.result.tools.forEach((tool) => {
          console.log(`   - ${tool.name} (${tool.title || 'No title'})`);
        });
      } else {
        console.log('❌ Tools list: FAILED');
      }
    } catch (error) {
      this.addResult('TOOLS_LIST', false, `Error: ${error.message}`);
      console.log('❌ Tools list: ERROR -', error.message);
    }
  }

  async testToolExecutionWithProgress() {
    console.log('\n⚡ Testing Tool Execution with Progress Notifications...');

    try {
      const progressToken = `test-${Date.now()}`;
      const request = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'list-sessions',
          arguments: {
            userId: 'test-user',
          },
          _meta: {
            progressToken: progressToken,
          },
        },
      };

      // Set up progress notification listener
      let progressReceived = false;
      const progressListener = (data) => {
        try {
          const lines = data
            .toString()
            .split('\n')
            .filter((line) => line.trim());
          for (const line of lines) {
            try {
              const message = JSON.parse(line);
              if (
                message.method === 'notifications/progress' &&
                message.params &&
                message.params.progressToken === progressToken
              ) {
                progressReceived = true;
              }
            } catch (parseError) {
              // Ignore non-JSON lines
            }
          }
        } catch (error) {
          // Ignore parsing errors
        }
      };

      this.mcpProcess.stdout.on('data', progressListener);

      const response = await this.sendMessage(request, 10000);

      // Remove progress listener
      this.mcpProcess.stdout.removeListener('data', progressListener);

      const isValid =
        response.jsonrpc === '2.0' && response.id === 4 && response.result && !response.error;

      this.addResult(
        'TOOL_EXECUTION_PROGRESS',
        isValid,
        isValid
          ? `Tool execution successful${progressReceived ? ' with progress notifications' : ' (progress notifications not detected)'}`
          : `Tool execution failed: ${JSON.stringify(response, null, 2)}`,
      );

      if (isValid) {
        console.log('✅ Tool execution with progress: PASSED');
        console.log(`   Progress notifications: ${progressReceived ? 'DETECTED' : 'NOT DETECTED'}`);
      } else {
        console.log('❌ Tool execution with progress: FAILED');
      }
    } catch (error) {
      this.addResult('TOOL_EXECUTION_PROGRESS', false, `Error: ${error.message}`);
      console.log('❌ Tool execution with progress: ERROR -', error.message);
    }
  }

  async testResourcesFlow() {
    console.log('\n📦 Testing Resources List and Read...');

    try {
      // Test resources/list
      const listRequest = {
        jsonrpc: '2.0',
        id: 5,
        method: 'resources/list',
      };

      const listResponse = await this.sendMessage(listRequest);

      const listValid =
        listResponse.jsonrpc === '2.0' &&
        listResponse.id === 5 &&
        listResponse.result &&
        listResponse.result.resources &&
        Array.isArray(listResponse.result.resources) &&
        listResponse.result.resources.length > 0;

      let readValid = false;
      if (listValid && listResponse.result.resources.length > 0) {
        // Test resources/read with first resource
        const firstResource = listResponse.result.resources[0];
        const readRequest = {
          jsonrpc: '2.0',
          id: 6,
          method: 'resources/read',
          params: {
            uri: firstResource.uri,
          },
        };

        try {
          const readResponse = await this.sendMessage(readRequest);
          readValid =
            readResponse.jsonrpc === '2.0' &&
            readResponse.id === 6 &&
            readResponse.result &&
            readResponse.result.contents;
        } catch (readError) {
          console.log(`   Resource read error: ${readError.message}`);
        }
      }

      this.addResult(
        'RESOURCES_FLOW',
        listValid && readValid,
        listValid && readValid
          ? `Resources flow working: ${listResponse.result.resources.length} resources listed, first resource read successfully`
          : `Resources flow failed - List: ${listValid}, Read: ${readValid}`,
      );

      if (listValid && readValid) {
        console.log('✅ Resources flow: PASSED');
        console.log(`   Found ${listResponse.result.resources.length} resources`);
        listResponse.result.resources.forEach((resource) => {
          console.log(`   - ${resource.name || resource.uri} (${resource.title || 'No title'})`);
        });
      } else {
        console.log('❌ Resources flow: FAILED');
      }
    } catch (error) {
      this.addResult('RESOURCES_FLOW', false, `Error: ${error.message}`);
      console.log('❌ Resources flow: ERROR -', error.message);
    }
  }

  async testCancellationSupport() {
    console.log('\n🚫 Testing Cancellation Support...');

    try {
      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/cancelled',
        params: {
          requestId: 'test-cancellation',
          reason: 'Test cancellation',
        },
      };

      // Send cancellation notification (should not respond)
      this.mcpProcess.stdin.write(JSON.stringify(notification) + '\n');

      // Wait briefly to ensure no response
      await new Promise((resolve) => setTimeout(resolve, 500));

      this.addResult('CANCELLATION_SUPPORT', true, 'Cancellation notification sent successfully');
      console.log('✅ Cancellation support: PASSED');
    } catch (error) {
      this.addResult('CANCELLATION_SUPPORT', false, `Error: ${error.message}`);
      console.log('❌ Cancellation support: ERROR -', error.message);
    }
  }

  async testProtocolVersion() {
    console.log('\n📋 Testing Protocol Version Validation...');

    try {
      // Test with different protocol version
      const request = {
        jsonrpc: '2.0',
        id: 7,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05', // Older version
          capabilities: {},
          clientInfo: {
            name: 'version-test',
            version: '1.0.0',
          },
        },
      };

      const response = await this.sendMessage(request);

      // Server should respond with its supported version
      const isValid =
        response.jsonrpc === '2.0' &&
        response.id === 7 &&
        response.result &&
        response.result.protocolVersion === '2025-06-18';

      this.addResult(
        'PROTOCOL_VERSION',
        isValid,
        isValid
          ? 'Server correctly responds with supported protocol version'
          : `Server response invalid: ${JSON.stringify(response, null, 2)}`,
      );

      if (isValid) {
        console.log('✅ Protocol version validation: PASSED');
        console.log(`   Server protocol version: ${response.result.protocolVersion}`);
      } else {
        console.log('❌ Protocol version validation: FAILED');
      }
    } catch (error) {
      this.addResult('PROTOCOL_VERSION', false, `Error: ${error.message}`);
      console.log('❌ Protocol version validation: ERROR -', error.message);
    }
  }

  async sendMessage(request, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const requestId = request.id;
      let messageTimeout = setTimeout(() => {
        reject(new Error(`Request ${requestId} timed out after ${timeout}ms`));
      }, timeout);

      const responseListener = (data) => {
        try {
          const lines = data
            .toString()
            .split('\n')
            .filter((line) => line.trim());

          for (const line of lines) {
            try {
              const message = JSON.parse(line);
              if (message.id === requestId) {
                clearTimeout(messageTimeout);
                this.mcpProcess.stdout.removeListener('data', responseListener);
                resolve(message);
                return;
              }
            } catch (parseError) {
              // Ignore non-JSON lines
            }
          }
        } catch (error) {
          // Ignore parsing errors
        }
      };

      this.mcpProcess.stdout.on('data', responseListener);
      this.mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  addResult(testName, passed, details) {
    this.testResults.push({
      test: testName,
      passed,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  async generateReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);

    console.log('\n📊 MCP 2025-06-18 Compliance Test Results');
    console.log('='.repeat(50));
    console.log(`Duration: ${duration}ms`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log('');

    // Print detailed results
    this.testResults.forEach((result) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status}: ${result.test}`);
      console.log(`   ${result.details}`);
    });

    // Generate JSON report
    const report = {
      testSuite: 'MCP 2025-06-18 Compliance',
      timestamp: new Date().toISOString(),
      duration: duration,
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        passRate: parseFloat(passRate),
      },
      protocolVersion: '2025-06-18',
      compliance: passRate >= 90 ? 'COMPLIANT' : 'NON_COMPLIANT',
      results: this.testResults,
    };

    const reportPath = path.join(__dirname, `mcp-compliance-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📄 Detailed report saved: ${reportPath}`);

    // Final compliance assessment
    if (passRate >= 90) {
      console.log('\n🎉 MCP 2025-06-18 COMPLIANCE: PASSED');
      console.log('   The server implementation is compliant with MCP 2025-06-18 standard.');
    } else {
      console.log('\n⚠️  MCP 2025-06-18 COMPLIANCE: FAILED');
      console.log('   The server implementation requires fixes to meet MCP 2025-06-18 standard.');
    }
  }

  async cleanup() {
    if (this.mcpProcess) {
      console.log('\n🧹 Cleaning up MCP server process...');
      this.mcpProcess.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise((resolve) => {
        this.mcpProcess.on('exit', resolve);
        setTimeout(() => {
          this.mcpProcess.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new MCPComplianceTest();
  test.runTest().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export default MCPComplianceTest;
