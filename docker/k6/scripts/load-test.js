import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const sessionCreationDuration = new Trend('session_creation_duration');
const apiCallDuration = new Trend('api_call_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '2m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '2m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.1'],             // Error rate must be below 10%
  },
};

const BASE_URL = 'http://app:8443';
const HEADERS = {
  'Content-Type': 'application/json',
};

// Helper function to handle API responses
function handleResponse(response, checkName) {
  const success = check(response, {
    [checkName]: (r) => r.status >= 200 && r.status < 300,
  });
  
  errorRate.add(!success);
  return success;
}

export default function () {
  // Test 1: Health check
  let response = http.get(`${BASE_URL}/health`);
  handleResponse(response, 'health check successful');

  // Test 2: Create session
  const sessionStart = Date.now();
  response = http.post(
    `${BASE_URL}/api/sessions`,
    JSON.stringify({
      metadata: {
        test: 'k6-load-test',
        user: `user-${__VU}`,
        iteration: __ITER,
      },
    }),
    { headers: HEADERS }
  );
  
  if (!handleResponse(response, 'session created')) {
    return; // Skip rest of iteration if session creation failed
  }
  
  sessionCreationDuration.add(Date.now() - sessionStart);
  const sessionData = response.json();
  const sessionId = sessionData.sessionId;
  const token = sessionData.token;

  // Add auth header for subsequent requests
  const authHeaders = Object.assign({}, HEADERS, {
    'Authorization': `Bearer ${token}`,
  });

  // Test 3: Create browser context
  const apiStart = Date.now();
  response = http.post(
    `${BASE_URL}/api/sessions/${sessionId}/contexts`,
    JSON.stringify({
      options: {
        viewport: { width: 1920, height: 1080 },
        userAgent: 'k6-load-test/1.0',
      },
    }),
    { headers: authHeaders }
  );
  
  if (!handleResponse(response, 'context created')) {
    return;
  }
  
  apiCallDuration.add(Date.now() - apiStart);
  const contextData = response.json();
  const contextId = contextData.contextId;

  // Test 4: Create page
  response = http.post(
    `${BASE_URL}/api/contexts/${contextId}/pages`,
    JSON.stringify({}),
    { headers: authHeaders }
  );
  
  if (!handleResponse(response, 'page created')) {
    return;
  }
  
  const pageData = response.json();
  const pageId = pageData.pageId;

  // Test 5: Navigate to URL
  response = http.post(
    `${BASE_URL}/api/pages/${pageId}/navigate`,
    JSON.stringify({
      url: 'https://example.com',
      waitUntil: 'networkidle0',
    }),
    { headers: authHeaders }
  );
  
  handleResponse(response, 'navigation successful');

  // Test 6: Take screenshot
  response = http.post(
    `${BASE_URL}/api/pages/${pageId}/screenshot`,
    JSON.stringify({
      fullPage: true,
      type: 'png',
    }),
    { headers: authHeaders }
  );
  
  handleResponse(response, 'screenshot taken');

  // Simulate user think time
  sleep(Math.random() * 3 + 1); // 1-4 seconds

  // Test 7: Execute JavaScript
  response = http.post(
    `${BASE_URL}/api/pages/${pageId}/evaluate`,
    JSON.stringify({
      script: 'document.title',
    }),
    { headers: authHeaders }
  );
  
  handleResponse(response, 'script executed');

  // Test 8: Close page
  response = http.delete(
    `${BASE_URL}/api/pages/${pageId}`,
    null,
    { headers: authHeaders }
  );
  
  handleResponse(response, 'page closed');

  // Test 9: Close context
  response = http.delete(
    `${BASE_URL}/api/contexts/${contextId}`,
    null,
    { headers: authHeaders }
  );
  
  handleResponse(response, 'context closed');

  // Test 10: Close session
  response = http.delete(
    `${BASE_URL}/api/sessions/${sessionId}`,
    null,
    { headers: authHeaders }
  );
  
  handleResponse(response, 'session closed');

  // Random wait between iterations
  sleep(Math.random() * 2);
}

// Lifecycle hooks
export function setup() {
  // Verify the service is up before starting the test
  const response = http.get(`${BASE_URL}/health`);
  check(response, {
    'service is ready': (r) => r.status === 200,
  });
}

export function teardown(data) {
  // Clean up any resources if needed
  console.log('Load test completed');
}