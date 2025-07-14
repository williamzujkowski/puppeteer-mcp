import puppeteer, { Browser, LaunchOptions } from 'puppeteer';

/**
 * Launch a browser instance with CI-appropriate settings
 */
export async function launchBrowser(options?: LaunchOptions): Promise<Browser> {
  const defaultOptions: LaunchOptions = {
    headless: true,
    args: [],
  };

  // Add CI-specific args
  if (process.env.CI === 'true') {
    defaultOptions.args = [
      ...(defaultOptions.args || []),
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ];
  }

  // Merge with provided options
  const finalOptions = {
    ...defaultOptions,
    ...options,
    args: [...(defaultOptions.args || []), ...(options?.args || [])],
  };

  return puppeteer.launch(finalOptions);
}
