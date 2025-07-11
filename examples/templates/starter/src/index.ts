/**
 * Puppeteer MCP Starter Template
 *
 * This is a basic template to get you started with Puppeteer MCP.
 * It includes common patterns and best practices.
 */

import { config } from './config';
import { PuppeteerMCPClient } from './client';
import { logger } from './utils/logger';
import { ExampleAutomation } from './automations/example';

async function main() {
  const client = new PuppeteerMCPClient(config);

  try {
    logger.info('Starting Puppeteer MCP application');

    // Initialize client
    await client.connect();

    // Run example automation
    const automation = new ExampleAutomation(client);
    const result = await automation.run({
      url: 'https://example.com',
      screenshotPath: './screenshots',
    });

    logger.info('Automation completed', { result });
  } catch (error) {
    logger.error('Application error', { error });
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

// Run the application
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { PuppeteerMCPClient, ExampleAutomation };
