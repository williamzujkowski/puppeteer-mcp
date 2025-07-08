/**
 * CLI Output Utilities
 * @module cli/output
 * @description Utilities for CLI output formatting and display
 */

// Config is imported dynamically when needed to avoid side effects

/**
 * Write output to stdout (for CLI output)
 */
export function writeOutput(message: string): void {
  process.stdout.write(message);
}

/**
 * Write line to stdout with newline
 */
export function writeOutputLine(message: string): void {
  process.stdout.write(`${message}\n`);
}

/**
 * Write error to stderr
 */
export function writeError(message: string): void {
  process.stderr.write(`${message}\n`);
}

/**
 * Show version information
 */
export function showVersion(packageInfo: { name: string; version: string }): void {
  writeOutputLine(`${packageInfo.name} v${packageInfo.version}`);
  writeOutputLine(`Node.js ${process.version}`);
  writeOutputLine(`Platform: ${process.platform} ${process.arch}`);
}

/**
 * Show help information
 */
export function showHelp(packageInfo: {
  name: string;
  version: string;
  description: string;
}): void {
  writeOutput(`
${packageInfo.name} v${packageInfo.version}
${packageInfo.description}

Usage: puppeteer-mcp [command] [options]

Commands:
  start              Start the MCP server (default)
  --version, -v      Show version information
  --help, -h         Show this help message
  config --init      Initialize configuration file
  test-connection    Test database and Redis connections
  validate-config    Validate current configuration

Examples:
  puppeteer-mcp                    # Start MCP server
  puppeteer-mcp --version          # Show version
  puppeteer-mcp config --init      # Create config file
  puppeteer-mcp test-connection    # Test connections
  puppeteer-mcp validate-config    # Validate config

Environment Variables:
  NODE_ENV           Environment (development|test|production)
  PORT               HTTP server port (default: 8443)
  TLS_ENABLED        Enable TLS (default: true)
  LOG_LEVEL          Log level (trace|debug|info|warn|error|fatal)
  REDIS_URL          Redis connection URL
  JWT_SECRET         JWT signing secret (required in production)
  SESSION_SECRET     Session cookie secret

For more information, visit: https://williamzujkowski.github.io/puppeteer-mcp/
`);
}

/**
 * Show configuration creation messages
 */
export function showConfigCreated(configPath: string): void {
  writeOutputLine(`Configuration template created: ${configPath}`);
  writeOutputLine('Copy this file to .env and customize the values.');
  writeOutputLine('');
  writeOutputLine('Important: Set secure values for:');
  writeOutputLine('  - JWT_SECRET (minimum 32 characters)');
  writeOutputLine('  - SESSION_SECRET (minimum 32 characters)');
  writeOutputLine('  - TLS certificate paths if using HTTPS');
}

/**
 * Show configuration already exists message
 */
export function showConfigExists(configPath: string): void {
  writeOutputLine(`Configuration file ${configPath} already exists.`);
  writeOutputLine('Remove it first if you want to regenerate it.');
}

/**
 * Show connection test results
 */
export function showConnectionTest(
  service: string,
  status: 'OK' | 'FAILED' | 'ERROR' | 'NOT_CONFIGURED',
  error?: unknown,
): void {
  switch (status) {
    case 'OK':
      writeOutputLine(`✅ ${service}: OK`);
      break;
    case 'FAILED':
      writeOutputLine(`❌ ${service}: FAILED`);
      break;
    case 'ERROR':
      writeOutputLine(`❌ ${service}: ERROR - ${String(error)}`);
      break;
    case 'NOT_CONFIGURED':
      writeOutputLine(`ℹ️  ${service}: Not configured (using in-memory storage)`);
      break;
  }
}

/**
 * Show connection test header and footer
 */
export function showConnectionTestHeader(): void {
  writeOutputLine('Testing connections...\n');
}

export function showConnectionTestFooter(): void {
  writeOutputLine('\nConnection tests completed.');
}

/**
 * Show configuration validation results
 */
export function showConfigValidationResults(issues: string[], warnings: string[]): void {
  if (issues.length === 0 && warnings.length === 0) {
    writeOutputLine('✅ Configuration validation passed');
    return;
  }

  if (issues.length > 0) {
    writeOutputLine('❌ Configuration Issues:');
    for (const issue of issues) {
      writeOutputLine(`  - ${issue}`);
    }
  }

  if (warnings.length > 0) {
    writeOutputLine('⚠️  Configuration Warnings:');
    for (const warning of warnings) {
      writeOutputLine(`  - ${warning}`);
    }
  }
}

/**
 * Show configuration summary
 */
export async function showConfigSummary(): Promise<void> {
  const { config } = await import('../core/config.js');

  writeOutputLine('\nConfiguration Summary:');
  writeOutputLine(`  Environment: ${config.NODE_ENV}`);
  writeOutputLine(`  Port: ${config.PORT}`);
  writeOutputLine(`  TLS: ${config.TLS_ENABLED ? 'Enabled' : 'Disabled'}`);
  writeOutputLine(`  Log Level: ${config.LOG_LEVEL}`);
  writeOutputLine(
    `  Redis: ${config.REDIS_URL !== null && config.REDIS_URL !== undefined && config.REDIS_URL !== '' ? 'Configured' : 'Not configured'}`,
  );
  writeOutputLine(`  Browser Pool: ${config.BROWSER_POOL_MAX_SIZE} max browsers`);
  writeOutputLine(
    `  Rate Limiting: ${config.RATE_LIMIT_MAX_REQUESTS} requests per ${config.RATE_LIMIT_WINDOW}ms`,
  );
}

/**
 * Show configuration validation footer
 */
export function showConfigValidationFooter(hasIssues: boolean): void {
  if (hasIssues) {
    writeOutputLine('\nPlease fix the configuration issues before running in production.');
  }
}
