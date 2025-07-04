// Integration test setup
import './setup';
import { Application } from 'express';
import http from 'http';

declare global {
   
  var testApp: Application;
   
  var testServer: http.Server;
}

// Setup for integration tests
beforeAll(() => {
  // Set integration test specific environment
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0'; // Use random port
  process.env.JWT_SECRET = 'test-secret-key-for-integration-tests-must-be-at-least-32-chars';
  process.env.JWT_EXPIRY = '1h';
  process.env.SESSION_TIMEOUT = '3600000'; // 1 hour
});

// Cleanup after each test
afterEach(async () => {
  // Close server if running
  if (global.testServer !== undefined && global.testServer !== null) {
    await new Promise<void>((resolve) => {
      global.testServer.close(() => resolve());
    });
    global.testServer = undefined as unknown as http.Server;
  }
});

// Helper to wait for server to be ready
export function waitForServer(server: http.Server, timeout = 5000): Promise<void> {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const checkServer = (): void => {
      if (server.listening) {
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error('Server failed to start within timeout'));
      } else {
        setTimeout(checkServer, 100);
      }
    };

    checkServer();
  });
}
