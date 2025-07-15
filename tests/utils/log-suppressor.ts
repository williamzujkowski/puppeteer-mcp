/**
 * Test log suppressor utility
 * Reduces noise in test output
 */

const originalConsole = { ...console };
const logLevels = ['log', 'info', 'warn', 'error', 'debug'];

/**
 * Suppress console output during tests
 */
export function suppressLogs() {
  if (process.env.CI || process.env.SUPPRESS_TEST_LOGS === 'true') {
    logLevels.forEach(level => {
      console[level] = () => {};
    });
  }
}

/**
 * Restore console output
 */
export function restoreLogs() {
  logLevels.forEach(level => {
    console[level] = originalConsole[level];
  });
}

/**
 * Setup function to call in test files
 */
export function setupTestLogging() {
  beforeAll(() => {
    suppressLogs();
  });
  
  afterAll(() => {
    restoreLogs();
  });
}
