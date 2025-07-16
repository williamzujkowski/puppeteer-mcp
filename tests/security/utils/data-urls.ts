/**
 * Data URLs for security testing
 * Replaces external URLs to make tests more reliable and isolated
 */

export const TEST_DATA_URLS = {
  /**
   * Basic HTML page for navigation testing
   * Replaces: https://williamzujkowski.github.io/paperclips/index2.html
   */
  basicTestPage: 'data:text/html;charset=utf-8,' + encodeURIComponent(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Security Test Page</title>
    </head>
    <body>
      <div id="test-content">
        <h1>Security Test Page</h1>
        <p>This is a test page for security testing.</p>
        <input type="text" id="test-input" placeholder="Test input">
        <button id="test-button">Test Button</button>
        <div id="output"></div>
      </div>
    </body>
    </html>
  `),

  /**
   * HTML page with form for injection testing
   */
  formTestPage: 'data:text/html;charset=utf-8,' + encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head><title>Form Test Page</title></head>
    <body>
      <form id="test-form">
        <input type="text" name="username" id="username">
        <input type="password" name="password" id="password">
        <textarea name="comment" id="comment"></textarea>
        <button type="submit">Submit</button>
      </form>
      <div id="result"></div>
    </body>
    </html>
  `),

  /**
   * JavaScript file for script injection testing
   */
  maliciousScript: 'data:text/javascript;charset=utf-8,' + encodeURIComponent(`
    console.log("test-malicious-script");
    window.testMaliciousExecuted = true;
  `),

  /**
   * CSS file for style injection testing
   */
  maliciousCSS: 'data:text/css;charset=utf-8,' + encodeURIComponent(`
    body { background: red !important; }
    .test-malicious { display: none; }
  `),

  /**
   * JSON response for AJAX testing
   */
  jsonResponse: 'data:application/json;charset=utf-8,' + encodeURIComponent(`
    {"status": "success", "data": "test-data", "timestamp": "2025-01-01T00:00:00Z"}
  `),

  /**
   * JSONP response for callback testing
   */
  jsonpResponse: 'data:application/javascript;charset=utf-8,' + encodeURIComponent(`
    callback({"results": ["test1", "test2"], "status": "ok"});
  `),

  /**
   * XML response for parsing testing
   */
  xmlResponse: 'data:application/xml;charset=utf-8,' + encodeURIComponent(`
    <?xml version="1.0" encoding="UTF-8"?>
    <response>
      <status>success</status>
      <data>test-data</data>
    </response>
  `),

  /**
   * Plain text for simple content testing
   */
  plainText: 'data:text/plain;charset=utf-8,' + encodeURIComponent('Test plain text content'),

  /**
   * Redirect simulation (uses meta refresh)
   */
  redirectPage: 'data:text/html;charset=utf-8,' + encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta http-equiv="refresh" content="0;url=data:text/plain,redirected">
      <title>Redirect Test</title>
    </head>
    <body>
      <p>Redirecting...</p>
    </body>
    </html>
  `),
} as const;

/**
 * Mock domains for testing (these will not resolve)
 */
export const MOCK_DOMAINS = {
  evil: 'http://evil.test.invalid',
  malicious: 'https://malicious.test.invalid', 
  external: 'http://external.test.invalid',
  redirect: 'http://redirect.test.invalid',
} as const;

/**
 * Create a data URL for HTML content
 */
export function createHtmlDataUrl(html: string): string {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

/**
 * Create a data URL for JavaScript content
 */
export function createJsDataUrl(js: string): string {
  return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(js);
}

/**
 * Create a data URL for CSS content
 */
export function createCssDataUrl(css: string): string {
  return 'data:text/css;charset=utf-8,' + encodeURIComponent(css);
}