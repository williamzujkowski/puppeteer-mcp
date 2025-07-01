// E2E test setup
import './setup';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

declare global {
  // eslint-disable-next-line no-var
  var e2eServerProcess: any;
}

// Setup for E2E tests
beforeAll(async () => {
  // Set E2E test specific environment
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3456';
  process.env.JWT_SECRET = 'test-secret-key-for-e2e-tests-must-be-at-least-32-chars';
  process.env.JWT_EXPIRY = '1h';
  process.env.SESSION_TIMEOUT = '3600000'; // 1 hour

  // Build the application before E2E tests
  console.log('Building application for E2E tests...');
  await execAsync('npm run build');
});

// Cleanup after all E2E tests
afterAll(async () => {
  // Kill any running server processes
  if (global.e2eServerProcess) {
    global.e2eServerProcess.kill();
    global.e2eServerProcess = undefined;
  }
});

// Helper function to start the server for E2E tests
export async function startE2EServer(): Promise<void> {
  const { spawn } = await import('child_process');

  return new Promise((resolve, reject) => {
    global.e2eServerProcess = spawn('npm', ['start'], {
      env: { ...process.env },
      stdio: 'pipe',
    });

    let serverStarted = false;
    const timeout = setTimeout(() => {
      if (!serverStarted) {
        global.e2eServerProcess.kill();
        reject(new Error('Server failed to start within timeout'));
      }
    }, 30000);

    global.e2eServerProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      if (output.includes('Server started') || output.includes('listening')) {
        serverStarted = true;
        clearTimeout(timeout);
        // Give server a moment to fully initialize
        setTimeout(() => resolve(), 1000);
      }
    });

    global.e2eServerProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`E2E Server Error: ${data.toString()}`);
    });

    global.e2eServerProcess.on('error', (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Helper to stop E2E server
export async function stopE2EServer(): Promise<void> {
  if (global.e2eServerProcess) {
    global.e2eServerProcess.kill();
    global.e2eServerProcess = undefined;
    // Wait for process to fully terminate
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
