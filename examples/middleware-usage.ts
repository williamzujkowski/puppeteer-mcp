/**
 * Example usage of the request-response-logger middleware
 * This demonstrates how to integrate the middleware into an Express application
 * @module examples/middleware-usage
 */

import express from 'express';
import {
  createRequestResponseLogger,
  VerbosityLevel,
} from '../src/core/middleware/request-response-logger.js';
import { createLogger } from '../src/utils/logger.js';

const app = express();

// Example 1: Basic usage with default standard configuration
app.use(createRequestResponseLogger.standard());

// Example 2: Verbose logging for development
app.use(
  createRequestResponseLogger.development({
    skipPaths: ['/health', '/metrics'],
    slowRequestThreshold: 500,
  }),
);

// Example 3: Production configuration with security focus
app.use(
  createRequestResponseLogger.production({
    auditLogging: true,
    includeHeaders: false,
    includeRequestBody: false,
    includeResponseBody: false,
    errorsOnly: false,
    slowRequestThreshold: 2000,
  }),
);

// Example 4: Custom configuration
const customLogger = createLogger('custom-request-logger');
app.use(
  createRequestResponseLogger.verbose({
    logger: customLogger,
    verbosity: VerbosityLevel.VERBOSE,
    includeHeaders: true,
    includeRequestBody: true,
    includeResponseBody: true,
    maxBodySize: 4096,
    sensitiveHeaders: ['authorization', 'cookie', 'x-api-key'],
    sensitiveBodyFields: ['password', 'token', 'secret'],
    loggedContentTypes: ['application/json', 'text/plain'],
    auditLogging: true,
    highPrecisionTiming: true,
    slowRequestThreshold: 1000,
    metadataExtractor: (req, res) => ({
      customField: 'custom-value',
      endpoint: req.path,
      method: req.method,
    }),
  }),
);

// Example 5: Security-focused configuration
app.use(
  createRequestResponseLogger.security({
    verbosity: VerbosityLevel.VERBOSE,
    auditLogging: true,
    includeHeaders: true,
    includeRequestBody: true,
    includeResponseBody: false,
    maxBodySize: 8192,
    skipPaths: [], // Log everything for security
    highPrecisionTiming: true,
  }),
);

// Example 6: Performance monitoring configuration
app.use(
  createRequestResponseLogger.performance({
    verbosity: VerbosityLevel.MINIMAL,
    auditLogging: false,
    includeHeaders: false,
    includeRequestBody: false,
    includeResponseBody: false,
    maxBodySize: 0,
    skipPaths: ['/health', '/metrics'],
    slowRequestThreshold: 100, // Very sensitive to slow requests
    highPrecisionTiming: true,
  }),
);

// Example routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.post('/api/data', express.json(), (req, res) => {
  // Simulate processing time
  setTimeout(() => {
    res.json({ message: 'Data processed', id: req.body.id });
  }, 100);
});

app.get('/api/slow', (req, res) => {
  // Simulate slow endpoint
  setTimeout(() => {
    res.json({ message: 'Slow response' });
  }, 1500);
});

app.get('/api/error', (req, res) => {
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export { app };
